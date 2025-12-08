"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { TutorialButton } from "@/components/tutorials"

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analíticas</h1>
            <p className="text-muted-foreground">Métricas y reportes de tu negocio</p>
          </div>
          <TutorialButton moduleId="analytics" />
        </div>
        <AnalyticsDashboard />
      </div>
    </DashboardLayout>
  )
}
