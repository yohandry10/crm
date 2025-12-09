import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Rutas excluidas de CSRF (webhooks externos, auth y rutas internas autenticadas por sesión)
// Las rutas autenticadas por cookie de sesión de Supabase no necesitan CSRF adicional
const CSRF_EXCLUDED_PATHS = [
  "/api/webhooks/n8n",
  "/api/webhooks/stripe",
  "/api/payments/stripe/webhook",
  "/api/auth/login",
  "/api/auth/change-password",
  "/api/public",
  "/api/onboarding",
  "/api/subscriptions",
  "/api/settings",
  // Rutas internas autenticadas - la sesión de Supabase las protege
  "/api/contacts",
  "/api/invoices",
  "/api/payments",
  "/api/workflows",
  "/api/products",
  "/api/campaigns",
  "/api/opportunities",
  "/api/quotes",
  "/api/tasks",
  "/api/events",
  "/api/inventory",
  "/api/dashboard",
  "/api/analytics",
  "/api/accounts",
  "/api/tickets",
  "/api/orders",
  "/api/notes",
  "/api/activity",
  "/api/team",
  "/api/notifications",
  "/api/profile",
  "/api/forms",
  "/api/calendar",
  "/api/reports",
  "/api/chat",
  "/api/upload",
  "/api/payment-links",
]

// CSRF token middleware: espera header "x-csrf-token" y cookie "csrf-token"
export function csrfMiddleware(request: NextRequest) {
  const method = request.method
  const pathname = request.nextUrl.pathname

  // ✅ Excluir webhooks externos de la validación CSRF
  if (CSRF_EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    return null
  }

  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return null
  }

  const origin = request.headers.get("origin")
  const host = request.nextUrl.origin
  if (origin && origin !== host) {
    return NextResponse.json({ success: false, error: "CSRF: invalid origin" }, { status: 403 })
  }

  const cookieToken = request.cookies.get("csrf-token")?.value
  const headerToken = request.headers.get("x-csrf-token")

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ success: false, error: "CSRF token invalid" }, { status: 403 })
  }

  return null
}
