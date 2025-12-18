"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { DEFAULT_STAGES } from "./kanban-board"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createOpportunitySchema, updateOpportunitySchema } from "@/lib/schemas"
import type { z } from "zod"

type OpportunityFormData = z.infer<typeof createOpportunitySchema>

interface OpportunityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunity?: any
  onSuccess: () => void
}

export function OpportunityDialog({
  open,
  onOpenChange,
  opportunity,
  onSuccess,
}: OpportunityDialogProps) {
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<OpportunityFormData>({
    resolver: zodResolver(opportunity ? updateOpportunitySchema : createOpportunitySchema),
    defaultValues: {
      name: "",
      expected_revenue: 0,
      stage_id: "",
      probability: 50,
      contact_id: "",
      expected_close_date: "",
      description: "",
    }
  })

  const watchedStageId = watch("stage_id")

  useEffect(() => {
    if (open) {
      fetchContacts()
      if (opportunity) {
        reset({
          name: opportunity.name || "",
          expected_revenue: opportunity.expected_revenue || 0,
          stage_id: opportunity.stage_id || "",
          probability: opportunity.probability || 50,
          contact_id: opportunity.contact_id || "",
          expected_close_date: opportunity.expected_close_date?.split("T")[0] || "",
          description: opportunity.description || "",
        })
      } else {
        reset({
          name: "",
          expected_revenue: 0,
          stage_id: "",
          probability: 50,
          contact_id: "",
          expected_close_date: "",
          description: "",
        })
      }
    }
  }, [open, opportunity, reset])

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/contacts?limit=100")
      if (res.ok) {
        const data = await res.json()
        setContacts(data.data || [])
      }
    } catch (error) {
      console.error(error)
    }
  }

  const onSubmit = async (data: OpportunityFormData) => {
    setLoading(true)

    try {
      const url = opportunity
        ? `/api/opportunities/${opportunity.id}`
        : "/api/opportunities"
      const method = opportunity ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          expected_revenue: data.expected_revenue || 0,
          stage_id: data.stage_id || null,
          probability: data.probability || 50,
          contact_id: data.contact_id || null,
          expected_close_date: data.expected_close_date || null,
          description: data.description || null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to save")
      }

      toast.success(opportunity ? "Oportunidad actualizada" : "Oportunidad creada")
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || "Error al guardar")
    } finally {
      setLoading(false)
    }
  }

  const handleStageChange = (stage_id: string) => {
    const stageData = DEFAULT_STAGES.find(s => s.id === stage_id)
    setValue("stage_id", stage_id)
    if (stageData) {
      setValue("probability", stageData.probability)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {opportunity ? "Editar Oportunidad" : "Nueva Oportunidad"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Ej: Proyecto Website Empresa X"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expected_revenue">Valor (S/)</Label>
              <Input
                id="expected_revenue"
                type="number"
                step="0.01"
                {...register("expected_revenue", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.expected_revenue && (
                <p className="text-sm text-red-500">{errors.expected_revenue.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="probability">Probabilidad (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                {...register("probability", { valueAsNumber: true })}
              />
              {errors.probability && (
                <p className="text-sm text-red-500">{errors.probability.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={watchedStageId || ""} onValueChange={handleStageChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar etapa" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_STAGES.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.stage_id && (
                <p className="text-sm text-red-500">{errors.stage_id.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_close_date">Fecha cierre esperada</Label>
              <Input
                id="expected_close_date"
                type="date"
                {...register("expected_close_date")}
              />
              {errors.expected_close_date && (
                <p className="text-sm text-red-500">{errors.expected_close_date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contacto *</Label>
            <Select
              value={watch("contact_id") || ""}
              onValueChange={(v) => setValue("contact_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar contacto" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name} {contact.company ? `(${contact.company})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.contact_id && (
              <p className="text-sm text-red-500">{errors.contact_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notas</Label>
            <Textarea
              id="description"
              {...register("description")}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {opportunity ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
