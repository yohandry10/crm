import useSWR from 'swr'

// Fetcher genérico
const fetcher = async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) {
        const error: any = new Error('An error occurred while fetching the data.')
        error.info = await res.json()
        error.status = res.status
        throw error
    }
    const data = await res.json()
    return data.success ? data.data : data
}

// Hook para listar contactos con auto-refresh
export function useContacts(filters?: { search?: string; status?: string; tag?: string }) {
    const params = new URLSearchParams()
    if (filters?.search) params.set('search', filters.search)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.tag) params.set('tag', filters.tag)

    const url = `/api/contacts${params.toString() ? '?' + params.toString() : ''}`

    const { data, error, mutate, isLoading } = useSWR(url, fetcher, {
        refreshInterval: 30000, // Auto-refresh cada 30s
        revalidateOnFocus: true,
        dedupingInterval: 2000
    })

    return {
        contacts: data,
        isLoading,
        isError: error,
        mutate
    }
}

// Hook para obtener un contacto específico
export function useContact(id?: string) {
    const { data, error, mutate, isLoading } = useSWR(
        id ? `/api/contacts/${id}` : null,
        fetcher,
        {
            revalidateOnFocus: true
        }
    )

    return {
        contact: data,
        isLoading,
        isError: error,
        mutate
    }
}

// Hook para invoices
export function useInvoices(filters?: { status?: string; contact_id?: string }) {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.contact_id) params.set('contact_id', filters.contact_id)

    const url = `/api/invoices${params.toString() ? '?' + params.toString() : ''}`

    const { data, error, mutate, isLoading } = useSWR(url, fetcher, {
        refreshInterval: 60000, // Auto-refresh cada minuto
        revalidateOnFocus: true
    })

    return {
        invoices: data,
        isLoading,
        isError: error,
        mutate
    }
}

// Hook para analytics
export function useAnalytics(period: string = 'month', monthsBack: number = 6) {
    const url = `/api/analytics/aggregated?period=${period}&months_back=${monthsBack}`

    const { data, error, mutate, isLoading } = useSWR(url, fetcher, {
        refreshInterval: 300000, // Auto-refresh cada 5 minutos
        revalidateOnFocus: false // No refresh en analytics al cambiar de pestaña
    })

    return {
        analytics: data,
        isLoading,
        isError: error,
        mutate
    }
}

// Hook para dashboard
export function useDashboard(period: string = 'month') {
    const url = `/api/dashboard?period=${period}`

    const { data, error, mutate, isLoading } = useSWR(url, fetcher, {
        refreshInterval: 60000, // Refresh cada minuto
        revalidateOnFocus: true
    })

    return {
        dashboard: data,
        isLoading,
        isError: error,
        mutate
    }
}

// Hook para tasks
export function useTasks(filters?: { status?: string; priority?: string; contact_id?: string }) {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.priority) params.set('priority', filters.priority)
    if (filters?.contact_id) params.set('contact_id', filters.contact_id)

    const url = `/api/tasks${params.toString() ? '?' + params.toString() : ''}`

    const { data, error, mutate, isLoading } = useSWR(url, fetcher, {
        refreshInterval: 30000,
        revalidateOnFocus: true
    })

    return {
        tasks: data,
        isLoading,
        isError: error,
        mutate
    }
}

// Utilidad para mutate global (invalidar cache de todas las keys que matcheen un patrón)
// Esta función requiere el provider de SWR en _app.tsx
// useSWRConfig permite invalidar multiple keys
export function mutatePattern(_pattern: string | RegExp): void {
    void _pattern // Placeholder for future implementation
}
