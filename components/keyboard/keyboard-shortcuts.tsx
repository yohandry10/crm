"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ShortcutGroup {
  title: string
  shortcuts: {
    keys: string[]
    description: string
    action?: () => void
  }[]
}

interface KeyboardShortcutsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsProps) {
  const shortcutGroups: ShortcutGroup[] = [
    {
      title: "Navegación",
      shortcuts: [
        { keys: ["Ctrl", "K"], description: "Búsqueda global" },
        { keys: ["G", "D"], description: "Ir al Dashboard" },
        { keys: ["G", "C"], description: "Ir a Contactos" },
        { keys: ["G", "S"], description: "Ir a Ventas" },
        { keys: ["G", "T"], description: "Ir a Tareas" },
        { keys: ["G", "F"], description: "Ir a Facturas" },
      ],
    },
    {
      title: "Acciones",
      shortcuts: [
        { keys: ["N"], description: "Nuevo registro (en módulo actual)" },
        { keys: ["E"], description: "Editar seleccionado" },
        { keys: ["Del"], description: "Eliminar seleccionado" },
        { keys: ["Ctrl", "S"], description: "Guardar" },
        { keys: ["Esc"], description: "Cerrar modal / Cancelar" },
      ],
    },
    {
      title: "Selección",
      shortcuts: [
        { keys: ["Ctrl", "A"], description: "Seleccionar todo" },
        { keys: ["Shift", "Click"], description: "Selección múltiple" },
        { keys: ["↑", "↓"], description: "Navegar lista" },
        { keys: ["Enter"], description: "Abrir seleccionado" },
      ],
    },
    {
      title: "Otros",
      shortcuts: [
        { keys: ["?"], description: "Mostrar atajos de teclado" },
        { keys: ["Ctrl", "\\"], description: "Toggle sidebar" },
      ],
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atajos de Teclado</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2 py-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">
                {group.title}
              </h4>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, j) => (
                        <kbd
                          key={j}
                          className="px-2 py-1 text-xs font-mono bg-muted rounded border"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook para manejar shortcuts globales
export function useKeyboardShortcuts() {
  const router = useRouter()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignorar si está escribiendo en un input
    const target = e.target as HTMLElement
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return
    }

    const key = e.key.toLowerCase()
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey

    // Ctrl+K - Búsqueda global (manejado por GlobalSearch)
    if (ctrl && key === "k") {
      return // Ya manejado
    }

    // ? - Mostrar atajos
    if (key === "?" && !ctrl && !shift) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent("show-shortcuts"))
      return
    }

    // G + letra - Navegación
    if (key === "g" && !ctrl) {
      const handleSecondKey = (e2: KeyboardEvent) => {
        const key2 = e2.key.toLowerCase()
        window.removeEventListener("keydown", handleSecondKey)
        
        switch (key2) {
          case "d":
            e2.preventDefault()
            router.push("/dashboard")
            break
          case "c":
            e2.preventDefault()
            router.push("/contacts")
            break
          case "s":
            e2.preventDefault()
            router.push("/pipeline")
            break
          case "t":
            e2.preventDefault()
            router.push("/tasks")
            break
          case "f":
            e2.preventDefault()
            router.push("/invoicing")
            break
          case "p":
            e2.preventDefault()
            router.push("/products")
            break
        }
      }
      
      window.addEventListener("keydown", handleSecondKey, { once: true })
      setTimeout(() => {
        window.removeEventListener("keydown", handleSecondKey)
      }, 1000)
      return
    }
  }, [router])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}
