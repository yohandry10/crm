/**
 * Utilidades para exportar datos a CSV y Excel
 */

export interface ExportColumn {
  key: string
  header: string
  transform?: (value: any, row: any) => string
}

/**
 * Convierte datos a formato CSV
 */
export function toCSV(data: any[], columns: ExportColumn[]): string {
  if (data.length === 0) return ""

  // Headers
  const headers = columns.map(col => `"${col.header}"`).join(",")

  // Rows
  const rows = data.map(row => {
    return columns.map(col => {
      let value = getNestedValue(row, col.key)
      
      if (col.transform) {
        value = col.transform(value, row)
      }
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        value = ""
      }
      
      // Convert to string and escape quotes
      const strValue = String(value).replace(/"/g, '""')
      return `"${strValue}"`
    }).join(",")
  })

  return [headers, ...rows].join("\n")
}

/**
 * Obtiene valor anidado de un objeto (ej: "contact.name")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => {
    return current?.[key]
  }, obj)
}

/**
 * Descarga un archivo CSV
 */
export function downloadCSV(csv: string, filename: string): void {
  const BOM = "\uFEFF" // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exporta datos directamente a CSV y descarga
 */
export function exportToCSV(data: any[], columns: ExportColumn[], filename: string): void {
  const csv = toCSV(data, columns)
  downloadCSV(csv, filename)
}

/**
 * Formatea fecha para exportación
 */
export function formatDateForExport(date: string | Date | null): string {
  if (!date) return ""
  const d = new Date(date)
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric"
  })
}

/**
 * Formatea moneda para exportación
 */
export function formatCurrencyForExport(amount: number | null, currency = "PEN"): string {
  if (amount === null || amount === undefined) return ""
  return `${currency} ${amount.toFixed(2)}`
}

// ============================================
// Configuraciones de exportación por módulo
// ============================================

export const contactsExportColumns: ExportColumn[] = [
  { key: "name", header: "Nombre" },
  { key: "email", header: "Email" },
  { key: "phone", header: "Teléfono" },
  { key: "company", header: "Empresa" },
  { key: "position", header: "Cargo" },
  { key: "account.name", header: "Cuenta Asociada" },
  { key: "lead_status", header: "Estado Lead" },
  { key: "lead_source", header: "Fuente" },
  { key: "created_at", header: "Fecha Creación", transform: formatDateForExport },
]

export const accountsExportColumns: ExportColumn[] = [
  { key: "name", header: "Nombre" },
  { key: "ruc", header: "RUC" },
  { key: "industry", header: "Industria" },
  { key: "phone", header: "Teléfono" },
  { key: "email", header: "Email" },
  { key: "website", header: "Sitio Web" },
  { key: "address", header: "Dirección" },
  { key: "city", header: "Ciudad" },
  { key: "country", header: "País" },
  { key: "created_at", header: "Fecha Creación", transform: formatDateForExport },
]

export const opportunitiesExportColumns: ExportColumn[] = [
  { key: "name", header: "Nombre" },
  { key: "contact.name", header: "Contacto" },
  { key: "account.name", header: "Cuenta" },
  { key: "stage.name", header: "Etapa" },
  { key: "amount", header: "Monto", transform: (v) => formatCurrencyForExport(v) },
  { key: "probability", header: "Probabilidad (%)" },
  { key: "expected_close_date", header: "Fecha Cierre Esperada", transform: formatDateForExport },
  { key: "status", header: "Estado" },
  { key: "created_at", header: "Fecha Creación", transform: formatDateForExport },
]

export const invoicesExportColumns: ExportColumn[] = [
  { key: "invoice_number", header: "Número" },
  { key: "contact.name", header: "Cliente" },
  { key: "contact.email", header: "Email Cliente" },
  { key: "issue_date", header: "Fecha Emisión", transform: formatDateForExport },
  { key: "due_date", header: "Fecha Vencimiento", transform: formatDateForExport },
  { key: "subtotal", header: "Subtotal", transform: (v) => formatCurrencyForExport(v) },
  { key: "tax", header: "IGV", transform: (v) => formatCurrencyForExport(v) },
  { key: "total", header: "Total", transform: (v) => formatCurrencyForExport(v) },
  { key: "status", header: "Estado" },
]

export const productsExportColumns: ExportColumn[] = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Nombre" },
  { key: "description", header: "Descripción" },
  { key: "unit_price", header: "Precio Venta", transform: (v) => formatCurrencyForExport(v) },
  { key: "cost_price", header: "Precio Costo", transform: (v) => formatCurrencyForExport(v) },
  { key: "stock_quantity", header: "Stock" },
  { key: "is_service", header: "Es Servicio", transform: (v) => v ? "Sí" : "No" },
  { key: "is_active", header: "Activo", transform: (v) => v ? "Sí" : "No" },
]

export const tasksExportColumns: ExportColumn[] = [
  { key: "title", header: "Título" },
  { key: "description", header: "Descripción" },
  { key: "priority", header: "Prioridad" },
  { key: "status", header: "Estado" },
  { key: "due_date", header: "Fecha Vencimiento", transform: formatDateForExport },
  { key: "contact.name", header: "Contacto" },
  { key: "assigned_to_profile.full_name", header: "Asignado a" },
  { key: "created_at", header: "Fecha Creación", transform: formatDateForExport },
]

export const ticketsExportColumns: ExportColumn[] = [
  { key: "id", header: "ID" },
  { key: "title", header: "Título" },
  { key: "description", header: "Descripción" },
  { key: "account.name", header: "Cuenta" },
  { key: "contact.name", header: "Cliente" },
  { key: "priority", header: "Prioridad" },
  { key: "status", header: "Estado" },
  { key: "assigned_to_profile.full_name", header: "Asignado a" },
  { key: "sla_due_at", header: "SLA", transform: formatDateForExport },
  { key: "created_at", header: "Fecha Creación", transform: formatDateForExport },
]
