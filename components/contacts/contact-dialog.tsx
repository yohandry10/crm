"use client"

import { useState, useEffect } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DuplicateDetector } from "./duplicate-detector"

interface ContactDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: any
    onSave: (contact: any) => void
}

export function ContactDialog({ open, onOpenChange, contact, onSave }: ContactDialogProps) {
    const [formData, setFormData] = useState<any>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (contact) {
            setFormData(contact)
        } else {
            setFormData({
                name: "",
                email: "",
                phone: "",
                company: "",
                position: "",
                ruc: "",
                lead_status: "cold",
                source: "website",
                tags: [],
                notes: ""
            })
        }
    }, [contact, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSave(formData)
            onOpenChange(false)
        } catch (error) {
            console.error("Error saving contact:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{contact ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
                        <DialogDescription>
                            {contact ? "Modifica los datos del contacto existente." : "Ingresa los datos del nuevo contacto."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Duplicate detector */}
                        {!contact && (
                            <DuplicateDetector
                                email={formData.email}
                                phone={formData.phone}
                                name={formData.name}
                            />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre Completo</Label>
                                <Input
                                    id="name"
                                    value={formData.name || ""}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email || ""}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone || ""}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ruc">RUC / DNI</Label>
                                <Input
                                    id="ruc"
                                    value={formData.ruc || ""}
                                    onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="company">Empresa</Label>
                                <Input
                                    id="company"
                                    value={formData.company || ""}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="position">Cargo</Label>
                                <Input
                                    id="position"
                                    value={formData.position || ""}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Dirección</Label>
                                <Input
                                    id="address"
                                    value={formData.address || ""}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Av. Principal 123"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">Ciudad</Label>
                                <Input
                                    id="city"
                                    value={formData.city || ""}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    placeholder="Lima"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country">País</Label>
                                <Select
                                    value={formData.country || "PE"}
                                    onValueChange={(value) => setFormData({ ...formData, country: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="País" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PE">Perú</SelectItem>
                                        <SelectItem value="CO">Colombia</SelectItem>
                                        <SelectItem value="MX">México</SelectItem>
                                        <SelectItem value="CL">Chile</SelectItem>
                                        <SelectItem value="AR">Argentina</SelectItem>
                                        <SelectItem value="EC">Ecuador</SelectItem>
                                        <SelectItem value="US">Estados Unidos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="lead_status">Estado</Label>
                                <Select
                                    value={formData.lead_status || "cold"}
                                    onValueChange={(value) => setFormData({ ...formData, lead_status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cold">Frío</SelectItem>
                                        <SelectItem value="warm">Tibio</SelectItem>
                                        <SelectItem value="hot">Caliente</SelectItem>
                                        <SelectItem value="converted">Convertido</SelectItem>
                                        <SelectItem value="lost">Perdido</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="source">Fuente</Label>
                                <Select
                                    value={formData.source || "website"}
                                    onValueChange={(value) => setFormData({ ...formData, source: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar fuente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="website">Sitio Web</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="referral">Referido</SelectItem>
                                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                                        <SelectItem value="facebook">Facebook</SelectItem>
                                        <SelectItem value="instagram">Instagram</SelectItem>
                                        <SelectItem value="other">Otro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lead_score">Lead Score (0-100)</Label>
                                <Input
                                    id="lead_score"
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={formData.lead_score || 0}
                                    onChange={(e) => setFormData({ ...formData, lead_score: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
                            <Input
                                id="tags"
                                value={Array.isArray(formData.tags) ? formData.tags.join(", ") : (formData.tags || "")}
                                onChange={(e) => setFormData({ 
                                    ...formData, 
                                    tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean)
                                })}
                                placeholder="cliente, vip, interesado"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notas</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes || ""}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Información adicional sobre el contacto..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
