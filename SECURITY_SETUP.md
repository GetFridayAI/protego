# Security Setup Guide

## Overview

This guide explains how to set up and use the new endpoint protection features:
- API Key authentication via Cassandra
- Payload encryption with AES-256-GCM

## Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- npm or yarn

## Installation

1. **Install dependencies:**
```bash
npm install
```

This installs the new security dependencies:
- `cassandra-driver` (4.7.2) - For API key storage
- `uuid` (9.0.1) - For generating UUID keys

2. **Start services with Docker Compose:**
```bash
docker-compose up -d
```

This starts:
- Cassandra (port 9042) - API key storage
- Neo4j (port 7687) - User data
- Redis (port 6379) - Session management
- Kafka (port 9092) - Event streaming
- NestJS app (port 3000) - API server

3. **Verify Cassandra is running:**
```bash
docker-compose logs cassandra | grep "Listening for bootstrap"
```

## Creating Your First API Key

### Using the Service in Code

```typescript
// In any NestJS service or controller
constructor(private cassandraService: CassandraService) {}

async getApiKey() {
  const apiKey = await this.cassandraService.createApiKey(
    'my-client-name',
    ['read', 'write'] // optional permissions
  );
  console.log('API Key:', apiKey); // 64-character hex string
}
```

### Using cqlsh CLI

```bash
# Access Cassandra shell
docker exec -it protego-cassandra cqlsh

# Switch to keyspace
USE protego_keyspace;

# Insert API key
INSERT INTO api_keys (
  key_id, 
  api_key, 
  client_name, 
  is_active, 
  created_at, 
  permissions
) VALUES (
  uuid(),
  'your-64-char-hex-key-here',
  'test-client',
  true,
  now(),
  ['read', 'write']
);
```

## Testing the API

### 1. Encrypt Your Payload

Using Node.js:

```javascript
const crypto = require('crypto');

const encryptionKey = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
const algorithm = 'aes-256-gcm';

const payload = {
  email: 'user@example.com',
  password: 'mypassword'
};

const payloadString = JSON.stringify(payload);
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);

let encrypted = cipher.update(payloadString, 'utf-8', 'hex');
encrypted += cipher.final('hex');

const authTag = cipher.getAuthTag();

console.log(JSON.stringify({
  ciphertext: encrypted,
  iv: iv.toString('hex'),
  authTag: authTag.toString('hex')
}));
```

Or use the provided helper:

```typescript
import { ApiEncryptionHelper } from './utils/api-encryption.helper';

const helper = new ApiEncryptionHelper('0123456789abcdef0123456789abcdef');
const encrypted = helper.encrypt({
  email: 'user@example.com',
  password: 'mypassword'
});

console.log(encrypted);
```

### 2. Send Encrypted Request with API Key

```bash
# Using curl
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your-64-char-api-key>" \
  -d '{
    "ciphertext": "encrypted-hex-value",
    "iv": "iv-as-hex",
    "authTag": "auth-tag-as-hex"
  }'
```

Using JavaScript/Fetch:

```javascript
const apiKey = 'your-64-char-api-key';
const encryptionKey = '0123456789abcdef0123456789abcdef';

const helper = new ApiEncryptionHelper(encryptionKey);
const encrypted = helper.encrypt({
  email: 'user@example.com',
  password: 'mypassword'
});

const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey
  },
  body: JSON.stringify(encrypted)
});

const result = await response.json();
console.log(result);
```

## Environment Configuration

All endpoints are protected with both API key and encryption by default.

### Local Development

The default encryption key in `.env.local`:
```env
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
```

This is for development only. In production, use a strong, randomly generated key:

```bash
# Generate a secure encryption key
openssl rand -hex 16  # 256-bit key in hex
```

### Production Deployment

In production (.env.prod), use environment variables:

```env
CASSANDRA_CONTACT_POINTS=${PROD_CASSANDRA_HOSTS}
CASSANDRA_PASSWORD=${PROD_CASSANDRA_PASSWORD}
ENCRYPTION_KEY=${PROD_ENCRYPTION_KEY}
```

## Security Checklist

Before deploying to production:

- [ ] Generate unique, strong encryption keys (256-bit minimum)
- [ ] Store encryption keys in a secrets vault (AWS Secrets Manager, HashiCorp Vault)
- [ ] Enable Cassandra authentication in production
- [ ] Use TLS for Cassandra connections
- [ ] Enable HTTPS for all API endpoints
- [ ] Rotate API keys regularly
- [ ] Monitor API key usage via `lastUsed` timestamp
- [ ] Implement rate limiting per API key
- [ ] Set up audit logging for all API requests
- [ ] Never commit secrets to version control

## Migration Guide

If you have existing unprotected endpoints:

### Old Code (Unprotected)
```typescript
@Post('login')
async login(@Body() body: LoginDto) {
  // Handle plaintext request
}
```

### New Code (Protected)
```typescript
// Simply add the guard and interceptor at the module level
// They are now applied globally in app.module.ts

// The endpoint receives decrypted, validated requests:
@Post('login')
async login(@Body() body: LoginDto) {
  // body is already decrypted by DecryptPayloadInterceptor
  // API key is already validated by ApiKeyGuard
}
```

## Troubleshooting

### "Cassandra connection failed"

```bash
# Check Cassandra container status
docker ps | grep cassandra

# View Cassandra logs
docker logs protego-cassandra

# Verify port accessibility
nc -zv localhost 9042
```

### "Invalid or missing API key"

1. Verify API key exists in Cassandra:
```bash
docker exec -it protego-cassandra cqlsh -e "SELECT api_key, is_active FROM protego_keyspace.api_keys LIMIT 5;"
```

2. Verify key format (must be 64 hex characters):
```bash
# Should output nothing if invalid
echo "your-key" | grep -E '^[a-f0-9]{64}$'
```

### "Invalid encrypted payload format"

1. Verify payload has all required fields:
```javascript
{
  ciphertext: string,
  iv: string,
  authTag: string
}
```

2. Verify encryption key matches server:
```typescript
const helper = new ApiEncryptionHelper('0123456789abcdef0123456789abcdef');
const encrypted = helper.encrypt({ test: 'data' });
const decrypted = helper.decrypt(encrypted);
// Should output: { test: 'data' }
```

## Next Steps

1. Generate production API keys for each client
2. Implement API key management dashboard
3. Set up rotation policies for encryption keys
4. Monitor and audit API key usage
5. Implement rate limiting and request validation
6. Create client SDKs for easier integration

## Additional Resources

- [API Security Documentation](./API_SECURITY.md)
- [Cassandra Documentation](https://cassandra.apache.org/doc/latest/)
- [NIST Encryption Standards](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
