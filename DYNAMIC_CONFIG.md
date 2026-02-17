# Dynamic Configuration Management

## Overview

The application has migrated from environment-file-based configuration to a **Cassandra-backed dynamic configuration system**. This allows:

- **Single source of truth** - All configurations stored in Cassandra
- **Runtime configurability** - Change settings without redeploying
- **Environment isolation** - Separate configs per environment (local/dev/stage/prod)
- **Minimal env files** - Only Cassandra connection details needed
- **Type-safe access** - TypeScript interfaces for configuration

## Architecture

```
Cassandra (.env files contain only Cassandra connection)
    ↓
CassandraService (manages Cassandra connection)
    ↓
DynamicConfigService (loads configs from Cassandra table)
    ↓
All other services (Neo4j, Redis, Bcrypt, Encryption, etc.)
    ↓
Controllers and business logic
```

## Environment Files Structure

All `.env.*` files now contain ONLY Cassandra connection details:

```env
# Local Development
CASSANDRA_CONTACT_POINTS=localhost
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=protego_keyspace
CASSANDRA_DATA_CENTER=datacenter1
CASSANDRA_USERNAME=cassandra
CASSANDRA_PASSWORD=cassandra
NODE_ENV=local
```

No longer stored in env files:
- ❌ Port number
- ❌ Log levels/format
- ❌ Neo4j connection details
- ❌ Redis connection details
- ❌ Bcrypt rounds
- ❌ JWT secrets
- ❌ Encryption keys
- ❌ Kafka configuration
- ❌ Performance settings
- ❌ Monitoring settings

All the above are now stored in Cassandra's `application_config` table.

## Cassandra Configuration Table

### Schema

```sql
CREATE TABLE protego_keyspace.application_config (
  config_id uuid PRIMARY KEY,
  environment text,              -- local, dev, stage, prod
  config_key text,               -- PORT, NEO4J_HOST, etc.
  config_value text,             -- stored as string
  config_type text,              -- string, number, boolean
  category text,                 -- app, neo4j, redis, security, etc.
  created_at timestamp,
  updated_at timestamp
);

CREATE INDEX ON protego_keyspace.application_config (environment);
CREATE INDEX ON protego_keyspace.application_config (config_key);
```

### Sample Data

| config_key | config_value | environment | config_type | category |
|-----------|--------------|-------------|-------------|----------|
| PORT | 3000 | local | number | app |
| NEO4J_HOST | localhost | local | string | neo4j |
| REDIS_PORT | 6379 | local | number | redis |
| BCRYPT_ROUNDS | 10 | local | number | security |
| ENCRYPTION_KEY | 0123... | local | string | security |

## Application Configuration Interface

```typescript
interface ApplicationConfig {
  // Application
  port: number;
  appName: string;
  appVersion: string;
  apiTimeout: number;
  requestLimit: string;
  nodeEnv: string;

  // Logging
  logLevel: string;
  logFormat: string;
  logOutput: string;

  // Neo4j
  neo4jScheme: string;
  neo4jHost: string;
  neo4jPort: number;
  neo4jUsername: string;
  neo4jPassword: string;

  // Redis
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  redisDb: number;
  redisTls?: boolean;

  // Security
  bcryptRounds: number;
  jwtSecret: string;
  jwtExpiration: string;
  encryptionKey: string;
  encryptionAlgorithm: string;

  // Kafka
  kafkaBrokers: string;
  kafkaClientId: string;
  kafkaSaslEnabled?: boolean;
  kafkaSaslMechanism?: string;
  kafkaSaslUsername?: string;
  kafkaSaslPassword?: string;

  // Performance
  enableCaching?: boolean;
  cacheTtl?: number;
  connectionPoolSize?: number;

  // Monitoring
  enableMetrics?: boolean;
  metricsPort?: number;
}
```

## DynamicConfigService API

### Get Single Config

```typescript
@Injectable()
export class MyService {
  constructor(private configService: DynamicConfigService) {}

  async doSomething() {
    const port = this.configService.getConfig<number>('port');
    const host = this.configService.getConfig<string>('neo4jHost');
  }
}
```

### Get Config with Fallback

```typescript
const port = this.configService.getConfigWithFallback('port', 3000);
// Returns configured port, or 3000 if not found
```

### Get Full Config

```typescript
const allConfigs = this.configService.getFullConfig();
```

### Reload Configs

```typescript
// Refresh from Cassandra
await this.configService.reloadConfigs();
```

## Service Integration

### Neo4jService

