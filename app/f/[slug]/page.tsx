"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"

interface FormField {
  id: string
  type: string
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
}

interface WebForm {
  id: string
  name: string
  description?: string
  fields: FormField[]
  theme?: {
    primaryColor: string
    backgroundColor: string
  }
  success_message: string
  redirect_url?: string
}

export default function PublicFormPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug as string
  const isEmbed = searchParams?.get('embed') === 'true'

  const [form, setForm] = useState<WebForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const fetchForm = async () => {
    try {
      const res = await fetch(`/api/public/forms/${slug}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Formulario no encontrado')
        } else {
          setError('Error al cargar el formulario')
        }
        return
      }
      const data = await res.json()
      setForm(data)
      
      // Inicializar formData con valores vacíos
      const initialData: Record<string, any> = {}
      data.fields.forEach((field: FormField) => {
        initialData[field.id] = field.type === 'checkbox' ? false : ''
      })
      setFormData(initialData)
    } catch (err) {
      setError('Error al cargar el formulario')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    // Limpiar error del campo
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    form?.fields.forEach(field => {
      const value = formData[field.id]
      
      if (field.required) {
        if (field.type === 'checkbox' && !value) {
          errors[field.id] = 'Este campo es requerido'
        } else if (field.type !== 'checkbox' && (!value || value.toString().trim() === '')) {
          errors[field.id] = 'Este campo es requerido'
        }
      }
      
      // Validación de email
      if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
          errors[field.id] = 'Email inválido'
        }
      }
      
      // Validación de teléfono
      if (field.type === 'phone' && value) {
        const phoneRegex = /^[\d\s\-\+\(\)]{7,20}$/
        if (!phoneRegex.test(value)) {
          errors[field.id] = 'Teléfono inválido'
        }
      }
    })
    
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setSubmitting(true)
    setError(null)

    try {
      // Obtener UTM params
      const utm_source = searchParams?.get('utm_source') || undefined
      const utm_medium = searchParams?.get('utm_medium') || undefined
      const utm_campaign = searchParams?.get('utm_campaign') || undefined

      const res = await fetch(`/api/public/forms/${form?.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: formData,
          utm_source,
          utm_medium,
          utm_campaign
        })
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Error al enviar')
        if (result.field) {
          setFieldErrors({ [result.field]: result.error })
        }
        return
      }

      setSubmitted(true)

      // Notificar al padre (para resize de iframe)
      if (isEmbed && window.parent) {
        window.parent.postMessage({
          type: 'crm-form-resize',
          formId: form?.id,
          height: document.body.scrollHeight
        }, '*')
      }

      // Redirigir si hay URL configurada
      if (result.redirect_url) {
        setTimeout(() => {
          if (isEmbed && window.parent) {
            window.parent.location.href = result.redirect_url
          } else {
            window.location.href = result.redirect_url
          }
        }, 2000)
      }

    } catch (err) {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // Notificar altura al padre para auto-resize
  useEffect(() => {
    if (isEmbed && window.parent && form) {
      const sendHeight = () => {
        window.parent.postMessage({
          type: 'crm-form-resize',
          formId: form.id,
          height: document.body.scrollHeight
        }, '*')
      }
      sendHeight()
      window.addEventListener('resize', sendHeight)
      return () => window.removeEventListener('resize', sendHeight)
    }
  }, [isEmbed, form])

  const primaryColor = form?.theme?.primaryColor || '#3b82f6'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isEmbed ? 'bg-white' : 'bg-gray-50'}`}>
        <div className="text-center p-8 max-w-md">
          <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: primaryColor }} />
          <h2 className="text-xl font-semibold mb-2">¡Enviado!</h2>
          <p className="text-gray-600">{form?.success_message}</p>
          {form?.redirect_url && (
            <p className="text-sm text-gray-400 mt-4">Redirigiendo...</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isEmbed ? 'bg-white p-4' : 'bg-gray-50 py-12 px-4'}`}>
      <div className={`mx-auto ${isEmbed ? 'max-w-full' : 'max-w-md'}`}>
        <div className={`bg-white ${isEmbed ? '' : 'rounded-lg shadow-lg p-8'}`}>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{form?.name}</h1>
            {form?.description && (
              <p className="mt-2 text-gray-600">{form.description}</p>
            )}
          </div>

          {/* Error general */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {form?.fields.map((field) => (
              <div key={field.id}>
                <Label htmlFor={field.id} className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                
                {field.type === 'text' && (
                  <Input
                    id={field.id}
                    type="text"
                    placeholder={field.placeholder}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={fieldErrors[field.id] ? 'border-red-500' : ''}
                  />
                )}

                {field.type === 'email' && (
                  <Input
                    id={field.id}
                    type="email"
                    placeholder={field.placeholder || 'tu@email.com'}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={fieldErrors[field.id] ? 'border-red-500' : ''}
                  />
                )}

                {field.type === 'phone' && (
                  <Input
                    id={field.id}
                    type="tel"
                    placeholder={field.placeholder || '+51 999 999 999'}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={fieldErrors[field.id] ? 'border-red-500' : ''}
                  />
                )}

                {field.type === 'number' && (
                  <Input
                    id={field.id}
                    type="number"
                    placeholder={field.placeholder}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={fieldErrors[field.id] ? 'border-red-500' : ''}
                  />
                )}

                {field.type === 'textarea' && (
                  <Textarea
                    id={field.id}
                    placeholder={field.placeholder}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    rows={4}
                    className={fieldErrors[field.id] ? 'border-red-500' : ''}
                  />
                )}

                {field.type === 'date' && (
                  <Input
                    id={field.id}
                    type="date"
                    value={formData[field.id] || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={fieldErrors[field.id] ? 'border-red-500' : ''}
                  />
                )}

                {field.type === 'select' && (
                  <Select
                    value={formData[field.id] || ''}
                    onValueChange={(value) => handleChange(field.id, value)}
                  >
                    <SelectTrigger className={fieldErrors[field.id] ? 'border-red-500' : ''}>
                      <SelectValue placeholder={field.placeholder || 'Selecciona...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {field.type === 'checkbox' && (
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id={field.id}
                      checked={formData[field.id] || false}
                      onCheckedChange={(checked) => handleChange(field.id, checked)}
                    />
                    <label htmlFor={field.id} className="text-sm text-gray-600">
                      {field.placeholder || field.label}
                    </label>
                  </div>
                )}

                {fieldErrors[field.id] && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors[field.id]}</p>
                )}
              </div>
            ))}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar'
              )}
            </Button>
          </form>

          {/* Footer */}
          {!isEmbed && (
            <p className="mt-6 text-center text-xs text-gray-400">
              Formulario seguro
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
