"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Trash2, 
  Type, 
  Mail, 
  Phone, 
  Hash, 
  AlignLeft,
  Calendar,
  CheckSquare,
  List,
  ChevronUp,
  ChevronDown
} from "lucide-react"
import { toast } from "sonner"

interface FormField {
  id: string
  type: string
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
}

interface WebForm {
  id?: string
  name: string
  description?: string
  fields: FormField[]
  success_message?: string
  redirect_url?: string
  auto_create_contact: boolean
  default_lead_status: string
  default_lead_source: string
  default_tags: string[]
  notify_on_submit: boolean
  notify_emails: string[]
  theme?: {
    primaryColor: string
    backgroundColor: string
  }
}

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: WebForm | null
  onSuccess: () => void
}

const FIELD_TYPES = [
  { type: 'text', label: 'Texto corto', icon: Type },
  { type: 'textarea', label: 'Texto largo', icon: AlignLeft },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Teléfono', icon: Phone },
  { type: 'number', label: 'Número', icon: Hash },
  { type: 'select', label: 'Selección', icon: List },
  { type: 'date', label: 'Fecha', icon: Calendar },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
]

const DEFAULT_FIELDS: FormField[] = [
  { id: 'name', type: 'text', label: 'Nombre', placeholder: 'Tu nombre', required: true },
  { id: 'email', type: 'email', label: 'Email', placeholder: 'tu@email.com', required: true },
  { id: 'phone', type: 'phone', label: 'Teléfono', placeholder: '+51 999 999 999', required: false },
]

