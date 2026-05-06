"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loading } from "@/components/ui/loading"
import { ArrowLeft, Building2, CalendarClock, FileText, Mail, Phone, Receipt, Tag, TicketCheck } from "lucide-react"
import { toast } from "sonner"

type Contact = {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    company?: string | null
    position?: string | null
    city?: string | null
    country?: string | null
    lead_score?: number | null
    lead_status?: string | null
    source?: string | null
    tags?: string[] | null
    notes?: string | null
    created_at?: string | null
}

type RelatedState = {
    opportunities: any[]
    tasks: any[]
    tickets: any[]
    invoices: any[]
    quotes: any[]
}

const emptyRelated: RelatedState = {
    opportunities: [],
    tasks: [],
    tickets: [],
    invoices: [],
    quotes: [],
}

function getStatusColor(status?: string | null) {
    switch (status) {
        case "hot":
            return "bg-rose-500"
        case "warm":
            return "bg-amber-500"
        case "converted":
            return "bg-emerald-500"
        case "lost":
            return "bg-slate-500"
        default:
            return "bg-sky-500"
    }
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount || 0)
}

export default function ContactDetailPage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const contactId = params?.id
    const [contact, setContact] = useState<Contact | null>(null)
    const [related, setRelated] = useState<RelatedState>(emptyRelated)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!contactId) return

        const loadContact = async () => {
            setLoading(true)
            try {
                const contactRes = await fetch(`/api/contacts/${contactId}`)
                const contactJson = await contactRes.json()
                if (!contactRes.ok || !contactJson.success) {
                    throw new Error(contactJson.error || "Contacto no encontrado")
                }
                setContact(contactJson.data)

                const [
                    opportunitiesRes,
                    tasksRes,
                    ticketsRes,
                    invoicesRes,
                    quotesRes,
                ] = await Promise.all([
                    fetch(`/api/opportunities?contact_id=${contactId}&limit=5`).then((res) => res.json()),
                    fetch(`/api/tasks?contact_id=${contactId}&limit=5`).then((res) => res.json()),
                    fetch(`/api/tickets?contact_id=${contactId}&limit=5`).then((res) => res.json()),
                    fetch(`/api/invoices?contact_id=${contactId}&limit=5`).then((res) => res.json()),
                    fetch(`/api/quotes?contact_id=${contactId}`).then((res) => res.json()),
                ])

                setRelated({
                    opportunities: opportunitiesRes.success ? opportunitiesRes.data || [] : [],
                    tasks: tasksRes.success ? tasksRes.data || [] : [],
                    tickets: ticketsRes.success ? ticketsRes.data || [] : [],
                    invoices: invoicesRes.success ? invoicesRes.data || [] : [],
                    quotes: quotesRes.success ? (quotesRes.data || []).slice(0, 5) : [],
                })
            } catch (error: any) {
                toast.error(error.message || "No se pudo cargar el contacto")
                setContact(null)
            } finally {
                setLoading(false)
            }
        }

        void loadContact()
    }, [contactId])

    const revenueTotal = useMemo(() => (
        related.invoices
            .filter((invoice) => invoice.status === "paid")
            .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
    ), [related.invoices])

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={() => router.push("/contacts")}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                    {contact && (
                        <Button asChild>
                            <Link href={`/quotes?contact_id=${contact.id}`}>Crear cotizacion</Link>
                        </Button>
                    )}
                </div>

                {loading ? (
                    <Loading text="Cargando perfil del contacto..." />
                ) : !contact ? (
                    <Card>
                        <CardContent className="py-10 text-center text-muted-foreground">
                            Contacto no encontrado o fuera de tu organizacion.
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card>
                            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <CardTitle className="text-3xl">{contact.name}</CardTitle>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                        {contact.company && <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{contact.company}</span>}
                                        {contact.position && <span>{contact.position}</span>}
                                        {(contact.city || contact.country) && <span>{[contact.city, contact.country].filter(Boolean).join(", ")}</span>}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge className={`${getStatusColor(contact.lead_status)} border-0 text-white`}>
                                        {contact.lead_status || "lead"}
                                    </Badge>
                                    <Badge variant="outline">Score {contact.lead_score || 0}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="grid gap-6 md:grid-cols-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Email</p>
                                    <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{contact.email || "-"}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Telefono</p>
                                    <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{contact.phone || "-"}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Origen</p>
                                    <p className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" />{contact.source || "-"}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 md:grid-cols-4">
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm">Oportunidades</CardTitle></CardHeader>
                                <CardContent className="text-2xl font-semibold">{related.opportunities.length}</CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas pagadas</CardTitle></CardHeader>
                                <CardContent className="text-2xl font-semibold">{formatCurrency(revenueTotal)}</CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm">Tickets</CardTitle></CardHeader>
                                <CardContent className="text-2xl font-semibold">{related.tickets.length}</CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm">Tareas</CardTitle></CardHeader>
                                <CardContent className="text-2xl font-semibold">{related.tasks.length}</CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <RelatedList
                                title="Oportunidades"
                                icon={<CalendarClock className="h-4 w-4" />}
                                empty="Sin oportunidades asociadas."
                                items={related.opportunities}
                                renderItem={(item) => (
                                    <div>
                                        <p className="font-medium">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">{formatCurrency(Number(item.expected_revenue || 0))}</p>
                                    </div>
                                )}
                            />
                            <RelatedList
                                title="Facturas"
                                icon={<Receipt className="h-4 w-4" />}
                                empty="Sin facturas asociadas."
                                items={related.invoices}
                                renderItem={(item) => (
                                    <div>
                                        <p className="font-medium">{item.invoice_number || item.id?.slice(0, 8)}</p>
                                        <p className="text-sm text-muted-foreground">{item.status} · {formatCurrency(Number(item.total || 0))}</p>
                                    </div>
                                )}
                            />
                            <RelatedList
                                title="Tickets"
                                icon={<TicketCheck className="h-4 w-4" />}
                                empty="Sin tickets asociados."
                                items={related.tickets}
                                renderItem={(item) => (
                                    <div>
                                        <p className="font-medium">{item.title}</p>
                                        <p className="text-sm text-muted-foreground">{item.status} · {item.priority}</p>
                                    </div>
                                )}
                            />
                            <RelatedList
                                title="Cotizaciones"
                                icon={<FileText className="h-4 w-4" />}
                                empty="Sin cotizaciones asociadas."
                                items={related.quotes}
                                renderItem={(item) => (
                                    <div>
                                        <p className="font-medium">{item.quote_number || item.id?.slice(0, 8)}</p>
                                        <p className="text-sm text-muted-foreground">{item.status} · {formatCurrency(Number(item.total_amount || 0))}</p>
                                    </div>
                                )}
                            />
                        </div>

                        {contact.notes && (
                            <Card>
                                <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
                                <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}

function RelatedList({
    title,
    icon,
    empty,
    items,
    renderItem,
}: {
    title: string
    icon: React.ReactNode
    empty: string
    items: any[]
    renderItem: (item: any) => React.ReactNode
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    {icon}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{empty}</p>
                ) : (
                    items.map((item) => (
                        <div key={item.id} className="rounded-md border p-3">
                            {renderItem(item)}
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
