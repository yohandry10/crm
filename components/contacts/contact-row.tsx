"use client"

import { memo, useCallback } from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, Phone, Mail } from "lucide-react"

interface ContactRowProps {
  contact: any
  isSelected: boolean
  onToggleSelection: (id: string) => void
  onEdit: (contact: any) => void
  onDelete: (id: string) => void
  getStatusColor: (status: string) => string
}

export const ContactRow = memo(function ContactRow({
  contact,
  isSelected,
  onToggleSelection,
  onEdit,
  onDelete,
  getStatusColor,
}: ContactRowProps) {
  const handleToggle = useCallback(() => {
    onToggleSelection(contact.id)
  }, [contact.id, onToggleSelection])

  const handleEdit = useCallback(() => {
    onEdit(contact)
  }, [contact, onEdit])

  const handleDelete = useCallback(() => {
    onDelete(contact.id)
  }, [contact.id, onDelete])

  return (
    <TableRow className={isSelected ? "bg-primary/5" : ""}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleToggle}
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
        <div className="font-bold text-lg text-muted-foreground">
          {contact.lead_score || 0}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={handleEdit}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
})
