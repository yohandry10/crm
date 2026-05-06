"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type ReferenceItem = {
    id: string
    name: string
    email?: string
    unit_price?: number
}

type OrderDialogMode = "create" | "edit" | "view"

interface OrderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order?: any
    mode?: OrderDialogMode
    onSuccess: () => void
}

const orderStatuses = [
    { value: "draft", label: "Borrador" },
    { value: "confirmed", label: "Confirmado" },
    { value: "fulfilled", label: "Entregado" },
    { value: "completed", label: "Completado" },
    { value: "cancelled", label: "Cancelado" },
]

export function OrderDialog({
    open,
    onOpenChange,
    order,
    mode = "create",
    onSuccess,
}: OrderDialogProps) {
    const [contacts, setContacts] = useState<ReferenceItem[]>([])
    const [opportunities, setOpportunities] = useState<ReferenceItem[]>([])
    const [products, setProducts] = useState<ReferenceItem[]>([])
    const [loading, setLoading] = useState(false)
    const [contactId, setContactId] = useState("none")
    const [opportunityId, setOpportunityId] = useState("none")
    const [status, setStatus] = useState("draft")
    const [currency, setCurrency] = useState("PEN")
    const [notes, setNotes] = useState("")
    const [productId, setProductId] = useState("none")
    const [description, setDescription] = useState("")
    const [quantity, setQuantity] = useState("1")
    const [unitPrice, setUnitPrice] = useState("0")
    const readOnly = mode === "view"

    const total = useMemo(() => {
        const qty = Number(quantity) || 0
        const price = Number(unitPrice) || 0
        return qty * price
    }, [quantity, unitPrice])

    useEffect(() => {
        if (!open) return

        const loadReferences = async () => {
            try {
                const [contactsRes, opportunitiesRes, productsRes] = await Promise.all([
                    fetch("/api/contacts?limit=100").then((res) => res.json()),
                    fetch("/api/opportunities?limit=100").then((res) => res.json()),
                    fetch("/api/products?limit=100").then((res) => res.json()),
                ])

                if (contactsRes.success) setContacts(contactsRes.data || [])
                if (opportunitiesRes.success) setOpportunities(opportunitiesRes.data || [])
                if (productsRes.success) setProducts(productsRes.data || [])
            } catch {
                toast.error("No se pudieron cargar referencias del pedido")
            }
        }

        void loadReferences()
    }, [open])

    useEffect(() => {
        const firstItem = Array.isArray(order?.items) ? order.items[0] : null

        setContactId(order?.contact_id || "none")
        setOpportunityId(order?.opportunity_id || "none")
        setStatus(order?.status || "draft")
        setCurrency(order?.currency || "PEN")
        setNotes(order?.notes || "")
        setProductId(firstItem?.product_id || "none")
        setDescription(firstItem?.description || "")
        setQuantity(String(firstItem?.quantity || 1))
        setUnitPrice(String(firstItem?.unit_price ?? order?.total ?? 0))
    }, [order, open])

    const handleProductChange = (value: string) => {
        setProductId(value)
        const selected = products.find((product) => product.id === value)
        if (selected) {
            setDescription(selected.name)
            setUnitPrice(String(selected.unit_price || 0))
        }
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (readOnly) return

        const qty = Number(quantity)
        const price = Number(unitPrice)
        if (!description.trim()) {
            toast.error("Agrega una descripcion para el item")
            return
        }
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
            toast.error("Cantidad o precio invalido")
            return
        }

        setLoading(true)
        try {
            const itemTotal = qty * price
            const payload = {
                contact_id: contactId === "none" ? null : contactId,
                opportunity_id: opportunityId === "none" ? null : opportunityId,
                status,
                currency,
                notes: notes || null,
                subtotal: itemTotal,
                tax: 0,
                total: itemTotal,
                items: [{
                    product_id: productId === "none" ? null : productId,
                    description: description.trim(),
                    quantity: qty,
                    unit_price: price,
                    total: itemTotal,
                }],
            }

            const response = await fetch(order ? `/api/orders/${order.id}` : "/api/orders", {
                method: order ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const json = await response.json()

            if (!response.ok || !json.success) {
                throw new Error(json.error || "No se pudo guardar el pedido")
            }

            toast.success(order ? "Pedido actualizado" : "Pedido creado")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            toast.error(error.message || "Error al guardar pedido")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[680px]">
                <DialogHeader>
                    <DialogTitle>
                        {readOnly ? "Detalle del pedido" : order ? "Editar pedido" : "Nuevo pedido"}
                    </DialogTitle>
                    <DialogDescription>
                        {readOnly
                            ? "Consulta cliente, estado e item principal del pedido."
                            : "Crea o actualiza pedidos con referencias validadas por organizacion."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Contacto</Label>
                            <Select value={contactId} onValueChange={setContactId} disabled={readOnly}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sin contacto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin contacto</SelectItem>
                                    {contacts.map((contact) => (
                                        <SelectItem key={contact.id} value={contact.id}>
                                            {contact.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Oportunidad</Label>
                            <Select value={opportunityId} onValueChange={setOpportunityId} disabled={readOnly}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sin oportunidad" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin oportunidad</SelectItem>
                                    {opportunities.map((opportunity) => (
                                        <SelectItem key={opportunity.id} value={opportunity.id}>
                                            {opportunity.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <Select value={status} onValueChange={setStatus} disabled={readOnly}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    {orderStatuses.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Moneda</Label>
                            <Select value={currency} onValueChange={setCurrency} disabled={readOnly}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Moneda" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PEN">PEN</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Total</Label>
                            <Input value={total.toFixed(2)} readOnly />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr_1fr_1fr]">
                        <div className="space-y-2">
                            <Label>Producto</Label>
                            <Select value={productId} onValueChange={handleProductChange} disabled={readOnly}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Item manual" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Item manual</SelectItem>
                                    {products.map((product) => (
                                        <SelectItem key={product.id} value={product.id}>
                                            {product.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Descripcion</Label>
                            <Input value={description} onChange={(event) => setDescription(event.target.value)} disabled={readOnly} />
                        </div>

                        <div className="space-y-2">
                            <Label>Cantidad</Label>
                            <Input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={readOnly} />
                        </div>

                        <div className="space-y-2">
                            <Label>Precio</Label>
                            <Input type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} disabled={readOnly} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Notas</Label>
                        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={readOnly} placeholder="Notas internas del pedido..." />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {readOnly ? "Cerrar" : "Cancelar"}
                        </Button>
                        {!readOnly && (
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : "Guardar pedido"}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
