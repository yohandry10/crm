import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
])

const BLOCKED_PROTOCOLS = new Set([
  'file:',
  'ftp:',
  'gopher:',
  'data:',
  'javascript:',
])

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:'])

type ValidationOptions = {
  requireHttpsInProduction?: boolean
}

export type OutboundUrlValidation = {
  valid: boolean
  error?: string
  url?: URL
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname)
  return BLOCKED_HOSTS.has(normalized) || normalized.endsWith('.localhost')
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
}

function isPrivateOrReservedIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 192 && b === 0 ||
    a === 192 && b === 88 ||
    a === 198 && (b === 18 || b === 19) ||
    a >= 224
  )
}

function isPrivateOrReservedIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:169.254.')
  )
}

export function isPrivateOrReservedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPrivateOrReservedIpv4(address)
  if (family === 6) return isPrivateOrReservedIpv6(address)
  return true
}

export function validateOutboundUrlSyntax(
  urlString: string,
  options: ValidationOptions = {}
): OutboundUrlValidation {
  try {
    const url = new URL(urlString)

    if (!ALLOWED_PROTOCOLS.has(url.protocol) || BLOCKED_PROTOCOLS.has(url.protocol)) {
      return { valid: false, error: `Protocolo no permitido: ${url.protocol}` }
    }

    if ((url.username || url.password) && process.env.NODE_ENV === 'production') {
      return { valid: false, error: 'No se permiten credenciales embebidas en URLs' }
    }

    if ((options.requireHttpsInProduction ?? true) && process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      return { valid: false, error: 'Solo se permiten URLs HTTPS en producción' }
    }

    const hostname = normalizeHostname(url.hostname)
    if (isBlockedHostname(hostname)) {
      return { valid: false, error: `Host no permitido: ${hostname}` }
    }

    if (isIP(hostname) && isPrivateOrReservedAddress(hostname)) {
      return { valid: false, error: 'No se permiten IPs privadas o reservadas' }
    }

    return { valid: true, url }
  } catch {
    return { valid: false, error: 'URL inválida' }
  }
}

export async function validateOutboundWebhookUrl(urlString: string): Promise<OutboundUrlValidation> {
  const syntax = validateOutboundUrlSyntax(urlString)
  if (!syntax.valid || !syntax.url) return syntax

  const hostname = normalizeHostname(syntax.url.hostname)
  if (isIP(hostname)) {
    return syntax
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true })
    const blocked = records.find((record) => isPrivateOrReservedAddress(record.address))
    if (blocked) {
      return { valid: false, error: 'El host resuelve a una IP privada o reservada' }
    }
  } catch {
    return { valid: false, error: 'No se pudo resolver el host del webhook' }
  }

  return syntax
}
