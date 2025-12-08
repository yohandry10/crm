"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Users, UserPlus, Mail, MoreHorizontal, Loader2, Trash2, Edit, ArrowLeft
} from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { motion } from "framer-motion"
import Link from "next/link"

interface TeamMember {
  id: string
  user_id: string
  role: string
  is_active: boolean
  created_at: string
  profiles: {
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}

interface Invitation {
  id: string
  email: string
  role: string
  created_at: string
  accepted_at: string | null
}

const roleLabels: Record<string, { label: string; color: string }> = {
  owner: { label: "Owner", color: "bg-purple-100 text-purple-800" },
  admin: { label: "Admin", color: "bg-blue-100 text-blue-800" },
  manager: { label: "Manager", color: "bg-green-100 text-green-800" },
  sales: { label: "Vendedor", color: "bg-yellow-100 text-yellow-800" },
  support: { label: "Soporte", color: "bg-orange-100 text-orange-800" },
  viewer: { label: "Viewer", color: "bg-gray-100 text-gray-800" },
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [newInvite, setNewInvite] = useState({ email: "", role: "sales" })
  const [currentUserRole, setCurrentUserRole] = useState<string>("")
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null)

  useEffect(() => {
    loadTeam()
  }, [])

  const loadTeam = async () => {
    try {
      const res = await fetch("/api/team")
      const json = await res.json()
      if (json.success) {
        setMembers(json.data.members || [])
        setInvitations(json.data.invitations || [])
        setCurrentUserRole(json.data.currentUserRole || "")
      }
    } catch (error) {
      toast.error("Error al cargar equipo")
    } finally {
      setLoading(false)
    }
  }

  const sendInvitation = async () => {
    if (!newInvite.email) {
      toast.error("Ingresa un email")
      return
    }

    setInviting(true)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInvite),
      })

      const json = await res.json()
      if (json.success) {
        toast.success("Invitación enviada")
        setInviteDialogOpen(false)
        setNewInvite({ email: "", role: "sales" })
        loadTeam()
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al enviar invitación")
    } finally {
      setInviting(false)
    }
  }

  const updateMemberRole = async (memberId: string, newRole: string) => {
    setUpdatingRole(true)
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success("Rol actualizado")
        setEditingMember(null)
        loadTeam()
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar")
    } finally {
      setUpdatingRole(false)
    }
  }

  const removeMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) {
        toast.success("Miembro eliminado")
        loadTeam()
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar")
    } finally {
      setMemberToDelete(null)
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/team/invite/${invitationId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.success) {
        toast.success("Invitación cancelada")
        loadTeam()
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al cancelar")
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const canManageTeam = ["owner", "admin"].includes(currentUserRole)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full" />
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 relative z-10" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <Link
            href="/settings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-cyan-600 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Configuración
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
                Equipo
              </h1>
              <p className="text-lg text-muted-foreground">
                Gestiona los miembros de tu organización
              </p>
            </div>

            {canManageTeam && (
              <Button
                onClick={() => setInviteDialogOpen(true)}
                className="bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20 transition-all hover:scale-105"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invitar Miembro
              </Button>
            )}
          </div>
        </motion.div>

        {/* Team Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-white/50">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="w-5 h-5 text-cyan-600" />
                Miembros ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow className="hover:bg-transparent border-gray-100">
                    <TableHead className="pl-6">Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Desde</TableHead>
                    {canManageTeam && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const roleConfig = roleLabels[member.role] || roleLabels.viewer

                    return (
                      <TableRow key={member.id} className="hover:bg-cyan-50/30 border-gray-100 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                              <AvatarImage src={member.profiles?.avatar_url || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700">
                                {getInitials(member.profiles?.full_name, member.profiles?.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">
                                {member.profiles?.full_name || "Sin nombre"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {member.profiles?.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${roleConfig.color} border-0 px-2.5 py-0.5`}>{roleConfig.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {member.is_active ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-100/50 text-green-700 text-xs font-medium w-fit border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              Activo
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(member.created_at).toLocaleDateString("es-PE", { year: 'numeric', month: 'short', day: 'numeric' })}
                        </TableCell>
                        {canManageTeam && (
                          <TableCell>
                            {member.role !== "owner" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => setEditingMember(member)} className="cursor-pointer">
                                    <Edit className="w-4 h-4 mr-2" />
                                    Cambiar Rol
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setMemberToDelete(member.id)}
                                    className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-gray-100 bg-white/50">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Mail className="w-5 h-5 text-orange-500" />
                  Invitaciones Pendientes ({invitations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow className="hover:bg-transparent border-gray-100">
                      <TableHead className="pl-6">Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Enviada</TableHead>
                      {canManageTeam && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => {
                      const roleConfig = roleLabels[inv.role] || roleLabels.viewer

                      return (
                        <TableRow key={inv.id} className="hover:bg-orange-50/30 border-gray-100 transition-colors">
                          <TableCell className="pl-6 font-medium text-gray-700">{inv.email}</TableCell>
                          <TableCell>
                            <Badge className={`${roleConfig.color} border-0 px-2.5 py-0.5`}>{roleConfig.label}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(inv.created_at).toLocaleDateString("es-PE", { year: 'numeric', month: 'short', day: 'numeric' })}
                          </TableCell>
                          {canManageTeam && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelInvitation(inv.id)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Invite Dialog */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invitar Miembro</DialogTitle>
              <DialogDescription>
                Envía una invitación por email para unirse a tu equipo
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@ejemplo.com"
                  className="bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={newInvite.role}
                  onValueChange={(v) => setNewInvite(prev => ({ ...prev, role: v }))}
                >
                  <SelectTrigger className="bg-gray-50 border-gray-200 focus:bg-white transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin - Gestión completa</SelectItem>
                    <SelectItem value="manager">Manager - Supervisión de equipo</SelectItem>
                    <SelectItem value="sales">Vendedor - Gestión de ventas</SelectItem>
                    <SelectItem value="support">Soporte - Gestión de tickets</SelectItem>
                    <SelectItem value="viewer">Viewer - Solo lectura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={sendInvitation} disabled={inviting} className="gradient-neon border-0 text-white">
                {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar Invitación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cambiar Rol</DialogTitle>
              <DialogDescription>
                Actualiza el rol de {editingMember?.profiles?.full_name || editingMember?.profiles?.email}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Select
                value={editingMember?.role}
                onValueChange={(v) => setEditingMember(prev => prev ? { ...prev, role: v } : null)}
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 focus:bg-white transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="sales">Vendedor</SelectItem>
                  <SelectItem value="support">Soporte</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingMember(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => editingMember && updateMemberRole(editingMember.id, editingMember.role)}
                disabled={updatingRole}
                className="gradient-neon border-0 text-white"
              >
                {updatingRole && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Member Confirmation Dialog */}
        <ConfirmDialog
          open={!!memberToDelete}
          onOpenChange={(open) => !open && setMemberToDelete(null)}
          title="Eliminar Miembro"
          description="¿Estás seguro de eliminar este miembro del equipo? Esta acción no se puede deshacer."
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="destructive"
          onConfirm={() => memberToDelete && removeMember(memberToDelete)}
        />
      </div>
    </DashboardLayout>
  )
}
