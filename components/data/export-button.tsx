"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { exportToCSV, ExportColumn } from "@/lib/export-utils"

interface ExportButtonProps {
  data: any[]
  columns: ExportColumn[]
  filename: string
  disabled?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

export function ExportButton({
  data,
  columns,
  filename,
  disabled = false,
  variant = "outline",
  size = "default",
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: "csv") => {
    if (data.length === 0) {
      toast.error("No hay datos para exportar")
      return
    }

    setExporting(true)
    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const timestamp = new Date().toISOString().split("T")[0]
      const fullFilename = `${filename}_${timestamp}`

      if (format === "csv") {
        exportToCSV(data, columns, fullFilename)
        toast.success(`Exportado ${data.length} registros a CSV`)
      }
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Error al exportar datos")
    } finally {
      setExporting(false)
    }
  }

  if (size === "icon") {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={() => handleExport("csv")}
        disabled={disabled || exporting || data.length === 0}
        title="Exportar a CSV"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled || exporting || data.length === 0}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar a CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
