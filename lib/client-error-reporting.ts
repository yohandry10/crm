"use client"

type ClientErrorPayload = {
  errorId?: string
  source: "react-boundary" | "app-error" | "global-error" | "window-error" | "unhandled-rejection" | "swr"
  message: string
  stack?: string
  componentStack?: string
  digest?: string
  path?: string
  userAgent?: string
}

function createClientErrorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function normalizeClientError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message || "Error inesperado",
      stack: error.stack,
      digest: (error as Error & { digest?: string }).digest,
    }
  }

  if (typeof error === "string") {
    return { message: error }
  }

  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: "Error inesperado" }
  }
}

export async function reportClientError(payload: ClientErrorPayload) {
  if (typeof window === "undefined") return payload.errorId || createClientErrorId()

  const errorId = payload.errorId || createClientErrorId()

  try {
    const csrfResponse = await fetch("/api/auth/csrf", {
      credentials: "include",
      cache: "no-store",
    })
    const csrfJson = csrfResponse.ok ? await csrfResponse.json() : null
    const csrfToken = typeof csrfJson?.csrfToken === "string" ? csrfJson.csrfToken : ""

    await fetch("/api/client-errors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        ...payload,
        errorId,
        path: payload.path || window.location.pathname,
        userAgent: payload.userAgent || window.navigator.userAgent,
      }),
    })
  } catch {
    // Client error reporting must never create another user-visible failure.
  }

  return errorId
}
