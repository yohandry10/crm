/**
 * Tests for encryption utilities
 *
 * Run with: pnpm test lib/encryption.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
    encryptSecret,
    decryptSecret,
    encryptJSON,
    decryptJSON,
    isEncrypted,
    encryptIfNeeded,
    decryptIfNeeded,
    autoEncryptSensitiveFields,
    autoDecryptSensitiveFields,
    generateEncryptionKey,
    isEncryptionConfigured,
    validateEncryptionConfig
} from '@/lib/encryption'

// Set a test encryption key before running tests
beforeAll(() => {
    if (!process.env.ENCRYPTION_KEY) {
        process.env.ENCRYPTION_KEY = generateEncryptionKey()
    }
})

describe('Encryption Utilities', () => {
    describe('Basic Encryption/Decryption', () => {
        it('should encrypt and decrypt a simple string', () => {
            const original = 'my-secret-api-key-123'
            const encrypted = encryptSecret(original)
            const decrypted = decryptSecret(encrypted)

            expect(encrypted).not.toBe(original)
            expect(decrypted).toBe(original)
        })

        it('should throw error when encrypting empty string', () => {
            expect(() => encryptSecret('')).toThrow()
            expect(() => encryptSecret('   ')).toThrow()
        })

        it('should throw error when decrypting empty string', () => {
            expect(() => decryptSecret('')).toThrow()
        })

        it('should produce different ciphertext for same input (due to random IV)', () => {
            const original = 'same-secret'
            const encrypted1 = encryptSecret(original)
            const encrypted2 = encryptSecret(original)

            expect(encrypted1).not.toBe(encrypted2)
            expect(decryptSecret(encrypted1)).toBe(original)
            expect(decryptSecret(encrypted2)).toBe(original)
        })

        it('should handle special characters and unicode', () => {
            const special = '!@#$%^&*()_+-={}[]|:;"<>,.?/~`'
            const unicode = '你好世界 🔐 émojis'

            expect(decryptSecret(encryptSecret(special))).toBe(special)
            expect(decryptSecret(encryptSecret(unicode))).toBe(unicode)
        })

        it('should handle long strings', () => {
            const longString = 'a'.repeat(10000)
            const encrypted = encryptSecret(longString)
            const decrypted = decryptSecret(encrypted)

            expect(decrypted).toBe(longString)
        })
    })

    describe('JSON Encryption', () => {
        it('should encrypt and decrypt JSON objects', () => {
            const original = {
                apiKey: 'secret-key',
                clientId: 'client-123',
                nested: {
                    token: 'token-456',
                    value: 123
                }
            }

            const encrypted = encryptJSON(original)
            const decrypted = decryptJSON(encrypted)

            expect(encrypted).not.toBe(JSON.stringify(original))
            expect(decrypted).toEqual(original)
        })

        it('should handle arrays in JSON', () => {
            const original = {
                keys: ['key1', 'key2', 'key3'],
                numbers: [1, 2, 3]
            }

            const encrypted = encryptJSON(original)
            const decrypted = decryptJSON(encrypted)

            expect(decrypted).toEqual(original)
        })
    })

    describe('Encryption Detection', () => {
        it('should correctly identify encrypted values', () => {
            const encrypted = encryptSecret('secret')
            const plaintext = 'not-encrypted'

            expect(isEncrypted(encrypted)).toBe(true)
            expect(isEncrypted(plaintext)).toBe(false)
            expect(isEncrypted('')).toBe(false)
            expect(isEncrypted('invalid:format')).toBe(false)
        })
    })

    describe('Conditional Encryption', () => {
        it('should only encrypt if needed', () => {
            const plaintext = 'secret'
            const encrypted = encryptIfNeeded(plaintext)
            const alreadyEncrypted = encryptIfNeeded(encrypted)

            expect(isEncrypted(encrypted)).toBe(true)
            expect(alreadyEncrypted).toBe(encrypted) // Should not double-encrypt
        })

        it('should safely decrypt if needed', () => {
            const plaintext = 'secret'
            const encrypted = encryptSecret(plaintext)

            expect(decryptIfNeeded(plaintext)).toBe(plaintext)
            expect(decryptIfNeeded(encrypted)).toBe(plaintext)
        })
    })

    describe('Auto-detect Sensitive Fields', () => {
        it('should auto-encrypt sensitive field patterns', () => {
            const data = {
                name: 'John Doe',
                email: 'john@example.com',
                api_key: 'secret-api-key',
                client_secret: 'oauth-secret',
                access_token: 'token-123',
                password: 'pass123',
                publicField: 'not-encrypted'
            }

            const encrypted = autoEncryptSensitiveFields(data)

            // Public fields should remain unchanged
            expect(encrypted.name).toBe('John Doe')
            expect(encrypted.email).toBe('john@example.com')
            expect(encrypted.publicField).toBe('not-encrypted')

            // Sensitive fields should be encrypted
            expect(isEncrypted(encrypted.api_key)).toBe(true)
            expect(isEncrypted(encrypted.client_secret)).toBe(true)
            expect(isEncrypted(encrypted.access_token)).toBe(true)
            expect(isEncrypted(encrypted.password)).toBe(true)
        })

        it('should auto-decrypt sensitive fields', () => {
            const original = {
                name: 'Jane',
                api_key: 'secret-key',
                refresh_token: 'refresh-123'
            }

            const encrypted = autoEncryptSensitiveFields(original)
            const decrypted = autoDecryptSensitiveFields(encrypted)

            expect(decrypted).toEqual(original)
        })

        it('should handle various naming conventions', () => {
            const data = {
                apiKey: 'secret1',
                api_key: 'secret2',
                'api-key': 'secret3',
                API_KEY: 'secret4'
            }

            const encrypted = autoEncryptSensitiveFields(data)

            expect(isEncrypted(encrypted.apiKey)).toBe(true)
            expect(isEncrypted(encrypted.api_key)).toBe(true)
            expect(isEncrypted(encrypted['api-key'])).toBe(true)
            expect(isEncrypted(encrypted.API_KEY)).toBe(true)
        })
    })

    describe('Key Generation', () => {
        it('should generate valid encryption keys', () => {
            const key = generateEncryptionKey()

            expect(key).toBeDefined()
            expect(key.length).toBeGreaterThan(40) // Base64 of 32 bytes
        })

        it('should generate unique keys', () => {
            const key1 = generateEncryptionKey()
            const key2 = generateEncryptionKey()

            expect(key1).not.toBe(key2)
        })

        it('should generate keys of custom length', () => {
            const key16 = generateEncryptionKey(16)
            const key64 = generateEncryptionKey(64)

            // Base64 encoding increases size by ~33%
            expect(key64.length).toBeGreaterThan(key16.length)
        })
    })

    describe('Configuration Validation', () => {
        it('should validate encryption is configured', () => {
            expect(isEncryptionConfigured()).toBe(true)
        })

        it('should validate encryption config without errors', () => {
            expect(() => validateEncryptionConfig()).not.toThrow()
        })
    })

    describe('Error Handling', () => {
        it('should handle decryption of corrupted data gracefully', () => {
            const corrupted = 'aBcDeFgHiJkL:corrupted-data'

            expect(() => decryptSecret(corrupted)).toThrow()
        })

        it('should handle decryption with wrong key', () => {
            const originalKey = process.env.ENCRYPTION_KEY
            const encrypted = encryptSecret('secret')

            // Change key
            process.env.ENCRYPTION_KEY = generateEncryptionKey()

            expect(() => decryptSecret(encrypted)).toThrow()

            // Restore key
            process.env.ENCRYPTION_KEY = originalKey
        })

        it('should return original value in decryptIfNeeded when decryption fails', () => {
            const corrupted = 'aBcDeFgHiJkL:invalid'
            const result = decryptIfNeeded(corrupted)

            // Should not throw, returns original
            expect(result).toBe(corrupted)
        })
    })

    describe('Real-world Scenarios', () => {
        it('should handle integration config encryption', () => {
            const integrationConfig = {
                provider: 'google',
                client_id: 'public-client-id.apps.googleusercontent.com',
                client_secret: 'super-secret-oauth-secret',
                redirect_uri: 'https://app.example.com/callback',
                scopes: ['email', 'profile', 'calendar']
            }

            const encrypted = autoEncryptSensitiveFields(integrationConfig)

            // Public fields unchanged
            expect(encrypted.provider).toBe('google')
            expect(encrypted.client_id).toBe(integrationConfig.client_id)
            expect(encrypted.redirect_uri).toBe(integrationConfig.redirect_uri)

            // Sensitive field encrypted
            expect(isEncrypted(encrypted.client_secret)).toBe(true)

            // Can decrypt back
            const decrypted = autoDecryptSensitiveFields(encrypted)
            expect(decrypted.client_secret).toBe(integrationConfig.client_secret)
        })

        it('should handle SUNAT credentials', () => {
            const sunatUser = '20123456789USUARIO1'
            const sunatPass = 'MySecurePassword123'

            const encryptedUser = encryptSecret(sunatUser)
            const encryptedPass = encryptSecret(sunatPass)

            expect(decryptSecret(encryptedUser)).toBe(sunatUser)
            expect(decryptSecret(encryptedPass)).toBe(sunatPass)
        })

        it('should handle email account tokens', () => {
            const tokens = {
                access_token: 'ya29.a0AfH6SMB_very_long_google_token_here',
                refresh_token: '1//0gHZqV7X-another-long-token',
                expires_at: new Date().toISOString()
            }

            const encrypted = autoEncryptSensitiveFields(tokens)

            expect(isEncrypted(encrypted.access_token)).toBe(true)
            expect(isEncrypted(encrypted.refresh_token)).toBe(true)
            expect(encrypted.expires_at).toBe(tokens.expires_at) // Not encrypted

            const decrypted = autoDecryptSensitiveFields(encrypted)
            expect(decrypted.access_token).toBe(tokens.access_token)
            expect(decrypted.refresh_token).toBe(tokens.refresh_token)
        })
    })
})
