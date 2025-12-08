"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  X, MoreHorizontal, 
  CheckSquare, Loader2 
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface BulkAction {
  id: string
  label: string
  icon: any
  variant?: "default" | "destructive"
  action: (ids: string[]) => Promise<void>
  requireConfirm?: boolean
  confirmTitle?: string
  confirmDescription?: string
}

interface BulkActionsBarProps {
  selectedIds: string[]
  onClearSelection: () => void
  actions: BulkAction[]
  entityName?: string
}

export function BulkActionsBar({
  selectedIds,
  onClearSelection,
  actions,
  entityName = "registros",
}: BulkActionsBarProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null)

  const handleAction = async (action: BulkAction) => {
    if (action.requireConfirm) {
      setConfirmAction(action)
      return
    }

    await executeAction(action)
  }

  const executeAction = async (action: BulkAction) => {
    setLoading(action.id)
    try {
      await action.action(selectedIds)
      onClearSelection()
    } catch (error: any) {
      toast.error(error.message || "Error al ejecutar acción")
    } finally {
      setLoading(null)
      setConfirmAction(null)
    }
  }

  if (selectedIds.length === 0) return null

  const primaryActions = actions.slice(0, 3)
  const moreActions = actions.slice(3)

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl shadow-2xl">
            {/* Selection count */}
            <div className="flex items-center gap-2 pr-4 border-r border-gray-700">
              <CheckSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {selectedIds.length} {entityName} seleccionados
              </span>
            </div>

            {/* Primary actions */}
            <div className="flex items-center gap-1">
              {primaryActions.map((action) => {
                const Icon = action.icon
                const isLoading = loading === action.id

                return (
                  <Button
                    key={action.id}
                    variant={action.variant === "destructive" ? "destructive" : "secondary"}
                    size="sm"
                    onClick={() => handleAction(action)}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    {action.label}
                  </Button>
                )
              })}

              {/* More actions dropdown */}
              {moreActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {moreActions.map((action) => {
                      const Icon = action.icon
                      return (
                        <DropdownMenuItem
                          key={action.id}
                          onClick={() => handleAction(action)}
                          className={action.variant === "destructive" ? "text-red-600" : ""}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {action.label}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Clear selection */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearSelection}
              className="ml-2 text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.confirmTitle || "¿Confirmar acción?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.confirmDescription || 
                `Esta acción afectará a ${selectedIds.length} ${entityName}. ¿Deseas continuar?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && executeAction(confirmAction)}
              className={confirmAction?.variant === "destructive" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Hook para manejar selección
export function useBulkSelection<T extends { id: string }>() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const selectAll = (items: T[]) => {
    setSelectedIds(items.map(i => i.id))
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const isSelected = (id: string) => selectedIds.includes(id)

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    hasSelection: selectedIds.length > 0,
  }
}
