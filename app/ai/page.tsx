import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AIChatbot } from "@/components/chatbot/ai-chatbot"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bot, Brain, Database, ShieldCheck } from "lucide-react"

export default function AIPage() {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "fallback"
  const hasGemini = provider === "gemini" && Boolean(process.env.GEMINI_API_KEY)
  const providerLabel = hasGemini ? "Gemini activo" : "Fallback local"

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Asistente IA</h1>
            <p className="text-gray-600 mt-2">Consultas asistidas sobre datos reales del CRM.</p>
          </div>
          <Badge variant={hasGemini ? "default" : "secondary"} className="h-8 px-3">
            <Brain className="w-4 h-4 mr-2" />
            {providerLabel}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-cyan-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-cyan-600" />
                  Chat CRM
                </CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Activo
                </Badge>
              </div>
              <CardDescription>Usa `/api/chat` con contexto multi-tenant validado.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Respuestas basadas en contactos, facturas y tareas de la organización actual.
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-600" />
                  Datos
                </CardTitle>
                <Badge variant="outline">Real</Badge>
              </div>
              <CardDescription>Sin métricas ficticias ni endpoints de simulación.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              La interfaz no muestra contadores o precisión si no vienen del backend.
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  Aislamiento
                </CardTitle>
                <Badge variant="outline">Tenant</Badge>
              </div>
              <CardDescription>Cada consulta se ejecuta dentro de la organización autenticada.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              El handler valida sesión, membresía y rate limit antes de responder.
            </CardContent>
          </Card>
        </div>

        <AIChatbot />
      </div>
    </DashboardLayout>
  )
}
