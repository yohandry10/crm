"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loading } from "@/components/ui/loading"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Mail, Phone, Trash2 } from "lucide-react"
import { LeadScoreBadge } from "@/components/contacts/lead-score-badge"
import { WhatsAppButton } from "@/components/contacts/whatsapp-button"

type Props = {
  contacts: any[]
  loading: boolean
  allSelected: boolean
  someSelected: boolean
  onToggleAll: (checked: boolean) => void
  isSelected: (id: string) => boolean
  onToggleOne: (id: string) => void
  onEdit: (contact: any) => void
  onDelete: (id: string) => void
  getStatusColor: (status: string) => string
}

export function ContactsTableGrid({
  contacts,
  loading,
  allSelected,
  someSelected,
  onToggleAll,
  isSelected,
  onToggleOne,
  onEdit,
  onDelete,
  getStatusColor,
}: Props) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as any).indeterminate = someSelected
                }}
                onCheckedChange={(checked) => onToggleAll(!!checked)}
                aria-label="Seleccionar todos"
              />
            </TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Empresa / Cargo</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                <Loading text="Cargando contactos..." />
              </TableCell>
            </TableRow>
          ) : contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No se encontraron contactos
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow key={contact.id} className={isSelected(contact.id) ? "bg-primary/5" : ""}>
                <TableCell>
                  <Checkbox
                    checked={isSelected(contact.id)}
                    onCheckedChange={() => onToggleOne(contact.id)}
                    aria-label={`Seleccionar ${contact.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{contact.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{contact.company || "-"}</span>
                    <span className="text-xs text-muted-foreground">{contact.position}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    {contact.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        {contact.email}
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {contact.phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`${getStatusColor(contact.lead_status)} text-white border-0`}>
                    {contact.lead_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <LeadScoreBadge score={contact.lead_score || 0} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {contact.phone && (
                      <WhatsAppButton
                        phone={contact.phone}
                        contactName={contact.name}
                        contactId={contact.id}
                        variant="ghost"
                        size="icon"
                      />
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onEdit(contact)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(contact.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

