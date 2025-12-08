"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Download, CreditCard, Loader2, Edit, Mail } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { formatDatePE } from "@/lib/date-utils"

interface InvoiceItem {
    id: string
    description: string
    quantity: number
    unit_price: number
    total: number
}

interface Invoice {
    id: string
    invoice_number: string
    status: string
    issue_date: string
    due_date: string
    subtotal: number
    tax: number
    total: number
    notes: string
    contact: {
        id: string
        name: string
        email: string
        phone: string
        ruc: string
        address: string
    }
    items: InvoiceItem[]
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [invoice, setInvoice] = useState<Invoice | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const res = await fetch(`/api/invoices/${id}`)
                const data = await res.json()
                
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'Factura no encontrada')
                }
                
                setInvoice(data.data)
            } catch (error: any) {
                toast.error(error.message)
                router.push('/invoicing')
            } finally {
                setLoading(false)
            }
        }
        
        fetchInvoice()
    }, [id, router])

    const handleDownloadPDF = async () => {
        try {
            // Abrir en nueva ventana para imprimir/guardar como PDF
            const pdfWindow = window.open(`/api/invoices/${id}/pdf`, '_blank')
            if (pdfWindow) {
                pdfWindow.onload = () => {
                    setTimeout(() => {
                        pdfWindow.print()
                    }, 500)
                }
            }
            toast.success('PDF generado - usa Ctrl+P para guardar')
        } catch (error) {
            toast.error('Error al generar PDF')
        }
    }

    const handleSendInvoice = async () => {
        if (!invoice) return
        
        if (!invoice.contact?.email) {
            toast.error('El cliente no tiene email registrado')
            return
        }
        
        setActionLoading(true)
        
        try {
            // Enviar email real
            const res = await fetch(`/api/invoices/${id}/send`, {
                method: 'POST',
            })
            
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            
            setInvoice({ ...invoice, status: 'sent' })
            toast.success(`Factura enviada a ${invoice.contact.email}`)
        } catch (error: any) {
            toast.error(error.message || 'Error al enviar factura')
        } finally {
            setActionLoading(false)
        }
    }

    const handleMarkPaid = async () => {
        if (!invoice) return
        setActionLoading(true)
        
        try {
            // Crear pago
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoice_id: id,
                    amount: invoice.total,
                    payment_method: 'cash',
                    gateway: 'manual',
                }),
            })
            
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            
            setInvoice({ ...invoice, status: 'paid' })
            toast.success('Pago registrado exitosamente')
        } catch (error: any) {
            toast.error(error.message || 'Error al registrar pago')
        } finally {
            setActionLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: any; label: string }> = {
            draft: { variant: "secondary", label: "Borrador" },
            sent: { variant: "default", label: "Enviada" },
            paid: { variant: "success", label: "Pagada" },
            overdue: { variant: "destructive", label: "Vencida" },
            cancelled: { variant: "outline", label: "Cancelada" }
        }
        const config = variants[status] || variants.draft
        return <Badge variant={config.variant as any}>{config.label}</Badge>
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-PE', { 
            style: 'currency', 
            currency: 'PEN' 
        }).format(amount || 0)
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardLayout>
        )
    }

    if (!invoice) {
        return (
            <DashboardLayout>
                <div className="text-center py-12">
                    <p>Factura no encontrada</p>
                    <Link href="/invoicing">
                        <Button className="mt-4">Volver a Facturación</Button>
                    </Link>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 max-w-4xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/invoicing">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
                                {getStatusBadge(invoice.status)}
                            </div>
                            <p className="text-muted-foreground">
                                Emitida el {formatDatePE(invoice.issue_date)}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {invoice.status === 'draft' && (
                            <Link href={`/invoicing/${id}/edit`}>
                                <Button variant="outline">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar
                                </Button>
                            </Link>
                        )}
                        <Button variant="outline" onClick={handleDownloadPDF}>
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                        </Button>
                        {invoice.status === 'draft' && (
                            <Button onClick={handleSendInvoice} disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                                Enviar por Email
                            </Button>
                        )}
                        {invoice.status === 'sent' && invoice.contact?.email && (
                            <Button variant="outline" onClick={handleSendInvoice} disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                                Reenviar
                            </Button>
                        )}
                        {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                            <Button onClick={handleMarkPaid} disabled={actionLoading}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Registrar Pago
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cliente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="font-medium">{invoice.contact?.name}</p>
                                    <p className="text-sm text-muted-foreground">{invoice.contact?.email}</p>
                                    <p className="text-sm text-muted-foreground">{invoice.contact?.phone}</p>
                                </div>
                                <div>
                                    {invoice.contact?.ruc && (
                                        <p className="text-sm">RUC: {invoice.contact.ruc}</p>
                                    )}
                                    {invoice.contact?.address && (
                                        <p className="text-sm text-muted-foreground">{invoice.contact.address}</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Detalle</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
                                    <div className="col-span-6">Descripción</div>
                                    <div className="col-span-2 text-right">Cantidad</div>
                                    <div className="col-span-2 text-right">Precio Unit.</div>
                                    <div className="col-span-2 text-right">Total</div>
                                </div>
                                
                                {invoice.items?.map((item) => (
                                    <div key={item.id} className="grid grid-cols-12 gap-4 text-sm">
                                        <div className="col-span-6">{item.description}</div>
                                        <div className="col-span-2 text-right">{item.quantity}</div>
                                        <div className="col-span-2 text-right">{formatCurrency(item.unit_price)}</div>
                                        <div className="col-span-2 text-right">{formatCurrency(item.total)}</div>
                                    </div>
                                ))}

                                <Separator />

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Subtotal:</span>
                                        <span>{formatCurrency(invoice.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>IGV (18%):</span>
                                        <span>{formatCurrency(invoice.tax)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Total:</span>
                                        <span>{formatCurrency(invoice.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {invoice.notes && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Notas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {invoice.notes}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Fechas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Fecha de Emisión:</span>
                                    <p className="font-medium">{formatDatePE(invoice.issue_date)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Fecha de Vencimiento:</span>
                                    <p className="font-medium">{formatDatePE(invoice.due_date)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    )
}
