> Esta documentación fue consolidada en `DOCUMENTACION.md#encriptación-db--app`.

# Encryption Quick Reference

## Setup (One-time)

```bash
# 1. Generate key
pnpm tsx scripts/generate-encryption-key.ts

# 2. Add to .env
echo "ENCRYPTION_KEY=your-key-here" >> .env

# 3. Run migration
supabase db push
```

## Common Tasks

### Encrypt a Value

```typescript
import { encryptSecret } from '@/lib/encryption'

const encrypted = encryptSecret('my-secret-api-key')
```

### Decrypt a Value

```typescript
import { decryptSecret } from '@/lib/encryption'

const decrypted = decryptSecret(encryptedValue)
```

### Encrypt JSON Config

```typescript
import { encryptJSON, decryptJSON } from '@/lib/encryption'

const config = { apiKey: 'secret', clientId: '123' }
const encrypted = encryptJSON(config)
const decrypted = decryptJSON(encrypted)
```

### Auto-encrypt Sensitive Fields

```typescript
import { autoEncryptSensitiveFields, autoDecryptSensitiveFields } from '@/lib/encryption'

// Automatically encrypts: api_key, secret, token, password, etc.
const data = { name: 'Test', api_key: 'secret' }
const encrypted = autoEncryptSensitiveFields(data)
const decrypted = autoDecryptSensitiveFields(encrypted)
```

## Database Functions

### Update Organization Credentials

```sql
SELECT upsert_organization_credentials(
  org_id := 'uuid-here',
  sunat_user := 'USUARIO123',
  sunat_pass := 'PASSWORD456'
);
```

### Update Email Tokens

```sql
SELECT upsert_email_account_tokens(
  account_id := 'uuid-here',
  access_tok := 'ya29.token...',
  refresh_tok := '1//refresh...'
);
```

### Decrypt in SQL

```sql
-- Use decrypted view
SELECT * FROM organizations_decrypted WHERE id = 'uuid';

-- Or manual decryption
SELECT decrypt_secret(sunat_usuario_sol_encrypted) FROM organizations;
```

## API Endpoints

### Settings API

```typescript
// GET - automatically decrypts
const settings = await fetch('/api/settings').then(r => r.json())

// PUT - automatically encrypts
await fetch('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    sunat_usuario_sol: 'USER',
    sunat_clave_sol: 'PASS'
  })
})
```

### Integrations API

```typescript
// POST - encrypts config
await fetch('/api/integrations', {
  method: 'POST',
  body: JSON.stringify({
    provider: 'google',
    config: {
      client_id: 'public',
      client_secret: 'encrypted-automatically'
    }
  })
})
```

## Encrypted Tables & Columns

| Table | Encrypted Columns |
|-------|------------------|
| organizations | sunat_usuario_sol_encrypted<br>sunat_clave_sol_encrypted<br>ose_api_key_encrypted |
| email_accounts | access_token_encrypted<br>refresh_token_encrypted |
| integrations | config_encrypted |
| webhooks | secret_encrypted |

## Sensitive Field Patterns

Auto-encrypted if field name contains:
- `api_key` or `apiKey`
- `secret`
- `token`
- `password`
- `credential`
- `client_secret`
- `access_token`
- `refresh_token`
- `private_key`

## Testing

```bash
# Run encryption tests
pnpm test tests/lib/encryption.test.ts

# Test encryption in Node.js
node -e "
  process.env.ENCRYPTION_KEY = 'test-key-32-characters-minimum-required';
  const { encryptSecret, decryptSecret } = require('./lib/encryption');
  const encrypted = encryptSecret('test');
  console.log('Encrypted:', encrypted);
  console.log('Decrypted:', decryptSecret(encrypted));
"
```

## Troubleshooting

### ENCRYPTION_KEY not set
```bash
export ENCRYPTION_KEY="your-key-here"
```

### Failed to decrypt
- Verify correct encryption key
- Check data is not corrupted
- Ensure same key used for encrypt/decrypt

### Generate new key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Security Checklist

- [ ] ENCRYPTION_KEY is set in environment
- [ ] Key is at least 32 characters
- [ ] Key is not committed to version control
- [ ] Different keys for dev/staging/prod
- [ ] Backups include encryption key (stored separately)
- [ ] Key rotation plan exists
- [ ] Encrypted data verified in database
- [ ] Tests passing

## Files Reference

| File | Purpose |
|------|---------|
| lib/encryption.ts | Main encryption utilities |
| supabase/migrations/080_encrypt_credentials.sql | Database migration |
| tests/lib/encryption.test.ts | Unit tests |
| scripts/generate-encryption-key.ts | Key generator |
| ENCRYPTION_GUIDE.md | Full documentation |
| ENCRYPTION_IMPLEMENTATION.md | Implementation summary |

## Quick Commands

```bash
# Generate key
pnpm tsx scripts/generate-encryption-key.ts

# Run tests
pnpm test tests/lib/encryption.test.ts

# Check encrypted data in DB
psql -c "SELECT id, sunat_usuario_sol_encrypted IS NOT NULL as encrypted FROM organizations;"

# Verify encryption key length
node -e "console.log('Key length:', (process.env.ENCRYPTION_KEY || '').length)"
```

## Production Deployment

```bash
# 1. Set production encryption key
export ENCRYPTION_KEY="production-key-here"

# 2. Run migration
supabase db push --db-url "postgres://..."

# 3. Verify
psql -c "SELECT COUNT(*) FROM organizations WHERE sunat_usuario_sol_encrypted IS NOT NULL;"

# 4. Monitor logs
tail -f logs/app.log | grep -i encrypt
```

## Support

- Documentation: `ENCRYPTION_GUIDE.md`
- Implementation: `ENCRYPTION_IMPLEMENTATION.md`
- Tests: `tests/lib/encryption.test.ts`
- Code: `lib/encryption.ts`
