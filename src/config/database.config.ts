import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  neo4j: {
    scheme: process.env.NEO4J_SCHEME || 'bolt',
    host: process.env.NEO4J_HOST || 'localhost',
    port: process.env.NEO4J_PORT || 7687,
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
}));
