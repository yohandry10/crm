"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TutorialButton } from "@/components/tutorials"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Mail, MessageSquare, Send, Users, Eye, MousePointer, Loader2, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Campaign {
    id: string
    name: string
    description: string
    type: 'email' | 'whatsapp' | 'sms' | 'mixed'
    status: string
    contact_count: number
    sent_count: number
    delivered_count: number
    opened_count: number
    clicked_count: number
    converted_count: number
    scheduled_at: string
    subject: string | null
    content: string | null
    target_segment: Record<string, any> | null
    budget: number
    created_at: string
}

const statusColors: Record<string, string> = {
    draft: "secondary",
    scheduled: "outline",
    active: "default",
    paused: "secondary",
    completed: "default",
    cancelled: "destructive"
}

const statusLabels: Record<string, string> = {
    draft: "Borrador",
    scheduled: "Programada",
    active: "Activa",
    paused: "Pausada",
    completed: "Completada",
    cancelled: "Cancelada"
}

const typeIcons: Record<string, any> = {
    email: Mail,
    whatsapp: MessageSquare,
    sms: Send,
    mixed: Users
}

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [form, setForm] = useState<Partial<Campaign>>({})
    const [deleteId, setDeleteId] = useState<string | null>(null)

    useEffect(() => {
        fetchCampaigns()
    }, [])

    const fetchCampaigns = async () => {
        try {
            const res = await fetch('/api/campaigns')
            const data = await res.json()
            if (data.success) {
                setCampaigns(data.data)
            }
        } catch {
            toast.error("Error al cargar campañas")
        } finally {
            setLoading(false)
        }
    }

    const getOpenRate = (campaign: Campaign) => {
        if (campaign.delivered_count === 0) return 0
        return Math.round((campaign.opened_count / campaign.delivered_count) * 100)
    }

    const getClickRate = (campaign: Campaign) => {
        if (campaign.opened_count === 0) return 0
        return Math.round((campaign.clicked_count / campaign.opened_count) * 100)
    }

    const getSendProgress = (campaign: Campaign) => {
        if (!campaign.contact_count || campaign.contact_count <= 0) return 0
        return Math.min(100, Math.round((campaign.sent_count / campaign.contact_count) * 100))
    }

    const openCreate = () => {
        setForm({ type: 'email', status: 'draft', target_segment: { type: "all_contacts" }, budget: 0 })
        setDialogOpen(true)
    }

    const openEdit = (campaign: Campaign) => {
        setForm(campaign)
        setDialogOpen(true)
    }

    const save = async () => {
        try {
            const scheduledAt = form.scheduled_at
                ? new Date(form.scheduled_at).toISOString()
                : null
            const payload = {
                name: form.name || "",
                description: form.description || "",
                type: form.type || "email",
                status: form.status || "draft",
                subject: form.subject || null,
                content: form.content || null,
                target_segment: form.target_segment || { type: "all_contacts" },
                scheduled_at: scheduledAt,
                budget: Number(form.budget || 0),
            }
            
            const res = await fetch(form.id ? `/api/campaigns/${form.id}` : "/api/campaigns", {
                method: form.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Error")
            
            toast.success(form.id ? "Campaña actualizada" : "Campaña creada")
            setDialogOpen(false)
            setForm({})
            fetchCampaigns()
        } catch (error: any) {
            toast.error(error.message || "Error al guardar")
        }
    }

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" })
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Error")
            toast.success("Campaña eliminada")
            fetchCampaigns()
        } catch (error: any) {
            toast.error(error.message || "Error al eliminar")
        } finally {
            setDeleteId(null)
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Campañas de Marketing</h1>
                        <p className="text-muted-foreground">Gestiona tus campañas de email, WhatsApp y SMS</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TutorialButton moduleId="campaigns" />
                        <Button className="gradient-neon border-0" onClick={openCreate}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nueva Campaña
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Campañas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{campaigns.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Activas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {campaigns.filter(c => c.status === 'active').length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Emails Enviados</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {campaigns.reduce((sum, c) => sum + c.sent_count, 0).toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Conversiones</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {campaigns.reduce((sum, c) => sum + c.converted_count, 0)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Campaign List */}
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : campaigns.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No hay campañas creadas</p>
                            <Button className="mt-4 gradient-neon border-0" onClick={openCreate}>
                                <Plus className="w-4 h-4 mr-2" />
                                Crear primera campaña
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {campaigns.map((campaign) => {
                            const TypeIcon = typeIcons[campaign.type] || Mail
                            return (
                                <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                    <TypeIcon className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                                                    <CardDescription>{campaign.description}</CardDescription>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={statusColors[campaign.status] as any}>
                                                    {statusLabels[campaign.status]}
                                                </Badge>
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(campaign)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setDeleteId(campaign.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-4 md:grid-cols-4">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm">{campaign.contact_count} contactos</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Send className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm">{campaign.sent_count} enviados</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Eye className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm">{getOpenRate(campaign)}% aperturas</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MousePointer className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm">{getClickRate(campaign)}% clicks</span>
                                            </div>
                                        </div>
                                        {campaign.status === 'active' && (
                                            <div className="mt-4">
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span>Progreso</span>
                                                    <span>{getSendProgress(campaign)}%</span>
                                                </div>
                                                <Progress value={getSendProgress(campaign)} />
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{form.id ? "Editar campaña" : "Nueva campaña"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Nombre*</Label>
                                <Input
                                    value={form.name || ""}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ej: Campaña Black Friday"
                                />
                            </div>
                            <div>
                                <Label>Descripción</Label>
                                <Textarea
                                    value={form.description || ""}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Describe el objetivo de la campaña..."
                                />
                            </div>
                            <div>
                                <Label>Asunto</Label>
                                <Input
                                    value={form.subject || ""}
                                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                    placeholder="Asunto para email o titulo interno"
                                />
                            </div>
                            <div>
                                <Label>Contenido</Label>
                                <Textarea
                                    value={form.content || ""}
                                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                                    placeholder="Mensaje de la campaña..."
                                    rows={5}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Tipo</Label>
                                    <Select value={form.type || "email"} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="email">Email</SelectItem>
                                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                            <SelectItem value="sms">SMS</SelectItem>
                                            <SelectItem value="mixed">Mixta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Estado</Label>
                                    <Select value={form.status || "draft"} onValueChange={(v) => setForm({ ...form, status: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="draft">Borrador</SelectItem>
                                            <SelectItem value="scheduled">Programada</SelectItem>
                                            <SelectItem value="active">Activa</SelectItem>
                                            <SelectItem value="paused">Pausada</SelectItem>
                                            <SelectItem value="completed">Completada</SelectItem>
                                            <SelectItem value="cancelled">Cancelada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Audiencia</Label>
                                    <Select
                                        value={(form.target_segment as any)?.type || "all_contacts"}
                                        onValueChange={(v) => setForm({ ...form, target_segment: { type: v } })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all_contacts">Todos los contactos</SelectItem>
                                            <SelectItem value="hot_leads">Leads calientes</SelectItem>
                                            <SelectItem value="customers">Clientes</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Presupuesto</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.budget ?? 0}
                                        onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            {form.status === "scheduled" && (
                                <div>
                                    <Label>Fecha programada</Label>
                                    <Input
                                        type="datetime-local"
                                        value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ""}
                                        onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="flex gap-2 pt-2">
                                <Button onClick={save}>{form.id ? "Actualizar" : "Crear"}</Button>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <ConfirmDialog
                    open={!!deleteId}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                    title="¿Eliminar campaña?"
                    description="Esta acción no se puede deshacer. Se perderán todas las estadísticas asociadas."
                    onConfirm={() => deleteId && handleDelete(deleteId)}
                    confirmText="Eliminar"
                    cancelText="Cancelar"
                />
            </div>
        </DashboardLayout>
    )
}
