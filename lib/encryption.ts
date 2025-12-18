/**
 * Encryption utilities for handling sensitive credentials
 * Uses AES-256 encryption compatible with PostgreSQL pgcrypto
 *
 * @module lib/encryption
 */

import crypto from 'crypto'
import { logger } from './logger'

/**
 * Get encryption key from environment
 * Lazy getter to allow tests to set the key before use
 */
function getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY ?? ''

    if (!key) {
        // Only warn once
        if (!getEncryptionKey.hasWarned) {
            logger.warn('ENCRYPTION_KEY not set in environment variables. Encryption will fail.')
            getEncryptionKey.hasWarned = true
        }
    } else if (key.length < 32) {
        // Only warn once
        if (!getEncryptionKey.hasWarnedLength) {
            logger.warn('ENCRYPTION_KEY is too short. Recommended: 32+ characters for AES-256.')
            getEncryptionKey.hasWarnedLength = true
        }
    }

    return key
}
// Track warnings to avoid spam
getEncryptionKey.hasWarned = false
getEncryptionKey.hasWarnedLength = false

/**
 * Configuration for encryption
 */
const ENCRYPTION_CONFIG = {
    algorithm: 'aes-256-cbc',
    ivLength: 16, // Initialization vector length for AES
    encoding: 'base64' as BufferEncoding,
    inputEncoding: 'utf8' as BufferEncoding,
}

/**
 * Derives a 32-byte key from the encryption key using SHA-256
 * This ensures compatibility with AES-256
 */
function deriveKey(key: string): Buffer {
    return crypto.createHash('sha256').update(key).digest()
}

/**
 * Encrypts a plain text secret using AES-256-CBC
 * Returns base64-encoded encrypted data with IV prepended
 *
 * Format: [IV (16 bytes)][Encrypted Data]
 *
 * @param plainText - The secret to encrypt
 * @returns Base64-encoded encrypted string
 * @throws Error if encryption fails or key is not set
 *
 * @example
 * const encrypted = encryptSecret('my-api-key-123')
 * // Returns: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ...'
 */
export function encryptSecret(plainText: string): string {
    const encryptionKey = getEncryptionKey()

    if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is not set')
    }

    if (!plainText || plainText.trim() === '') {
        throw new Error('Cannot encrypt empty or null value')
    }

    try {
        // Generate a random IV for this encryption
        const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength)

        // Derive the encryption key
        const key = deriveKey(encryptionKey)

        // Create cipher
        const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv)

        // Encrypt the data
        let encrypted = cipher.update(plainText, ENCRYPTION_CONFIG.inputEncoding, ENCRYPTION_CONFIG.encoding)
        encrypted += cipher.final(ENCRYPTION_CONFIG.encoding)

        // Prepend IV to encrypted data (both in base64)
        const ivBase64 = iv.toString(ENCRYPTION_CONFIG.encoding)
        const result = ivBase64 + ':' + encrypted

        return result
    } catch (error) {
        logger.error('Encryption failed', error)
        throw new Error('Failed to encrypt secret')
    }
}

/**
 * Decrypts an encrypted secret using AES-256-CBC
 * Expects base64-encoded data with IV prepended
 *
 * @param encryptedText - The encrypted secret (base64 with IV)
 * @returns Decrypted plain text
 * @throws Error if decryption fails or key is not set
 *
 * @example
 * const decrypted = decryptSecret('aBcDeFgHiJkLmNoPqRsTuVwXyZ...')
 * // Returns: 'my-api-key-123'
 */
export function decryptSecret(encryptedText: string): string {
    const encryptionKey = getEncryptionKey()

    if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is not set')
    }

    if (!encryptedText || encryptedText.trim() === '') {
        throw new Error('Cannot decrypt empty or null value')
    }

    try {
        // Split IV and encrypted data
        const parts = encryptedText.split(':')
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format')
        }

        const ivBase64 = parts[0]
        const encrypted = parts[1]

        // Convert IV from base64 to Buffer
        const iv = Buffer.from(ivBase64, ENCRYPTION_CONFIG.encoding)

        // Derive the encryption key
        const key = deriveKey(encryptionKey)

        // Create decipher
        const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv)

        // Decrypt the data
        let decrypted = decipher.update(encrypted, ENCRYPTION_CONFIG.encoding, ENCRYPTION_CONFIG.inputEncoding)
        decrypted += decipher.final(ENCRYPTION_CONFIG.inputEncoding)

        return decrypted
    } catch (error) {
        logger.error('Decryption failed', error)
        throw new Error('Failed to decrypt secret. Data may be corrupted or key is incorrect.')
    }
}

/**
 * Encrypts a JSON object (for integration configs, etc.)
 *
 * @param data - Object to encrypt
 * @returns Base64-encoded encrypted JSON string
 *
 * @example
 * const encrypted = encryptJSON({ apiKey: 'secret', token: '123' })
 */
export function encryptJSON(data: Record<string, any>): string {
    const jsonString = JSON.stringify(data)
    return encryptSecret(jsonString)
}

/**
 * Decrypts an encrypted JSON object
 *
 * @param encryptedText - Encrypted JSON string
 * @returns Decrypted object
 *
 * @example
 * const decrypted = decryptJSON(encryptedString)
 * // Returns: { apiKey: 'secret', token: '123' }
 */
export function decryptJSON(encryptedText: string): Record<string, any> {
    const jsonString = decryptSecret(encryptedText)
    return JSON.parse(jsonString)
}

