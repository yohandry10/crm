import type { NextRequest } from "next/server"

export function getServerAppBaseUrl(request?: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, "")
  }

  if (request) return request.nextUrl.origin

  return "http://localhost:3000"
}
