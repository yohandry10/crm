/**
 * API Versioning metadata helpers
 *
 * Estado actual:
 * - /api/v1/version expone metadata de version.
 * - Las rutas de recursos siguen usando /api/* sin version.
 * - Este archivo no esta conectado a middleware.ts para reescritura automatica.
 *
 * Rutas de recursos versionadas como /api/v1/contacts no existen todavia.
 *
 * Funcionalidad preparada:
 * - Backward compatibility automático
 * - Headers de deprecación
 * - Sunset dates para APIs antiguas
 * - Redirects automáticos de versiones deprecated
 */

import { NextRequest, NextResponse } from 'next/server'

export interface APIVersion {
  version: number
  status: 'current' | 'deprecated' | 'sunset'
  deprecationDate?: Date
  sunsetDate?: Date
  message?: string
}

// Configuración de versiones de API
export const API_VERSIONS: Record<string, APIVersion> = {
  v1: {
    version: 1,
    status: 'current',
  },
  // Ejemplo de versión deprecated:
  // v0: {
  //   version: 0,
  //   status: 'deprecated',
  //   deprecationDate: new Date('2024-01-01'),
  //   sunsetDate: new Date('2024-06-01'),
  //   message: 'API v0 is deprecated. Please migrate to v1. See: https://docs.example.com/migration'
  // }
}

// Versión por defecto cuando no se especifica
export const DEFAULT_API_VERSION = 'v1'

/**
 * Extrae la versión de la API de la URL
 *
 * Ejemplos:
 * - /api/contacts → null (usa default)
 * - /api/v1/contacts → 'v1'
 * - /api/v2/contacts → 'v2'
 */
export function extractAPIVersion(pathname: string): string | null {
  const versionMatch = pathname.match(/^\/api\/(v\d+)\//)
  return versionMatch ? versionMatch[1] : null
}

/**
 * Verifica si una ruta es una ruta de API
 */
export function isAPIRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

/**
 * Normaliza una ruta de API para agregar la versión
 *
 * Ejemplos:
 * - /api/contacts → /api/v1/contacts
 * - /api/v2/contacts → /api/v2/contacts (sin cambios)
 */
export function normalizeAPIPath(pathname: string): string {
  // Si ya tiene versión, retornar sin cambios
  if (extractAPIVersion(pathname)) {
    return pathname
  }

  // Agregar versión por defecto
  return pathname.replace('/api/', `/api/${DEFAULT_API_VERSION}/`)
}

/**
 * Middleware para API Versioning
 *
 * Agrega headers de versionado a las responses
 */
export function handleAPIVersioning(request: NextRequest, response: NextResponse): NextResponse {
  const pathname = request.nextUrl.pathname

  // Solo para rutas de API
  if (!isAPIRoute(pathname)) {
    return response
  }

  const version = extractAPIVersion(pathname) || DEFAULT_API_VERSION
  const versionConfig = API_VERSIONS[version]

  // Si la versión no existe, retornar 404
  if (!versionConfig) {
    return NextResponse.json(
      {
        success: false,
        error: 'API version not found',
        message: `API version '${version}' does not exist. Available versions: ${Object.keys(API_VERSIONS).join(', ')}`,
      },
      { status: 404 }
    )
  }

  // Clonar response para agregar headers
  const newResponse = NextResponse.next()

  // Headers de versionado
  newResponse.headers.set('X-API-Version', `${versionConfig.version}`)
  newResponse.headers.set('X-API-Version-Status', versionConfig.status)

  // Si está deprecated, agregar headers de deprecación
  if (versionConfig.status === 'deprecated') {
    if (versionConfig.deprecationDate) {
      newResponse.headers.set(
        'Deprecation',
        versionConfig.deprecationDate.toUTCString()
      )
    }

    if (versionConfig.sunsetDate) {
      newResponse.headers.set(
        'Sunset',
        versionConfig.sunsetDate.toUTCString()
      )
    }

    if (versionConfig.message) {
      newResponse.headers.set('X-API-Deprecation-Message', versionConfig.message)
    }

    // Log de uso de API deprecated
    console.warn(
      `⚠️  API deprecated usada: ${version} - Path: ${pathname} - ${versionConfig.message}`
    )
  }

  // Si está sunset, retornar error
  if (versionConfig.status === 'sunset') {
    return NextResponse.json(
      {
        success: false,
        error: 'API version no longer supported',
        message: versionConfig.message || `API version '${version}' is no longer supported. Please migrate to a newer version.`,
        availableVersions: Object.keys(API_VERSIONS).filter(
          (v) => API_VERSIONS[v].status !== 'sunset'
        ),
      },
      { status: 410 } // 410 Gone
    )
  }

  return newResponse
}

/**
 * Helper para marcar una versión como deprecated
 */
export function deprecateAPIVersion(
  version: string,
  deprecationDate: Date,
  sunsetDate: Date,
  message: string
): void {
  if (API_VERSIONS[version]) {
    API_VERSIONS[version].status = 'deprecated'
    API_VERSIONS[version].deprecationDate = deprecationDate
    API_VERSIONS[version].sunsetDate = sunsetDate
    API_VERSIONS[version].message = message
  }
}

/**
 * Helper para marcar una versión como sunset
 */
export function sunsetAPIVersion(version: string, message?: string): void {
  if (API_VERSIONS[version]) {
    API_VERSIONS[version].status = 'sunset'
    API_VERSIONS[version].message = message
  }
}
