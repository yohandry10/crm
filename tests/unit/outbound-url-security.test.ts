import { describe, expect, it } from 'vitest'
import {
  isPrivateOrReservedAddress,
  validateOutboundUrlSyntax,
  validateOutboundWebhookUrl,
} from '@/lib/outbound-url-security'

describe('outbound URL security', () => {
  it('rejects private and reserved IP addresses', () => {
    expect(isPrivateOrReservedAddress('127.0.0.1')).toBe(true)
    expect(isPrivateOrReservedAddress('10.0.0.1')).toBe(true)
    expect(isPrivateOrReservedAddress('172.16.0.1')).toBe(true)
    expect(isPrivateOrReservedAddress('192.168.1.1')).toBe(true)
    expect(isPrivateOrReservedAddress('169.254.169.254')).toBe(true)
    expect(isPrivateOrReservedAddress('8.8.8.8')).toBe(false)
  })

  it('rejects unsafe webhook URL syntax before network access', async () => {
    expect(validateOutboundUrlSyntax('file:///etc/passwd').valid).toBe(false)
    expect(validateOutboundUrlSyntax('http://localhost/hook').valid).toBe(false)
    expect(validateOutboundUrlSyntax('http://127.0.0.1/hook').valid).toBe(false)
    expect(validateOutboundUrlSyntax('http://[::1]/hook').valid).toBe(false)
    expect(validateOutboundUrlSyntax('https://example.com/hook').valid).toBe(true)

    const resolved = await validateOutboundWebhookUrl('http://127.0.0.1/hook')
    expect(resolved.valid).toBe(false)
    expect(resolved.error).toContain('privadas')
  })
})
