import { Suspense } from 'react'
import { ContactsTable } from "@/components/contacts/contacts-table"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TutorialButton } from "@/components/tutorials"
import { TableModuleSkeleton } from '@/components/ui/module-skeleton'

export default function ContactsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<TableModuleSkeleton />}>
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
      </Suspense>
    </DashboardLayout>
  )
}
