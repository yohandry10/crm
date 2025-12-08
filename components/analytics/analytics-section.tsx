"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp, Brain, Target, Loader2 } from "lucide-react"

export function AnalyticsSection() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/analytics?period=month")
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        }
      } catch (error) {
        console.error("Error fetching analytics:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return <div className="text-center py-8 text-muted-foreground">No se pudieron cargar los datos.</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <span className="text-xs text-muted-foreground">Mes actual</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {data.metrics.total_revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuevos Contactos</CardTitle>
            <span className="text-xs text-muted-foreground">Mes actual</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.new_contacts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Score Prom.</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.avg_lead_score.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversión</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.conversion_rate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Tendencias de Ventas</span>
          </CardTitle>
          <CardDescription>Evolución estimada del mes actual</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [
                  name === "ventas" ? `S/ ${value.toLocaleString()}` : value,
                  name === "ventas" ? "Ventas" : "Leads",
                ]}
              />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))" }}
              />
              <Line
                type="monotone"
                dataKey="leads"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--accent))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>Predicciones IA</span>
            <Badge variant="secondary">Nuevo</Badge>
          </CardTitle>
          <CardDescription>Análisis predictivo por sector empresarial</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.predictions.map((item: any) => (
            <div key={item.categoria} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center space-x-3">
                <Target className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{item.categoria}</p>
                  <p className="text-xs text-muted-foreground">Valor estimado: {item.valor}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={item.probabilidad > 80 ? "default" : item.probabilidad > 70 ? "secondary" : "outline"}>
                  {item.probabilidad.toFixed(0)}% prob.
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
