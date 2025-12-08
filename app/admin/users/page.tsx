"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Search, Users, Shield, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface User {
  id: string
  email: string
  full_name: string | null
  is_platform_admin: boolean
  created_at: string
  organizations: { name: string; role: string }[]
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users")
      const json = await res.json()
      if (json.success) {
        setUsers(json.data)
      }
    } catch {
      toast.error("Error al cargar usuarios")
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(search.toLowerCase()))
  )

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Usuarios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Todos los usuarios registrados en la plataforma</p>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Search Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre o email..."
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
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-5 py-3">Usuario</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-5 py-3">Organizaciones</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-5 py-3">Tipo</th>
                  <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-5 py-3">Registrado</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-500 text-sm">
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${user.is_platform_admin ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                            {user.is_platform_admin ? (
                              <Shield className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            ) : (
                              <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{user.full_name || "Sin nombre"}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {user.organizations.length > 0 ? (
                            user.organizations.map((org, i) => (
                              <span key={i} className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                {org.name} ({org.role})
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 text-sm">Sin organización</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {user.is_platform_admin ? (
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400">
                            Super Admin
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            Usuario
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(user.created_at)}</td>
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
