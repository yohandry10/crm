"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { InboxClient } from "@/components/chat/inbox-client"

export default function InboxPage() {
    return (
        <DashboardLayout>
            <InboxClient />
        </DashboardLayout>
    )
}
