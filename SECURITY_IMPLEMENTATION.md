# Security Implementation Summary

## Overview

This document summarizes the comprehensive security layer added to the Protego API with API key authentication and payload encryption.

## Architecture

```
Client Request
    ↓
API Key Guard (validates X-API-Key header)
    ↓
Decrypt Payload Interceptor (decrypts AES-256-GCM encrypted body)
    ↓
Controller Handler (receives decrypted, validated request)
    ↓
Response (sent in plaintext)
```

## New Components

### 1. Cassandra Service (`src/services/cassandra.service.ts`)
- **Purpose**: Manages Cassandra database connection and API key operations
- **Responsibilities**:
  - Connection management with automatic module lifecycle hooks
  - Keyspace initialization on startup
  - API key CRUD operations
  - AAA operations (query, create, update)
  - Last-used timestamp tracking for audit trails

- **Key Methods**:
  - `connect()` - Establishes connection with authentication
  - `initializeKeyspace()` - Creates keyspace and API keys table
  - `getApiKey(apiKey)` - Query Cassandra for key metadata
  - `createApiKey(clientName, permissions)` - Generate new 64-char hex key
  - `updateLastUsed(apiKey)` - Update last_used timestamp
  - `disconnect()` - Graceful shutdown

### 2. Encryption Service (`src/services/encryption.service.ts`)
- **Purpose**: Handles AES-256-GCM encryption/decryption
- **Algorithm**: AES-256-GCM (Authenticated Encryption with Associated Data)
- **Key Size**: 256-bit (32 bytes)
- **IV Size**: 128-bit (16 bytes, random per encryption)
- **Auth Tag**: 128-bit authentication tag for GCM mode

- **Key Methods**:
  - `encrypt(data: string)` - Encrypts and returns { ciphertext, iv, authTag }
  - `decrypt(payload)` - Decrypts and validates auth tag
  - `decryptFromRequest(encryptedData)` - Handles both string and object inputs

### 3. API Key Service (`src/services/api-key.service.ts`)
- **Purpose**: High-level API key validation and management
- **Responsibilities**:
  - Validate API keys against Cassandra
  - Check if keys are active/inactive
  - Update last-used tracking
  - Mask sensitive key parts in logs

- **Key Methods**:
  - `validateApiKey(apiKey)` - Full validation with active check
  - `getApiKeyClientName(apiKey)` - Retrieve client metadata
  - `maskApiKey(apiKey)` - Security helper for logging

### 4. API Key Guard (`src/guards/api-key.guard.ts`)
- **Type**: NestJS CanActivate Guard
- **Purpose**: Validates API key on every protected request
- **Integration**: Registered globally via APP_GUARD in app.module.ts

- **Behavior**:
  - Extracts API key from `X-API-Key` header or `api_key` query parameter
  - Validates against Cassandra via ApiKeyService
  - Throws UnauthorizedException on validation failure
  - Attaches apiKey and clientName to request object for downstream logging

- **Error Response**:
  ```json
  {
    "statusCode": 401,
    "message": "Invalid or missing API key"
  }
  ```

### 5. Decrypt Payload Interceptor (`src/interceptors/decrypt-payload.interceptor.ts`)
- **Type**: NestJS NestInterceptor
- **Purpose**: Decrypts incoming payloads before controller processing
- **Integration**: Registered globally via APP_INTERCEPTOR in app.module.ts

- **Behavior**:
  - Intercepts POST, PUT, PATCH requests only
  - Checks for presence of ciphertext, iv, authTag fields
  - Skips if payload is plain (allows mixed encrypted/unencrypted endpoints)
  - Decrypts encrypted payloads
  - Parses decrypted JSON
  - Replaces request.body with decrypted data

- **Error Response**:
  ```json
  {
    "statusCode": 400,
    "message": "Invalid encrypted payload format"
  }
  ```

## Configuration Files

### Cassandra Config (`src/config/cassandra.config.ts`)
- Interface definition for CassandraConfig
- Environment variable parsing and defaults
- Support for:
  - Multiple contact points (comma-separated)
  - Custom port configuration
  - Data center selection
  - Connection timeouts

### Environment Files (`env/*.env`)

