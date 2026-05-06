// Polyfill ligero para evitar `self` undefined en entornos Node durante build
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis
}

import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isKnownServerDependencyWarning = (warning) => {
  const message = warning?.message || String(warning)
  const resource = warning?.module?.resource || ''

  return (
    /Critical dependency: the request of a dependency is an expression/i.test(message) &&
    (resource.includes('@opentelemetry') || resource.includes('@protobufjs'))
  )
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==============================
  // OPTIMIZACIONES DE RENDIMIENTO
  // ==============================

  // Modo estricto para detectar problemas de hidratación y bugs
  reactStrictMode: true,

  // Habilitar Turbopack para desarrollo más rápido (Next 15+)
  // (Next 15.5+): mover experimental.turbo -> turbopack
  turbopack: {
    // Reglas personalizadas si necesitas loaders específicos
  },

  // Optimización de paquetes para reducir tamaño de bundles
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'recharts',
      'framer-motion',
      'swr',
    ],
  },

  // Evitar que Next infiera el root por lockfiles externos
  outputFileTracingRoot: __dirname,

  // ✅ Optimizar server components (Next 15+ usa serverExternalPackages)
  serverExternalPackages: [
    '@supabase/supabase-js',
    'bullmq',
    'ioredis',
  ],

  // ✅ Code splitting más agresivo para reducir bundles
  ...(process.env.NODE_ENV === 'production'
    ? {
      webpack: (config, { isServer }) => {
        // Silenciar warnings conocidos de dependencias server-only (OpenTelemetry usa require() dinámico)
        config.ignoreWarnings = [
          ...(config.ignoreWarnings ?? []),
          /require function is used in a way in which dependencies cannot be statically extracted/i,
          /A Node\.js API is used .* not supported in the Edge Runtime/i,
          isKnownServerDependencyWarning,
        ]

        if (!isServer) {
          config.optimization = {
            ...config.optimization,
            splitChunks: {
              chunks: 'all',
              cacheGroups: {
                // Separar vendors grandes
                supabase: {
                  test: /[\\/]node_modules[\\/](@supabase)[\\/]/,
                  name: 'supabase',
                  priority: 10,
                },
                charts: {
                  test: /[\\/]node_modules[\\/](recharts)[\\/]/,
                  name: 'charts',
                  priority: 10,
                },
                framer: {
                  test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
                  name: 'framer',
                  priority: 10,
                },
                lucide: {
                  test: /[\\/]node_modules[\\/](lucide-react)[\\/]/,
                  name: 'lucide',
                  priority: 10,
                },
                // Vendor común más pequeño
                vendor: {
                  test: /[\\/]node_modules[\\/]/,
                  name: 'vendor',
                  priority: 5,
                },
              },
            },
          }
        }
        return config
      },
    }
    : {}),

  // Optimización de imágenes
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
    // Formatos modernos para mejor compresión
    formats: ['image/avif', 'image/webp'],
  },

  // Deshabilitar powered by header (seguridad + menor tamaño)
  poweredByHeader: false,

  // Comprimir respuestas
  compress: true,

  // Generar source maps solo en desarrollo
  productionBrowserSourceMaps: false,

  // ==============================
  // VARIABLES DE ENTORNO
  // ==============================
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // ==============================
  // HEADERS DE SEGURIDAD
  // ==============================
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://va.vercel-scripts.com https://vitals.vercel-insights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.culqi.com https://accounts.google.com https://va.vercel-scripts.com https://vitals.vercel-insights.com; frame-src 'self' https://accounts.google.com; frame-ancestors 'self'; worker-src 'self' blob:"
          }
        ]
      }
    ]
  },

}

export default nextConfig;
