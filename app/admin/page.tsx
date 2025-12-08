"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, TrendingUp, Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { ActivityOverviewChart } from "@/components/dashboard/activity-overview-chart"
import { PipelineChart } from "@/components/dashboard/pipeline-chart"

interface DashboardStats {
  totalOrganizations: number
  activeOrganizations: number
  trialOrganizations: number
  expiredOrganizations: number
  totalUsers: number
  monthlyRevenue: number
  recentOrganizations: any[]
  activityOverview?: any[]
  pipeline?: any[]
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const res = await fetch("/api/admin/stats")
      const json = await res.json()
      if (json.success) {
        setStats(json.data)
      }
    } catch (error) {
      console.error("Error loading stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard de Administración</h1>
        <p className="text-muted-foreground">Vista general de la plataforma</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizaciones</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrganizations || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeOrganizations || 0} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Trial</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.trialOrganizations || 0}</div>
            <p className="text-xs text-muted-foreground">
              Período de prueba
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              En todas las organizaciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              S/ {(stats?.monthlyRevenue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityOverviewChart data={stats?.activityOverview} />
        <PipelineChart data={stats?.pipeline} />
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Suscripciones Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.activeOrganizations || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              En Período de Pruebas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats?.trialOrganizations || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Expiradas / Canceladas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats?.expiredOrganizations || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>Organizaciones Recientes</CardTitle>
          <CardDescription>Últimas organizaciones creadas</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentOrganizations && stats.recentOrganizations.length > 0 ? (
            <div className="space-y-4">
              {stats.recentOrganizations.map((org: any) => (
                <div key={org.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-muted-foreground">{org.slug}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      org.subscription_status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : org.subscription_status === 'trial' 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {org.subscription_status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(org.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No hay organizaciones aún</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
