# Ejemplos Prácticos de Implementación

## 🎯 Guía Rápida de Implementación

Este documento proporciona ejemplos prácticos paso a paso para implementar las optimizaciones del sidebar y navegación.

---

## 📝 Ejemplo 1: Migrar un Módulo Simple (Contactos)

### Antes (Sin Optimización)
```tsx
// app/contacts/page.tsx
export default function ContactsPage() {
  return (
    <div>
      <ContactsTable />
    </div>
  )
}
```

### Después (Con Optimización)
```tsx
// app/contacts/page.tsx
import { Suspense } from 'react'
import { TableModuleSkeleton } from '@/components/ui/module-skeleton'

export default function ContactsPage() {
  return (
    <Suspense fallback={<TableModuleSkeleton />}>
      <ContactsContent />
    </Suspense>
  )
}

// Separar la lógica en un componente async
async function ContactsContent() {
  // Tu lógica de carga de datos aquí
  return <ContactsTable />
}
```

**Resultado:** Usuario ve skeleton inmediatamente mientras carga los datos.

---

## 📝 Ejemplo 2: Migrar Dashboard con Múltiples Componentes

### Antes
```tsx
// app/dashboard/page.tsx
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Charts } from '@/components/dashboard/charts'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

export default function DashboardPage() {
  return (
    <div>
      <StatsCards />
      <Charts />
      <ActivityFeed />
    </div>
  )
}
```

### Después
```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { DashboardModuleSkeleton } from '@/components/ui/module-skeleton'
import { StatsCards } from '@/components/dashboard/stats-cards'

// Lazy load componentes pesados
const Charts = dynamic(
  () => import('@/components/dashboard/charts'),
  {
    loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-lg" />,
    ssr: false // Charts no necesitan SSR
  }
)

const ActivityFeed = dynamic(
  () => import('@/components/dashboard/activity-feed'),
  { loading: () => <div className="h-96 animate-pulse bg-gray-100 rounded-lg" /> }
)

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardModuleSkeleton />}>
      <div className="space-y-6">
        {/* Stats cards se cargan primero (más rápido) */}
        <StatsCards />

        {/* Charts y ActivityFeed se cargan después */}
        <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-lg" />}>
          <Charts />
        </Suspense>

        <Suspense fallback={<div className="h-96 animate-pulse bg-gray-100 rounded-lg" />}>
          <ActivityFeed />
        </Suspense>
      </div>
    </Suspense>
  )
}
```

**Resultado:** Carga progresiva - usuario ve stats inmediatamente, luego gráficos, luego actividad.

---

## 📝 Ejemplo 3: Implementar Prefetch en una Página Específica

### Página de Leads que debe precargar Pipeline
```tsx
// app/leads/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRoutePrefetch } from '@/hooks/use-route-prefetch'

export default function LeadsPage() {
  const router = useRouter()

  // Precargar rutas relacionadas
  useRoutePrefetch([
    '/pipeline',      // Usuario probablemente irá a pipeline después
    '/sales',         // O a oportunidades
    '/contacts'       // O a ver contactos
  ])

  return (
    <div>
      <LeadsTable />

      {/* Botón que se beneficia del prefetch */}
      <button onClick={() => router.push('/pipeline')}>
        Ver en Pipeline {/* ⚡ Navegación instantánea */}
      </button>
    </div>
  )
}
```

---

## 📝 Ejemplo 4: Usar Caché de Usuario en Componentes Personalizados

### Componente de Header que necesita datos de usuario
```tsx
// components/custom-header.tsx
'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useUserProfile } from '@/lib/user-cache'

export function CustomHeader() {
  const [supabase, setSupabase] = useState(null)

  useEffect(() => {
    setSupabase(getSupabaseBrowserClient())
  }, [])

  // Hook con caché integrado - no hace llamadas redundantes
  const { user, loading } = useUserProfile(supabase)

  if (loading) {
    return <div>Cargando...</div>
  }

  return (
    <header>
      <h1>Bienvenido, {user?.full_name || user?.email}</h1>
      <span className="badge">{user?.role}</span>
    </header>
  )
}
```

