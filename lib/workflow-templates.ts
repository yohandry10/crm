/**
 * Template Engine para Workflows
 * Permite usar variables dinámicas en acciones de workflows
 *
 * Sintaxis: {{variable}} o {{object.property}}
 *
 * Ejemplos:
 * - {{contact.email}} → obtiene el email del contacto
 * - {{contact.full_name}} → obtiene el nombre completo
 * - {{invoice.total}} → obtiene el total de la factura
 * - {{opportunity.stage}} → obtiene la etapa de la oportunidad
 */

/**
 * Obtiene un valor anidado de un objeto usando notación de punto
 * @param obj - Objeto del cual extraer el valor
 * @param path - Ruta al valor (ej: "contact.email")
 * @returns El valor encontrado o undefined
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined

  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = current[key]
  }

  return current
}

/**
 * Reemplaza variables de template en un string
 * @param template - String con variables {{variable}}
 * @param data - Objeto con los datos disponibles
 * @returns String con variables reemplazadas
 */
export function replaceTemplateVariables(template: string, data: any): string {
  if (typeof template !== 'string') {
    return template
  }

  // Regex para capturar {{variable}} o {{object.property}}
  const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}\}/g

  return template.replace(regex, (match, path) => {
    const value = getNestedValue(data, path.trim())

    // Si el valor es undefined o null, mantener el placeholder
    if (value === undefined || value === null) {
      return match // Mantener {{variable}} sin reemplazar
    }

    // Convertir a string si no lo es
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  })
}

/**
 * Reemplaza variables de template en un objeto completo (recursivamente)
 * @param obj - Objeto con posibles templates
 * @param data - Datos disponibles para reemplazo
 * @returns Objeto con templates reemplazados
 */
export function replaceTemplateVariablesInObject(obj: any, data: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  // Si es string, reemplazar variables
  if (typeof obj === 'string') {
    return replaceTemplateVariables(obj, data)
  }

  // Si es array, procesar cada elemento
  if (Array.isArray(obj)) {
    return obj.map(item => replaceTemplateVariablesInObject(item, data))
  }

  // Si es objeto, procesar cada propiedad
  if (typeof obj === 'object') {
    const result: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = replaceTemplateVariablesInObject(obj[key], data)
      }
    }
    return result
  }

  // Para otros tipos (number, boolean), retornar tal cual
  return obj
}

/**
 * Extrae todas las variables usadas en un template
 * @param template - String con variables
 * @returns Array de nombres de variables
 */
export function extractTemplateVariables(template: string): string[] {
  if (typeof template !== 'string') {
    return []
  }

  const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}\}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(template)) !== null) {
    variables.push(match[1].trim())
  }

  return variables
}

/**
 * Valida que todas las variables usadas en un template existan en los datos
 * @param template - String con variables
 * @param data - Datos disponibles
 * @returns { valid: boolean, missing: string[] }
 */
export function validateTemplateVariables(
  template: string,
  data: any
): { valid: boolean; missing: string[] } {
  const variables = extractTemplateVariables(template)
  const missing: string[] = []

  for (const variable of variables) {
    const value = getNestedValue(data, variable)
    if (value === undefined) {
      missing.push(variable)
    }
  }

  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Obtiene las variables disponibles según el tipo de trigger
 * @param triggerType - Tipo de evento que disparó el workflow
 * @returns Objeto con ejemplos de variables disponibles
 */
export function getAvailableVariables(triggerType: string): Record<string, any> {
  const baseVariables = {
    organization_id: 'uuid-example',
    user_id: 'uuid-example',
    timestamp: new Date().toISOString()
  }

  // Variables específicas por tipo de trigger
  const triggerVariables: Record<string, any> = {
    'contact.created': {
      contact: {
        id: 'uuid',
        email: 'ejemplo@email.com',
        full_name: 'Juan Pérez',
        phone: '+51 999 999 999',
        lead_score: 75,
        status: 'new',
        company: 'Empresa S.A.',
        tags: ['premium', 'latam']
      }
    },
    'contact.updated': {
      contact: {
        id: 'uuid',
        email: 'ejemplo@email.com',
        full_name: 'Juan Pérez',
        lead_score: 85,
        status: 'qualified',
        previous_status: 'new'
      }
    },
    'invoice.created': {
      invoice: {
        id: 'uuid',
        invoice_number: 'INV-001',
        total: 1500.00,
        currency: 'PEN',
        status: 'draft',
        due_date: '2025-01-15'
      },
      contact: {
        id: 'uuid',
        email: 'cliente@email.com',
        full_name: 'María García'
      }
    },
    'invoice.paid': {
      invoice: {
        id: 'uuid',
        invoice_number: 'INV-001',
        total: 1500.00,
        paid_at: new Date().toISOString()
      },
      payment: {
        id: 'uuid',
        amount: 1500.00,
        method: 'bank_transfer'
      }
    },
    'opportunity.created': {
      opportunity: {
        id: 'uuid',
        title: 'Nuevo negocio - Empresa ABC',
        value: 50000,
        stage: 'prospecting',
        probability: 20,
        expected_close_date: '2025-02-28'
      },
      contact: {
        id: 'uuid',
        email: 'contacto@empresa.com',
        full_name: 'Carlos Rodríguez'
      }
    },
    'task.completed': {
      task: {
        id: 'uuid',
        title: 'Llamar al cliente',
        description: 'Seguimiento de propuesta',
        completed_at: new Date().toISOString()
      },
      contact: {
        id: 'uuid',
        full_name: 'Ana Torres'
      }
    }
  }

  return {
    ...baseVariables,
    ...(triggerVariables[triggerType] || {})
  }
}

/**
 * Formatea un valor para mostrarlo en ejemplos
 * @param value - Valor a formatear
 * @returns String formateado
 */
export function formatVariableValue(value: any): string {
  if (value === null || value === undefined) {
    return '(vacío)'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}
