"use client"

import { useOnlineStatus } from "@/hooks/use-online-status"
import { WifiOff } from "lucide-react"

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-yellow-500 text-yellow-950 px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-left">
      <WifiOff className="w-4 h-4" />
      <span className="text-sm font-medium">Sin conexión</span>
    </div>
  )
}
