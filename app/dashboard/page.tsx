import { Suspense } from 'react'
import DashboardLayout from "@/components/layout/dashboard-layout"
import { DashboardWrapper } from "@/components/dashboard/dashboard-wrapper"
import { DashboardModuleSkeleton } from '@/components/ui/module-skeleton'

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<DashboardModuleSkeleton />}>
        <DashboardWrapper />
      </Suspense>
    </DashboardLayout>
  )
}
