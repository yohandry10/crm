"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  MessageSquare, Send, MoreHorizontal, Pin, PinOff, 
  Trash2, Edit, Loader2 
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

interface Note {
  id: string
  content: string
  is_pinned: boolean
  created_at: string
  profiles: {
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

interface NotesPanelProps {
  entityType: string
  entityId: string
  title?: string
}

export function NotesPanel({ entityType, entityId, title = "Notas" }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

  useEffect(() => {
    loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  const loadNotes = async () => {
    try {
      const res = await fetch(`/api/notes?entity_type=${entityType}&entity_id=${entityId}`)
      const json = await res.json()
      if (json.success) {
        setNotes(json.data)
      }
    } catch (error) {
      console.error("Error loading notes:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!newNote.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          content: newNote.trim(),
        }),
      })

      const json = await res.json()
      if (json.success) {
        setNotes(prev => [json.data, ...prev])
        setNewNote("")
        toast.success("Nota agregada")
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al agregar nota")
    } finally {
      setSubmitting(false)
    }
  }

  const handlePin = async (note: Note) => {
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      })

      if (res.ok) {
        setNotes(prev => {
          const updated = prev.map(n => 
            n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n
          )
          // Re-sort: pinned first
          return updated.sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1
            if (!a.is_pinned && b.is_pinned) return 1
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
        })
      }
    } catch {
      toast.error("Error al actualizar nota")
    }
  }

  const handleEdit = async (noteId: string) => {
    if (!editContent.trim()) return

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      })

      if (res.ok) {
        setNotes(prev => prev.map(n => 
          n.id === noteId ? { ...n, content: editContent.trim() } : n
        ))
        setEditingId(null)
        toast.success("Nota actualizada")
      }
    } catch {
      toast.error("Error al actualizar nota")
    }
  }

  const handleDelete = async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" })
      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== noteId))
        toast.success("Nota eliminada")
      }
    } catch {
      toast.error("Error al eliminar nota")
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    return email[0].toUpperCase()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {title} ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New note input */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Escribe una nota..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                handleSubmit()
              }
            }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Ctrl+Enter para enviar</span>
          <Button 
            onClick={handleSubmit} 
            disabled={!newNote.trim() || submitting}
            size="sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Agregar
              </>
            )}
          </Button>
        </div>

        {/* Notes list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay notas aún
          </p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {notes.map((note) => (
                <div 
                  key={note.id} 
                  className={`p-3 rounded-lg border ${note.is_pinned ? "bg-amber-50 border-amber-200" : "bg-muted/30"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={note.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(note.profiles?.full_name || null, note.profiles?.email || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {note.profiles?.full_name || note.profiles?.email}
                          </span>
                          {note.is_pinned && <Pin className="w-3 h-3 text-amber-600" />}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: es })}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePin(note)}>
                          {note.is_pinned ? (
                            <><PinOff className="w-4 h-4 mr-2" />Desfijar</>
                          ) : (
                            <><Pin className="w-4 h-4 mr-2" />Fijar</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setEditingId(note.id)
                          setEditContent(note.content)
                        }}>
                          <Edit className="w-4 h-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(note.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {editingId === note.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEdit(note.id)}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm whitespace-pre-wrap">{note.content}</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
