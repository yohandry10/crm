/**
 * Logger utility (Resuelve DATA-001)
 *
 * En desarrollo: logs activos
 * En producción: logs deshabilitados (excepto errors críticos)
 */

const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

/**
 * Log para debugging (solo en desarrollo)
 */
export function devLog(...args: any[]): void {
    if (isDev) {
        console.log(...args)
    }
}

/**
 * Log informativo (solo en desarrollo)
 */
export function devInfo(...args: any[]): void {
    if (isDev) {
        console.info(...args)
    }
}

/**
 * Warnings (siempre activos)
 */
export function warn(...args: any[]): void {
    console.warn(...args)
}

/**
 * Errors críticos (siempre activos)
 */
export function error(...args: any[]): void {
    console.error(...args)
}

/**
 * Debug detallado (solo en desarrollo y test)
 */
export function debug(...args: any[]): void {
    if (isDev || isTest) {
        console.debug(...args)
    }
}

/**
 * Helper para loggear objetos complejos
 */
export function logObject(label: string, obj: any): void {
    if (isDev) {
        console.log(`${label}:`, JSON.stringify(obj, null, 2))
    }
}

/**
 * Helper para medir performance
 */
export function timeLog(label: string): void {
    if (isDev) {
        console.time(label)
    }
}

export function timeLogEnd(label: string): void {
    if (isDev) {
        console.timeEnd(label)
    }
}
