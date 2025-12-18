/**
 * Pagination Utilities - Sistema de paginación global
 * Implementa límites seguros y consistentes en toda la aplicación
 */

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1,
} as const

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Extrae y valida parámetros de paginación de URL search params
 *
 * @param searchParams - URLSearchParams del request
 * @returns Parámetros de paginación validados y seguros
 */
export function getPaginationParams(searchParams: URLSearchParams): PaginationParams {
  const rawLimit = parseInt(searchParams.get('limit') || `${PAGINATION.DEFAULT_PAGE_SIZE}`)
  const rawPage = parseInt(searchParams.get('page') || `${PAGINATION.DEFAULT_PAGE}`)

  // Validar y aplicar límites seguros
  const limit = Math.min(
    Math.max(1, isNaN(rawLimit) ? PAGINATION.DEFAULT_PAGE_SIZE : rawLimit),
    PAGINATION.MAX_PAGE_SIZE
  )

  const page = Math.max(1, isNaN(rawPage) ? PAGINATION.DEFAULT_PAGE : rawPage)
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Genera metadata de paginación para respuestas
 *
 * @param page - Página actual
 * @param limit - Items por página
 * @param total - Total de items
 * @returns Metadata completa de paginación
 */
export function getPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit)

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

/**
 * Interfaz para respuesta paginada estándar
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

/**
 * Crea una respuesta paginada estándar
 *
 * @param data - Array de datos
 * @param page - Página actual
 * @param limit - Items por página
 * @param total - Total de items
 * @returns Respuesta paginada formateada
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: getPaginationMeta(page, limit, total),
  }
}

/**
 * Valida que los parámetros de paginación sean válidos
 * Útil para validación adicional en endpoints específicos
 */
export function validatePaginationLimits(page: number, limit: number): {
  valid: boolean
  error?: string
} {
  if (page < 1) {
    return { valid: false, error: 'Page must be greater than or equal to 1' }
  }

  if (limit < 1) {
    return { valid: false, error: 'Limit must be greater than or equal to 1' }
  }

  if (limit > PAGINATION.MAX_PAGE_SIZE) {
    return {
      valid: false,
      error: `Limit cannot exceed ${PAGINATION.MAX_PAGE_SIZE}`,
    }
  }

  return { valid: true }
}
