"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  entityType: string
  entityId: string
  entityName?: string
  size?: "default" | "sm" | "lg" | "icon"
  variant?: "default" | "ghost" | "outline"
  className?: string
}

export function FavoriteButton({
  entityType,
  entityId,
  entityName,
  size = "icon",
  variant = "ghost",
  className,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkFavorite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  const checkFavorite = async () => {
    try {
      const res = await fetch(`/api/favorites?entity_type=${entityType}`)
      const json = await res.json()
      if (json.success) {
        const found = json.data.some((f: any) => f.entity_id === entityId)
        setIsFavorite(found)
      }
    } catch (error) {
      console.error("Error checking favorite:", error)
    }
  }

  const toggleFavorite = async () => {
    setLoading(true)
    try {
      if (isFavorite) {
        // Remove
        const res = await fetch(
          `/api/favorites?entity_type=${entityType}&entity_id=${entityId}`,
          { method: "DELETE" }
        )
        if (res.ok) {
          setIsFavorite(false)
          toast.success("Eliminado de favoritos")
        }
      } else {
        // Add
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            entity_name: entityName,
          }),
        })
        if (res.ok) {
          setIsFavorite(true)
          toast.success("Agregado a favoritos")
        }
      }
    } catch (error) {
      toast.error("Error al actualizar favoritos")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleFavorite}
      disabled={loading}
      className={cn(className)}
      title={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
    >
      <Star
        className={cn(
          "w-4 h-4 transition-colors",
          isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
        )}
      />
    </Button>
  )
}
