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
  Users, UserPlus, Mail, MoreHorizontal, Loader2, Trash2, Edit
} from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

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
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Equipo</h1>
            <p className="text-muted-foreground">Gestiona los miembros de tu organización</p>
          </div>
          {canManageTeam && (
            <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Invitar Miembro
            </Button>
          )}
        </div>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Miembros ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
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
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={member.profiles?.avatar_url || undefined} />
                            <AvatarFallback>
                              {getInitials(member.profiles?.full_name, member.profiles?.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.profiles?.full_name || "Sin nombre"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.profiles?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleConfig.color}>{roleConfig.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {member.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Activo</Badge>
                        ) : (
                          <Badge variant="outline">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString("es-PE")}
                      </TableCell>
                      {canManageTeam && (
                        <TableCell>
                          {member.role !== "owner" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingMember(member)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Cambiar Rol
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setMemberToDelete(member.id)}
                                  className="text-red-600"
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

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Invitaciones Pendientes ({invitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Enviada</TableHead>
                    {canManageTeam && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => {
                    const roleConfig = roleLabels[inv.role] || roleLabels.viewer

                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell>
                          <Badge className={roleConfig.color}>{roleConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString("es-PE")}
                        </TableCell>
                        {canManageTeam && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => cancelInvitation(inv.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
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
        )}

        {/* Invite Dialog */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent>
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
                />
              </div>

              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={newInvite.role}
                  onValueChange={(v) => setNewInvite(prev => ({ ...prev, role: v }))}
                >
                  <SelectTrigger>
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
              <Button onClick={sendInvitation} disabled={inviting}>
                {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar Invitación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent>
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
                <SelectTrigger>
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
