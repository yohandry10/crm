"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
} from "lucide-react"
import { toast } from "sonner"
import {
  parseCSV,
  validateImportData,
  autoDetectMapping,
  readFileAsText,
  ImportColumn,
  ImportResult,
} from "@/lib/import-utils"

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete"

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  columns: ImportColumn[]
  onImport: (data: any[]) => Promise<{ success: boolean; imported: number; errors?: string[] }>
  templateUrl?: string
}

export function ImportModal({
  open,
  onOpenChange,
  title,
  description,
  columns,
  onImport,
  templateUrl,
}: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>("upload")
  const [csvData, setCsvData] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ImportResult | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const reset = () => {
    setStep("upload")
    setCsvData([])
    setMapping({})
    setValidationResult(null)
    setImportResult(null)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Por favor selecciona un archivo CSV")
      return
    }

    try {
      const text = await readFileAsText(selectedFile)
      const parsed = parseCSV(text)

      if (parsed.length < 2) {
        toast.error("El archivo está vacío o no tiene datos")
        return
      }

      setCsvData(parsed)

      // Auto-detect mapping
      const autoMapping = autoDetectMapping(parsed[0], columns)
      setMapping(autoMapping)

      setStep("mapping")
    } catch (error) {
      toast.error("Error al leer el archivo")
    }
  }, [columns])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleMappingChange = (columnKey: string, csvHeader: string) => {
    setMapping(prev => ({
      ...prev,
      [columnKey]: csvHeader === "_none_" ? "" : csvHeader,
    }))
  }

  const handleValidate = () => {
    const result = validateImportData(csvData, columns, mapping)
    setValidationResult(result)
    setStep("preview")
  }

  const handleImport = async () => {
    if (!validationResult || validationResult.data.length === 0) return

    setStep("importing")

    try {
      const result = await onImport(validationResult.data)
      setImportResult({
        imported: result.imported,
        errors: result.errors || [],
      })
      setStep("complete")

      if (result.success) {
        toast.success(`${result.imported} registros importados exitosamente`)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al importar")
      setStep("preview")
    }
  }

  const csvHeaders = csvData[0] || []
  const requiredColumns = columns.filter(c => c.required)
  const mappedRequired = requiredColumns.filter(c => mapping[c.key])
  const canProceedToPreview = mappedRequired.length === requiredColumns.length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {["upload", "mapping", "preview", "complete"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["upload", "mapping", "preview", "importing", "complete"].indexOf(step) > i
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {["upload", "mapping", "preview", "importing", "complete"].indexOf(step) > i ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && <div className="w-12 h-0.5 bg-muted mx-1" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto py-4">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Arrastra tu archivo CSV aquí
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  o haz clic para seleccionar
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                  id="csv-upload"
                />
                <Button asChild variant="outline">
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Seleccionar archivo
                  </label>
                </Button>
              </div>

              {templateUrl && (
                <Alert>
                  <Download className="w-4 h-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>¿Necesitas una plantilla?</span>
                    <Button variant="link" size="sm" asChild>
                      <a href={templateUrl} download>
                        Descargar plantilla CSV
                      </a>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  Mapea las columnas de tu CSV con los campos del sistema.
                  Los campos marcados con * son obligatorios.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4">
                {columns.map(column => (
                  <div key={column.key} className="flex items-center gap-4">
                    <Label className="w-40 flex-shrink-0">
                      {column.header}
                      {column.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <Select
                      value={mapping[column.key] || "_none_"}
                      onValueChange={(v) => handleMappingChange(column.key, v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar columna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">-- No mapear --</SelectItem>
                        {csvHeaders.map(header => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping[column.key] && (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && validationResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold">{validationResult.totalRows}</p>
                  <p className="text-sm text-muted-foreground">Total filas</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{validationResult.validRows}</p>
                  <p className="text-sm text-muted-foreground">Válidas</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{validationResult.invalidRows}</p>
                  <p className="text-sm text-muted-foreground">Con errores</p>
                </div>
              </div>

              {/* Errors */}
              {validationResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="w-4 h-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">
                      Se encontraron {validationResult.errors.length} errores:
                    </p>
                    <ScrollArea className="h-32">
                      <ul className="text-sm space-y-1">
                        {validationResult.errors.slice(0, 10).map((error, i) => (
                          <li key={i}>
                            Fila {error.row}: {error.message}
                            {error.value && ` (valor: "${error.value}")`}
                          </li>
                        ))}
                        {validationResult.errors.length > 10 && (
                          <li>... y {validationResult.errors.length - 10} errores más</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview table */}
              {validationResult.data.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Vista previa (primeros 5 registros):
                  </p>
                  <ScrollArea className="h-48 border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.filter(c => mapping[c.key]).map(col => (
                            <TableHead key={col.key}>{col.header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationResult.data.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {columns.filter(c => mapping[c.key]).map(col => (
                              <TableCell key={col.key}>
                                {row[col.key] ?? "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Importing */}
          {step === "importing" && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Importando datos...</p>
              <p className="text-sm text-muted-foreground">
                Por favor espera, esto puede tomar unos segundos.
              </p>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === "complete" && importResult && (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <p className="text-2xl font-bold mb-2">¡Importación completada!</p>
              <p className="text-muted-foreground mb-4">
                Se importaron {importResult.imported} registros exitosamente.
              </p>
              {importResult.errors.length > 0 && (
                <Alert variant="destructive" className="text-left mt-4">
                  <AlertDescription>
                    <p className="font-medium mb-2">Algunos registros no se pudieron importar:</p>
                    <ul className="text-sm">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Atrás
              </Button>
              <Button onClick={handleValidate} disabled={!canProceedToPreview}>
                Validar datos
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Atrás
              </Button>
              <Button
                onClick={handleImport}
                disabled={!validationResult || validationResult.validRows === 0}
              >
                Importar {validationResult?.validRows || 0} registros
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button onClick={handleClose}>Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
