> Esta documentación fue consolidada en `DOCUMENTACION.md#encriptación-db--app`.

# Encryption Implementation Guide

This guide explains how sensitive credentials are encrypted in the CRM database and how to work with encrypted data.

## Overview

The application uses **AES-256 encryption** to protect sensitive credentials stored in the database, including:

- **Organization Settings**: SUNAT credentials, OSE API keys
- **Email Accounts**: OAuth access tokens and refresh tokens
- **Integrations**: API keys, client secrets, and configuration data
- **Webhooks**: Secret keys for signature verification

## Architecture

### Database Layer (PostgreSQL + pgcrypto)

The database uses the `pgcrypto` extension to provide encryption functions:

- `encrypt_secret(TEXT)` - Encrypts a plaintext secret using AES-256
- `decrypt_secret(TEXT)` - Decrypts an encrypted secret
- Automatic triggers encrypt data on INSERT/UPDATE operations
- Encrypted columns are stored alongside original columns during migration

### Application Layer (Node.js/TypeScript)

The `lib/encryption.ts` module provides JavaScript functions for encryption:

- Uses Node.js `crypto` module with AES-256-CBC
- Compatible with PostgreSQL encryption format
- Provides helper functions for common use cases
- Automatic detection of sensitive fields

## Setup

### 1. Generate an Encryption Key

Generate a secure 32+ character encryption key:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using OpenSSL
openssl rand -base64 32
```

### 2. Set Environment Variable

Add the encryption key to your `.env` file:

```env
ENCRYPTION_KEY=your-generated-key-here
```

**Important**:
- Keep this key secure and never commit it to version control
- Use the same key across all environments that share the database
- If you lose this key, encrypted data cannot be recovered

### 3. Configure PostgreSQL

Set the encryption key at the database level (for SQL functions):

```sql
-- For current session
SET app.encryption_key = 'your-encryption-key-here';

-- For database default
ALTER DATABASE your_database_name SET app.encryption_key = 'your-encryption-key-here';
```

### 4. Run Migration

Apply the encryption migration:

```bash
# Using Supabase CLI
supabase db push

# Or directly with psql
psql -h your-host -U your-user -d your-db -f supabase/migrations/080_encrypt_credentials.sql
```

## Usage

### In API Endpoints

The encryption is handled automatically in API endpoints. Example from `app/api/settings/route.ts`:

```typescript
import { encryptSecret, decryptSecret } from "@/lib/encryption"

// On GET - decrypt for response
export async function GET() {
  const org = await supabase.from('organizations').select('*').single()

  // Decrypt sensitive fields
  const sunatUsuario = org.sunat_usuario_sol_encrypted
    ? decryptSecret(org.sunat_usuario_sol_encrypted)
    : org.sunat_usuario_sol

  return { ...org, sunat_usuario_sol: sunatUsuario }
}

// On PUT - encrypt before storing
export async function PUT(request) {
  const { sunat_usuario_sol } = await request.json()

  const updateData = {
    sunat_usuario_sol_encrypted: encryptSecret(sunat_usuario_sol),
    sunat_usuario_sol: null // Clear plaintext
  }

  await supabase.from('organizations').update(updateData)
}
```

### Encryption Helper Functions

#### Basic Encryption/Decryption

```typescript
import { encryptSecret, decryptSecret } from "@/lib/encryption"

// Encrypt a secret
const encrypted = encryptSecret("my-api-key-123")
// Returns: "aBcD123...==" (base64 encoded)

// Decrypt a secret
const decrypted = decryptSecret(encrypted)
// Returns: "my-api-key-123"
```

#### JSON Encryption

```typescript
import { encryptJSON, decryptJSON } from "@/lib/encryption"

// Encrypt an object
const config = { apiKey: "secret", token: "123" }
const encrypted = encryptJSON(config)

// Decrypt back to object
const decrypted = decryptJSON(encrypted)
// Returns: { apiKey: "secret", token: "123" }
```

#### Conditional Encryption

```typescript
import { encryptIfNeeded, decryptIfNeeded, isEncrypted } from "@/lib/encryption"

// Only encrypt if not already encrypted (idempotent)
const value = encryptIfNeeded("secret") // Encrypts
const value2 = encryptIfNeeded(value)   // Returns as-is (already encrypted)

// Safe decryption (won't fail on unencrypted data)
const plain = decryptIfNeeded(possiblyEncryptedValue)
```

#### Auto-detect Sensitive Fields

```typescript
import { autoEncryptSensitiveFields, autoDecryptSensitiveFields } from "@/lib/encryption"

// Automatically encrypt fields matching patterns (api_key, secret, token, etc.)
const data = {
  client_id: "public-123",      // Not encrypted (public)
  client_secret: "secret-456",  // Encrypted (contains "secret")
  api_key: "key-789"           // Encrypted (contains "api_key")
}

const encrypted = autoEncryptSensitiveFields(data)
const decrypted = autoDecryptSensitiveFields(encrypted)
```

#### Manual Field Selection

```typescript
import { encryptSensitiveFields, decryptSensitiveFields } from "@/lib/encryption"

const data = {
  name: "John",
  apiKey: "secret",
  token: "123"
}

// Encrypt specific fields
const encrypted = encryptSensitiveFields(data, ['apiKey', 'token'])
// Returns: { name: "John", apiKey: "[encrypted]", token: "[encrypted]" }

