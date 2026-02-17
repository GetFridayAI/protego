# API Security Documentation

## Overview

The Protego API implements two layers of security:

1. **API Key Authentication** - All endpoints require a valid API key passed in the request header
2. **Payload Encryption** - Request payloads must be encrypted using AES-256-GCM

## API Key Management

### Registering an API Key

API keys are stored in Apache Cassandra. To create a new API key, use the CassandraService:

```typescript
const apiKey = await cassandraService.createApiKey(
  'my-client-name',
  ['read', 'write'] // optional permissions
);
```

This returns a 64-character hexadecimal API key that should be securely stored and used for all requests.

### Validating API Keys

API keys are automatically validated via the `ApiKeyGuard` middleware on all protected endpoints.

**Header Format:**
```
X-API-Key: <your-api-key-here>
```

**Alternative (Query Parameter):**
```
GET /api/endpoint?api_key=<your-api-key-here>
```

The guard will:
- Extract the API key from headers or query parameters
- Query Cassandra for the key
- Validate that the key is active
- Update the last_used timestamp
- Return 401 Unauthorized if validation fails

## Payload Encryption

### Client-Side: Encrypting Requests

All POST, PUT, PATCH requests must have encrypted payloads:

```javascript
const crypto = require('crypto');

// Your encryption key (must match ENCRYPTION_KEY in environment)
const encryptionKey = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
const algorithm = 'aes-256-gcm';

// Original payload
const payload = {
  email: 'user@example.com',
  password: 'secure-password'
};

const payloadString = JSON.stringify(payload);

// Generate IV
const iv = crypto.randomBytes(16);

// Encrypt
const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
let encrypted = cipher.update(payloadString, 'utf-8', 'hex');
encrypted += cipher.final('hex');

// Get auth tag for GCM mode
const authTag = cipher.getAuthTag();

// Send encrypted request
const encryptedRequest = {
  ciphertext: encrypted,
  iv: iv.toString('hex'),
  authTag: authTag.toString('hex')
};

// Example with fetch
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here'
  },
  body: JSON.stringify(encryptedRequest)
});
```

### Server-Side: Automatic Decryption

The `DecryptPayloadInterceptor` automatically:
1. Intercepts requests with encrypted payloads
2. Validates the payload format (must have `ciphertext`, `iv`, `authTag`)
3. Decrypts using the configured encryption key
4. Parses the decrypted JSON
5. Replaces the request body with the decrypted data

If decryption fails, returns:
```json
{
  "statusCode": 400,
  "message": "Invalid encrypted payload format"
}
```

## Complete Request Example

### Step 1: Encrypt the Payload

```bash
# Create the payload
PAYLOAD='{"email":"user@example.com","password":"mypassword"}'

# Encrypt (requires Node.js crypto)
# See "Client-Side: Encrypting Requests" section above
```

### Step 2: Send Authenticated Request

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-64-char-api-key" \
  -d '{
    "ciphertext": "encrypted-hex-string",
    "iv": "16-byte-iv-as-hex",
    "authTag": "auth-tag-as-hex"
  }'
```

### Response

Responses are returned in plain JSON (not encrypted):

```json
{
  "valid": true,
  "message": "Login successful",
  "code": null,
  "token": "session-token-here",
  "timestamp": "2026-02-17T10:30:00.000Z"
}
```

## Environment Configuration

### Local Development (.env.local)

```env
CASSANDRA_CONTACT_POINTS=localhost
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=protego_keyspace
CASSANDRA_DATA_CENTER=datacenter1
CASSANDRA_USERNAME=cassandra
CASSANDRA_PASSWORD=cassandra
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
ENCRYPTION_ALGORITHM=aes-256-gcm
```

### Production (.env.prod)

```env
CASSANDRA_CONTACT_POINTS=${PROD_CASSANDRA_HOSTS}
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=protego_keyspace_prod
CASSANDRA_DATA_CENTER=${PROD_DATA_CENTER}
CASSANDRA_USERNAME=${PROD_CASSANDRA_USER}
CASSANDRA_PASSWORD=${PROD_CASSANDRA_PASSWORD}
ENCRYPTION_KEY=${PROD_ENCRYPTION_KEY}
ENCRYPTION_ALGORITHM=aes-256-gcm
```

## Troubleshooting

### "Invalid or missing API key"

**Cause:** API key not provided or invalid
**Solution:** 
- Include `X-API-Key` header in request
- Verify API key is 64 characters long
- Check if API key is active in Cassandra

### "Invalid encrypted payload format"

**Cause:** Payload missing required fields or malformed
**Solution:**
- Ensure payload has `ciphertext`, `iv`, and `authTag` fields
- Verify encryption key matches on client and server
- Check that payload is valid JSON before encryption

### "Cassandra connection failed"

**Cause:** Cassandra service not running or unreachable
**Solution:**
- Ensure Cassandra is running: `docker-compose up cassandra`
- Verify contact points in environment config
- Check network connectivity to Cassandra host
- Review Cassandra logs for specific errors

## Security Best Practices

1. **API Key Storage**
   - Store API keys securely (use environment variables, secret managers)
   - Never commit API keys to version control
   - Rotate keys periodically

2. **Encryption Keys**
   - Use strong, randomly generated 256-bit keys
   - Store in secure vaults (AWS Secrets Manager, HashiCorp Vault)
   - Never commit encryption keys to version control
   - Implement key rotation policies

3. **Transport Security**
   - Always use HTTPS in production
   - Validate SSL/TLS certificates
   - Consider certificate pinning for sensitive clients

4. **Request/Response Patterns**
   - Log request IDs for auditing
   - Track API key usage via `lastUsed` timestamp
   - Monitor for suspicious patterns (failed auth attempts)
   - Implement rate limiting per API key

## Endpoint Protection Status

The following endpoints are protected with both API key and encryption:

- `POST /api/auth/login`
- `POST /api/auth/verify`
- `POST /api/auth/logout`
- All future endpoints registered in LoginController

## Advanced Configuration

### Custom Encryption Algorithm

To use a different encryption algorithm, update the environment:

```env
ENCRYPTION_ALGORITHM=aes-256-cbc
```

Supported algorithms: `aes-256-gcm`, `aes-256-cbc`, `aes-256-ofb`

### Disabling Encryption for Specific Endpoints

Create a custom decorator to bypass the DecryptPayloadInterceptor:

```typescript
import { SetMetadata } from '@nestjs/common';

export const SKIP_ENCRYPTION = 'skipEncryption';
export const SkipEncryption = () => SetMetadata(SKIP_ENCRYPTION, true);
```

Update the interceptor to check for this metadata and skip decryption.

## Cassandra Schema

The following table is automatically created on startup:

```sql
CREATE TABLE protego_keyspace.api_keys (
  key_id uuid PRIMARY KEY,
  api_key text,
  client_name text,
  is_active boolean,
  created_at timestamp,
  last_used timestamp,
  permissions list<text>
);

CREATE INDEX ON protego_keyspace.api_keys (api_key);
```

## Next Steps

1. Generate API keys for your clients
2. Distribute securely with documentation
3. Implement client libraries for encryption/decryption
4. Monitor API key usage and security metrics
5. Set up key rotation schedules for production
