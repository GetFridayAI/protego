# Protego - NestJS Microservice

A NestJS scaffolding project with integrated support for Neo4j, Redis, and bcrypt password hashing.

## Features

- **NestJS 11** - Modern TypeScript framework
- **Neo4j** - Graph database integration
- **Redis** - In-memory caching
- **Bcrypt** - Password hashing and verification
- **ConfigModule** - Environment-based configuration
- **TypeScript** - Type-safe development

## Project Structure

```
src/
├── config/
│   └── database.config.ts          # Database configuration
├── services/
│   ├── database.module.ts         # Database module
│   ├── neo4j.service.ts           # Neo4j service
│   ├── redis.service.ts           # Redis service
│   └── bcrypt.service.ts          # Bcrypt service
├── app.module.ts                   # Root module
├── app.controller.ts               # Root controller
├── app.service.ts                  # Root service
└── main.ts                         # Application entry point
```

## Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure your environment variables:
```env
NEO4J_HOST=localhost
NEO4J_PORT=7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## Using the Services

### Neo4j Service

```typescript
import { Neo4jService } from './services/neo4j.service';

export class MyController {
  constructor(private neo4jService: Neo4jService) {}

  async getNodes() {
    const result = await this.neo4jService.executeQuery(
      'MATCH (n) RETURN n LIMIT 10'
    );
    return result.records;
  }
}
```

### Redis Service

```typescript
import { RedisService } from './services/redis.service';

export class MyCacheService {
  constructor(private redisService: RedisService) {}

  async cacheData(key: string, value: string, ttl?: number) {
    await this.redisService.set(key, value, ttl);
  }

  async getCachedData(key: string) {
    return this.redisService.get(key);
  }
}
```

### Bcrypt Service

```typescript
import { BcryptService } from './services/bcrypt.service';

export class AuthService {
  constructor(private bcryptService: BcryptService) {}

  async hashPassword(password: string) {
    return this.bcryptService.hash(password);
  }

  async verifyPassword(password: string, hash: string) {
    return this.bcryptService.compare(password, hash);
  }
}
```

## Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

## Scripts

- `npm run build` - Build the application
- `npm run start` - Run the application
- `npm run start:dev` - Run in watch mode
- `npm run start:debug` - Run in debug mode
- `npm run start:prod` - Run production build
- `npm run lint` - Lint and fix code
- `npm run format` - Format code with prettier
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Generate coverage report
- `npm run test:e2e` - Run e2e tests

## Docker Setup (Optional)

### Neo4j
```bash
docker run -d \
  --name neo4j \
  -p 7687:7687 \
  -p 7474:7474 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

### Redis
```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:latest
```

## License

UNLICENSED
