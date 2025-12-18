"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExportButton } from "@/components/data/export-button"
import { Upload, Search, Plus } from "lucide-react"
import { contactsExportColumns } from "@/lib/export-utils"

type Props = {
  contacts: any[]
  search: string
  onSearchChange: (value: string) => void
  onSubmitSearch: (e: React.FormEvent) => void
  onOpenImport: () => void
  onCreate: () => void
}

export function ContactsTableToolbar({
  contacts,
  search,
  onSearchChange,
  onSubmitSearch,
  onOpenImport,
  onCreate,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <form onSubmit={onSubmitSearch} className="flex-1 flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contactos..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <div className="flex items-center gap-2">
        <ExportButton data={contacts} columns={contactsExportColumns} filename="contactos" />
        <Button variant="outline" onClick={onOpenImport}>
          <Upload className="w-4 h-4 mr-2" />
          Importar
        </Button>
        <Button onClick={onCreate} className="gradient-neon border-0">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Contacto
        </Button>
      </div>
    </div>
  )
}

