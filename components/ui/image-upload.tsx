"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
    value?: string
    onChange: (url: string) => void
    onClear?: () => void
    bucket?: 'organization-assets' | 'payment-proofs'
    label?: string
    placeholder?: string
    accept?: string
    maxSize?: number // in MB
    className?: string
    showPreview?: boolean
    previewHeight?: string
}

export function ImageUpload({
    value,
    onChange,
    onClear,
    bucket = 'organization-assets',
    label = "Imagen",
    placeholder = "https://ejemplo.com/imagen.png",
    accept = "image/*",
    maxSize = 5,
    className,
    showPreview = true,
    previewHeight = "max-h-24",
}: ImageUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [useUrl, setUseUrl] = useState(!value || value.startsWith('http'))
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate size
        if (file.size > maxSize * 1024 * 1024) {
            toast.error(`El archivo excede el tamaño máximo de ${maxSize}MB`)
            return
        }

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('bucket', bucket)

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Error al subir archivo')
            }

            onChange(result.data.url)
            toast.success('Imagen subida correctamente')
        } catch (error: any) {
            toast.error(error.message || 'Error al subir imagen')
        } finally {
            setUploading(false)
            if (inputRef.current) {
                inputRef.current.value = ''
            }
        }
    }

    const handleUrlChange = (url: string) => {
        onChange(url)
    }

    const handleClear = () => {
        onChange('')
        onClear?.()
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant={useUrl ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setUseUrl(true)}
                    >
                        URL
                    </Button>
                    <Button
                        type="button"
                        variant={!useUrl ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setUseUrl(false)}
                    >
                        Subir
                    </Button>
                </div>
            </div>

            {useUrl ? (
                <div className="flex gap-2">
                    <Input
                        value={value || ''}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder={placeholder}
                        className="flex-1"
                    />
                    {value && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleClear}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            ) : (
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        className="flex-1"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Subiendo...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Seleccionar archivo
                            </>
                        )}
                    </Button>
                    {value && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleClear}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            )}

            {/* Preview */}
            {showPreview && value && (
                <div className="mt-2 p-2 border rounded-lg inline-block bg-muted/50">
                    {value.match(/\.(pdf)$/i) ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ImageIcon className="w-4 h-4" />
                            <span>PDF cargado</span>
                        </div>
                    ) : (
                        <img
                            src={value}
                            alt="Preview"
                            className={cn("object-contain rounded", previewHeight)}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                            }}
                        />
                    )}
                </div>
            )}
        </div>
    )
}
