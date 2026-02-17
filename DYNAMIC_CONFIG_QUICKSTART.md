# Dynamic Configuration - Quick Start Guide

## What You Need to Know

All application configurations are now fetched from Cassandra at runtime instead of being stored in `.env` files*

*Only Cassandra connection details (`CASSANDRA_*` and `NODE_ENV`) stay in `.env` files.

## Quick Reference

### Configuration File Changes

**Before:**
```bash
# .env.local had 40+ lines with all configs
PORT=3000
LOG_LEVEL=debug
NEO4J_HOST=localhost
... 35 more lines
```

**After:**
```bash
# .env.local has only 8 lines
CASSANDRA_CONTACT_POINTS=localhost
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=protego_keyspace
CASSANDRA_DATA_CENTER=datacenter1
CASSANDRA_USERNAME=cassandra
CASSANDRA_PASSWORD=cassandra
NODE_ENV=local
```

### How Configuration Flows

1. App starts → reads `.env` file
2. Loads only Cassandra connection details
3. Connects to Cassandra
4. Creates/initializes `application_config` table
5. Loads all other configs from Cassandra
6. Makes configs available to all services

### Using Configuration in Code

```typescript
// Inject DynamicConfigService
constructor(private configService: DynamicConfigService) {}

// Get config value
const port = this.configService.getConfig<number>('port');

// Get with fallback
const cacheTtl = this.configService.getConfigWithFallback('cacheTtl', 3600);

// Get entire config
const allConfigs = this.configService.getFullConfig();
```

### What Configurations Are Available

**Application**
- port
- appName
- appVersion
- apiTimeout
- requestLimit
- nodeEnv (local, dev, stage, prod)

**Logging**
- logLevel (debug, info, warn, error)
- logFormat (json, text)
- logOutput (console, file)

**Neo4j**
- neo4jScheme
- neo4jHost
- neo4jPort
- neo4jUsername
- neo4jPassword

**Redis**
- redisHost
- redisPort
- redisPassword
- redisDb
- redisTls

**Security**
- bcryptRounds
- jwtSecret
- jwtExpiration
- encryptionKey
- encryptionAlgorithm

**Kafka**
- kafkaBrokers
- kafkaClientId
- kafkaSaslEnabled
- kafkaSaslMechanism
- kafkaSaslUsername
- kafkaSaslPassword

**Performance**
- enableCaching
- cacheTtl
- connectionPoolSize

**Monitoring**
- enableMetrics
- metricsPort

## Getting Started

### 1. Start the Application

```bash
npm install
docker-compose up -d
npm run start:local
```

The app will:
- Read Cassandra connection from `.env.local`
- Connect to Cassandra
- Create `application_config` table
- Seed default configs for "local" environment
- Boot up with those configs

### 2. Verify Configuration Loaded

Look for log messages:
```
Application config loaded from Cassandra for environment: local
```

### 3. Query Cassandra to See Loaded Configs

```bash
docker exec -it protego-cassandra cqlsh

USE protego_keyspace;

SELECT config_key, config_value, environment 
FROM application_config 
WHERE environment = 'local' 
LIMIT 5;
```

Output:
```
 config_key    | environment | config_value
---------------+-------------+-----------
 PORT          | local       | 3000
 LOG_LEVEL     | local       | debug
 NEO4J_HOST    | local       | localhost
 NEO4J_PORT    | local       | 7687
 REDIS_HOST    | local       | localhost
```

### 4. Changing a Configuration

#### Option A: Direct Cassandra Update

```sql
UPDATE application_config 
SET config_value = '5000'
WHERE environment = 'local' AND config_key = 'PORT';
```

Then in your app (if you support hot reload):
```typescript
await this.configService.reloadConfigs();
```

#### Option B: Update Default Template (Next Restart)

Edit `src/config/application-config.schema.ts`:
```typescript
DEFAULT_CONFIGS = {
  local: {
    port: 5000,  // Changed from 3000
    // ... other configs
  }
}
```

Next time app starts and table is empty, it will use new defaults.

## Common Tasks

### Change Neo4j Host for Dev Environment

```sql
UPDATE application_config 
SET config_value = 'your-neo4j-server.com'
WHERE environment = 'dev' AND config_key = 'NEO4J_HOST';
```

### Change Bcrypt Rounds for Production

```sql
UPDATE application_config 
SET config_value = '15'
WHERE environment = 'prod' AND config_key = 'BCRYPT_ROUNDS';
```

### View All Configs for an Environment

```sql
SELECT config_key, config_value, config_type, category
FROM application_config 
WHERE environment = 'stage'
ORDER BY category;
```

### Add a New Configuration

1. **Update the interface** in `src/config/application-config.schema.ts`:
   ```typescript
   interface ApplicationConfig {
     // ... existing
     myNewConfig: string;
   }
   ```

2. **Add to defaults**:
   ```typescript
   DEFAULT_CONFIGS = {
     local: {
       // ... existing
       myNewConfig: 'default-value',
     }
   }
   ```

3. **Add category mapping** in `DynamicConfigService.seedDefaultConfigs()`:
   ```typescript
   const categories = {
     // ... existing
     myNewConfig: 'my-category',
   }
   ```

4. **Use in code**:
   ```typescript
   const value = this.configService.getConfig<string>('myNewConfig');
   ```

## Troubleshooting

### "Config not initialized, returning default"

The service tried to access config before DynamicConfigService finished loading.

**Solution:** Wait for app to fully boot (see "Application is running" message).

### "Cassandra connection failed"

DynamicConfigService couldn't connect to Cassandra.

**Solution:**
1. Check Cassandra is running: `docker-compose ps cassandra`
2. Verify credentials in `.env` match Cassandra defaults
3. Check network: `docker exec protego-app nc -zv cassandra 9042`

### Application doesn't see my config changes

Config is cached. Either:
1. Restart the application
2. Call `configService.reloadConfigs()`
3. Wait for cache TTL to expire (default 5 minutes)

### Default configs not being seeded

The `application_config` table already has data.

**Solution:** 
- Delete existing configs: `TRUNCATE application_config;`
- Restart app to reseed

## Environment Progression

Configs flow through environments:

```
Development (local)
    ↓
Development (docker-compose)
    ↓
Staging (pre-prod testing)
    ↓
Production (live)
```

Each has own environment value in Cassandra, so configs don't mix.

## Important Files

- **DYNAMIC_CONFIG.md** - Full architecture and detailed docs
- **DYNAMIC_CONFIG_SUMMARY.md** - Implementation summary
- **src/config/application-config.schema.ts** - Config templates
- **src/services/dynamic-config.service.ts** - Main service

## Support

For issues or questions:
1. Check DYNAMIC_CONFIG.md "Troubleshooting" section
2. Review DynamicConfigService logs
3. Query Cassandra directly to verify configs exist
4. Check that Cassandra connection details are correct in .env

## Next Steps

1. ✓ Application configured and running
2. Verify all configs loaded: check logs
3. Access your app on configured port
4. Test updating a config in Cassandra
5. Verify config reload (if implemented)
6. Review documentation for advanced features

**You're all set!** The application is now using Cassandra for all runtime configuration.
