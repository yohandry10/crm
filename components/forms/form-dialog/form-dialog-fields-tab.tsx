"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { FIELD_TYPES } from "@/components/forms/form-dialog/constants"
import type { WebFormDialogData } from "@/components/forms/form-dialog/types"
import { Controller, useFieldArray, useFormContext } from "react-hook-form"
import { ChevronDown, ChevronUp, Trash2, Type } from "lucide-react"

function FieldIcon({ type }: { type: string }) {
  const fieldType = FIELD_TYPES.find((f) => f.type === type)
  const Icon = fieldType?.icon || Type
  return <Icon className="h-4 w-4" />
}

export function FormDialogFieldsTab() {
  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useFormContext<WebFormDialogData>()

  const fieldsArray = useFieldArray({
    control,
    name: "fields",
  })

  const addField = (type: string) => {
    fieldsArray.append({
      id: `field_${Date.now()}`,
      type,
      label: FIELD_TYPES.find((f) => f.type === type)?.label || "Campo",
      placeholder: "",
      required: false,
      options: type === "select" ? ["Opción 1", "Opción 2"] : undefined,
    } as any)
  }

  const moveField = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= fieldsArray.fields.length) return
    fieldsArray.move(index, newIndex)
  }

  return (
    <TabsContent value="fields" className="space-y-4">
      <div className="grid gap-4">
        <div className="space-y-1">
          <Label>Nombre del formulario *</Label>
          <Input placeholder="Ej: Solicitar demo" {...register("name")} />
          {errors.name?.message && <p className="text-destructive text-sm">{String(errors.name.message)}</p>}
        </div>

        <div className="space-y-1">
          <Label>Descripción (opcional)</Label>
          <Textarea placeholder="Descripción que aparecerá en el formulario" rows={2} {...register("description")} />
          {errors.description?.message && (
            <p className="text-destructive text-sm">{String(errors.description.message)}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Campos del formulario</Label>

        {fieldsArray.fields.map((field, index) => {
          const fieldType = String(getValues(`fields.${index}.type`) || (field as any).type)
          return (
            <Card key={field.id}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveField(index, "up")}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveField(index, "down")}
                      disabled={index === fieldsArray.fields.length - 1}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex-1 grid gap-2">
                    <div className="flex items-center gap-2">
                      <FieldIcon type={fieldType} />
                      <Badge variant="outline">{FIELD_TYPES.find((f) => f.type === fieldType)?.label}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Input placeholder="Etiqueta" {...register(`fields.${index}.label` as const)} />
                        {errors.fields?.[index]?.label?.message && (
                          <p className="text-destructive text-sm">{String(errors.fields[index]?.label?.message)}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Input placeholder="Placeholder" {...register(`fields.${index}.placeholder` as const)} />
                        {errors.fields?.[index]?.placeholder?.message && (
                          <p className="text-destructive text-sm">
                            {String(errors.fields[index]?.placeholder?.message)}
                          </p>
                        )}
                      </div>
                    </div>

                    {fieldType === "select" && (
                      <div className="space-y-1">
                        <Controller
                          control={control}
                          name={`fields.${index}.options` as const}
                          render={({ field: optionsField }) => (
                            <Input
                              value={(optionsField.value || []).join(", ")}
                              onChange={(e) => {
                                const next = e.target.value
                                  .split(",")
                                  .map((o) => o.trim())
                                  .filter(Boolean)
                                optionsField.onChange(next)
                              }}
                              placeholder="Opciones separadas por coma"
                            />
                          )}
                        />
                        {errors.fields?.[index]?.options?.message && (
                          <p className="text-destructive text-sm">{String(errors.fields[index]?.options?.message)}</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Controller
                        control={control}
                        name={`fields.${index}.required` as const}
                        render={({ field: requiredField }) => (
                          <Switch
                            checked={!!requiredField.value}
                            onCheckedChange={(checked) => requiredField.onChange(checked)}
                          />
                        )}
                      />
                      <Label className="text-sm">Requerido</Label>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => fieldsArray.remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {errors.fields?.message && <p className="text-destructive text-sm">{String(errors.fields.message)}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {FIELD_TYPES.map((fieldType) => (
          <Button
            type="button"
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
  )
}

