import DashboardLayout from "@/components/layout/dashboard-layout"
import { AIChatbot } from "@/components/chatbot/ai-chatbot"
import { DashboardWrapper } from "@/components/dashboard/dashboard-wrapper"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardWrapper />
      <AIChatbot />
    </DashboardLayout>
  )
}
