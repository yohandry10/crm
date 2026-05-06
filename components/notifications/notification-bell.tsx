"use client"

import { useState, useEffect } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, Check, AlertTriangle, CreditCard, Clock, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data: any
  read_at: string | null
  created_at: string
  source?: "notifications" | "system_notifications"
}

const notificationIcons: Record<string, any> = {
  trial_expiring: Clock,
  payment_failed: AlertTriangle,
  subscription_cancelled: CreditCard,
  team_invite: UserPlus,
  default: Bell,
}

const notificationColors: Record<string, string> = {
  trial_expiring: "text-yellow-500 bg-yellow-50",
  payment_failed: "text-red-500 bg-red-50",
  subscription_cancelled: "text-gray-500 bg-gray-50",
  team_invite: "text-blue-500 bg-blue-50",
  default: "text-primary bg-primary/10",
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadNotifications()

    const supabase = getSupabaseBrowserClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotifications(prev => [{ ...(payload.new as Notification), source: "notifications" }, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "system_notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotifications(prev => [{ ...(payload.new as Notification), source: "system_notifications" }, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        )
        .subscribe()
    }

    void subscribe()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const loadNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=10")
      const json = await res.json()
      if (json.success) {
        setNotifications(json.data || [])
        setUnreadCount(json.unreadCount || 0)
      }
    } catch (error) {
      console.error("Error loading notifications:", error)
    }
  }

  const markAsRead = async (notification?: Notification) => {
    setLoading(true)
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          notification
            ? { notificationIds: [notification.id], source: notification.source }
            : { markAllRead: true }
        ),
      })

      if (notification) {
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Error marking as read:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date: string) => {
    const now = new Date()
    const notifDate = new Date(date)
    const diffMs = now.getTime() - notifDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Ahora"
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return notifDate.toLocaleDateString("es-PE", { day: "numeric", month: "short" })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificaciones</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1"
              onClick={() => markAsRead()}
              disabled={loading}
            >
              <Check className="w-3 h-3 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || notificationIcons.default
                const colorClass = notificationColors[notification.type] || notificationColors.default
                const isUnread = !notification.read_at

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                      isUnread && "bg-blue-50/50"
                    )}
                    onClick={() => isUnread && markAsRead(notification)}
                  >
                    <div className="flex gap-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm font-medium", isUnread && "text-foreground")}>
                            {notification.title}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
              <a href="/notifications">Ver todas las notificaciones</a>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
