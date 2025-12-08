"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plug,
  CheckCircle,
  AlertCircle,
  Clock,
  BookOpen,
  Calculator,
  Package,
  MessageSquare,
  Smartphone,
} from "lucide-react"
import { toast } from "sonner"

interface Integration {
  id: string
  name: string
  description: string
  category: "lms" | "accounting" | "erp" | "payments" | "communication" | "government"
  status: "connected" | "disconnected" | "error" | "syncing"
  icon: React.ReactNode
  lastSync?: string
  recordCount?: number
  isActive: boolean
}

export function IntegrationHub() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "lms",
      name: "LMS Corporativo",
      description: "Sincroniza cursos y progreso de estudiantes",
      category: "lms",
      status: "connected",
      icon: <BookOpen className="h-5 w-5" />,
      lastSync: "2024-01-28 10:30",
      recordCount: 1250,
      isActive: true,
    },
    {
      id: "concar",
      name: "Concar SQL",
      description: "Integración con sistema contable Concar",
      category: "accounting",
      status: "connected",
      icon: <Calculator className="h-5 w-5" />,
      lastSync: "2024-01-28 09:15",
      recordCount: 850,
      isActive: true,
    },
    {
      id: "erp",
      name: "ERP Empresarial",
      description: "Conecta inventarios y órdenes de compra",
      category: "erp",
      status: "syncing",
      icon: <Package className="h-5 w-5" />,
      lastSync: "2024-01-28 11:00",
      recordCount: 2100,
      isActive: true,
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      description: "Mensajería automatizada con clientes",
      category: "communication",
      status: "disconnected",
      icon: <MessageSquare className="h-5 w-5" />,
      isActive: false,
    },
  ])

  const toggleIntegration = async (id: string) => {
    setIntegrations(
      integrations.map((integration) =>
        integration.id === id ? { ...integration, isActive: !integration.isActive } : integration,
      ),
    )

    const integration = integrations.find((i) => i.id === id)
    toast.success(`${integration?.name} ${integration?.isActive ? "desactivado" : "activado"}`)
  }

  const syncIntegration = async (id: string) => {
    setIntegrations(
      integrations.map((integration) => (integration.id === id ? { ...integration, status: "syncing" } : integration)),
    )

    // Simulate sync
    setTimeout(() => {
      setIntegrations(
        integrations.map((integration) =>
          integration.id === id
            ? {
              ...integration,
              status: "connected",
              lastSync: new Date().toLocaleString("es-PE"),
            }
            : integration,
        ),
      )
      toast.success("Sincronización completada")
    }, 3000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "syncing":
        return <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-100 text-green-800"
      case "error":
        return "bg-red-100 text-red-800"
      case "syncing":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Conectado"
      case "error":
        return "Error"
      case "syncing":
        return "Sincronizando"
      default:
        return "Desconectado"
    }
  }

  const getCategoryIntegrations = (category: string) => {
    return integrations.filter((i) => i.category === category)
  }

  const connectedCount = integrations.filter((i) => i.status === "connected").length
  const totalRecords = integrations.reduce((sum, i) => sum + (i.recordCount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Plug className="h-6 w-6 text-cyan-600" />
        <h2 className="text-2xl font-bold text-gray-900">Centro de Integraciones</h2>
      </div>

      {/* Integration Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{connectedCount}</div>
                <div className="text-sm text-gray-600">Conectadas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{integrations.length}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Registros</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">98%</div>
                <div className="text-sm text-gray-600">Uptime</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="lms">LMS</TabsTrigger>
          <TabsTrigger value="accounting">Contabilidad</TabsTrigger>
          <TabsTrigger value="erp">ERP</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="government">Gobierno</TabsTrigger>
          <TabsTrigger value="communication">Comunicación</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {integrations.map((integration) => (
              <Card key={integration.id} className={`${integration.isActive ? "border-green-200" : "border-gray-200"}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">{integration.icon}</div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <p className="text-sm text-gray-600">{integration.description}</p>
                      </div>
                    </div>
                    <Switch checked={integration.isActive} onCheckedChange={() => toggleIntegration(integration.id)} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(integration.status)}
                      <Badge className={getStatusColor(integration.status)}>{getStatusText(integration.status)}</Badge>
                    </div>

                    {integration.status === "connected" && (
                      <Button variant="outline" size="sm" onClick={() => syncIntegration(integration.id)}>
                        Sincronizar
                      </Button>
                    )}
                  </div>

                  {integration.status === "syncing" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Sincronizando...</span>
                        <span>75%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                  )}

                  {integration.lastSync && (
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Última sincronización: {integration.lastSync}</div>
                      {integration.recordCount && <div>Registros: {integration.recordCount.toLocaleString()}</div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Category-specific tabs */}
        {["lms", "accounting", "erp", "payments", "government", "communication"].map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {getCategoryIntegrations(category).map((integration) => (
                <Card key={integration.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">{integration.icon}</div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <p className="text-sm text-gray-600">{integration.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge className={getStatusColor(integration.status)}>{getStatusText(integration.status)}</Badge>
                      <Switch
                        checked={integration.isActive}
                        onCheckedChange={() => toggleIntegration(integration.id)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
