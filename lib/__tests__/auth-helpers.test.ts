import { describe, it, expect } from 'vitest'
import { maskEmail, maskRUC, validatePagination } from '../auth-helpers'

describe('auth-helpers', () => {
  describe('maskEmail', () => {
    it('should mask email correctly', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j********@example.com')
      expect(maskEmail('a@test.com')).toBe('a***@test.com')
      expect(maskEmail('test@example.com')).toBe('t***@example.com')
    })

    it('should handle edge cases', () => {
      expect(maskEmail(null)).toBe('***@***.***')
      expect(maskEmail(undefined)).toBe('***@***.***')
      expect(maskEmail('')).toBe('***@***.***')
      expect(maskEmail('invalid-email')).toBe('***@***.***')
    })

    it('should preserve domain', () => {
      const masked = maskEmail('user@company.com')
      expect(masked).toContain('@company.com')
    })
  })

  describe('maskRUC', () => {
    it('should mask RUC correctly', () => {
      expect(maskRUC('20123456789')).toBe('********789')
      expect(maskRUC('1234567890')).toBe('*******890')
      expect(maskRUC('12345')).toBe('**345')
    })

    it('should handle edge cases', () => {
      expect(maskRUC(null)).toBe(null)
      expect(maskRUC(undefined)).toBe(null)
      expect(maskRUC('')).toBe(null)
      expect(maskRUC('123')).toBe('*23')
    })

    it('should show last 3 digits', () => {
      const masked = maskRUC('20123456789')
      expect(masked?.slice(-3)).toBe('789')
    })
  })

  describe('validatePagination', () => {
    it('should return default values', () => {
      const params = new URLSearchParams()
      const result = validatePagination(params)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)
    })

    it('should validate and sanitize values', () => {
      const params = new URLSearchParams('page=2&limit=50')
      const result = validatePagination(params)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(50)
      expect(result.offset).toBe(50)
    })

    it('should enforce maximum limit', () => {
      const params = new URLSearchParams('limit=200')
      const result = validatePagination(params)
      expect(result.limit).toBe(100)
    })

    it('should enforce minimum values', () => {
      const params = new URLSearchParams('page=-1&limit=0')
      const result = validatePagination(params)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(1)
    })

    it('should calculate offset correctly', () => {
      const params = new URLSearchParams('page=3&limit=25')
      const result = validatePagination(params)
      expect(result.offset).toBe(50) // (3-1) * 25
    })
  })
})
