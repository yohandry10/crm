"use client"

import { memo, useMemo, useCallback, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Phone, Mail, Star, Loader2 } from "lucide-react"

const getStatusColor = (status: string) => {
  switch (status) {
    case "hot":
      return "bg-red-500"
    case "warm":
      return "bg-yellow-500"
    case "cold":
      return "bg-blue-500"
    default:
      return "bg-gray-500"
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case "hot":
      return "Caliente"
    case "warm":
      return "Tibio"
    case "cold":
      return "Frío"
    default:
      return "Sin clasificar"
  }
}

const ContactCard = memo(({ contact }: { contact: any }) => (
  <div className="flex items-center space-x-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
    <Avatar>
      <AvatarImage src={contact.avatar || "/placeholder.svg"} alt={contact.name} />
      <AvatarFallback>
        {contact.name
          ? contact.name
            .split(" ")
            .map((n: string) => n[0])
            .join("")
          : "?"}
      </AvatarFallback>
    </Avatar>

    <div className="flex-1 min-w-0">
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium text-foreground truncate">{contact.name || "Sin nombre"}</p>
        <Badge variant="outline" className={`text-xs ${getStatusColor(contact.status)} text-white border-0`}>
          {getStatusText(contact.status)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground truncate">
        {contact.company || "Sin empresa"} • RUC: {contact.ruc || "N/A"}
      </p>
      <div className="flex items-center space-x-4 mt-1">
        <span className="text-xs text-muted-foreground flex items-center">
          <Mail className="w-3 h-3 mr-1" />
          {contact.email || "Sin email"}
        </span>
        <span className="text-xs text-muted-foreground flex items-center">
          <Phone className="w-3 h-3 mr-1" />
          {contact.phone || "Sin teléfono"}
        </span>
      </div>
    </div>

    <div className="text-right">
      <div className="flex items-center space-x-1">
        <Star className="w-4 h-4 text-yellow-500" />
        <span className="text-sm font-medium">{contact.leadScore || 0}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {contact.lastInteraction ? `Hace ${contact.lastInteraction}` : "Sin interacción"}
      </p>
    </div>
  </div>
))

ContactCard.displayName = "ContactCard"

export const ContactsSection = memo(() => {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/contacts')
      const result = await response.json()

      if (result.success) {
        // Asumiendo que la API devuelve un array de contactos en result.data
        // Ajustar según la estructura real de la respuesta
        setContacts(Array.isArray(result.data) ? result.data : [])
      } else {
        console.error("Failed to fetch contacts:", result.error)
        setError("No se pudieron cargar los contactos")
        // No mostrar toast aquí para no saturar si falla al cargar la página
      }
    } catch (err) {
      console.error("Error fetching contacts:", err)
      setError("Error de conexión al cargar contactos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const handleNewContact = useCallback(() => {
    router.push('/contacts?new=true')
  }, [router])

  const handleViewAll = useCallback(() => {
    router.push('/contacts')
  }, [router])

  const contactCards = useMemo(
    () => contacts.map((contact) => <ContactCard key={contact.id} contact={contact} />),
    [contacts],
  )

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contactos Recientes</CardTitle>
          <CardDescription>Cargando contactos...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contactos Recientes</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={fetchContacts}>Intentar de nuevo</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>Contactos Recientes</span>
              {contacts.length > 0 && <Badge variant="secondary">{contacts.length} nuevos</Badge>}
            </CardTitle>
            <CardDescription>Gestión inteligente con scoring de IA</CardDescription>
          </div>
          <Button size="sm" onClick={handleNewContact}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Contacto
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay contactos recientes
          </div>
        ) : (
          contactCards
        )}
        <Button variant="outline" className="w-full bg-transparent" onClick={handleViewAll}>
          Ver Todos los Contactos
        </Button>
      </CardContent>
    </Card>
  )
})

ContactsSection.displayName = "ContactsSection"
