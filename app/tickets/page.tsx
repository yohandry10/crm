import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TicketsTable } from "@/components/tickets/tickets-table"
import { TutorialButton } from "@/components/tutorials"

export default function TicketsPage() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tickets de Soporte</h1>
            <p className="text-muted-foreground">Cola de casos, prioridades y asignaciones.</p>
          </div>
          <TutorialButton moduleId="tickets" />
        </div>
        <TicketsTable />
      </div>
    </DashboardLayout>
  )
}
