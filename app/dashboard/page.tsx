import DashboardLayout from "@/components/layout/dashboard-layout"
import DashboardOverview from "@/components/dashboard/dashboard-overview"
import { AIChatbot } from "@/components/chatbot/ai-chatbot"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardOverview />
      <AIChatbot />
    </DashboardLayout>
  )
}
