"use client"

import type { WebFormDialogData } from "@/components/forms/form-dialog/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Controller, useFormContext } from "react-hook-form"

export function FormDialogSettingsTab() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<WebFormDialogData>()

  const watchedAutoCreateContact = watch("auto_create_contact")
  const watchedNotifyOnSubmit = watch("notify_on_submit")

  return (
    <TabsContent value="settings" className="space-y-4">
      <div className="grid gap-4">
        <div className="space-y-1">
          <Label>Mensaje de éxito</Label>
          <Textarea placeholder="Mensaje que verá el usuario al enviar" rows={2} {...register("success_message")} />
          {errors.success_message?.message && (
            <p className="text-destructive text-sm">{String(errors.success_message.message)}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>URL de redirección (opcional)</Label>
          <Input placeholder="https://tudominio.com/gracias" {...register("redirect_url")} />
          {errors.redirect_url?.message && <p className="text-destructive text-sm">{String(errors.redirect_url.message)}</p>}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="font-medium">Automatización de leads</h4>

        <div className="flex items-center justify-between">
          <div>
            <Label>Crear contacto automáticamente</Label>
            <p className="text-sm text-muted-foreground">Crear un nuevo contacto cuando se envíe el formulario</p>
          </div>
          <Controller
            control={control}
            name="auto_create_contact"
            render={({ field }) => (
              <Switch checked={!!field.value} onCheckedChange={(checked) => field.onChange(checked)} />
            )}
          />
        </div>

        {watchedAutoCreateContact && (
          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2">
            <div className="space-y-1">
              <Label>Estado inicial del lead</Label>
              <Controller
                control={control}
                name="default_lead_status"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cold">Frío</SelectItem>
                      <SelectItem value="warm">Tibio</SelectItem>
                      <SelectItem value="hot">Caliente</SelectItem>
                      <SelectItem value="converted">Convertido</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.default_lead_status?.message && (
                <p className="text-destructive text-sm">{String(errors.default_lead_status.message)}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Fuente del lead</Label>
              <Input placeholder="web_form" {...register("default_lead_source")} />
              {errors.default_lead_source?.message && (
                <p className="text-destructive text-sm">{String(errors.default_lead_source.message)}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="font-medium">Notificaciones</h4>

        <div className="flex items-center justify-between">
          <div>
            <Label>Notificar al recibir envío</Label>
            <p className="text-sm text-muted-foreground">Envía un email cuando alguien complete el formulario</p>
          </div>
          <Controller
            control={control}
            name="notify_on_submit"
            render={({ field }) => (
              <Switch checked={!!field.value} onCheckedChange={(checked) => field.onChange(checked)} />
            )}
          />
        </div>

        {watchedNotifyOnSubmit && (
          <div className="space-y-1">
            <Label>Emails a notificar</Label>
            <Input placeholder="email1@empresa.com, email2@empresa.com" {...register("notify_emails")} />
            <p className="text-xs text-muted-foreground mt-1">Separa múltiples emails con coma</p>
            {errors.notify_emails?.message && (
              <p className="text-destructive text-sm">{String(errors.notify_emails.message)}</p>
            )}
          </div>
        )}
      </div>
    </TabsContent>
  )
}

