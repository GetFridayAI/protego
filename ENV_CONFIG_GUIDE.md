# Environment Configuration Guide

## Overview

## Environments

### 1. **Local** (`env/.env.local`)
- **Used for**: Local development on your machine
- **Node Environment**: `development`
- **Database**: localhost
- **Logging**: Debug level, console output
- **Purpose**: Development and testing with local services

### 2. **Dev** (`env/.env.dev`)
- **Used for**: Development servers/team environment
- **Node Environment**: `development`
- **Database**: Docker containers or dev servers
- **Logging**: Debug level, console + file output
- **Purpose**: Shared development environment testing

### 3. **Stage** (`env/.env.stage`)
- **Used for**: Staging/QA environment
- **Node Environment**: `staging`
- **Database**: Staging database servers
- **Logging**: Info level, file output
- **Purpose**: Pre-production testing and validation
- **Note**: Uses environment variable placeholders for secrets

### 4. **Prod** (`env/.env.prod`)
- **Used for**: Production environment
- **Node Environment**: `production`
- **Database**: Production database servers
- **Logging**: Warning level, file output
- **Purpose**: Live environment
- **Note**: Uses environment variable placeholders for all secrets

## Running the Application

### Using Predefined Scripts

```bash
# Local development
npm run start:local

# Development environment (watch mode)
npm run start:dev

# Staging environment
npm run start:stage

# Production
npm run start:prod
```

### Using Environment Variable (Recommended for CI/CD)

```bash
# Set environment and run any command
ENV=local npm run build
ENV=dev npm start
ENV=stage npm run build:env
ENV=prod npm run build:env
```

### Building for Specific Environment

```bash
# Build for local
npm run build:local

# Build for dev
npm run build:dev

# Build for staging
npm run build:stage

# Build for production
npm run build:prod

# Build with ENV variable
ENV=prod npm run build:env
```

## Configuration Structure

### App Configuration
Located at `src/config/app.config.ts`

- **name**: Application name
- **version**: Application version
- **env**: Current environment
- **port**: Server port
- **logLevel**: Logging level (debug, info, warn, error)
- **apiTimeout**: API request timeout in milliseconds
- **requestLimit**: Max request body size

### Database Configuration
Located at `src/config/database.config.ts`

- **Neo4j**: Graph database connection settings
- **Redis**: Cache database connection settings

### Security Configuration
Located at `src/config/app.config.ts`

- **bcryptRounds**: Password hashing difficulty
- **jwtSecret**: JWT signing secret
- **jwtExpiration**: JWT token expiration time

### Kafka Configuration
- **brokers**: Kafka broker addresses
- **clientId**: Kafka client identifier
- **saslEnabled**: Enable SASL authentication (prod only)
- **saslMechanism**: SASL mechanism (plain)

### Performance Configuration
- **cachingEnabled**: Enable Redis caching
- **cacheTtl**: Cache time-to-live in seconds
- **connectionPoolSize**: Database connection pool size

### Monitoring Configuration
- **metricsEnabled**: Enable metrics collection
- **metricsPort**: Prometheus metrics port
- **sentryDsn**: Sentry error tracking DSN

## Environment Variables by Level

### Local Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
NEO4J_PASSWORD=password
REDIS_PASSWORD=
```

### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
NEO4J_PASSWORD=dev-password-123
KAFKA_BROKERS=kafka-dev:9092
```

### Staging
```bash
NODE_ENV=staging
LOG_LEVEL=info
BCRYPT_ROUNDS=12
# Secrets via environment variables
NEO4J_PASSWORD=${NEO4J_PASSWORD_STAGE}
JWT_SECRET=${JWT_SECRET_STAGE}
```

### Production
```bash
NODE_ENV=production
LOG_LEVEL=warn
BCRYPT_ROUNDS=15
REDIS_TLS=true
# All secrets via environment variables
NEO4J_PASSWORD=${NEO4J_PASSWORD_PROD}
JWT_SECRET=${JWT_SECRET_PROD}
KAFKA_SASL_ENABLED=true
SENTRY_DSN=${SENTRY_DSN_PROD}
```

## Docker Deployment

### Local Development with Docker Compose
```bash
# Start all services (Neo4j, Redis, Kafka, App)
docker-compose up

# For specific environment
NODE_ENV=dev docker-compose up
```

### Build Docker Image
```bash
# Build image
docker build -t protego:latest .

# Run with environment variables
docker run -e NODE_ENV=prod \
  -e NEO4J_PASSWORD=secret \
  -e JWT_SECRET=secret \
  protego:latest
```

## Managing Secrets

### Local & Dev
- Secrets can be plaintext in `.env.local` and `.env.dev`
- Never commit these files with real secrets

### Stage & Prod
- Use environment variable placeholders: `${VARIABLE_NAME}`
- Provide actual values via environment variables at runtime
- Example: `docker run -e NEO4J_PASSWORD_PROD=actual-secret protego:latest`

### Environment Variable Naming Convention
- **Stage**: `${VARIABLE_NAME_STAGE}`
- **Prod**: `${VARIABLE_NAME_PROD}`

## Configuration Loading Order

1. Load `.env.{NODE_ENV}` or `.env.local` (default)
2. Load environment-specific overrides from process.env
3. Load configuration modules via `@nestjs/config`
4. Services inject configuration via ConfigService

## Example: Accessing Configuration in Services

```typescript
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyService {
  constructor(private configService: ConfigService) {}

  someMethod() {
    // App config
    const appName = this.configService.get('app.name');
    const port = this.configService.get('app.port');

    // Security config
    const jwtSecret = this.configService.get('security.jwtSecret');

    // Database config
    const neo4jHost = this.configService.get('database.neo4j.host');
  }
}
```

## Troubleshooting

### Wrong Environment Loaded
```bash
# Check current environment
NODE_ENV=prod npm start
# Verify output shows "[prod]"
```

### Missing Configuration
- Ensure `.env.{ENV}` file exists
- Check file permissions
- Verify environment variables are set

### Database Connection Issues
- Check NEO4J_HOST and REDIS_HOST point to correct locations
- In Docker: use service names (neo4j, redis) not localhost
- Verify ports are exposed and accessible

## Best Practices

1. **Never commit secrets** - Use only `.env.example` in repo
2. **Use environment variables** for stage/prod - Don't put secrets in config files
3. **Test configuration loading** - Run with `NODE_ENV=stage` locally to verify
4. **Document environment variables** - Keep `.env.example` updated
5. **Validate on startup** - NestJS will error if required env vars missing
6. **Use separate secrets management** - K8s secrets, AWS Secrets Manager, etc.

## Quick Reference

| Action | Command |
|--------|---------|
| Start locally | `npm run start:local` |
| Start dev (watch) | `npm run start:dev` |
| Build for prod | `npm run build:prod` |
| Build with env var | `ENV=prod npm run build:env` |
| Docker compose | `docker-compose up` |
| Docker build | `docker build -t protego:latest .` |
