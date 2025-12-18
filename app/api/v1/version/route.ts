/**
 * API V1 - Version Info
 *
 * GET /api/v1/version
 * Retorna información sobre la versión de la API
 */

import { NextResponse } from 'next/server'
import { API_VERSIONS } from '@/middleware-api-version'

export async function GET() {
  const currentVersion = API_VERSIONS.v1

  return NextResponse.json({
    success: true,
    data: {
      version: 'v1',
      versionNumber: currentVersion.version,
      status: currentVersion.status,
      endpoints: {
        contacts: '/api/v1/contacts',
        workflows: '/api/v1/workflows',
        campaigns: '/api/v1/campaigns',
        analytics: '/api/v1/analytics',
      },
      documentation: '/docs/api/v1',
      changelog: '/docs/changelog',
      deprecation: currentVersion.status === 'deprecated' ? {
        deprecatedAt: currentVersion.deprecationDate,
        sunsetAt: currentVersion.sunsetDate,
        message: currentVersion.message,
      } : null,
    },
  })
}
