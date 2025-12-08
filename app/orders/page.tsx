import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { OrdersTable } from "@/components/orders/orders-table"
import { TutorialButton } from "@/components/tutorials"

export default function OrdersPage() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pedidos</h1>
            <p className="text-muted-foreground">Pedidos derivados de oportunidades ganadas o cotizaciones.</p>
          </div>
          <TutorialButton moduleId="orders" />
        </div>
        <OrdersTable />
      </div>
    </DashboardLayout>
  )
}
