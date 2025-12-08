"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, UserCheck, Building2, Target } from "lucide-react"
import { toast } from "sonner"

interface ConvertLeadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    lead: {
        id: string
        name: string
        email: string
        company?: string
        lead_status: string
    } | null
    onSuccess: () => void
}

export function ConvertLeadDialog({
    open,
    onOpenChange,
    lead,
    onSuccess,
}: ConvertLeadDialogProps) {
    const [loading, setLoading] = useState(false)
    const [createAccount, setCreateAccount] = useState(true)
    const [createOpportunity, setCreateOpportunity] = useState(true)
    const [opportunityName, setOpportunityName] = useState("")
    const [expectedRevenue, setExpectedRevenue] = useState("")

    const handleConvert = async () => {
        if (!lead) return

        setLoading(true)
        try {
            const res = await fetch(`/api/contacts/${lead.id}/convert`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    create_account: createAccount && !!lead.company,
                    create_opportunity: createOpportunity,
                    opportunity_name: opportunityName || `Oportunidad - ${lead.name}`,
                    expected_revenue: expectedRevenue ? parseFloat(expectedRevenue) : 0,
                }),
            })

            const data = await res.json()

            if (data.success) {
                toast.success("Lead convertido exitosamente")
                if (data.data.account) {
                    toast.info(`Cuenta creada: ${data.data.account.name || lead.company}`)
                }
                if (data.data.opportunity) {
                    toast.info("Oportunidad creada en el pipeline")
                }
                onOpenChange(false)
                onSuccess()
            } else {
                toast.error(data.error || "Error al convertir lead")
            }
        } catch (error) {
            toast.error("Error al convertir lead")
        } finally {
            setLoading(false)
        }
    }

    if (!lead) return null

    const canConvert = lead.lead_status !== "converted" && lead.lead_status !== "lost"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-green-600" />
                        Convertir Lead a Cliente
                    </DialogTitle>
                    <DialogDescription>
                        Convierte a <strong>{lead.name}</strong> en cliente.
                        {!canConvert && (
                            <span className="block mt-2 text-orange-600">
                                Este lead ya está {lead.lead_status === "converted" ? "convertido" : "perdido"}.
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {canConvert && (
                    <div className="space-y-4 py-4">
                        {/* Crear Cuenta */}
                        {lead.company && (
                            <div className="flex items-start space-x-3 p-3 border rounded-lg">
                                <Checkbox
                                    id="create_account"
                                    checked={createAccount}
                                    onCheckedChange={(checked) => setCreateAccount(!!checked)}
                                />
                                <div className="space-y-1">
                                    <Label htmlFor="create_account" className="flex items-center gap-2 cursor-pointer">
                                        <Building2 className="w-4 h-4" />
                                        Crear Cuenta Empresarial
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Se creará la cuenta: <strong>{lead.company}</strong>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Crear Oportunidad */}
                        <div className="flex items-start space-x-3 p-3 border rounded-lg">
                            <Checkbox
                                id="create_opportunity"
                                checked={createOpportunity}
                                onCheckedChange={(checked) => setCreateOpportunity(!!checked)}
                            />
                            <div className="space-y-1 flex-1">
                                <Label htmlFor="create_opportunity" className="flex items-center gap-2 cursor-pointer">
                                    <Target className="w-4 h-4" />
                                    Crear Oportunidad de Venta
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Se agregará al pipeline de ventas
                                </p>
                            </div>
                        </div>

                        {/* Detalles de Oportunidad */}
                        {createOpportunity && (
                            <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                                <div className="space-y-2">
                                    <Label htmlFor="opportunity_name">Nombre de la Oportunidad</Label>
                                    <Input
                                        id="opportunity_name"
                                        value={opportunityName}
                                        onChange={(e) => setOpportunityName(e.target.value)}
                                        placeholder={`Oportunidad - ${lead.name}`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="expected_revenue">Ingreso Esperado (S/)</Label>
                                    <Input
                                        id="expected_revenue"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={expectedRevenue}
                                        onChange={(e) => setExpectedRevenue(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    {canConvert && (
                        <Button onClick={handleConvert} disabled={loading} className="bg-green-600 hover:bg-green-700">
                            {loading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <UserCheck className="w-4 h-4 mr-2" />
                            )}
                            Convertir
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
