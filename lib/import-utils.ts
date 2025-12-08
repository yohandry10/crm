/**
 * Utilidades para importar datos desde CSV
 */

export interface ImportColumn {
  key: string
  header: string
  required?: boolean
  validate?: (value: string) => boolean
  transform?: (value: string) => any
}

export interface ImportResult {
  success: boolean
  data: any[]
  errors: ImportError[]
  totalRows: number
  validRows: number
  invalidRows: number
}

export interface ImportError {
  row: number
  column: string
  message: string
  value?: string
}

/**
 * Parsea un archivo CSV a array de objetos
 */
export function parseCSV(csvText: string): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ""
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentField += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true
      } else if (char === ",") {
        // End of field
        currentLine.push(currentField.trim())
        currentField = ""
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        // End of line
        currentLine.push(currentField.trim())
        if (currentLine.some(f => f !== "")) {
          lines.push(currentLine)
        }
        currentLine = []
        currentField = ""
        if (char === "\r") i++ // Skip \n after \r
      } else if (char !== "\r") {
        currentField += char
      }
    }
  }

  // Don't forget the last field/line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    if (currentLine.some(f => f !== "")) {
      lines.push(currentLine)
    }
  }

  return lines
}

/**
 * Valida y transforma datos importados
 */
export function validateImportData(
  rows: string[][],
  columns: ImportColumn[],
  headerMapping: Record<string, string>
): ImportResult {
  const errors: ImportError[] = []
  const data: any[] = []

  if (rows.length < 2) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, column: "", message: "El archivo está vacío o solo tiene encabezados" }],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    }
  }

  const headers = rows[0]
  const dataRows = rows.slice(1)

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex]
    const rowData: Record<string, any> = {}
    let rowValid = true

    for (const column of columns) {
      const csvHeader = headerMapping[column.key]
      const headerIndex = headers.findIndex(
        h => h.toLowerCase() === csvHeader?.toLowerCase()
      )

      let value = headerIndex >= 0 ? row[headerIndex] : ""

      // Check required
      if (column.required && !value) {
        errors.push({
          row: rowIndex + 2, // +2 because of 0-index and header row
          column: column.header,
          message: `Campo requerido "${column.header}" está vacío`,
        })
        rowValid = false
        continue
      }

      // Validate
      if (value && column.validate && !column.validate(value)) {
        errors.push({
          row: rowIndex + 2,
          column: column.header,
          message: `Valor inválido en "${column.header}"`,
          value,
        })
        rowValid = false
        continue
      }

      // Transform
      if (value && column.transform) {
        value = column.transform(value)
      }

      rowData[column.key] = value || null
    }

    if (rowValid) {
      data.push(rowData)
    }
  }

  return {
    success: errors.length === 0,
    data,
    errors,
    totalRows: dataRows.length,
    validRows: data.length,
    invalidRows: dataRows.length - data.length,
  }
}

/**
 * Lee un archivo como texto
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Error al leer el archivo"))
    reader.readAsText(file, "UTF-8")
  })
}

/**
 * Detecta automáticamente el mapeo de columnas
 */
export function autoDetectMapping(
  csvHeaders: string[],
  targetColumns: ImportColumn[]
): Record<string, string> {
  const mapping: Record<string, string> = {}

  for (const column of targetColumns) {
    // Try exact match first
    let match = csvHeaders.find(
      h => h.toLowerCase() === column.header.toLowerCase()
    )

    // Try partial match
    if (!match) {
      match = csvHeaders.find(
        h => h.toLowerCase().includes(column.key.toLowerCase()) ||
             column.key.toLowerCase().includes(h.toLowerCase())
      )
    }

    // Try common variations
    if (!match) {
      const variations = getCommonVariations(column.key)
      match = csvHeaders.find(h => 
        variations.some(v => h.toLowerCase().includes(v.toLowerCase()))
      )
    }

    if (match) {
      mapping[column.key] = match
    }
  }

  return mapping
}

/**
 * Variaciones comunes de nombres de columnas
 */
function getCommonVariations(key: string): string[] {
  const variations: Record<string, string[]> = {
    name: ["nombre", "name", "nombres", "razon social"],
    email: ["email", "correo", "e-mail", "mail"],
    phone: ["telefono", "phone", "tel", "celular", "movil"],
    company: ["empresa", "company", "compañia", "organizacion"],
    position: ["cargo", "position", "puesto", "rol"],
    address: ["direccion", "address", "domicilio"],
    city: ["ciudad", "city"],
    country: ["pais", "country"],
    ruc: ["ruc", "nit", "cuit", "tax_id"],
    website: ["web", "website", "sitio web", "pagina web"],
  }

  return variations[key] || [key]
}

// ============================================
// Configuraciones de importación por módulo
// ============================================

export const contactsImportColumns: ImportColumn[] = [
  { 
    key: "name", 
    header: "Nombre", 
    required: true,
    validate: (v) => v.length >= 2,
  },
  { 
    key: "email", 
    header: "Email",
    validate: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  { 
    key: "phone", 
    header: "Teléfono",
  },
  { 
    key: "company", 
    header: "Empresa",
  },
  { 
    key: "position", 
    header: "Cargo",
  },
  { 
    key: "lead_source", 
    header: "Fuente",
  },
  { 
    key: "notes", 
    header: "Notas",
  },
]

export const productsImportColumns: ImportColumn[] = [
  { 
    key: "name", 
    header: "Nombre", 
    required: true,
  },
  { 
    key: "sku", 
    header: "SKU",
  },
  { 
    key: "description", 
    header: "Descripción",
  },
  { 
    key: "unit_price", 
    header: "Precio Venta",
    validate: (v) => !v || !isNaN(parseFloat(v)),
    transform: (v) => v ? parseFloat(v) : 0,
  },
  { 
    key: "cost_price", 
    header: "Precio Costo",
    validate: (v) => !v || !isNaN(parseFloat(v)),
    transform: (v) => v ? parseFloat(v) : 0,
  },
  { 
    key: "stock_quantity", 
    header: "Stock",
    validate: (v) => !v || !isNaN(parseInt(v)),
    transform: (v) => v ? parseInt(v) : 0,
  },
]

export const accountsImportColumns: ImportColumn[] = [
  { 
    key: "name", 
    header: "Nombre", 
    required: true,
  },
  { 
    key: "ruc", 
    header: "RUC",
    validate: (v) => !v || /^\d{11}$/.test(v),
  },
  { 
    key: "industry", 
    header: "Industria",
  },
  { 
    key: "phone", 
    header: "Teléfono",
  },
  { 
    key: "email", 
    header: "Email",
    validate: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  { 
    key: "website", 
    header: "Sitio Web",
  },
  { 
    key: "address", 
    header: "Dirección",
  },
  { 
    key: "city", 
    header: "Ciudad",
  },
  { 
    key: "country", 
    header: "País",
  },
]
