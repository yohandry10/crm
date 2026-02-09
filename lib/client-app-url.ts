/**
 * Returns the canonical app base URL in the browser.
 * Prefers NEXT_PUBLIC_APP_URL when configured; falls back to current origin.
 */
export function getClientAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, "")
  }

  if (typeof window !== "undefined") {
    return window.location.origin
  }

  return ""
}
