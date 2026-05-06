import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Rutas excluidas del token CSRF. Las mutaciones autenticadas siguen validando Origin.
const CSRF_EXCLUDED_PATHS = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/change-password",
  "/api/auth/bootstrap",
  "/api/public",
  "/api/onboarding",
  "/api/subscriptions",
  "/api/settings",
  "/api/admin",
  "/api/invitations",
  "/api/pay",
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
  "/api/organizations",
  "/api/profile",
  "/api/forms",
  "/api/calendar",
  "/api/reports",
  "/api/webhooks",
  "/api/chat",
  "/api/upload",
  "/api/payment-links",
]

const PUBLIC_MUTATION_PATHS = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/bootstrap",
  "/api/public",
  "/api/pay",
  "/api/calendar/booking",
]

function hasPathPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(path => pathname.startsWith(path))
}

function rejectInvalidOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  const host = request.nextUrl.origin

  if (origin && origin !== host) {
    return NextResponse.json({ success: false, error: "CSRF: invalid origin" }, { status: 403 })
  }

  return null
}

// CSRF token middleware: espera header "x-csrf-token" y cookie "csrf-token"
export function csrfMiddleware(request: NextRequest) {
  const method = request.method
  const pathname = request.nextUrl.pathname
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method)

  if (!isMutation) {
    return null
  }

  if (hasPathPrefix(pathname, CSRF_EXCLUDED_PATHS)) {
    if (hasPathPrefix(pathname, PUBLIC_MUTATION_PATHS)) {
      return null
    }

    return rejectInvalidOrigin(request)
  }

  const originRejection = rejectInvalidOrigin(request)
  if (originRejection) {
    return originRejection
  }

  const cookieToken = request.cookies.get("csrf-token")?.value
  const headerToken = request.headers.get("x-csrf-token")

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ success: false, error: "CSRF token invalid" }, { status: 403 })
  }

  return null
}
