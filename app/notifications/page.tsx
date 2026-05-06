"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loading } from "@/components/ui/loading"
import { Bell, Check, Clock } from "lucide-react"
import { toast } from "sonner"

type NotificationItem = {
    id: string
    type: string
    title: string
    message: string
    read_at: string | null
    created_at: string
    source?: "notifications" | "system_notifications"
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat("es-PE", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(date))
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const loadNotifications = async () => {
        setLoading(true)
        try {
            const response = await fetch("/api/notifications?limit=50")
            const json = await response.json()
            if (!response.ok || !json.success) {
                throw new Error(json.error || "No se pudieron cargar las notificaciones")
            }
            setNotifications(json.data || [])
            setUnreadCount(json.unreadCount || 0)
        } catch (error: any) {
            toast.error(error.message || "Error al cargar notificaciones")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadNotifications()
    }, [])

    const markAsRead = async (notification?: NotificationItem) => {
        setSaving(true)
        try {
            const body = notification
                ? { notificationIds: [notification.id], source: notification.source }
                : { markAllRead: true }
            const response = await fetch("/api/notifications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const json = await response.json()
            if (!response.ok || !json.success) {
                throw new Error(json.error || "No se pudo actualizar")
            }
            await loadNotifications()
        } catch (error: any) {
            toast.error(error.message || "Error al marcar como leida")
        } finally {
            setSaving(false)
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
                        <p className="text-muted-foreground">Avisos de sistema y eventos de tu organizacion activa.</p>
                    </div>
                    <Button onClick={() => markAsRead()} disabled={saving || unreadCount === 0}>
                        <Check className="mr-2 h-4 w-4" />
                        Marcar todas
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Bandeja
                            {unreadCount > 0 && <Badge>{unreadCount} sin leer</Badge>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Loading text="Cargando notificaciones..." />
                        ) : notifications.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <Bell className="mx-auto mb-3 h-8 w-8 opacity-50" />
                                No hay notificaciones.
                            </div>
                        ) : (
                            <div className="divide-y rounded-md border">
                                {notifications.map((notification) => {
                                    const isUnread = !notification.read_at
                                    return (
                                        <div key={`${notification.source}-${notification.id}`} className="flex items-start justify-between gap-4 p-4">
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-medium">{notification.title}</p>
                                                    {isUnread && <Badge variant="secondary">Nueva</Badge>}
                                                    <Badge variant="outline">{notification.type}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{notification.message}</p>
                                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDate(notification.created_at)}
                                                </p>
                                            </div>
                                            {isUnread && (
                                                <Button variant="outline" size="sm" onClick={() => markAsRead(notification)} disabled={saving}>
                                                    Marcar leida
                                                </Button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
