"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog, DialogContent, DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search, User, Building2, DollarSign, FileText, CheckSquare,
  Ticket, Package, Loader2, ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchResult {
  id: string
  type: "contact" | "account" | "opportunity" | "invoice" | "task" | "ticket" | "product" | "navigation"
  title: string
  subtitle: string
  url: string
}

const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
  contact: { icon: User, label: "Contacto", color: "bg-blue-100 text-blue-700" },
  account: { icon: Building2, label: "Cuenta", color: "bg-purple-100 text-purple-700" },
  opportunity: { icon: DollarSign, label: "Oportunidad", color: "bg-green-100 text-green-700" },
  invoice: { icon: FileText, label: "Factura", color: "bg-orange-100 text-orange-700" },
  task: { icon: CheckSquare, label: "Tarea", color: "bg-yellow-100 text-yellow-700" },
  ticket: { icon: Ticket, label: "Ticket", color: "bg-red-100 text-red-700" },
  product: { icon: Package, label: "Producto", color: "bg-cyan-100 text-cyan-700" },
  navigation: { icon: ArrowRight, label: "Ir a", color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
}

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const json = await res.json()
        if (json.success) {
          setResults(json.data)
          setSelectedIndex(0)
        }
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault()
      navigateTo(results[selectedIndex])
    }
  }, [results, selectedIndex])

  const navigateTo = (result: SearchResult) => {
    onOpenChange(false)
    setQuery("")
    router.push(result.url)
  }

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery("")
      setResults([])
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl">
        <DialogTitle className="sr-only">Búsqueda Global</DialogTitle>
        <div className="flex items-center border-b px-4">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar contactos, oportunidades, facturas..."
            className="border-0 focus-visible:ring-0 text-lg py-6"
          />
          {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {!query.trim() ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Escribe para buscar en todo el CRM</p>
              <p className="text-xs mt-2">
                Contactos, cuentas, oportunidades, facturas, tareas...
              </p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No se encontraron resultados para "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => {
                const config = typeConfig[result.type]
                const Icon = config?.icon || Search

                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => navigateTo(result)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                      index === selectedIndex && "bg-muted"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", config?.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">
                      {config?.label}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
              seleccionar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
              cerrar
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook para abrir búsqueda con Cmd+K
export function useGlobalSearch() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return { open, setOpen }
}
