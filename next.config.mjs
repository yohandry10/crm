import {withSentryConfig} from '@sentry/nextjs';
// Polyfill ligero para evitar `self` undefined en entornos Node durante build
if (typeof globalThis.self === 'undefined') {
  // eslint-disable-next-line no-global-assign
  globalThis.self = globalThis
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==============================
  // OPTIMIZACIONES DE RENDIMIENTO
  // ==============================

  // Cambiamos distDir para evitar conflictos con el .next anterior bloqueado
  distDir: '.next-build',

  // Modo estricto para detectar problemas de hidratación y bugs
  reactStrictMode: true,

  // Habilitar Turbopack para desarrollo más rápido (Next 15+)
  // Nota: Esto acelera significativamente el hot-reload
  experimental: {
    // Turbopack es más rápido que Webpack para desarrollo
    turbo: {
      // Reglas personalizadas si necesitas loaders específicos
    },
    // Optimización de paquetes para reducir tamaño de bundles
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'recharts',
      'framer-motion',
    ],
  },

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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://va.vercel-scripts.com https://vitals.vercel-insights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://accounts.google.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.sentry.io https://*.ingest.us.sentry.io; frame-src 'self' https://accounts.google.com; frame-ancestors 'self'"
          }
        ]
      }
    ]
  },

}

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "andydev-zb",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true
});
