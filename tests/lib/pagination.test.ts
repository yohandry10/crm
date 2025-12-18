/**
 * Tests for Pagination Utilities
 * Validates the pagination fixes implemented for P1 issues
 */

import { describe, it, expect } from 'vitest'
import {
  PAGINATION,
  getPaginationParams,
  getPaginationMeta,
  createPaginatedResponse,
  validatePaginationLimits
} from '@/lib/pagination'

describe('Pagination Utilities', () => {
  describe('PAGINATION constants', () => {
    it('should have correct default values', () => {
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(20)
      expect(PAGINATION.MAX_PAGE_SIZE).toBe(100)
      expect(PAGINATION.DEFAULT_PAGE).toBe(1)
    })
  })

  describe('getPaginationParams', () => {
    it('should return default values when no params provided', () => {
      const searchParams = new URLSearchParams()
      const result = getPaginationParams(searchParams)

      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)
    })

    it('should parse valid pagination params', () => {
      const searchParams = new URLSearchParams('page=3&limit=50')
      const result = getPaginationParams(searchParams)

      expect(result.page).toBe(3)
      expect(result.limit).toBe(50)
      expect(result.offset).toBe(100) // (3-1) * 50
    })

    it('should enforce MAX_PAGE_SIZE limit', () => {
      const searchParams = new URLSearchParams('limit=500')
      const result = getPaginationParams(searchParams)

      expect(result.limit).toBe(100) // MAX_PAGE_SIZE
    })

    it('should enforce minimum page value of 1', () => {
      const searchParams = new URLSearchParams('page=0')
      const result = getPaginationParams(searchParams)

      expect(result.page).toBe(1)
    })

    it('should enforce minimum limit value of 1', () => {
      const searchParams = new URLSearchParams('limit=0')
      const result = getPaginationParams(searchParams)

      expect(result.limit).toBe(1)
    })

    it('should handle negative values correctly', () => {
      const searchParams = new URLSearchParams('page=-5&limit=-10')
      const result = getPaginationParams(searchParams)

      expect(result.page).toBe(1)
      expect(result.limit).toBe(1)
    })

    it('should handle invalid values correctly', () => {
      const searchParams = new URLSearchParams('page=abc&limit=xyz')
      const result = getPaginationParams(searchParams)

      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })

    it('should calculate offset correctly for different pages', () => {
      const searchParams1 = new URLSearchParams('page=1&limit=20')
      expect(getPaginationParams(searchParams1).offset).toBe(0)

      const searchParams2 = new URLSearchParams('page=2&limit=20')
      expect(getPaginationParams(searchParams2).offset).toBe(20)

      const searchParams3 = new URLSearchParams('page=5&limit=25')
      expect(getPaginationParams(searchParams3).offset).toBe(100)
    })
  })

  describe('getPaginationMeta', () => {
    it('should calculate metadata correctly for first page', () => {
      const meta = getPaginationMeta(1, 20, 100)

      expect(meta.page).toBe(1)
      expect(meta.limit).toBe(20)
      expect(meta.total).toBe(100)
      expect(meta.totalPages).toBe(5)
      expect(meta.hasNext).toBe(true)
      expect(meta.hasPrev).toBe(false)
    })

    it('should calculate metadata correctly for middle page', () => {
      const meta = getPaginationMeta(3, 20, 100)

      expect(meta.page).toBe(3)
      expect(meta.totalPages).toBe(5)
      expect(meta.hasNext).toBe(true)
      expect(meta.hasPrev).toBe(true)
    })

    it('should calculate metadata correctly for last page', () => {
      const meta = getPaginationMeta(5, 20, 100)

      expect(meta.page).toBe(5)
      expect(meta.totalPages).toBe(5)
      expect(meta.hasNext).toBe(false)
      expect(meta.hasPrev).toBe(true)
    })

    it('should handle empty results correctly', () => {
      const meta = getPaginationMeta(1, 20, 0)

      expect(meta.total).toBe(0)
      expect(meta.totalPages).toBe(0)
      expect(meta.hasNext).toBe(false)
      expect(meta.hasPrev).toBe(false)
    })

    it('should handle partial last page correctly', () => {
      const meta = getPaginationMeta(3, 20, 55)

      expect(meta.totalPages).toBe(3) // Math.ceil(55/20)
      expect(meta.hasNext).toBe(false)
    })
  })

  describe('createPaginatedResponse', () => {
    it('should create properly formatted paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const response = createPaginatedResponse(data, 1, 20, 100)

      expect(response.data).toEqual(data)
      expect(response.pagination).toHaveProperty('page')
      expect(response.pagination).toHaveProperty('limit')
      expect(response.pagination).toHaveProperty('total')
      expect(response.pagination).toHaveProperty('totalPages')
      expect(response.pagination).toHaveProperty('hasNext')
      expect(response.pagination).toHaveProperty('hasPrev')
    })
  })

  describe('validatePaginationLimits', () => {
    it('should validate correct pagination params', () => {
      const result = validatePaginationLimits(1, 20)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject page less than 1', () => {
      const result = validatePaginationLimits(0, 20)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Page must be greater than or equal to 1')
    })

    it('should reject limit less than 1', () => {
      const result = validatePaginationLimits(1, 0)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Limit must be greater than or equal to 1')
    })

    it('should reject limit exceeding MAX_PAGE_SIZE', () => {
      const result = validatePaginationLimits(1, 150)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Limit cannot exceed 100')
    })

    it('should accept limit at MAX_PAGE_SIZE boundary', () => {
      const result = validatePaginationLimits(1, 100)

      expect(result.valid).toBe(true)
    })
  })

  describe('DoS Protection', () => {
    it('should prevent queries without limits by enforcing max', () => {
      const searchParams = new URLSearchParams('limit=999999')
      const result = getPaginationParams(searchParams)

      expect(result.limit).toBeLessThanOrEqual(PAGINATION.MAX_PAGE_SIZE)
    })

    it('should prevent negative offset attacks', () => {
      const searchParams = new URLSearchParams('page=-100')
      const result = getPaginationParams(searchParams)

      expect(result.offset).toBeGreaterThanOrEqual(0)
    })
  })
})
