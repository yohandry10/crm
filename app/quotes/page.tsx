"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { QuoteDialog } from "@/components/quotes/quote-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, RefreshCw, Download } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

export default function QuotesPage() {
    const [quotes, setQuotes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedQuote, setSelectedQuote] = useState<any>(null)
    const [filter, setFilter] = useState("")

    const fetchQuotes = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/quotes')
            if (!res.ok) throw new Error('Failed to fetch quotes')
            const data = await res.json()
            setQuotes(data.data || [])
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar cotizaciones")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchQuotes()
    }, [])

    const handleAddQuote = () => {
        setSelectedQuote(null)
        setDialogOpen(true)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'accepted': return 'default' // green-ish usually
            case 'sent': return 'secondary'
            case 'rejected': return 'destructive'
            case 'draft': return 'outline'
            default: return 'secondary'
        }
    }

    const filteredQuotes = quotes.filter(quote =>
        quote.quote_number?.toString().includes(filter) ||
        quote.contact?.name?.toLowerCase().includes(filter.toLowerCase())
    )

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                <div className="flex items-center justify-between pb-6 border-b">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Cotizaciones</h1>
                        <p className="text-muted-foreground">
                            Genera y envía propuestas comerciales
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={fetchQuotes}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleAddQuote} className="gradient-neon border-0">
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Cotización
                        </Button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 max-w-sm">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por número o cliente..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            Cargando...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredQuotes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No hay cotizaciones registradas.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredQuotes.map((quote) => (
                                        <TableRow key={quote.id}>
                                            <TableCell className="font-medium">
                                                #{quote.quote_number}
                                            </TableCell>
                                            <TableCell>
                                                {quote.contact?.name || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(quote.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>
                                                {formatCurrency(quote.total_amount)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusColor(quote.status) as any}>
                                                    {quote.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        const pdfWindow = window.open(`/api/quotes/${quote.id}/pdf`, '_blank')
                                                        if (pdfWindow) {
                                                            pdfWindow.onload = () => setTimeout(() => pdfWindow.print(), 500)
                                                        }
                                                        toast.success('PDF generado - usa Ctrl+P para guardar')
                                                    }}
                                                >
                                                    <Download className="h-4 w-4 mr-1" /> PDF
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <QuoteDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    quote={selectedQuote}
                    onSuccess={fetchQuotes}
                />
            </div>
        </DashboardLayout>
    )
}
