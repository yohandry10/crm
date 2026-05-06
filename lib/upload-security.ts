import { ValidationError } from "@/lib/error-handler"

const SAFE_PATH_SEGMENT_RE = /^[a-zA-Z0-9._-]+$/

export function sanitizeStoragePath(input: string | null | undefined): string | null {
  if (!input) return null

  const segments = input
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length === 0) return null
  if (segments.length > 5) throw new ValidationError("Ruta de archivo demasiado profunda")

  for (const segment of segments) {
    if (
      segment === "." ||
      segment === ".." ||
      segment.length > 80 ||
      !SAFE_PATH_SEGMENT_RE.test(segment)
    ) {
      throw new ValidationError("Ruta de archivo inválida")
    }
  }

  return segments.join("/")
}

export function assertStoragePathWithinPrefix(path: string, prefix: string) {
  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`
  if (path !== prefix && !path.startsWith(normalizedPrefix)) {
    throw new ValidationError("Archivo fuera del alcance permitido")
  }
}

export function getSafeFileExtension(fileName: string, mimeType: string) {
  const originalExtension = fileName.split(".").pop()?.toLowerCase() || ""
  const allowedByMime: Record<string, string[]> = {
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/gif": ["gif"],
    "image/webp": ["webp"],
    "application/pdf": ["pdf"],
  }

  const allowedExtensions = allowedByMime[mimeType] || []
  if (!allowedExtensions.includes(originalExtension)) {
    return allowedExtensions[0] || "bin"
  }

  return originalExtension
}

export function assertMagicBytes(bytes: Uint8Array, mimeType: string) {
  const startsWith = (signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte)

  if (mimeType === "image/png" && !startsWith([0x89, 0x50, 0x4e, 0x47])) {
    throw new ValidationError("Contenido PNG inválido")
  }

  if (mimeType === "image/jpeg" && !startsWith([0xff, 0xd8, 0xff])) {
    throw new ValidationError("Contenido JPEG inválido")
  }

  if (mimeType === "image/gif" && !startsWith([0x47, 0x49, 0x46])) {
    throw new ValidationError("Contenido GIF inválido")
  }

  if (mimeType === "image/webp" && !(startsWith([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)) {
    throw new ValidationError("Contenido WebP inválido")
  }

  if (mimeType === "application/pdf" && !startsWith([0x25, 0x50, 0x44, 0x46])) {
    throw new ValidationError("Contenido PDF inválido")
  }
}