### Invalidar caché después de actualizar perfil
```tsx
// components/profile/edit-profile.tsx
'use client'

import { userCache } from '@/lib/user-cache'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export function EditProfileForm() {
  const handleSubmit = async (data) => {
    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Actualizar perfil
    await supabase
      .from('profiles')
      .update({ full_name: data.fullName })
      .eq('id', user.id)

    // ⚠️ IMPORTANTE: Invalidar caché después de actualizar
    if (user) {
      userCache.invalidate(user.id)
    }

    // El siguiente componente que use useUserProfile obtendrá datos frescos
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

---

## 📝 Ejemplo 5: Componente Kanban con Skeleton Personalizado

### Pipeline/Oportunidades con skeleton específico
```tsx
// app/pipeline/page.tsx
import { Suspense } from 'react'
import { KanbanModuleSkeleton } from '@/components/ui/module-skeleton'

export default function PipelinePage() {
  return (
    <Suspense fallback={<KanbanModuleSkeleton />}>
      <PipelineBoard />
    </Suspense>
  )
}

// components/pipeline/pipeline-board.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'

export function PipelineBoard() {
  const [deals, setDeals] = useState([])

  // Memoizar columnas para evitar re-renders
  const columns = useMemo(() => [
    { id: 'lead', name: 'Leads', deals: deals.filter(d => d.stage === 'lead') },
    { id: 'qualified', name: 'Calificado', deals: deals.filter(d => d.stage === 'qualified') },
    { id: 'proposal', name: 'Propuesta', deals: deals.filter(d => d.stage === 'proposal') },
    { id: 'closed', name: 'Cerrado', deals: deals.filter(d => d.stage === 'closed') },
  ], [deals])

  return (
    <div className="kanban-board">
      {columns.map(column => (
        <KanbanColumn key={column.id} column={column} />
      ))}
    </div>
  )
}
```

---

## 📝 Ejemplo 6: Tabla con Virtual Scrolling (Para listas largas)

### Contactos con más de 1000 registros
```tsx
// components/contacts/contacts-table-virtual.tsx
'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function ContactsTableVirtual({ contacts }) {
  const parentRef = useRef(null)

  const rowVirtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Altura estimada de cada fila
    overscan: 5, // Renderizar 5 filas extra arriba/abajo
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const contact = contacts[virtualRow.index]

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ContactRow contact={contact} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Uso:**
```bash
npm install @tanstack/react-virtual
```

```tsx
// app/contacts/page.tsx
import { ContactsTableVirtual } from '@/components/contacts/contacts-table-virtual'

// Solo renderiza ~20 filas visibles en lugar de 1000+
<ContactsTableVirtual contacts={contacts} />
```

---

## 📝 Ejemplo 7: Barra de Navegación con Loading State

### Header que muestra indicador durante navegación
```tsx
// components/dashboard/header.tsx
'use client'

import { useNavigationLoading } from '@/components/providers/navigation-loading-provider'

export function Header() {
  const { isLoading } = useNavigationLoading()

  return (
    <header className="relative">
      {/* Barra de progreso */}
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
      )}

      <div className="p-4">
        <h1>Dashboard CRM</h1>
      </div>
    </header>
  )
}
```

---

## 📝 Ejemplo 8: Sidebar con Agrupación y Colapsables

### Sidebar optimizado con secciones colapsables
```tsx
// components/dashboard/sidebar-with-groups.tsx
'use client'

import { memo, useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

interface NavGroup {
  title: string
  items: NavItem[]
}

const NavGroup = memo(({ group, currentPath }) => {
  const [isOpen, setIsOpen] = useState(true)

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return (
    <div className="nav-group">
      <button
        onClick={toggleOpen}
        className="flex items-center justify-between w-full p-2 text-sm font-medium"
      >
        {group.title}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </button>

      {isOpen && (
        <div className="pl-4 space-y-1">
          {group.items.map(item => (
            <NavLink key={item.href} item={item} isCurrent={currentPath === item.href} />
          ))}
        </div>
      )}
    </div>
  )
})

const navigationGroups: NavGroup[] = [
  {
    title: 'Ventas',
    items: [
      { name: 'Leads', href: '/leads', icon: Target },
      { name: 'Pipeline', href: '/pipeline', icon: Kanban },
      { name: 'Oportunidades', href: '/sales', icon: Briefcase },
    ]
  },
  {
    title: 'Gestión',
    items: [
      { name: 'Contactos', href: '/contacts', icon: Users },
      { name: 'Tareas', href: '/tasks', icon: CheckSquare },
      { name: 'Calendario', href: '/calendar', icon: Calendar },
    ]
  },
  {
    title: 'Operaciones',
    items: [
      { name: 'Productos', href: '/products', icon: Package },
      { name: 'Cotizaciones', href: '/quotes', icon: FileText },
      { name: 'Facturación', href: '/invoicing', icon: Receipt },
    ]
  }
]
```

