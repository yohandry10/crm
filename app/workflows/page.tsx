import { WorkflowsList } from "@/components/workflows/workflows-list"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TutorialButton } from "@/components/tutorials"

export default function WorkflowsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Automatización de Workflows</h1>
            <p className="text-muted-foreground">Configura reglas automáticas para tus leads</p>
          </div>
          <TutorialButton moduleId="workflows" />
        </div>
        <WorkflowsList />
      </div>
    </DashboardLayout>
  )
}
