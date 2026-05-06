"use client"

import { usePathname } from "next/navigation"
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget"

export function GlobalChatbotWrapper() {
    const pathname = usePathname() ?? ""

    // Blacklist paths where the chatbot should NOT appear
    const hiddenPaths = ["/login", "/signup", "/forgot-password", "/reset-password", "/terms", "/privacy", "/"]

    // Also hide if it's strictly the landing page (root) depending on requirement, 
    // but usually CRM apps have a landing page at root. 
    // If the user wants it EVERYWHERE inside the CRM, we assume paths like /dashboard, /pipeline, etc.

    // If the path is exactly one of the hidden paths, don't render
    if (hiddenPaths.includes(pathname)) {
        return null
    }

    // Double check auth routes that might have subpaths
    if (
        pathname.startsWith("/auth") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/pay/") ||
        pathname.startsWith("/book/") ||
        pathname.startsWith("/f/")
    ) {
        return null
    }

    return <ChatbotWidget />
}
