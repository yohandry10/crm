import { DashboardLayout } from "@/components/layout/dashboard-layout"
import DashboardOverview from "@/components/dashboard/dashboard-overview"

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">KPIs de ventas, embudo y rendimiento por periodo.</p>
        </div>
        <DashboardOverview />
      </div>
    </DashboardLayout>
  )
}
