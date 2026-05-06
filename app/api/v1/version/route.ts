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
        version: '/api/v1/version',
        contacts: '/api/contacts',
        workflows: '/api/workflows',
        campaigns: '/api/campaigns',
        analytics: '/api/analytics',
      },
      versionedResourcesEnabled: false,
      message: 'Resource endpoints currently use unversioned /api/* routes; /api/v1/version only exposes version metadata.',
      documentation: '/api/docs',
      changelog: null,
      deprecation: currentVersion.status === 'deprecated' ? {
        deprecatedAt: currentVersion.deprecationDate,
        sunsetAt: currentVersion.sunsetDate,
        message: currentVersion.message,
      } : null,
    },
  })
}
