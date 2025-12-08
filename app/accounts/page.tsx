import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AccountsTable } from "@/components/accounts/accounts-table"
import { TutorialButton } from "@/components/tutorials"

export default function AccountsPage() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cuentas / Empresas</h1>
            <p className="text-muted-foreground">Gestiona organizaciones, RUC y relaciones con contactos y oportunidades.</p>
          </div>
          <TutorialButton moduleId="accounts" />
        </div>
        <AccountsTable />
      </div>
    </DashboardLayout>
  )
}