All environment files updated with:

```env
# Cassandra Configuration
CASSANDRA_CONTACT_POINTS=localhost
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=protego_keyspace
CASSANDRA_DATA_CENTER=datacenter1
CASSANDRA_USERNAME=cassandra
CASSANDRA_PASSWORD=cassandra

# Encryption Configuration
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
ENCRYPTION_ALGORITHM=aes-256-gcm
```

Environment-specific variations:
- **local**: localhost, standard credentials
- **dev**: cassandra service via Docker Compose
- **stage**: Secure hosts with environment variable references
- **prod**: All sensitive values as environment variable references

## Database Schema

### Cassandra Keyspace & Table (Auto-created)

```sql
CREATE KEYSPACE IF NOT EXISTS protego_keyspace
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
}

CREATE TABLE IF NOT EXISTS protego_keyspace.api_keys (
  key_id uuid PRIMARY KEY,
  api_key text,
  client_name text,
  is_active boolean,
  created_at timestamp,
  last_used timestamp,
  permissions list<text>
)

CREATE INDEX IF NOT EXISTS ON protego_keyspace.api_keys (api_key)
```

**Key Fields**:
- `key_id`: Unique UUID for the key record
- `api_key`: 64-character hexadecimal key (indexed for fast lookup)
- `client_name`: Human-readable identifier for audit/logging
- `is_active`: Boolean to enable/disable without deletion
- `created_at`: Timestamp of key creation
- `last_used`: Timestamp of last validation (audit trail)
- `permissions`: List of granted permissions (extensible)

## Docker Compose Updates

### New Cassandra Service

```yaml
cassandra:
  image: cassandra:5.0
  container_name: protego-cassandra
  environment:
    CASSANDRA_CLUSTER_NAME: protego-cluster
    CASSANDRA_DC: datacenter1
    CASSANDRA_RACK: rack1
    CASSANDRA_SEEDS: cassandra
  ports:
    - "9042:9042"
  volumes:
    - cassandra_data:/var/lib/cassandra
  healthcheck:
    test: ["CMD-SHELL", "cqlsh -e 'SELECT 1'"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### NestJS Service Updates

Added Cassandra connection details and encryption config to the protego service:

```yaml
environment:
  CASSANDRA_CONTACT_POINTS: cassandra
  CASSANDRA_PORT: 9042
  CASSANDRA_KEYSPACE: protego_keyspace
  CASSANDRA_DATA_CENTER: datacenter1
  CASSANDRA_USERNAME: cassandra
  CASSANDRA_PASSWORD: cassandra
  ENCRYPTION_KEY: ${ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef}
  ENCRYPTION_ALGORITHM: aes-256-gcm

depends_on:
  cassandra:
    condition: service_healthy
```

## Message Module Extensions

Updated `src/common/messages/messages.ts` with new message categories:

### INFO_MESSAGES (New)
- `CASSANDRA_CONNECTED`
- `CASSANDRA_KEYSPACE_INITIALIZED`

### ERROR_MESSAGES (New)
- `CASSANDRA_CONNECTION_FAILED`
- `CASSANDRA_INITIALIZATION_FAILED`
- `CASSANDRA_QUERY_FAILED`
- `ENCRYPTION_FAILED`
- `DECRYPTION_FAILED`
- `INVALID_API_KEY`
- `API_KEY_INACTIVE`
- `MISSING_ENCRYPTED_PAYLOAD`
- `INVALID_ENCRYPTED_FORMAT`

### LOG_MESSAGES (New)
- `API_KEY_VALIDATED`
- `API_KEY_NOT_FOUND`
- `API_KEY_INACTIVE`
- `API_KEY_VALIDATION_ERROR`
- `API_KEY_LOOKUP_ERROR`
- `PAYLOAD_DECRYPTED`
- `PAYLOAD_DECRYPTION_ERROR`

## Module Registration

### DatabaseModule (`src/services/database.module.ts`)

Added providers and exports:
- `CassandraService`
- `EncryptionService`
- `ApiKeyService`

### AppModule (`src/app.module.ts`)

Guard and Interceptor registration:
```typescript
providers: [
  AppService,
  {
    provide: APP_GUARD,
    useClass: ApiKeyGuard,
  },
  {
    provide: APP_INTERCEPTOR,
    useClass: DecryptPayloadInterceptor,
  },
]
```

This makes them global - applied to all routes automatically.

## Package Dependencies

### New Dependencies Added

```json
{
  "cassandra-driver": "^4.7.2",  // Cassandra client
  "uuid": "^9.0.1"                // UUID generation
}
```

## Security Flow Diagram

```
REQUEST RECEIVED
    ↓
