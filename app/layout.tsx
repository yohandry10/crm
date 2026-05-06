import "@/polyfills/self"
import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { NavigationLoadingProvider } from "@/components/providers/navigation-loading-provider"
import { AuthProvider } from "@/components/providers/auth-provider"
import { SWRProvider } from "@/components/providers/swr-provider"
import { GlobalErrorReporter } from "@/components/providers/global-error-reporter"
import { GlobalChatbotWrapper } from "@/components/chatbot/global-chatbot-wrapper"
import { ErrorBoundary } from "@/components/error-boundary"
import { ThemeProvider } from "@/hooks/use-theme"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3b82f6",
}

export const metadata: Metadata = {
  title: "NEON SYSTEM - Gestion Inteligente de Negocios",
  description: "Sistema de gestion empresarial con IA integrada.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CRM AI",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <SWRProvider>
          <AuthProvider>
            <ThemeProvider>
              <ErrorBoundary>
                <GlobalErrorReporter />
                <NavigationLoadingProvider>
                  {children}
                </NavigationLoadingProvider>
                <GlobalChatbotWrapper />
                <Analytics />
                <SpeedInsights />
              </ErrorBoundary>
            </ThemeProvider>
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
