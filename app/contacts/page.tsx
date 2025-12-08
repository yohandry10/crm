import { ContactsTable } from "@/components/contacts/contacts-table"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TutorialButton } from "@/components/tutorials"

export default function ContactsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Contactos</h1>
            <p className="text-muted-foreground">Administra tus clientes y leads</p>
          </div>
          <TutorialButton moduleId="contacts" />
        </div>
        <ContactsTable />
      </div>
    </DashboardLayout>
  )
}