[ApiKeyGuard]
  ├─ Extract X-API-Key header
  ├─ Query Cassandra for key
  ├─ Check is_active flag
  ├─ Update last_used timestamp
  └─ Attach clientName to request
    ↓
[DecryptPayloadInterceptor]
  ├─ Extract: { ciphertext, iv, authTag }
  ├─ Validate auth tag (GCM)
  ├─ Decrypt with AES-256-GCM
  ├─ Parse JSON
  └─ Replace request.body
    ↓
[Controller Handler]
  └─ Receive validated, decrypted request
    ↓
RESPONSE (plaintext JSON)
```

## Usage Example

### Client-Side (JavaScript/TypeScript)

```typescript
import { ApiEncryptionHelper } from './utils/api-encryption.helper';

// Initialize encryption helper
const helper = new ApiEncryptionHelper('0123456789abcdef0123456789abcdef');

// Encrypt payload
const encrypted = helper.encrypt({
  email: 'user@example.com',
  password: 'mypassword'
});

// Send with API key
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-64-char-api-key'
  },
  body: JSON.stringify(encrypted)
});

// Response is plaintext JSON
const result = await response.json();
console.log(result);
```

### Server-Side (NestJS)

```typescript
// No special handling needed!
// Guard and Interceptor handle security automatically

@Post('login')
async login(@Body() body: LoginDto) {
  // body is already decrypted and validated
  // API key is already verified
  // request.clientName contains API key client name
  return this.authService.login(body);
}
```

## Performance Considerations

### Caching API Keys
Current implementation queries Cassandra for each request. For high-traffic scenarios:
1. Implement Redis caching layer for API keys
2. Cache with TTL (e.g., 5 minutes)
3. Invalidate on key creation/deactivation

### Encryption Performance
- AES-256-GCM is hardware-accelerated on modern CPUs
- Minimal overhead for small payloads (<1KB)
- Consider streaming encryption for large payloads

### Cassandra Optimization
- API key is indexed for O(1) lookup
- Connection pooling configured in driver
- Adjust replication factor for production (currently 1)

## Security Best Practices Implemented

1. ✅ API Key Validation - Every request requires valid key
2. ✅ Authentication Tag - GCM mode prevents tampering
3. ✅ Random IVs - Each encryption uses unique IV
4. ✅ Audit Trail - last_used timestamp tracks key usage
5. ✅ Key Deactivation - Can disable keys without deletion
6. ✅ Error Handling - Generic error messages (no key enumeration)
7. ✅ Logging - All security events logged with interpolated messages
8. ✅ Environment Separation - Different configs per environment

## Testing Checklist

- [ ] Cassandra container starts up successfully
- [ ] API key validation works (valid and invalid keys)
- [ ] Payload encryption/decryption roundtrip works
- [ ] Invalid encrypted payloads rejected with 400
- [ ] Missing API keys rejected with 401
- [ ] Inactive API keys rejected with 401
- [ ] last_used timestamp updates on successful validation
- [ ] Request body is correctly decrypted and accessible in controller
- [ ] Plaintext payloads still work (backwards compatibility)
- [ ] Error messages don't leak sensitive information

## Migration Path

Existing endpoints automatically protected. No code changes required in controllers - just add guard/interceptor to app.module.ts and they apply globally.

For gradual migration:
1. Can create separate endpoint routes without protection
2. Use custom decorator to skip guard/interceptor per endpoint
3. Implement phased migration by endpoint group

## Documentation Files

1. **API_SECURITY.md** - Complete API usage and integration guide
2. **SECURITY_SETUP.md** - Setup, testing, and troubleshooting guide
3. **This file** - Architecture and implementation details