---

## 📝 Ejemplo 9: Implementación Completa en Root Layout

### Layout raíz con todas las optimizaciones
```tsx
// app/layout.tsx
import { Suspense } from 'react'
import { NavigationLoadingProvider } from '@/components/providers/navigation-loading-provider'
import DashboardLayoutOptimized from '@/components/layout/dashboard-layout-optimized'

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <NavigationLoadingProvider>
          <DashboardLayoutOptimized>
            <Suspense fallback={<div>Cargando...</div>}>
              {children}
            </Suspense>
          </DashboardLayoutOptimized>
        </NavigationLoadingProvider>
      </body>
    </html>
  )
}
```

---

## 🧪 Testing de Rendimiento

### Medir mejoras con Performance API
```tsx
// utils/performance-monitor.ts
export function measureNavigationTime(routeName: string) {
  if (typeof window === 'undefined') return

  const navigationStart = performance.now()

  return () => {
    const navigationEnd = performance.now()
    const duration = navigationEnd - navigationStart

    console.log(`🚀 Navegación a ${routeName}: ${duration.toFixed(2)}ms`)

    // Enviar a analytics si quieres
    if (duration > 1000) {
      console.warn(`⚠️ Navegación lenta detectada: ${routeName}`)
    }
  }
}

// Uso en componente
'use client'

import { useEffect } from 'react'
import { measureNavigationTime } from '@/utils/performance-monitor'

export default function ContactsPage() {
  useEffect(() => {
    const endMeasure = measureNavigationTime('Contacts')
    return endMeasure
  }, [])

  return <ContactsTable />
}
```

---

## 📊 Comparación Antes vs Después

### Mediciones reales esperadas

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Navegación Dashboard → Contactos | 1200ms | 250ms | 79% ⚡ |
| Re-renders del Sidebar | 18/ruta | 2/ruta | 89% ⚡ |
| Queries a BD (sidebar) | 3/mount | 1/mount | 67% ⚡ |
| Bundle inicial | 450KB | 280KB | 38% ⚡ |
| First Contentful Paint | 1.8s | 1.2s | 33% ⚡ |

---

## ✅ Checklist de Testing

Después de implementar, verifica:

- [ ] El sidebar no re-renderiza en cada cambio de ruta
- [ ] La navegación se siente instantánea
- [ ] Los skeletons aparecen inmediatamente
- [ ] El caché de usuario funciona (verificar en Network tab - 0 requests después del primero)
- [ ] No hay layout shift durante la carga
- [ ] La barra de progreso aparece durante navegación
- [ ] El bundle size se redujo (verificar con `ANALYZE=true npm run build`)
- [ ] Lighthouse score mejoró (Performance > 90)

---

## 🎯 Tips Finales

1. **Prefetch selectivo:** No todas las rutas necesitan prefetch, solo las más usadas
2. **Skeleton matching:** Los skeletons deben tener altura similar al contenido real
3. **Cache invalidation:** Siempre invalidar caché después de mutaciones
4. **Virtual scrolling:** Solo para listas >500 items
5. **Bundle analysis:** Ejecuta regularmente para detectar regresiones
6. **User feedback:** La percepción de velocidad es tan importante como la velocidad real

---

¡Con estos ejemplos puedes implementar todas las optimizaciones paso a paso! 🚀
