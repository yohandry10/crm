"use client"

import { useEffect, useState } from "react"

interface ServiceWorkerState {
  isSupported: boolean
  isRegistered: boolean
  isUpdateAvailable: boolean
  registration: ServiceWorkerRegistration | null
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdateAvailable: false,
    registration: null,
  })

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    setState((prev) => ({ ...prev, isSupported: true }))

    // Registrar Service Worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        setState((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }))

        // Verificar actualizaciones
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setState((prev) => ({ ...prev, isUpdateAvailable: true }))
              }
            })
          }
        })
      })
      .catch((error) => {
        console.error("Error registrando Service Worker:", error)
      })

    // Escuchar mensajes del SW
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        window.dispatchEvent(new CustomEvent("sw-sync-complete"))
      }
    })
  }, [])

  const update = () => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: "SKIP_WAITING" })
      window.location.reload()
    }
  }

  return { ...state, update }
}
