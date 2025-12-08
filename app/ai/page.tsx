import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AIChatbot } from "@/components/chatbot/ai-chatbot"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, MessageSquare, Settings, TrendingUp, Users } from "lucide-react"

export default function AIPage() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">IA Asistentes</h1>
            <p className="text-gray-600 mt-2">Gestiona y configura tus asistentes de inteligencia artificial</p>
          </div>
          <Button className="bg-cyan-600 hover:bg-cyan-700">
            <Brain className="w-4 h-4 mr-2" />
            Nuevo Asistente
          </Button>
        </div>

        {/* Asistentes Disponibles */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-l-4 border-l-cyan-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-cyan-600" />
                  Chatbot CRM
                </CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Activo
                </Badge>
              </div>
              <CardDescription>Asistente principal para consultas sobre datos del CRM</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Consultas hoy:</span>
                  <span className="font-semibold">247</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Precisión:</span>
                  <span className="font-semibold text-green-600">94.2%</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline">
                    Configurar
                  </Button>
                  <Button size="sm" variant="outline">
                    Entrenar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Predictor de Ventas
                </CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Activo
                </Badge>
              </div>
              <CardDescription>IA para predicciones de ventas y análisis de tendencias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Predicciones generadas:</span>
                  <span className="font-semibold">156</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Precisión:</span>
                  <span className="font-semibold text-green-600">87.8%</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline">
                    Ver Reportes
                  </Button>
                  <Button size="sm" variant="outline">
                    Ajustar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Clasificador de Leads
                </CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Activo
                </Badge>
              </div>
              <CardDescription>Clasifica automáticamente leads por probabilidad de conversión</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Leads procesados:</span>
                  <span className="font-semibold">1,234</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Precisión:</span>
                  <span className="font-semibold text-green-600">91.5%</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline">
                    Ver Métricas
                  </Button>
                  <Button size="sm" variant="outline">
                    Entrenar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuración de IA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuración de IA
            </CardTitle>
            <CardDescription>Ajusta los parámetros globales de tus asistentes de IA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Modelo de IA Principal</label>
                <select className="w-full p-2 border rounded-md">
                  <option>Claude 3.5 Sonnet</option>
                  <option>GPT-4</option>
                  <option>Grok</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Temperatura</label>
                <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className="w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tokens Máximos</label>
                <input type="number" defaultValue="4000" className="w-full p-2 border rounded-md" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Idioma Principal</label>
                <select className="w-full p-2 border rounded-md">
                  <option>Español (Perú)</option>
                  <option>Inglés</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button>Guardar Configuración</Button>
              <Button variant="outline">Probar Conexión</Button>
            </div>
          </CardContent>
        </Card>

        {/* Chat IA Integrado */}
        <div className="mt-8">
          <AIChatbot />
        </div>
      </div>
    </DashboardLayout>
  )
}
