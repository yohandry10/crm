"use client"

import { useState, useEffect, useCallback } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, X, ExternalLink } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import Link from "next/link"

interface Duplicate {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  match_type: "email" | "phone" | "name"
}

interface DuplicateDetectorProps {
  email?: string
  phone?: string
  name?: string
  excludeId?: string
  onDismiss?: () => void
}

export function DuplicateDetector({
  email,
  phone,
  name,
  excludeId,
  onDismiss,
}: DuplicateDetectorProps) {
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])
  const [dismissed, setDismissed] = useState(false)

  // Debounce values to avoid too many API calls
  const debouncedEmail = useDebounce(email, 500)
  const debouncedPhone = useDebounce(phone, 500)
  const debouncedName = useDebounce(name, 500)

  const checkDuplicates = useCallback(async () => {
    if (!debouncedEmail && !debouncedPhone) {
      setDuplicates([])
      return
    }

    try {
      const params = new URLSearchParams()
      if (debouncedEmail) params.set("email", debouncedEmail)
      if (debouncedPhone) params.set("phone", debouncedPhone)
      if (debouncedName) params.set("name", debouncedName)
      if (excludeId) params.set("exclude_id", excludeId)

      const res = await fetch(`/api/contacts/duplicates?${params}`)
      const json = await res.json()

      if (json.success) {
        setDuplicates(json.data)
        setDismissed(false)
      }
    } catch (error) {
      console.error("Error checking duplicates:", error)
    }
  }, [debouncedEmail, debouncedPhone, debouncedName, excludeId])

  useEffect(() => {
    checkDuplicates()
  }, [checkDuplicates])

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  if (dismissed || duplicates.length === 0) {
    return null
  }

  const getMatchLabel = (type: string) => {
    switch (type) {
      case "email": return "Mismo email"
      case "phone": return "Mismo teléfono"
      case "name": return "Mismo nombre"
      default: return "Coincidencia"
    }
  }

  return (
    <Alert variant="destructive" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Posibles duplicados encontrados</AlertTitle>
      <AlertDescription>
        <p className="mb-3">
          Se encontraron {duplicates.length} contacto(s) que podrían ser duplicados:
        </p>
        <div className="space-y-2">
          {duplicates.map((dup) => (
            <div 
              key={dup.id} 
              className="flex items-center justify-between p-2 bg-red-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-sm">{dup.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {dup.email || dup.phone || dup.company}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {getMatchLabel(dup.match_type)}
                </Badge>
              </div>
              <Link href={`/contacts/${dup.id}`} target="_blank">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  )
}
