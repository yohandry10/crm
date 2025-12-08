import { IntegrationsGrid } from "@/components/integrations/integrations-grid"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export default function IntegrationsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Integraciones</h1>
          <p className="text-muted-foreground">Conecta tus herramientas favoritas</p>
        </div>
        <IntegrationsGrid />
      </div>
    </DashboardLayout>
  )
}
