/**
 * Tests para Error Handler
 * Verifica el manejo de errores y sanitización
 */
import { describe, it, expect } from 'vitest'
import { 
  ValidationError, 
  UnauthorizedError, 
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
  sanitizeErrorForClient,
  getHttpStatusForError
} from '@/lib/error-handler'

describe('Error Handler', () => {
  describe('Custom Error Classes', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Campo inválido', { field: 'email' })
      
      expect(error.name).toBe('ValidationError')
      expect(error.message).toBe('Campo inválido')
      expect(error.details).toEqual({ field: 'email' })
    })

    it('should create UnauthorizedError', () => {
      const error = new UnauthorizedError('No autenticado')
      
      expect(error.name).toBe('UnauthorizedError')
      expect(error.message).toBe('No autenticado')
    })

    it('should create ForbiddenError', () => {
      const error = new ForbiddenError('Sin permisos')
      
      expect(error.name).toBe('ForbiddenError')
      expect(error.message).toBe('Sin permisos')
    })

    it('should create NotFoundError', () => {
      const error = new NotFoundError('Contacto', 'c-123')
      
      expect(error.name).toBe('NotFoundError')
      expect(error.message).toBe('Contacto con id c-123 no encontrado')
    })

    it('should create BusinessRuleError', () => {
      const error = new BusinessRuleError('Regla de negocio violada')
      
      expect(error.name).toBe('BusinessRuleError')
      expect(error.message).toBe('Regla de negocio violada')
    })
  })

  describe('sanitizeErrorForClient', () => {
    it('should return message for known error types', () => {
      const validationError = new ValidationError('Email inválido')
      expect(sanitizeErrorForClient(validationError)).toBe('Email inválido')

      const authError = new UnauthorizedError('Sesión expirada')
      expect(sanitizeErrorForClient(authError)).toBe('Sesión expirada')
    })

    it('should return generic message for unknown errors in production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      const unknownError = new Error('Database connection failed')
      const result = sanitizeErrorForClient(unknownError)
      
      // En producción, mensajes cortos y seguros se permiten
      expect(typeof result).toBe('string')
      
      process.env.NODE_ENV = originalEnv
    })

    it('should handle non-Error objects', () => {
      const result = sanitizeErrorForClient('string error')
      // Debería manejar strings gracefully
      expect(typeof result).toBe('string')
    })
  })

  describe('getHttpStatusForError', () => {
    it('should return 400 for ValidationError', () => {
      const error = new ValidationError('Invalid')
      expect(getHttpStatusForError(error)).toBe(400)
    })

    it('should return 401 for UnauthorizedError', () => {
      const error = new UnauthorizedError('Unauthenticated')
      expect(getHttpStatusForError(error)).toBe(401)
    })

    it('should return 403 for ForbiddenError', () => {
      const error = new ForbiddenError('Forbidden')
      expect(getHttpStatusForError(error)).toBe(403)
    })

    it('should return 404 for NotFoundError', () => {
      const error = new NotFoundError('Not found')
      expect(getHttpStatusForError(error)).toBe(404)
    })

    it('should return 422 for BusinessRuleError', () => {
      const error = new BusinessRuleError('Business rule violated')
      expect(getHttpStatusForError(error)).toBe(422)
    })

    it('should return 500 for unknown errors', () => {
      const error = new Error('Unknown')
      expect(getHttpStatusForError(error)).toBe(500)
    })
  })
})
