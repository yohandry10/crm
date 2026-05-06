import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { validateFormDataContentType } from "@/lib/validate-content-type"
import {
    assertMagicBytes,
    assertStoragePathWithinPrefix,
    getSafeFileExtension,
    sanitizeStoragePath,
} from "@/lib/upload-security"
import crypto from "crypto"

// Allowed buckets and their configurations
const BUCKET_CONFIG = {
    'organization-assets': {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        public: true,
    },
    'payment-proofs': {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'],
        public: false,
    },
} as const

type BucketType = keyof typeof BUCKET_CONFIG

export async function POST(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const contentTypeError = validateFormDataContentType(request)
        if (contentTypeError) return contentTypeError

        const { supabase, user, organizationId } = await getAuthenticatedContext()

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const bucket = formData.get('bucket') as string | null
        const customPath = formData.get('path') as string | null

        // Validate inputs
        if (!file) {
            throw new ValidationError("No se proporcionó un archivo")
        }

        if (!bucket || !(bucket in BUCKET_CONFIG)) {
            throw new ValidationError(`Bucket inválido. Permitidos: ${Object.keys(BUCKET_CONFIG).join(', ')}`)
        }

        const bucketConfig = BUCKET_CONFIG[bucket as BucketType]
        const safeCustomPath = sanitizeStoragePath(customPath)

        // Validate file size
        if (file.size > bucketConfig.maxSize) {
            throw new ValidationError(`El archivo excede el tamaño máximo de ${bucketConfig.maxSize / (1024 * 1024)}MB`)
        }

        // Validate file type
        if (!bucketConfig.allowedTypes.includes(file.type as any)) {
            throw new ValidationError(`Tipo de archivo no permitido. Permitidos: ${bucketConfig.allowedTypes.join(', ')}`)
        }

        // Convert File to ArrayBuffer for upload
        const arrayBuffer = await file.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)
        assertMagicBytes(buffer, file.type)

        // Generate unique filename
        const fileExt = getSafeFileExtension(file.name, file.type)
        const timestamp = Date.now()
        const uniqueId = crypto.randomBytes(8).toString('hex')
        const fileName = `${timestamp}-${uniqueId}.${fileExt}`

        // Build path based on bucket type
        let filePath: string
        if (bucket === 'organization-assets') {
            // User-based folder for organization assets
            filePath = safeCustomPath ? `${user.id}/${safeCustomPath}/${fileName}` : `${user.id}/${fileName}`
        } else {
            // Organization-based folder for payment proofs
            filePath = safeCustomPath ? `${organizationId}/${safeCustomPath}/${fileName}` : `${organizationId}/${fileName}`
        }

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false,
            })

        if (error) throw error

        // Get public URL for public buckets
        let publicUrl: string | null = null
        if (bucketConfig.public) {
            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path)
            publicUrl = urlData.publicUrl
        } else {
            // For private buckets, create a signed URL (valid for 1 hour)
            const { data: signedData, error: signedError } = await supabase.storage
                .from(bucket)
                .createSignedUrl(data.path, 3600)
            if (!signedError && signedData) {
                publicUrl = signedData.signedUrl
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                path: data.path,
                fullPath: `${bucket}/${data.path}`,
                url: publicUrl,
                bucket,
                size: file.size,
                type: file.type,
            }
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/upload",
            method: "POST",
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

// GET: List files in a bucket path
export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const bucket = searchParams.get('bucket')
        const path = searchParams.get('path') || ''

        if (!bucket || !(bucket in BUCKET_CONFIG)) {
            throw new ValidationError(`Bucket inválido`)
        }

        const basePrefix = bucket === "organization-assets" ? user.id : organizationId
        const safePath = sanitizeStoragePath(path)
        const listPath = safePath ? `${basePrefix}/${safePath}` : basePrefix
        assertStoragePathWithinPrefix(listPath, basePrefix)

        // List files in the path
        const { data, error } = await supabase.storage
            .from(bucket)
            .list(listPath, {
                limit: 100,
                sortBy: { column: 'created_at', order: 'desc' }
            })

        if (error) throw error

        return NextResponse.json({ success: true, data })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/upload",
            method: "GET",
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

// DELETE: Remove a file from storage
export async function DELETE(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()

        const { bucket, path } = await request.json()

        if (!bucket || !(bucket in BUCKET_CONFIG)) {
            throw new ValidationError(`Bucket inválido`)
        }

        if (!path || typeof path !== "string") {
            throw new ValidationError(`Path requerido`)
        }

        const safePath = sanitizeStoragePath(path)
        if (!safePath || safePath !== path) {
            throw new ValidationError("Path inválido")
        }

        const basePrefix = bucket === "organization-assets" ? user.id : organizationId
        assertStoragePathWithinPrefix(safePath, basePrefix)

        const { error } = await supabase.storage
            .from(bucket)
            .remove([safePath])

        if (error) throw error

        return NextResponse.json({ success: true, message: "Archivo eliminado" })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/upload",
            method: "DELETE",
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
