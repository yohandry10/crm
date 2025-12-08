"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
    TrendingUp,
    Users,
    DollarSign,
    CreditCard,
    Activity,
    Target,
    Briefcase,
    Megaphone,
    Download
} from "lucide-react"
import { toast } from "sonner"

interface AnalyticsData {
    metrics: {
        new_contacts: number
        total_revenue: number
        invoices_generated: number
        payments_received: number
        avg_lead_score: number
        conversion_rate: number
        pipeline_value: number
        won_value: number
        win_rate: number
        active_campaigns: number
        marketing_budget: number
    }
    salesData: { month: string; ventas: number; leads: number }[]
    predictions: { categoria: string; probabilidad: number; valor: string }[]
}

export function AnalyticsDashboard() {
    const [period, setPeriod] = useState("month")
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/analytics?period=${period}`)
            if (!res.ok) throw new Error("Failed to fetch analytics")
            const json = await res.json()
            setData(json.data)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar analíticas")
        } finally {
            setLoading(false)
        }
    }

    const handleExport = () => {
        if (!data) return

        const csvContent = [
            ["Metrica", "Valor"],
            ["Ingresos Totales", data.metrics.total_revenue],
            ["Nuevos Contactos", data.metrics.new_contacts],
            ["Tasa de Conversion", `${data.metrics.conversion_rate}%`],
            ["Facturas Generadas", data.metrics.invoices_generated],
            ["Valor en Pipeline", data.metrics.pipeline_value],
            ["Ventas Ganadas", data.metrics.won_value],
            ["Tasa de Cierre", `${data.metrics.win_rate}%`],
            ["Campañas Activas", data.metrics.active_campaigns],
            ["Presupuesto Marketing", data.metrics.marketing_budget]
        ].map(e => e.join(",")).join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `reporte_analitica_${period}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast.success("Reporte descargado correctamente")
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Cargando analíticas...</p>
                </div>
            </div>
        )
    }

    if (!data) return null

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard Analítico</h2>
                    <p className="text-muted-foreground">Métricas y predicciones de tu negocio</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px] bg-muted/50 border-border/50">
                            <SelectValue placeholder="Selecciona periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">Última Semana</SelectItem>
                            <SelectItem value="month">Último Mes</SelectItem>
                            <SelectItem value="quarter">Último Trimestre</SelectItem>
                            <SelectItem value="year">Último Año</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleExport} className="bg-muted/50 border-border/50">
                        <Download className="mr-2 h-4 w-4" /> Exportar
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Resumen General</TabsTrigger>
                    <TabsTrigger value="sales">Ventas & Pipeline</TabsTrigger>
                    <TabsTrigger value="marketing">Marketing</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="group hover:border-primary/50 hover:neon-glow transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                                <div className="w-10 h-10 rounded-xl gradient-neon flex items-center justify-center">
                                    <DollarSign className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(data.metrics.total_revenue)}</div>
                                <p className="text-xs text-muted-foreground">
                                    +20.1% respecto al periodo anterior
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="group hover:border-primary/50 hover:neon-glow transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Nuevos Contactos</CardTitle>
                                <div className="w-10 h-10 rounded-xl gradient-neon flex items-center justify-center">
                                    <Users className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.metrics.new_contacts}</div>
                                <p className="text-xs text-muted-foreground">
                                    Score Promedio: {data.metrics.avg_lead_score}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="group hover:border-primary/50 hover:neon-glow transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
                                <div className="w-10 h-10 rounded-xl gradient-neon flex items-center justify-center">
                                    <Activity className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.metrics.conversion_rate}%</div>
                                <p className="text-xs text-muted-foreground">
                                    De Leads a Clientes Pagos
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="group hover:border-primary/50 hover:neon-glow transition-all duration-300">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Facturas Generadas</CardTitle>
                                <div className="w-10 h-10 rounded-xl gradient-neon flex items-center justify-center">
                                    <CreditCard className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.metrics.invoices_generated}</div>
                                <p className="text-xs text-muted-foreground">
                                    {data.metrics.payments_received} Pagos recibidos
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Resumen de Ventas</CardTitle>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <div className="h-[200px] flex items-end justify-between gap-2 px-4">
                                    {data.salesData.map((item, i) => (
                                        <div key={i} className="flex flex-col items-center gap-2 w-full">
                                            <div
                                                className="w-full bg-primary/80 rounded-t-md hover:bg-primary transition-all"
                                                style={{ height: `${Math.max(item.ventas / 100, 10)}%` }}
                                            ></div>
                                            <span className="text-xs text-muted-foreground">{item.month}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Predicciones IA</CardTitle>
                                <CardDescription>
                                    Oportunidades detectadas por el motor de IA.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-8">
                                    {data.predictions.map((pred, i) => (
                                        <div key={i} className="flex items-center">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium leading-none">{pred.categoria}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Probabilidad: {pred.probabilidad.toFixed(1)}%
                                                </p>
                                            </div>
                                            <div className="ml-auto font-medium">{pred.valor}</div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="sales" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Valor en Pipeline</CardTitle>
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(data.metrics.pipeline_value)}</div>
                                <p className="text-xs text-muted-foreground">Oportunidades Abiertas</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ventas Ganadas</CardTitle>
                                <Target className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(data.metrics.won_value)}</div>
                                <p className="text-xs text-muted-foreground">Total Cerrado Ganado</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Tasa de Cierre</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.metrics.win_rate}%</div>
                                <p className="text-xs text-muted-foreground">Win Rate Global</p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="marketing" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
                                <Megaphone className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{data.metrics.active_campaigns}</div>
                                <p className="text-xs text-muted-foreground">En ejecución actualmente</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Presupuesto Marketing</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(data.metrics.marketing_budget)}</div>
                                <p className="text-xs text-muted-foreground">Total asignado a campañas activas</p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
