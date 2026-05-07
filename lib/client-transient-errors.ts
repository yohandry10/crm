"use client"

export function isTransientClientFetchError(error: unknown) {
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : String(error || "")

  return (
    name === "AbortError" ||
    message.includes("Failed to fetch") ||
    message.includes("Load failed") ||
    message.includes("NetworkError when attempting to fetch resource") ||
    message.includes("The user aborted a request")
  )
}
