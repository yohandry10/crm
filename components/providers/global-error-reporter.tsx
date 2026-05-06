"use client"

import { useEffect } from "react"
import { normalizeClientError, reportClientError } from "@/lib/client-error-reporting"

export function GlobalErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const normalized = normalizeClientError(event.error || event.message)
      void reportClientError({
        source: "window-error",
        message: normalized.message,
        stack: normalized.stack,
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const normalized = normalizeClientError(event.reason)
      void reportClientError({
        source: "unhandled-rejection",
        message: normalized.message,
        stack: normalized.stack,
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  return null
}