Before:
```typescript
const config = this.configService.get('database.neo4j');
const uri = `${config.scheme}://${config.host}:${config.port}`;
```

After:
```typescript
const scheme = this.dynamicConfigService.getConfig<string>('neo4jScheme');
const host = this.dynamicConfigService.getConfig<string>('neo4jHost');
const port = this.dynamicConfigService.getConfig<number>('neo4jPort');
const uri = `${scheme}://${host}:${port}`;
```

### RedisService

Now gets host, port, password, db from DynamicConfigService.

### BcryptService

Now gets bcryptRounds from DynamicConfigService instead of hardcoding.

### EncryptionService

Now gets encryptionKey and encryptionAlgorithm from DynamicConfigService with fallback to environment variables.

## Initialization Sequence

1. **Application boots** → NestFactory.create(AppModule)
2. **ConfigModule initializes** with cassandra details from .env
3. **DatabaseModule initializes**:
   - LoggerService created first
   - CassandraService connects to Cassandra
   - DynamicConfigService loads configs from Cassandra table
   - Other services (Neo4j, Redis, etc.) now get configs from DynamicConfigService
4. **main.ts** gets port from DynamicConfigService and starts server

## Default Configurations

Default configuration templates are provided for each environment:

```typescript
DEFAULT_CONFIGS = {
  local: { /* development defaults */ },
  dev: { /* docker compose defaults */ },
  stage: { /* staging defaults */ },
  prod: { /* production defaults with env var placeholders */ }
}
```

If a configuration table is empty for an environment, defaults are automatically seeded.

## Environment-Specific Configurations

### Local Development (.env.local)

```
CASSANDRA_CONTACT_POINTS=localhost
CASSANDRA_PORT=9042
NODE_ENV=local
```

Loads defaults with:
- Port: 3000
- Log level: debug
- Neo4j/Redis on localhost
- Bcrypt rounds: 10

### Development with Docker (.env.dev)

```
CASSANDRA_CONTACT_POINTS=cassandra
NODE_ENV=dev
```

Loads defaults with:
- Neo4j/Redis as Docker service names
- Bcrypt rounds: 12
- Caching enabled

### Staging (.env.stage)

```
CASSANDRA_CONTACT_POINTS=cassandra-stage.internal
CASSANDRA_PASSWORD=${CASSANDRA_PASSWORD_STAGE}
NODE_ENV=stage
```

Loads from Cassandra with sensitive values in env vars.

### Production (.env.prod)

```
CASSANDRA_CONTACT_POINTS=${PROD_CASSANDRA_HOSTS}
CASSANDRA_PASSWORD=${PROD_CASSANDRA_PASSWORD}
NODE_ENV=prod
```

All connection details from environment variables, configs stored in Cassandra.

## Benefits

### 1. Centralized Configuration

All environments' configurations in one place (Cassandra):
- Easier to review and audit
- Consistent structure
- Single point of maintenance

### 2. Runtime Configuration Changes

Update configs without redeploying:
```sql
UPDATE application_config
SET config_value = '4000'
WHERE environment = 'stage' AND config_key = 'PORT';
```

Then reload in application:
```typescript
await configService.reloadConfigs();
```

### 3. Environment Parity

Same configuration structure across all environments:
- Dev ≈ Stage ≈ Prod (just different values)
- Reduced "works on my machine" issues
- Easy environment promotion

### 4. Zero Trust Secrets

Sensitive values stored in env files:
- CASSANDRA_PASSWORD never hardcoded
- Database passwords never in code
- Encryption keys in vault/secret manager
- Clean git history

### 5. Type Safety

Configurations are strongly typed:
```typescript
const config = configService.getConfig<number>('port'); // ✓ Typed
const config = configService.getConfig('port'); // Still works, any type
```

## Troubleshooting

### "Config not initialized, returning default"

A service tried to access config before DynamicConfigService finished loading.

**Solution:**
- Ensure DynamicConfigService is provided in DatabaseModule
- Check that CassandraService connects successfully first

### "Cassandra connection failed"

Config table cannot be created or accessed.

**Solution:**
- Verify Cassandra is running
- Check Cassandra credentials in .env
- Verify network connectivity to Cassandra
- Check Cassandra logs for errors

### Configs not updating

Changed values in Cassandra but application still using old values.

**Solution:**
- Call `configService.reloadConfigs()` after changes
- Or wait for cache TTL to expire (default 5 minutes)
- Or restart application

## Migration Guide

To add a new configuration:

1. **Add to ApplicationConfig interface**:
```typescript
interface ApplicationConfig {
  myNewSetting: string;
}
```

2. **Add to DEFAULT_CONFIGS**:
```typescript
DEFAULT_CONFIGS = {
  local: {
    myNewSetting: 'default-value',
  },
  // ... other environments
}
```

3. **Add to category mapping** (in DynamicConfigService):
```typescript
categories: {
  myNewSetting: 'category-name',
}
```

4. **Use in service**:
```typescript
const value = this.configService.getConfig<string>('myNewSetting');
```

## Best Practices

1. **Use type-safe getters**:
   ```typescript
   const port = configService.getConfig<number>('port');
   ```

2. **Provide fallbacks**:
   ```typescript
   const cacheTtl = configService.getConfigWithFallback('cacheTtl', 3600);
   ```

3. **Never hardcode defaults** - Put them in DEFAULT_CONFIGS

4. **Document new configs** - Update this file when adding settings

5. **Use environment variables for secrets** - In .env files, not hardcoded

6. **Test config loading** - Ensure services initialize in correct order

## Future Enhancements

- [ ] Config validation schema using Joi/Zod
- [ ] Configuration versioning
- [ ] Config rollback functionality
- [ ] Configuration change webhooks
- [ ] Admin UI for config management
- [ ] Audit trail for configuration changes
- [ ] Feature flags management (separate table)
- [ ] A/B testing configurations
