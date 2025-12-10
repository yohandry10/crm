/** @type {import('next').NextConfig} */
const nextConfig = {
  // ==============================
  // OPTIMIZACIONES DE RENDIMIENTO
  // ==============================

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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://va.vercel-scripts.com https://vitals.vercel-insights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://accounts.google.com https://va.vercel-scripts.com https://vitals.vercel-insights.com; frame-src 'self' https://accounts.google.com; frame-ancestors 'self'"
          }
        ]
      }
    ]
  },

  // ==============================
  // WEBPACK (solo si no usas Turbopack)
  // ==============================
  webpack: (config, { dev, isServer }) => {
    // Optimizaciones solo para producción
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      }
    }

    // Ignorar warnings de módulos grandes en desarrollo
    if (dev) {
      config.infrastructureLogging = {
        level: 'error', // Solo mostrar errores, no warnings
      }
    }

    return config
  },
}

export default nextConfig
