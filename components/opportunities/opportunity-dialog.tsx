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
  const [formData, setFormData] = useState({
    name: "",
    value: "",
    stage_id: "",
    probability: "10",
    contact_id: "",
    expected_close_date: "",
    notes: "",
  })

  useEffect(() => {
    if (open) {
      fetchContacts()
      if (opportunity) {
        setFormData({
          name: opportunity.name || "",
          value: opportunity.value?.toString() || "",
          stage_id: opportunity.stage_id || "",
          probability: opportunity.probability?.toString() || "10",
          contact_id: opportunity.contact_id || "",
          expected_close_date: opportunity.expected_close_date?.split("T")[0] || "",
          notes: opportunity.notes || "",
        })
      } else {
        setFormData({
          name: "",
          value: "",
          stage_id: "",
          probability: "10",
          contact_id: "",
          expected_close_date: "",
          notes: "",
        })
      }
    }
  }, [open, opportunity])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
          name: formData.name,
          expected_revenue: parseFloat(formData.value) || 0,
          stage_id: formData.stage_id || null,
          probability: parseInt(formData.probability) || 10,
          contact_id: formData.contact_id || null,
          expected_close_date: formData.expected_close_date || null,
          description: formData.notes || null,
        }),
      })

      if (!res.ok) throw new Error("Failed to save")

      toast.success(opportunity ? "Oportunidad actualizada" : "Oportunidad creada")
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      toast.error("Error al guardar")
    } finally {
      setLoading(false)
    }
  }

  const handleStageChange = (stage_id: string) => {
    const stageData = DEFAULT_STAGES.find(s => s.id === stage_id)
    setFormData({
      ...formData,
      stage_id,
      probability: stageData?.probability.toString() || formData.probability,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {opportunity ? "Editar Oportunidad" : "Nueva Oportunidad"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Proyecto Website Empresa X"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Valor (S/)</Label>
              <Input
                id="value"
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probability">Probabilidad (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={formData.probability}
                onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={formData.stage_id} onValueChange={handleStageChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_STAGES.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_close_date">Fecha cierre esperada</Label>
              <Input
                id="expected_close_date"
                type="date"
                value={formData.expected_close_date}
                onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contacto</Label>
            <Select
              value={formData.contact_id}
              onValueChange={(v) => setFormData({ ...formData, contact_id: v })}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
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
