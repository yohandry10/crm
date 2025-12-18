/**
 * Tests for Schema Validations
 * Validates the invoice schema fixes implemented for P1 issues
 */

import { describe, it, expect } from 'vitest'
import {
  invoiceItemSchema,
  createInvoiceSchema,
  createPaymentSchema
} from '@/lib/schemas'

describe('Invoice Item Schema', () => {
  describe('product_id validation', () => {
    it('should accept valid UUID product_id', () => {
      const validItem = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Test Product',
        quantity: 5,
        unit_price: 100,
        tax_rate: 0.18
      }

      const result = invoiceItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should accept null product_id', () => {
      const validItem = {
        product_id: null,
        description: 'Custom Service',
        quantity: 1,
        unit_price: 500
      }

      const result = invoiceItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should accept undefined product_id', () => {
      const validItem = {
        description: 'Ad-hoc Item',
        quantity: 2,
        unit_price: 75
      }

      const result = invoiceItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID format', () => {
      const invalidItem = {
        product_id: 'not-a-valid-uuid',
        description: 'Test Product',
        quantity: 1,
        unit_price: 100
      }

      const result = invoiceItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid product ID')
      }
    })

    it('should reject empty string product_id', () => {
      const invalidItem = {
        product_id: '',
        description: 'Test Product',
        quantity: 1,
        unit_price: 100
      }

      const result = invoiceItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })
  })

  describe('quantity validation', () => {
    it('should accept positive quantity', () => {
      const validItem = {
        description: 'Test',
        quantity: 5,
        unit_price: 100
      }

      const result = invoiceItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should reject zero quantity', () => {
      const invalidItem = {
        description: 'Test',
        quantity: 0,
        unit_price: 100
      }

      const result = invoiceItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('positive')
      }
    })

    it('should reject negative quantity', () => {
      const invalidItem = {
        description: 'Test',
        quantity: -5,
        unit_price: 100
      }

      const result = invoiceItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })
  })

  describe('unit_price validation', () => {
    it('should accept zero price', () => {
      const validItem = {
        description: 'Free Item',
        quantity: 1,
        unit_price: 0
      }

      const result = invoiceItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should accept positive price', () => {
      const validItem = {
        description: 'Paid Item',
        quantity: 1,
        unit_price: 99.99
      }

      const result = invoiceItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should reject negative price', () => {
      const invalidItem = {
        description: 'Test',
        quantity: 1,
        unit_price: -50
      }

      const result = invoiceItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('non-negative')
      }
    })
  })

  describe('tax_rate validation', () => {
    it('should use default tax rate when not provided', () => {
      const item = {
        description: 'Test',
        quantity: 1,
        unit_price: 100
      }

      const result = invoiceItemSchema.safeParse(item)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tax_rate).toBe(0.18)
      }
    })

    it('should accept custom tax rate', () => {
      const item = {
        description: 'Test',
        quantity: 1,
        unit_price: 100,
        tax_rate: 0.10
      }

      const result = invoiceItemSchema.safeParse(item)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tax_rate).toBe(0.10)
      }
    })

    it('should reject negative tax rate', () => {
      const invalidItem = {
        description: 'Test',
        quantity: 1,
        unit_price: 100,
        tax_rate: -0.05
      }

      const result = invoiceItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })
  })

  describe('description validation', () => {
    it('should require description', () => {
      const invalidItem = {
        quantity: 1,
        unit_price: 100
      }

      const result = invoiceItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('should reject empty description', () => {
      const invalidItem = {
        description: '',
        quantity: 1,
        unit_price: 100
      }

      const result = invoiceItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('required')
      }
    })
  })
})

describe('Invoice Schema', () => {
  describe('items validation', () => {
    it('should require at least one item', () => {
      const invalidInvoice = {
        contact_id: '550e8400-e29b-41d4-a716-446655440000',
        due_date: '2025-12-31',
        items: []
      }

      const result = createInvoiceSchema.safeParse(invalidInvoice)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one item')
      }
    })

    it('should accept valid invoice with items', () => {
      const validInvoice = {
        contact_id: '550e8400-e29b-41d4-a716-446655440000',
        due_date: '2025-12-31',
        items: [
          {
            description: 'Product 1',
            quantity: 2,
            unit_price: 100
          }
        ]
      }

      const result = createInvoiceSchema.safeParse(validInvoice)
      expect(result.success).toBe(true)
    })

    it('should validate all items in array', () => {
      const invalidInvoice = {
        contact_id: '550e8400-e29b-41d4-a716-446655440000',
        due_date: '2025-12-31',
        items: [
          {
            description: 'Valid Item',
            quantity: 1,
            unit_price: 100
          },
          {
            description: 'Invalid Item',
            quantity: -5, // Invalid
            unit_price: 100
          }
        ]
      }

      const result = createInvoiceSchema.safeParse(invalidInvoice)
      expect(result.success).toBe(false)
    })
  })

  describe('contact_id validation', () => {
    it('should require valid UUID contact_id', () => {
      const validInvoice = {
        contact_id: '550e8400-e29b-41d4-a716-446655440000',
        due_date: '2025-12-31',
        items: [{ description: 'Test', quantity: 1, unit_price: 100 }]
      }

      const result = createInvoiceSchema.safeParse(validInvoice)
      expect(result.success).toBe(true)
    })

    it('should reject invalid contact_id', () => {
      const invalidInvoice = {
        contact_id: 'not-a-uuid',
        due_date: '2025-12-31',
        items: [{ description: 'Test', quantity: 1, unit_price: 100 }]
      }

      const result = createInvoiceSchema.safeParse(invalidInvoice)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid contact ID')
      }
    })
  })
})

describe('Payment Schema', () => {
  describe('amount validation', () => {
    it('should accept positive amount', () => {
      const validPayment = {
        amount: 500.50,
        payment_method: 'card',
        gateway: 'manual'
      }

      const result = createPaymentSchema.safeParse(validPayment)
      expect(result.success).toBe(true)
    })

    it('should reject zero amount', () => {
      const invalidPayment = {
        amount: 0,
        payment_method: 'card',
        gateway: 'manual'
      }

      const result = createPaymentSchema.safeParse(invalidPayment)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('positive')
      }
    })

    it('should reject negative amount', () => {
      const invalidPayment = {
        amount: -100,
        payment_method: 'card',
        gateway: 'manual'
      }

      const result = createPaymentSchema.safeParse(invalidPayment)
      expect(result.success).toBe(false)
    })
  })
})
