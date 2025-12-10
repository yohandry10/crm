"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"

import { toast } from "sonner"
import { CalendarDays, Clock, CheckCircle, Loader2, ArrowLeft } from "lucide-react"

interface BookingSlot {
  start: string
  end: string
  available: boolean
}

interface BookingConfig {
  name: string
  duration: number
}

export default function PublicBookingPage() {
  const params = useParams()
  const configId = params?.configId as string

  const [config, setConfig] = useState<BookingConfig | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null)
  const [loading, setLoading] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [booked, setBooked] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  })

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const fetchSlots = async (date: Date) => {
    setSlotsLoading(true)
    try {
      const dateStr = date.toISOString().split("T")[0]
      const res = await fetch(`/api/calendar/booking?config_id=${configId}&date=${dateStr}`)
      const data = await res.json()
      
      if (data.success) {
        setConfig(data.data.config)
        setSlots(data.data.slots)
      } else {
        toast.error(data.error || "Error al cargar horarios")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSlotsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot) return

    setLoading(true)
    try {
      const res = await fetch("/api/calendar/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config_id: configId,
          slot_start: selectedSlot.start,
          ...formData,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setBooked(true)
        toast.success("¡Cita agendada exitosamente!")
      } else {
        toast.error(data.error || "Error al agendar")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  if (booked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">¡Cita Confirmada!</h2>
            <p className="text-muted-foreground mb-4">
              Te hemos enviado un email de confirmación con los detalles.
            </p>
            {selectedSlot && (
              <div className="bg-muted rounded-lg p-4 text-left">
                <p className="font-medium">{config?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedSlot.start).toLocaleDateString("es-PE", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric"
                  })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedSlot.start).toLocaleTimeString("es-PE", {
                    hour: "2-digit", minute: "2-digit"
                  })}
                </p>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2 items-center">
              <Button variant="outline" onClick={() => {
                setBooked(false)
                setSelectedSlot(null)
                setSelectedDate(undefined)
              }}>
                Ver otra fecha
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Volver al dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center border-b">
            <CardTitle className="text-2xl">{config?.name || "Agendar Cita"}</CardTitle>
            <CardDescription>
              {config && `Duración: ${config.duration} minutos`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Calendar */}
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  Selecciona una fecha
                </h3>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0}
                  className="rounded-md border"
                />
              </div>

              {/* Slots & Form */}
              <div className="space-y-6">
                {selectedDate && (
                  <>
                    <div>
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Horarios disponibles
                      </h3>
                      {slotsLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : slots.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          No hay horarios disponibles para esta fecha
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {slots.filter(s => s.available).map((slot) => (
                            <Button
                              key={slot.start}
                              variant={selectedSlot?.start === slot.start ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedSlot(slot)}
                            >
                              {new Date(slot.start).toLocaleTimeString("es-PE", {
                                hour: "2-digit", minute: "2-digit"
                              })}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedSlot && (
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nombre *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Teléfono</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">Notas adicionales</Label>
                          <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Confirmar Cita
                        </Button>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
