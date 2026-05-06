"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

type Props = {
  onCreated: (conversationId: string) => void
  onRefreshConversations: () => void
}

export function NewChatDialog({ onCreated, onRefreshConversations }: Props) {
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])

  const newChatSchema = z.object({
    contact_id: z.string().min(1, "Selecciona un contacto"),
    subject: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal('')),
  })

  type NewChatFormData = z.infer<typeof newChatSchema>

  const form = useForm<NewChatFormData>({
    resolver: zodResolver(newChatSchema),
    defaultValues: {
      contact_id: "",
      subject: "",
    },
    mode: "onChange",
  })

  const { handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = form
  const selectedContactId = watch("contact_id")

  const selectedContactName = useMemo(() => {
    return contacts.find((c) => c.id === selectedContactId)?.name
  }, [contacts, selectedContactId])

  useEffect(() => {
    if (!open) return
    const loadContacts = async () => {
      try {
        const res = await fetch("/api/contacts?limit=50")
        const data = await res.json()
        if (data.success || Array.isArray(data)) {
          setContacts(data.data || data)
        }
      } catch (e) {
        console.error("Failed to load contacts", e)
      }
    }
    loadContacts()
  }, [open])

  const resetState = () => {
    reset({ contact_id: "", subject: "" })
  }

  const onSubmit = async (formData: NewChatFormData) => {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: formData.contact_id,
          channel_type: "whatsapp",
          subject: formData.subject?.trim() ? formData.subject.trim() : null,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success("Chat creado")
        setOpen(false)
        resetState()
        onRefreshConversations()
        onCreated(json.data.id)
      } else {
        const errorMessage = typeof json.error === "string" ? json.error : JSON.stringify(json.error)
        toast.error(errorMessage || "Error al crear chat")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetState()
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" className="h-8 w-8 bg-cyan-600 hover:bg-cyan-700 text-white rounded-full">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Conversación</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Cliente</FormLabel>
                    <input type="hidden" {...field} />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between">
                          {selectedContactId ? selectedContactName : "Buscar contacto..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Buscar cliente..." />
                          <CommandList>
                            <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                            <CommandGroup>
                              {contacts.map((contact) => (
                                <CommandItem
                                  key={contact.id}
                                  value={contact.name}
                                  onSelect={() => {
                                    setValue("contact_id", contact.id, { shouldValidate: true })
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedContactId === contact.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {contact.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Asunto (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Consulta sobre precios" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || !selectedContactId}>
                {isSubmitting ? "Creando..." : "Iniciar Chat"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
