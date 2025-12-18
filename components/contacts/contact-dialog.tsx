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
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createContactSchema, updateContactSchema } from "@/lib/schemas"
import type { z } from "zod"

type ContactFormData = z.infer<typeof createContactSchema>

interface ContactDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: any
    onSave: (contact: any) => void
}

export function ContactDialog({ open, onOpenChange, contact, onSave }: ContactDialogProps) {
    const [loading, setLoading] = useState(false)

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors }
    } = useForm<ContactFormData>({
        resolver: zodResolver(contact ? updateContactSchema : createContactSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            company: "",
            position: "",
            ruc: "",
            address: "",
            city: "Lima",
            country: "Perú",
            lead_status: "cold",
            lead_score: 0,
            source: "website",
            tags: [],
            notes: ""
        }
    })

    useEffect(() => {
        if (contact) {
            reset({
                name: contact.name || "",
                email: contact.email || "",
                phone: contact.phone || "",
                company: contact.company || "",
                position: contact.position || "",
                ruc: contact.ruc || "",
                address: contact.address || "",
                city: contact.city || "Lima",
                country: contact.country || "Perú",
                lead_status: contact.lead_status || "cold",
                lead_score: contact.lead_score || 0,
                source: contact.source || "website",
                tags: contact.tags || [],
                notes: contact.notes || ""
            })
        } else {
            reset({
                name: "",
                email: "",
                phone: "",
                company: "",
                position: "",
                ruc: "",
                address: "",
                city: "Lima",
                country: "Perú",
                lead_status: "cold",
                lead_score: 0,
                source: "website",
                tags: [],
                notes: ""
            })
        }
    }, [contact, open, reset])

    const onSubmit = async (data: ContactFormData) => {
        setLoading(true)
        try {
            await onSave(data)
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
                <form onSubmit={handleSubmit(onSubmit)}>
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
                                email={watch("email") || ""}
                                phone={watch("phone") || ""}
                                name={watch("name") || ""}
                            />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre Completo *</Label>
                                <Input
                                    id="name"
                                    {...register("name")}
                                />
                                {errors.name && (
                                    <p className="text-sm text-red-500">{errors.name.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    {...register("email")}
                                />
                                {errors.email && (
                                    <p className="text-sm text-red-500">{errors.email.message}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono *</Label>
                                <Input
                                    id="phone"
                                    {...register("phone")}
                                />
                                {errors.phone && (
                                    <p className="text-sm text-red-500">{errors.phone.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ruc">RUC / DNI</Label>
                                <Input
                                    id="ruc"
                                    {...register("ruc")}
                                />
                                {errors.ruc && (
                                    <p className="text-sm text-red-500">{errors.ruc.message}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="company">Empresa</Label>
                                <Input
                                    id="company"
                                    {...register("company")}
                                />
                                {errors.company && (
                                    <p className="text-sm text-red-500">{errors.company.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="position">Cargo</Label>
                                <Input
                                    id="position"
                                    {...register("position")}
                                />
                                {errors.position && (
                                    <p className="text-sm text-red-500">{errors.position.message}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Dirección</Label>
                                <Input
                                    id="address"
                                    {...register("address")}
                                    placeholder="Av. Principal 123"
                                />
                                {errors.address && (
                                    <p className="text-sm text-red-500">{errors.address.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">Ciudad</Label>
                                <Input
                                    id="city"
                                    {...register("city")}
                                    placeholder="Lima"
                                />
                                {errors.city && (
                                    <p className="text-sm text-red-500">{errors.city.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country">País</Label>
                                <Select
                                    value={watch("country") || "Perú"}
                                    onValueChange={(value) => setValue("country", value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="País" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Perú">Perú</SelectItem>
                                        <SelectItem value="Colombia">Colombia</SelectItem>
                                        <SelectItem value="México">México</SelectItem>
                                        <SelectItem value="Chile">Chile</SelectItem>
                                        <SelectItem value="Argentina">Argentina</SelectItem>
                                        <SelectItem value="Ecuador">Ecuador</SelectItem>
                                        <SelectItem value="Estados Unidos">Estados Unidos</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.country && (
                                    <p className="text-sm text-red-500">{errors.country.message}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="lead_status">Estado</Label>
                                <Select
                                    value={watch("lead_status") || "cold"}
                                    onValueChange={(value: any) => setValue("lead_status", value)}
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
                                {errors.lead_status && (
                                    <p className="text-sm text-red-500">{errors.lead_status.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="source">Fuente</Label>
                                <Select
                                    value={watch("source") || "website"}
                                    onValueChange={(value) => setValue("source", value)}
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
                                {errors.source && (
                                    <p className="text-sm text-red-500">{errors.source.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lead_score">Lead Score (0-100)</Label>
                                <Input
                                    id="lead_score"
                                    type="number"
                                    min={0}
                                    max={100}
                                    {...register("lead_score", { valueAsNumber: true })}
                                />
                                {errors.lead_score && (
                                    <p className="text-sm text-red-500">{errors.lead_score.message}</p>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
                            <Input
                                id="tags"
                                value={Array.isArray(watch("tags")) ? watch("tags")?.join(", ") : ""}
                                onChange={(e) => setValue("tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
                                placeholder="cliente, vip, interesado"
                            />
                            {errors.tags && (
                                <p className="text-sm text-red-500">{errors.tags.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notas</Label>
                            <Textarea
                                id="notes"
                                {...register("notes")}
                                placeholder="Información adicional sobre el contacto..."
                            />
                            {errors.notes && (
                                <p className="text-sm text-red-500">{errors.notes.message}</p>
                            )}
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
