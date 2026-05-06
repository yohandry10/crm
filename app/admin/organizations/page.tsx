"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Plus, Search, MoreHorizontal, Building2, Eye, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Organization {
  id: string
  name: string
  slug: string
  ruc: string | null
  subscription_status: string
  subscription_plan: string
  trial_ends_at: string | null
  subscription_ends_at: string | null
  onboarding_completed: boolean
  created_at: string
  member_count?: number
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    try {
      const res = await fetch("/api/admin/organizations")
      const json = await res.json()
      if (json.success) {
        setOrganizations(json.data)
      }
    } catch {
      toast.error("Error al cargar organizaciones")
    } finally {
      setLoading(false)
    }
  }

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    org.slug.toLowerCase().includes(search.toLowerCase()) ||
    (org.ruc && org.ruc.includes(search))
  )

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
      trial: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
      expired: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
      cancelled: "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400",
      past_due: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400",
    }
    return styles[status] || "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400"
  }

  const getPlanBadge = (plan: string) => {
    const styles: Record<string, string> = {
      trial: "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400",
      starter: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400",
      professional: "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400",
      enterprise: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400",
    }
    return styles[plan] || "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400"
  }

  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Organizaciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona todas las organizaciones de la plataforma</p>
        </div>
        <Link href="/admin/organizations/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Organización
          </Button>
        </Link>
      </div>

      {/* Search & Table Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Search Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, slug o RUC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Organización</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">RUC</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Estado</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Plan</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Vencimiento</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Onboarding</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Creado</th>
                  <th className="w-[50px] px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500 text-sm">
                      No se encontraron organizaciones
                    </td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr key={org.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{org.name}</p>
                            <p className="text-xs text-gray-500">{org.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{org.ruc || "-"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusBadge(org.subscription_status)}`}>
                          {org.subscription_status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${getPlanBadge(org.subscription_plan)}`}>
                          {org.subscription_plan}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {org.subscription_status === 'trial' 
                          ? formatDate(org.trial_ends_at)
                          : formatDate(org.subscription_ends_at)
                        }
                      </td>
                      <td className="px-5 py-4">
                        {org.onboarding_completed ? (
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            Completado
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(org.created_at)}</td>
                      <td className="px-5 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/organizations/${org.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalles
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
