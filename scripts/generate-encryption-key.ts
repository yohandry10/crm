#!/usr/bin/env tsx
/**
 * Generate a secure encryption key for the application
 *
 * Usage:
 *   pnpm tsx scripts/generate-encryption-key.ts
 *   node -r esbuild-register scripts/generate-encryption-key.ts
 */

import crypto from 'crypto'

function generateEncryptionKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64')
}

function main() {
    console.log('🔐 Generating secure encryption key...\n')

    const key = generateEncryptionKey()

    console.log('✅ Generated 32-byte encryption key (base64 encoded):\n')
    console.log('─'.repeat(60))
    console.log(key)
    console.log('─'.repeat(60))

    console.log('\n📋 Add this to your .env file:\n')
    console.log(`ENCRYPTION_KEY=${key}`)

    console.log('\n📋 Or set it in PostgreSQL:\n')
    console.log(`ALTER DATABASE your_database SET app.encryption_key = '${key}';`)

    console.log('\n⚠️  IMPORTANT SECURITY NOTES:')
    console.log('  • Keep this key secret - never commit it to version control')
    console.log('  • Store it securely (e.g., in a secrets manager)')
    console.log('  • Use the same key across all instances sharing the database')
    console.log('  • If you lose this key, encrypted data cannot be recovered')
    console.log('  • Consider using different keys for dev/staging/production')

    console.log('\n✨ Key generated successfully!\n')
}

main()
