"use client"

import type { WebFormDialogData } from "@/components/forms/form-dialog/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import { useFormContext } from "react-hook-form"

export function FormDialogStyleTab() {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WebFormDialogData>()

  const watchedName = watch("name")
  const watchedDescription = watch("description")
  const watchedFields = watch("fields")
  const watchedPrimaryColor = watch("theme.primaryColor")

  return (
    <TabsContent value="style" className="space-y-4">
      <div>
        <Label>Color principal</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={watchedPrimaryColor || "#3b82f6"}
            onChange={(e) => setValue("theme.primaryColor", e.target.value, { shouldValidate: true })}
            className="w-10 h-10 rounded cursor-pointer"
          />
          <Input
            value={watchedPrimaryColor || ""}
            onChange={(e) => setValue("theme.primaryColor", e.target.value, { shouldValidate: true })}
            className="w-32"
          />
        </div>
        {errors.theme?.primaryColor?.message && (
          <p className="text-destructive text-sm">{String(errors.theme.primaryColor.message)}</p>
        )}
      </div>

      <div className="border rounded-lg p-4 bg-gray-50">
        <p className="text-sm text-muted-foreground mb-2">Vista previa:</p>
        <div className="bg-white p-4 rounded border max-w-sm">
          <h3 className="font-semibold mb-2">{watchedName || "Nombre del formulario"}</h3>
          {watchedDescription && <p className="text-sm text-gray-600 mb-4">{watchedDescription}</p>}
          {(watchedFields || []).slice(0, 2).map((field, idx) => (
            <div key={String((field as any)?.id || idx)} className="mb-3">
              <label className="text-sm font-medium">
                {(field as any)?.label} {(field as any)?.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                placeholder={(field as any)?.placeholder || ""}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
                disabled
              />
            </div>
          ))}
          {(watchedFields || []).length > 2 && (
            <p className="text-xs text-gray-400">+{(watchedFields || []).length - 2} campos más...</p>
          )}
          <button
            className="w-full mt-3 py-2 rounded text-white text-sm font-medium"
            style={{ backgroundColor: watchedPrimaryColor || "#3b82f6" }}
            disabled
          >
            Enviar
          </button>
        </div>
      </div>
    </TabsContent>
  )
}

