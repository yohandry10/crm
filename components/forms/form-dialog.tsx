"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Form } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { webFormDialogSchema } from "@/lib/schemas"
import { z } from "zod"
import { DEFAULT_FIELDS } from "@/components/forms/form-dialog/constants"
import { FormDialogFieldsTab } from "@/components/forms/form-dialog/form-dialog-fields-tab"
import { FormDialogSettingsTab } from "@/components/forms/form-dialog/form-dialog-settings-tab"
import { FormDialogStyleTab } from "@/components/forms/form-dialog/form-dialog-style-tab"
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

type WebFormDialogData = z.infer<typeof webFormDialogSchema>

export function FormDialog({ open, onOpenChange, form, onSuccess }: FormDialogProps) {
  const [activeTab, setActiveTab] = useState("fields")

  const defaultValues = useMemo<WebFormDialogData>(() => {
    if (form) {
      return {
        name: form.name || "",
        description: form.description || "",
        fields: (form.fields || DEFAULT_FIELDS) as unknown as WebFormDialogData["fields"],
        success_message: form.success_message || "¡Gracias! Hemos recibido tu información.",
        redirect_url: form.redirect_url || "",
        auto_create_contact: form.auto_create_contact ?? true,
        default_lead_status: (form.default_lead_status || "warm") as WebFormDialogData["default_lead_status"],
        default_lead_source: form.default_lead_source || "web_form",
        notify_on_submit: form.notify_on_submit ?? true,
        notify_emails: (form.notify_emails || []).join(", "),
        theme: {
          primaryColor: form.theme?.primaryColor || "#3b82f6",
          backgroundColor: form.theme?.backgroundColor || "#ffffff",
        },
      }
    }

    return {
      name: "",
      description: "",
      fields: DEFAULT_FIELDS as unknown as WebFormDialogData["fields"],
      success_message: "¡Gracias! Hemos recibido tu información.",
      redirect_url: "",
      auto_create_contact: true,
      default_lead_status: "warm",
      default_lead_source: "web_form",
      notify_on_submit: true,
      notify_emails: "",
      theme: { primaryColor: "#3b82f6", backgroundColor: "#ffffff" },
    }
  }, [form])

  const formMethods = useForm<WebFormDialogData>({
    resolver: zodResolver(webFormDialogSchema),
    defaultValues,
    mode: "onChange",
  })

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = formMethods

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, open, reset])

  const onSubmit = async (data: WebFormDialogData) => {
    try {
      const notifyEmailsArray = (data.notify_emails || "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)

      const payload = {
        name: data.name,
        description: data.description || "",
        fields: data.fields,
        success_message: data.success_message || "¡Gracias! Hemos recibido tu información.",
        redirect_url: data.redirect_url?.trim() ? data.redirect_url.trim() : null,
        auto_create_contact: data.auto_create_contact,
        default_lead_status: data.default_lead_status,
        default_lead_source: data.default_lead_source,
        default_tags: [],
        notify_on_submit: data.notify_on_submit,
        notify_emails: notifyEmailsArray,
        theme: {
          primaryColor: data.theme.primaryColor,
          backgroundColor: data.theme.backgroundColor || "#ffffff",
        },
      }

      const url = form?.id ? `/api/forms/${form.id}` : "/api/forms"
      const method = form?.id ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Error al guardar")

      toast.success(form?.id ? "Formulario actualizado" : "Formulario creado")
      onSuccess()
    } catch {
      toast.error("Error al guardar formulario")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form ? "Editar Formulario" : "Crear Nuevo Formulario"}</DialogTitle>
        </DialogHeader>

        <Form {...formMethods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="fields">Campos</TabsTrigger>
                <TabsTrigger value="settings">Configuración</TabsTrigger>
                <TabsTrigger value="style">Estilo</TabsTrigger>
              </TabsList>

              <FormDialogFieldsTab />
              <FormDialogSettingsTab />
              <FormDialogStyleTab />
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : form?.id ? "Guardar cambios" : "Crear formulario"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