/**
 * Checks if a value appears to be encrypted
 * (Simple heuristic: base64 string with ':' separator)
 *
 * @param value - Value to check
 * @returns true if value looks encrypted
 */
export function isEncrypted(value: string): boolean {
    if (!value || typeof value !== 'string') {
        return false
    }

    // Check for our format: base64:base64
    const parts = value.split(':')
    if (parts.length !== 2) {
        return false
    }

    // Check if both parts are valid base64 and have reasonable length
    // IV should be 16 bytes = 24 chars in base64
    const base64Regex = /^[A-Za-z0-9+/]{16,}={0,2}$/
    return base64Regex.test(parts[0]) && base64Regex.test(parts[1])
}

/**
 * Safely encrypts a value only if it's not already encrypted
 * Useful for idempotent operations
 *
 * @param value - Value to encrypt
 * @returns Encrypted value
 */
export function encryptIfNeeded(value: string): string {
    if (isEncrypted(value)) {
        return value
    }
    return encryptSecret(value)
}

/**
 * Safely decrypts a value, returns original if not encrypted
 * Useful for backward compatibility during migration
 *
 * @param value - Value to decrypt
 * @returns Decrypted value or original if not encrypted
 */
export function decryptIfNeeded(value: string): string {
    if (!isEncrypted(value)) {
        return value
    }
    try {
        return decryptSecret(value)
    } catch {
        // If decryption fails, return original (may be corrupted or wrong key)
        logger.warn('Failed to decrypt value, returning original')
        return value
    }
}

/**
 * Encrypts sensitive fields in an object
 * Only encrypts fields that match sensitive patterns
 *
 * @param data - Object with potential sensitive fields
 * @param sensitiveFields - Array of field names to encrypt
 * @returns Object with encrypted sensitive fields
 *
 * @example
 * const encrypted = encryptSensitiveFields(
 *   { apiKey: 'secret', name: 'John', token: '123' },
 *   ['apiKey', 'token']
 * )
 * // Returns: { apiKey: '[encrypted]', name: 'John', token: '[encrypted]' }
 */
export function encryptSensitiveFields(
    data: Record<string, any>,
    sensitiveFields: string[]
): Record<string, any> {
    const result = { ...data }

    for (const field of sensitiveFields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = encryptIfNeeded(result[field])
        }
    }

    return result
}

/**
 * Decrypts sensitive fields in an object
 *
 * @param data - Object with encrypted fields
 * @param sensitiveFields - Array of field names to decrypt
 * @returns Object with decrypted sensitive fields
 */
export function decryptSensitiveFields(
    data: Record<string, any>,
    sensitiveFields: string[]
): Record<string, any> {
    const result = { ...data }

    for (const field of sensitiveFields) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = decryptIfNeeded(result[field])
        }
    }

    return result
}

/**
 * Common sensitive field patterns to automatically detect
 */
export const SENSITIVE_FIELD_PATTERNS = [
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /password/i,
    /credential/i,
    /client[_-]?secret/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /private[_-]?key/i,
    /auth/i,
]

/**
 * Automatically detects and encrypts sensitive fields in an object
 * Based on common patterns (api_key, secret, token, password, etc.)
 *
 * @param data - Object to process
 * @returns Object with sensitive fields encrypted
 *
 * @example
 * const encrypted = autoEncryptSensitiveFields({
 *   client_id: 'public-123',
 *   client_secret: 'secret-456',
 *   api_key: 'key-789'
 * })
 */
export function autoEncryptSensitiveFields(
    data: Record<string, any>
): Record<string, any> {
    const result = { ...data }

    for (const [key, value] of Object.entries(result)) {
        if (typeof value !== 'string' || !value) {
            continue
        }

        // Check if field name matches sensitive patterns
        const isSensitive = SENSITIVE_FIELD_PATTERNS.some(pattern =>
            pattern.test(key)
        )

        if (isSensitive) {
            result[key] = encryptIfNeeded(value)
        }
    }

    return result
}

/**
 * Automatically detects and decrypts sensitive fields in an object
 *
 * @param data - Object to process
 * @returns Object with sensitive fields decrypted
 */
export function autoDecryptSensitiveFields(
    data: Record<string, any>
): Record<string, any> {
    const result = { ...data }

    for (const [key, value] of Object.entries(result)) {
        if (typeof value !== 'string' || !value) {
            continue
        }

        // Check if field name matches sensitive patterns
        const isSensitive = SENSITIVE_FIELD_PATTERNS.some(pattern =>
            pattern.test(key)
        )

        if (isSensitive) {
            result[key] = decryptIfNeeded(value)
        }
    }

    return result
}

/**
 * Generates a secure random encryption key
 * Useful for initial setup or key rotation
 *
 * @param length - Key length in bytes (default: 32 for AES-256)
 * @returns Base64-encoded random key
 *
 * @example
 * const newKey = generateEncryptionKey()
 * logger.info('Set ENCRYPTION_KEY=' + newKey)
 */
export function generateEncryptionKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64')
}

/**
 * Type guard to check if encryption is configured
 */
export function isEncryptionConfigured(): boolean {
    const key = getEncryptionKey()
    return !!key && key.length >= 32
}

/**
 * Validates encryption configuration and throws if invalid
 * Use this in critical paths to fail fast
 */
export function validateEncryptionConfig(): void {
    const key = getEncryptionKey()

    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set')
    }

    if (key.length < 32) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
    }
}