export function FormDialog({ open, onOpenChange, form, onSuccess }: FormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("fields")
  
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS)
  const [successMessage, setSuccessMessage] = useState("¡Gracias! Hemos recibido tu información.")
  const [redirectUrl, setRedirectUrl] = useState("")
  const [autoCreateContact, setAutoCreateContact] = useState(true)
  const [defaultLeadStatus, setDefaultLeadStatus] = useState("warm")
  const [defaultLeadSource, setDefaultLeadSource] = useState("web_form")
  const [notifyOnSubmit, setNotifyOnSubmit] = useState(true)
  const [notifyEmails, setNotifyEmails] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#3b82f6")

  useEffect(() => {
    if (form) {
      setName(form.name)
      setDescription(form.description || "")
      setFields(form.fields || DEFAULT_FIELDS)
      setSuccessMessage(form.success_message || "¡Gracias! Hemos recibido tu información.")
      setRedirectUrl(form.redirect_url || "")
      setAutoCreateContact(form.auto_create_contact)
      setDefaultLeadStatus(form.default_lead_status || "warm")
      setDefaultLeadSource(form.default_lead_source || "web_form")
      setNotifyOnSubmit(form.notify_on_submit)
      setNotifyEmails(form.notify_emails?.join(", ") || "")
      setPrimaryColor(form.theme?.primaryColor || "#3b82f6")
    } else {
      // Reset to defaults
      setName("")
      setDescription("")
      setFields(DEFAULT_FIELDS)
      setSuccessMessage("¡Gracias! Hemos recibido tu información.")
      setRedirectUrl("")
      setAutoCreateContact(true)
      setDefaultLeadStatus("warm")
      setDefaultLeadSource("web_form")
      setNotifyOnSubmit(true)
      setNotifyEmails("")
      setPrimaryColor("#3b82f6")
    }
  }, [form, open])

  const addField = (type: string) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: FIELD_TYPES.find(f => f.type === type)?.label || 'Campo',
      placeholder: '',
      required: false,
      options: type === 'select' ? ['Opción 1', 'Opción 2'] : undefined
    }
    setFields([...fields, newField])
  }

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...updates }
    setFields(newFields)
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= fields.length) return
    
    const newFields = [...fields]
    const temp = newFields[index]
    newFields[index] = newFields[newIndex]
    newFields[newIndex] = temp
    setFields(newFields)
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido")
      return
    }
    if (fields.length === 0) {
      toast.error("Agrega al menos un campo")
      return
    }

    setLoading(true)
    try {
      const payload = {
        name,
        description,
        fields,
        success_message: successMessage,
        redirect_url: redirectUrl || null,
        auto_create_contact: autoCreateContact,
        default_lead_status: defaultLeadStatus,
        default_lead_source: defaultLeadSource,
        default_tags: [],
        notify_on_submit: notifyOnSubmit,
        notify_emails: notifyEmails.split(',').map(e => e.trim()).filter(Boolean),
        theme: { primaryColor, backgroundColor: '#ffffff' }
      }

      const url = form?.id ? `/api/forms/${form.id}` : '/api/forms'
      const method = form?.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Error al guardar')

      toast.success(form?.id ? 'Formulario actualizado' : 'Formulario creado')
      onSuccess()
    } catch (error) {
      toast.error('Error al guardar formulario')
    } finally {
      setLoading(false)
    }
  }

  const FieldIcon = ({ type }: { type: string }) => {
    const fieldType = FIELD_TYPES.find(f => f.type === type)
    const Icon = fieldType?.icon || Type
    return <Icon className="h-4 w-4" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {form?.id ? 'Editar Formulario' : 'Nuevo Formulario'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fields">Campos</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
            <TabsTrigger value="style">Estilo</TabsTrigger>
          </TabsList>

          {/* Tab: Campos */}
          <TabsContent value="fields" className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label>Nombre del formulario *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Solicitar demo"
                />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción que aparecerá en el formulario"
                  rows={2}
                />
              </div>
            </div>

            {/* Lista de campos */}
            <div className="space-y-2">
              <Label>Campos del formulario</Label>
              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveField(index, 'up')}
                          disabled={index === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveField(index, 'down')}
                          disabled={index === fields.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="flex-1 grid gap-2">
                        <div className="flex items-center gap-2">
                          <FieldIcon type={field.type} />
                          <Badge variant="outline">{FIELD_TYPES.find(f => f.type === field.type)?.label}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(index, { label: e.target.value })}
                            placeholder="Etiqueta"
                          />
                          <Input
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(index, { placeholder: e.target.value })}
                            placeholder="Placeholder"
                          />
                        </div>
                        {field.type === 'select' && (
                          <Input
                            value={field.options?.join(', ') || ''}
                            onChange={(e) => updateField(index, { 
                              options: e.target.value.split(',').map(o => o.trim()) 
                            })}
                            placeholder="Opciones separadas por coma"
                          />
                        )}
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(checked) => updateField(index, { required: checked })}
                          />
                          <Label className="text-sm">Requerido</Label>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeField(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Agregar campo */}
            <div className="flex flex-wrap gap-2">
              {FIELD_TYPES.map((fieldType) => (
                <Button
                  key={fieldType.type}
                  variant="outline"
                  size="sm"
                  onClick={() => addField(fieldType.type)}
                >
                  <fieldType.icon className="mr-1 h-3 w-3" />
                  {fieldType.label}
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* Tab: Configuración */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label>Mensaje de éxito</Label>
                <Textarea
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder="Mensaje que verá el usuario al enviar"
                  rows={2}
                />
              </div>
              <div>
                <Label>URL de redirección (opcional)</Label>
                <Input
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://tudominio.com/gracias"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Automatización de leads</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Crear contacto automáticamente</Label>
                  <p className="text-sm text-muted-foreground">
                    Crea un contacto en el CRM con los datos del formulario
                  </p>
                </div>
                <Switch
                  checked={autoCreateContact}
                  onCheckedChange={setAutoCreateContact}
                />
              </div>

              {autoCreateContact && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
                  <div>
                    <Label>Estado inicial del lead</Label>
                    <Select value={defaultLeadStatus} onValueChange={setDefaultLeadStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cold">Frío</SelectItem>
                        <SelectItem value="warm">Tibio</SelectItem>
                        <SelectItem value="hot">Caliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fuente del lead</Label>
                    <Input
                      value={defaultLeadSource}
                      onChange={(e) => setDefaultLeadSource(e.target.value)}
                      placeholder="web_form"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Notificaciones</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Notificar al recibir envío</Label>
                  <p className="text-sm text-muted-foreground">
                    Envía un email cuando alguien complete el formulario
                  </p>
                </div>
                <Switch
                  checked={notifyOnSubmit}
                  onCheckedChange={setNotifyOnSubmit}
                />
              </div>

              {notifyOnSubmit && (
                <div>
                  <Label>Emails a notificar</Label>
                  <Input
                    value={notifyEmails}
                    onChange={(e) => setNotifyEmails(e.target.value)}
                    placeholder="email1@empresa.com, email2@empresa.com"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separa múltiples emails con coma
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Estilo */}
          <TabsContent value="style" className="space-y-4">
            <div>
              <Label>Color principal</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-sm text-muted-foreground mb-2">Vista previa:</p>
              <div className="bg-white p-4 rounded border max-w-sm">
                <h3 className="font-semibold mb-2">{name || 'Nombre del formulario'}</h3>
                {description && <p className="text-sm text-gray-600 mb-4">{description}</p>}
                {fields.slice(0, 2).map((field) => (
                  <div key={field.id} className="mb-3">
                    <label className="text-sm font-medium">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      className="w-full mt-1 px-3 py-2 border rounded text-sm"
                      disabled
                    />
                  </div>
                ))}
                {fields.length > 2 && (
                  <p className="text-xs text-gray-400">+{fields.length - 2} campos más...</p>
                )}
                <button
                  className="w-full mt-3 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: primaryColor }}
                  disabled
                >
                  Enviar
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : (form?.id ? 'Guardar cambios' : 'Crear formulario')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
