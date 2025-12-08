/**
 * Tests para Utilidades
 * Verifica funciones de utilidad comunes
 */
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Utils', () => {
  describe('cn (className merger)', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2')
      expect(result).toContain('class1')
      expect(result).toContain('class2')
    })

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'included', false && 'excluded')
      expect(result).toContain('base')
      expect(result).toContain('included')
      expect(result).not.toContain('excluded')
    })

    it('should handle undefined and null', () => {
      const result = cn('base', undefined, null, 'valid')
      expect(result).toContain('base')
      expect(result).toContain('valid')
    })

    it('should merge tailwind classes correctly', () => {
      // tailwind-merge debería resolver conflictos
      const result = cn('p-4', 'p-2')
      // El último debería ganar
      expect(result).toBe('p-2')
    })

    it('should handle empty input', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle array of classes', () => {
      const result = cn(['class1', 'class2'])
      expect(result).toContain('class1')
      expect(result).toContain('class2')
    })
  })
})

describe('Date Formatting', () => {
  it('should format dates correctly for Peru timezone', () => {
    const date = new Date('2024-01-15T10:30:00Z')
    const formatted = date.toLocaleDateString('es-PE')
    
    expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
  })

  it('should handle currency formatting for PEN', () => {
    const amount = 1234.56
    const formatted = new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount)
    
    expect(formatted).toContain('1')
    expect(formatted).toContain('234')
  })
})

describe('Validation Helpers', () => {
  describe('Email validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    it('should validate correct emails', () => {
      expect(emailRegex.test('user@example.com')).toBe(true)
      expect(emailRegex.test('user.name@domain.co')).toBe(true)
      expect(emailRegex.test('user+tag@example.org')).toBe(true)
    })

    it('should reject invalid emails', () => {
      expect(emailRegex.test('invalid')).toBe(false)
      expect(emailRegex.test('invalid@')).toBe(false)
      expect(emailRegex.test('@domain.com')).toBe(false)
      expect(emailRegex.test('user @domain.com')).toBe(false)
    })
  })

  describe('RUC validation (Peru)', () => {
    const rucRegex = /^(10|20)\d{9}$/

    it('should validate correct RUC numbers', () => {
      expect(rucRegex.test('20123456789')).toBe(true) // Empresa
      expect(rucRegex.test('10123456789')).toBe(true) // Persona natural
    })

    it('should reject invalid RUC numbers', () => {
      expect(rucRegex.test('12345678901')).toBe(false) // No empieza con 10 o 20
      expect(rucRegex.test('2012345678')).toBe(false) // Muy corto
      expect(rucRegex.test('201234567890')).toBe(false) // Muy largo
      expect(rucRegex.test('20ABCDEFGHI')).toBe(false) // Letras
    })
  })

  describe('Phone validation (Peru)', () => {
    const phoneRegex = /^(\+51)?9\d{8}$/

    it('should validate correct phone numbers', () => {
      expect(phoneRegex.test('999123456')).toBe(true)
      expect(phoneRegex.test('+51999123456')).toBe(true)
    })

    it('should reject invalid phone numbers', () => {
      expect(phoneRegex.test('123456789')).toBe(false) // No empieza con 9
      expect(phoneRegex.test('99912345')).toBe(false) // Muy corto
      expect(phoneRegex.test('9991234567')).toBe(false) // Muy largo
    })
  })
})