// Decrypt specific fields
const decrypted = decryptSensitiveFields(encrypted, ['apiKey', 'token'])
```

## Database Functions

### SQL Helper Functions

The migration creates several helper functions you can use directly in SQL:

#### Encrypt Organization Credentials

```sql
-- Safely update organization SUNAT credentials
SELECT upsert_organization_credentials(
  org_id := 'uuid-here',
  sunat_user := 'USUARIO123',
  sunat_pass := 'PASSWORD456',
  ose_key := 'OSE-API-KEY'
);
```

#### Encrypt Email Account Tokens

```sql
-- Safely update email OAuth tokens
SELECT upsert_email_account_tokens(
  account_id := 'uuid-here',
  access_tok := 'ya29.a0AfH6SMB...',
  refresh_tok := '1//0gHZqV7X...'
);
```

#### Encrypt Integration Config

```sql
-- Safely update integration configuration
SELECT upsert_integration_config(
  integration_id := 'uuid-here',
  new_config := '{"api_key": "secret", "endpoint": "https://api.example.com"}'::jsonb
);
```

### Decrypted Views

For convenience, decrypted views are available:

```sql
-- Get organization with decrypted credentials
SELECT * FROM organizations_decrypted WHERE id = 'uuid-here';
```

## Migration Strategy

The migration follows a **dual-column approach** for safety:

1. **Add encrypted columns** (e.g., `sunat_usuario_sol_encrypted`)
2. **Migrate existing data** from plaintext to encrypted columns
3. **Keep plaintext columns** temporarily for backward compatibility
4. **Triggers auto-encrypt** new data on INSERT/UPDATE
5. **Eventually drop plaintext columns** (after verifying)

### Migration Phases

**Phase 1: Initial Migration** (Current)
- Both plaintext and encrypted columns exist
- Data written to both for safety
- Application reads from encrypted columns first

**Phase 2: Encryption Enforcement** (Future)
```sql
-- Drop plaintext columns (run after testing)
ALTER TABLE organizations
  DROP COLUMN sunat_usuario_sol,
  DROP COLUMN sunat_clave_sol,
  DROP COLUMN ose_api_key;

ALTER TABLE email_accounts
  DROP COLUMN access_token,
  DROP COLUMN refresh_token;

ALTER TABLE integrations
  DROP COLUMN config;

ALTER TABLE webhooks
  DROP COLUMN secret;
```

## Security Best Practices

### 1. Key Management

- **Never hardcode** encryption keys in code
- **Use environment variables** or secret management services
- **Rotate keys** periodically (requires re-encryption)
- **Use different keys** for different environments

### 2. Access Control

- **Limit access** to encrypted data (use RLS policies)
- **Audit logs** for sensitive data access
- **Mask secrets** in logs and error messages

### 3. Key Rotation

To rotate encryption keys:

```typescript
import { generateEncryptionKey, decryptSecret, encryptSecret } from "@/lib/encryption"

// 1. Generate new key
const newKey = generateEncryptionKey()

// 2. Re-encrypt all data
// - Decrypt with old key
// - Encrypt with new key
// - Update database

// 3. Update ENCRYPTION_KEY environment variable

// 4. Restart application
```

## Troubleshooting

### Error: "Encryption key not configured"

**Cause**: `ENCRYPTION_KEY` environment variable is not set.

**Solution**: Set the environment variable and restart the application.

```bash
export ENCRYPTION_KEY="your-key-here"
```

### Error: "Failed to decrypt secret"

**Possible causes**:
1. Wrong encryption key
2. Corrupted encrypted data
3. Data encrypted with different key

**Solution**:
- Verify `ENCRYPTION_KEY` matches the key used to encrypt
- Check database for data corruption
- Review encryption/decryption logs

### Decryption Returns NULL

**Cause**: Encrypted column is NULL or empty.

**Solution**: This is expected for records without sensitive data. Check if the original column has data.

## Testing

### Generate Test Encryption Key

```bash
# For development/testing only
export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### Test Encryption Functions

```typescript
import { encryptSecret, decryptSecret, validateEncryptionConfig } from "@/lib/encryption"

// Validate configuration
try {
  validateEncryptionConfig()
  console.log('✅ Encryption configured correctly')
} catch (err) {
  console.error('❌ Encryption configuration error:', err)
}

// Test round-trip encryption
const original = "test-secret-123"
const encrypted = encryptSecret(original)
const decrypted = decryptSecret(encrypted)

console.assert(original === decrypted, 'Encryption round-trip failed')
```

## Performance Considerations

- **Encryption overhead**: ~1-2ms per operation
- **Batch operations**: Use transaction blocks for multiple encryptions
- **Caching**: Consider caching decrypted values in memory (with TTL)
- **Indexing**: Encrypted columns cannot be indexed for searching

## Compliance

This encryption implementation helps meet compliance requirements:

- **PCI DSS**: Encryption of cardholder data
- **GDPR**: Protection of personal data
- **SOC 2**: Data encryption controls
- **ISO 27001**: Information security management

## Support

For issues or questions:
1. Check this guide
2. Review `lib/encryption.ts` source code
3. Check application logs for encryption errors
4. Contact the development team

## References

- [PostgreSQL pgcrypto documentation](https://www.postgresql.org/docs/current/pgcrypto.html)
- [Node.js crypto module](https://nodejs.org/api/crypto.html)
- [AES-256 encryption standard](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)
