# Authentication API Documentation

## Overview

The authentication service provides login, session verification, and logout endpoints using Neo4j for user storage and Redis for session management.

## Endpoints

### 1. Login

### 1a. Signup

**POST** `/api/auth/signup`

Register a new user. Request body parameters:

```json
{
  "email": "user@example.com",
  "encryptedPassword": "<AES-encrypted-password>"
}
```

The encrypted password is hashed with bcrypt before being stored in Neo4j. A session token is created and returned on success.

Responses mirror the login endpoint, including `sessionToken` upon success.

### 1. Login
**POST** `/api/auth/login`

Authenticate user with email and password credentials.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "plaintext-password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "sessionToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
  "message": "Login successful",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

**Error Responses:**

Missing Information (400):
```json
{
  "success": false,
  "message": "Email and password are required",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

Email Not Found (400):
```json
{
  "success": false,
  "message": "Email address not found in the system",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

Incorrect Password (400):
```json
{
  "success": false,
  "message": "Password is incorrect",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

---

### 2. Verify Session
**POST** `/api/auth/verify`

Verify if a session token is valid. Distinguishes between invalid sessions and expired sessions.

**Request:**
```json
{
  "sessionToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
}
```

**Valid Session Response (200):**
```json
{
  "valid": true,
  "message": "Session is valid",
  "code": null,
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

**Expired Session Response (200):**
```json
{
  "valid": false,
  "message": "Session token has expired",
  "code": "SESSION_EXPIRED",
  "reason": "EXPIRED",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

**Invalid Session Response (200):**
```json
{
  "valid": false,
  "message": "Session token is invalid or does not exist",
  "code": "SESSION_INVALID",
  "reason": "INVALID",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

---

### 3. Logout
**POST** `/api/auth/logout`

Invalidate a session token and log out the user.

**Request:**
```json
{
  "sessionToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
}
```

**Success Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

## Session Token

- **Format**: 64-character hexadecimal string (256 bits of randomness)
- **Storage**: Redis with TTL based on `JWT_EXPIRATION` config
- **TTL Default**: 24 hours (can be configured in `.env` files)
- **Metadata Tracking**: Session metadata is stored with 2x TTL to distinguish between invalid and expired tokens

Example token:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Session Status Distinction

The authentication service distinguishes between two session states:

**SESSION_INVALID** (reason: "INVALID")
- Token has never been issued
- Token format is invalid
- Token was never created through login
- **Resolution**: User must login again

**SESSION_EXPIRED** (reason: "EXPIRED")
- Token was issued but the TTL has passed
- Token existed in the system but is no longer valid
- Session metadata still exists in Redis (tracked for 2x TTL)
- **Resolution**: User must login again to get a new token

### Technical Implementation

- Session data is stored with TTL (default 24 hours)
- Session metadata is stored with 2x TTL to track expiration
- When a session token is verified:
  1. If session data exists → Session is VALID
  2. If session data doesn't exist but metadata exists → Session is EXPIRED
  3. If neither exists → Session is INVALID

---

## Error Codes

| Code | Message | Reason |
|------|---------|--------|
| `EMAIL_NOT_FOUND` | Email address not found in the system | User doesn't exist |
| `MISSING_INFORMATION` | Email and password are required | Input validation |
| `INCORRECT_PASSWORD` | Password is incorrect | Authentication failed |
| `INVALID_CREDENTIALS` | Invalid credentials provided | General auth error |
| `USER_NOT_FOUND` | User not found | User lookup failed |
| `DATABASE_ERROR` | Database error occurred | System error |
| `SESSION_CREATION_ERROR` | Failed to create session token | Session creation failed |
| `SESSION_INVALID` | Session token is invalid or does not exist | Token never existed |
| `SESSION_EXPIRED` | Session token has expired | Token expired (TTL passed) |

---

## User Data Structure (Neo4j)

### User Node
```
(:User {
  email: "user@example.com",
  hashedPassword: "$2b$10$...", // bcrypt hashed password
  createdAt: datetime(),
  updatedAt: datetime()
})
```

### Creating a Test User

```cypher
CREATE (u:User {
  email: "test@example.com",
  hashedPassword: "$2b$10$...", // Use bcrypt to hash password
  createdAt: datetime(),
  updatedAt: datetime()
})
RETURN u
```

---

## Usage Flow

### 1. User Registration (Manual)
```bash
# Create user in Neo4j with hashed password
# Use /api/example/users endpoint or Neo4j browser
```

### 2. User Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "plaintext-password"
  }'
```

Response:
```json
{
  "success": true,
  "sessionToken": "a1b2c3d4...e1f2",
  "message": "Login successful",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

### 3. Use Session Token
Store the `sessionToken` and send it with requests requiring authentication.

### 4. Verify Session
Use the verify endpoint to check if a session is valid or has expired:

**Valid Session:**
```json
{
  "valid": true,
  "message": "Session is valid",
  "code": null,
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

**Expired Session:**
```json
{
  "valid": false,
  "message": "Session token has expired",
  "code": "SESSION_EXPIRED",
  "reason": "EXPIRED",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

**Invalid Session:**
```json
{
  "valid": false,
  "message": "Session token is invalid or does not exist",
  "code": "SESSION_INVALID",
  "reason": "INVALID",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

### 5. User Logout
Logout immediately invalidates the session by removing both the session data and metadata:

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "a1b2c3d4...e1f2"
  }'
```

Response:
```json
{
  "message": "Logged out successfully",
  "timestamp": "2026-02-16T20:00:00.000Z"
}
```

**Note**: After logout, verifying the session will return `SESSION_INVALID` since the metadata has also been removed.

---

## Security Considerations

1. **Password Hashing**: All passwords are hashed using bcrypt (configurable rounds)
2. **Session Storage**: Sessions are stored in Redis with automatic expiration
3. **Token Generation**: Cryptographically secure random token generation
4. **Environment Variables**: Sensitive config in environment files, not code

---

## Configuration

Related environment variables in `env/.env.*`:

```env
# Security
BCRYPT_ROUNDS=10              # Default rounds for bcrypt
JWT_SECRET=your-secret-key    # JWT signing secret
JWT_EXPIRATION=24h            # Session TTL

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Neo4j
NEO4J_HOST=localhost
NEO4J_PORT=7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
```

---

## Testing the API

### Using cURL

1. **Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Response:
# {
#   "success": true,
#   "sessionToken": "a1b2c3d4e5f6...",
#   "message": "Login successful",
#   "timestamp": "2026-02-16T20:00:00.000Z"
# }
```

2. **Verify Valid Session:**
```bash
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"<token_from_login>"}'

# Response:
# {
#   "valid": true,
#   "message": "Session is valid",
#   "code": null,
#   "timestamp": "2026-02-16T20:00:00.000Z"
# }
```

3. **Verify Expired Session (after TTL):**
```bash
# Wait for session to expire, then:
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"<expired_token>"}'

# Response:
# {
#   "valid": false,
#   "message": "Session token has expired",
#   "code": "SESSION_EXPIRED",
#   "reason": "EXPIRED",
#   "timestamp": "2026-02-16T20:00:00.000Z"
# }
```

4. **Verify Invalid Session (never existed):**
```bash
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"0000000000000000000000000000000000000000000000000000000000000000"}'

# Response:
# {
#   "valid": false,
#   "message": "Session token is invalid or does not exist",
#   "code": "SESSION_INVALID",
#   "reason": "INVALID",
#   "timestamp": "2026-02-16T20:00:00.000Z"
# }
```

5. **Logout:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"<token>"}'

# Response:
# {
#   "message": "Logged out successfully",
#   "timestamp": "2026-02-16T20:00:00.000Z"
# }
```

### Using Postman

1. Import the requests above
2. Set variables for dynamic token usage
3. Test the flow: Login → Verify → Logout

---

## Architecture

```
LoginController
    ├── POST /api/auth/login
    │   └── AuthService.login()
    │       ├── ValidateInput
    │       ├── Neo4jService.executeQuery() → Find user
    │       ├── BcryptService.compare() → Verify password
    │       ├── RedisService.storeSession() → Create session + metadata
    │       └── LoggerService → Log action
    │
    ├── POST /api/auth/verify
    │   └── AuthService.verifySession()
    │       ├── RedisService.checkSessionStatus()
    │       │   ├── Check session data (TTL)
    │       │   └── Check session metadata (2x TTL)
    │       └── Return { valid, expired, code }
    │
    └── POST /api/auth/logout
        └── AuthService.logout()
            ├── RedisService.deleteSession()
            │   ├── Delete session data
            │   ├── Delete session metadata
            │   └── LoggerService → Log action
```

### Redis Storage Schema

```
# Session data (TTL: 24 hours by default)
session:<token> → {
  "email": "user@example.com",
  "timestamp": "2026-02-16T20:00:00.000Z"
}

# Session metadata (TTL: 48 hours - 2x session TTL)
session:metadata:<token> → {
  "createdAt": "2026-02-16T20:00:00.000Z",
  "expiresAt": "2026-02-17T20:00:00.000Z",
  "token": "<token>"
}
```

### Session Lifecycle

```
1. LOGIN
   ├─ Create session data with TTL
   ├─ Create metadata with 2x TTL
   └─ Return sessionToken

2. VERIFY (while valid)
   ├─ Check session data → EXISTS
   └─ Return { valid: true, code: null }

3. VERIFY (after TTL expires)
   ├─ Check session data → NULL
   ├─ Check metadata → EXISTS
   └─ Return { valid: false, code: SESSION_EXPIRED, reason: EXPIRED }

4. VERIFY (non-existent token)
   ├─ Check session data → NULL
   ├─ Check metadata → NULL
   └─ Return { valid: false, code: SESSION_INVALID, reason: INVALID }

5. LOGOUT
   ├─ Delete session data
   ├─ Delete metadata
   └─ Next verify → SESSION_INVALID
```

---

## Next Steps

1. ✅ Session expiration tracking (COMPLETED)
2. ✅ Distinguish SESSION_INVALID vs SESSION_EXPIRED (COMPLETED)
3. Implement user registration endpoint
4. Add JWT-based token refresh mechanism
5. Add password strength validation
6. Implement refresh token mechanism
7. Add rate limiting on login attempts
8. Add email verification workflow
9. Add two-factor authentication
10. Implement session management (list active sessions, revoke specific sessions)
