import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkDependencies, formatDependencyError, checkDependenciesOrThrow } from '../dependency-checker'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('Dependency Checker', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
  })

  describe('checkDependencies', () => {
    it('should return no dependencies when all counts are zero', async () => {
      mockSupabase.eq.mockResolvedValue({ count: 0, error: null })

      const result = await checkDependencies(
        mockSupabase as unknown as SupabaseClient,
        'contacts',
        'test-id',
        'org-id'
      )

      expect(result.hasDependencies).toBe(false)
      expect(result.dependencies).toHaveLength(0)
    })

    it('should return dependencies when count > 0', async () => {
      let callCount = 0
      mockSupabase.eq.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call (invoices)
          return Promise.resolve({ count: 3, error: null })
        }
        // Other calls
        return Promise.resolve({ count: 0, error: null })
      })

      const result = await checkDependencies(
        mockSupabase as unknown as SupabaseClient,
        'contacts',
        'test-id',
        'org-id'
      )

      expect(result.hasDependencies).toBe(true)
      expect(result.dependencies).toHaveLength(1)
      expect(result.dependencies[0]).toEqual({
        table: 'invoices',
        count: 3,
        displayName: 'Facturas',
      })
    })

    it('should handle multiple dependencies', async () => {
      let callCount = 0
      mockSupabase.eq.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // invoices
          return Promise.resolve({ count: 3, error: null })
        } else if (callCount === 2) {
          // opportunities
          return Promise.resolve({ count: 2, error: null })
        }
        return Promise.resolve({ count: 0, error: null })
      })

      const result = await checkDependencies(
        mockSupabase as unknown as SupabaseClient,
        'contacts',
        'test-id',
        'org-id'
      )

      expect(result.hasDependencies).toBe(true)
      expect(result.dependencies).toHaveLength(2)
    })

    it('should continue checking even if one table fails', async () => {
      let callCount = 0
      mockSupabase.eq.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call fails
          return Promise.resolve({ count: null, error: { message: 'Table error' } })
        } else if (callCount === 2) {
          // Second call succeeds with count
          return Promise.resolve({ count: 5, error: null })
        }
        return Promise.resolve({ count: 0, error: null })
      })

      const result = await checkDependencies(
        mockSupabase as unknown as SupabaseClient,
        'contacts',
        'test-id',
        'org-id'
      )

      expect(result.hasDependencies).toBe(true)
      expect(result.dependencies.length).toBeGreaterThan(0)
    })

    it('should throw error for unknown entity type', async () => {
      await expect(
        checkDependencies(
          mockSupabase as unknown as SupabaseClient,
          'unknown_type',
          'test-id',
          'org-id'
        )
      ).rejects.toThrow('Unknown entity type: unknown_type')
    })
  })

  describe('formatDependencyError', () => {
    it('should format single dependency correctly', () => {
      const result = {
        hasDependencies: true,
        dependencies: [
          { table: 'invoices', count: 3, displayName: 'Facturas' },
        ],
      }

      const message = formatDependencyError(result, 'contacts')

      expect(message).toContain('contacto')
      expect(message).toContain('Facturas (3)')
    })

    it('should format multiple dependencies correctly', () => {
      const result = {
        hasDependencies: true,
        dependencies: [
          { table: 'invoices', count: 3, displayName: 'Facturas' },
          { table: 'opportunities', count: 2, displayName: 'Oportunidades' },
        ],
      }

      const message = formatDependencyError(result, 'contacts')

      expect(message).toContain('Facturas (3)')
      expect(message).toContain('Oportunidades (2)')
    })

    it('should return empty string when no dependencies', () => {
      const result = {
        hasDependencies: false,
        dependencies: [],
      }

      const message = formatDependencyError(result, 'contacts')

      expect(message).toBe('')
    })

    it('should handle different entity types', () => {
      const result = {
        hasDependencies: true,
        dependencies: [
          { table: 'quotes', count: 1, displayName: 'Cotizaciones' },
        ],
      }

      expect(formatDependencyError(result, 'opportunities')).toContain('oportunidad')
      expect(formatDependencyError(result, 'products')).toContain('producto')
      expect(formatDependencyError(result, 'campaigns')).toContain('campaña')
    })
  })

  describe('checkDependenciesOrThrow', () => {
    it('should not throw when no dependencies', async () => {
      mockSupabase.eq.mockResolvedValue({ count: 0, error: null })

      await expect(
        checkDependenciesOrThrow(
          mockSupabase as unknown as SupabaseClient,
          'contacts',
          'test-id',
          'org-id'
        )
      ).resolves.not.toThrow()
    })

    it('should throw error with dependencies', async () => {
      let callCount = 0
      mockSupabase.eq.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({ count: 3, error: null })
        }
        return Promise.resolve({ count: 0, error: null })
      })

      await expect(
        checkDependenciesOrThrow(
          mockSupabase as unknown as SupabaseClient,
          'contacts',
          'test-id',
          'org-id'
        )
      ).rejects.toThrow()
    })

    it('should throw error with statusCode 409', async () => {
      let callCount = 0
      mockSupabase.eq.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({ count: 3, error: null })
        }
        return Promise.resolve({ count: 0, error: null })
      })

      try {
        await checkDependenciesOrThrow(
          mockSupabase as unknown as SupabaseClient,
          'contacts',
          'test-id',
          'org-id'
        )
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.statusCode).toBe(409)
        expect(error.dependencies).toBeDefined()
      }
    })
  })
})
