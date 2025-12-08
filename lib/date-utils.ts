/**
 * Date formatting utilities for Peru locale
 * ERROR-034: Dates - Formato inconsistente (US vs PE)
 */

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Format date to Peru format: DD/MM/YYYY
 */
export function formatDatePE(date: Date | string | null | undefined): string {
    if (!date) return '-'

    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date
        return format(dateObj, 'dd/MM/yyyy', { locale: es })
    } catch (error) {
        console.error('Error formatting date:', error)
        return '-'
    }
}

/**
 * Format datetime to Peru format: DD/MM/YYYY HH:mm
 */
export function formatDateTimePE(date: Date | string | null | undefined): string {
    if (!date) return '-'

    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date
        return format(dateObj, 'dd/MM/yyyy HH:mm', { locale: es })
    } catch (error) {
        console.error('Error formatting datetime:', error)
        return '-'
    }
}

/**
 * Format time to Peru format: HH:mm:ss
 */
export function formatTimePE(date: Date | string | null | undefined): string {
    if (!date) return '-'

    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date
        return format(dateObj, 'HH:mm:ss', { locale: es })
    } catch (error) {
        console.error('Error formatting time:', error)
        return '-'
    }
}

/**
 * Format date to relative format (hace 2 días, hace 1 hora, etc.)
 */
export function formatRelativePE(date: Date | string | null | undefined): string {
    if (!date) return '-'

    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date
        const now = new Date()
        const diffMs = now.getTime() - dateObj.getTime()
        const diffSecs = Math.floor(diffMs / 1000)
        const diffMins = Math.floor(diffSecs / 60)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffSecs < 60) return 'Hace un momento'
        if (diffMins < 60) return `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`
        if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`
        if (diffDays < 30) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`

        return formatDatePE(dateObj)
    } catch (error) {
        console.error('Error formatting relative date:', error)
        return '-'
    }
}

/**
 * Format date to long format: Lunes 21 de Noviembre de 2024
 */
export function formatDateLongPE(date: Date | string | null | undefined): string {
    if (!date) return '-'

    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date
        return format(dateObj, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    } catch (error) {
        console.error('Error formatting long date:', error)
        return '-'
    }
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | null | undefined): string {
    if (!date) return ''

    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date
        return format(dateObj, 'yyyy-MM-dd')
    } catch (error) {
        console.error('Error formatting input date:', error)
        return ''
    }
}

/**
 * Parse Peru format date (DD/MM/YYYY) to Date object
 */
export function parseDatePE(dateString: string): Date | null {
    if (!dateString) return null

    try {
        const [day, month, year] = dateString.split('/')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } catch (error) {
        console.error('Error parsing date:', error)
        return null
    }
}
