import { registerAs } from '@nestjs/config';

export type Environment = 'local' | 'dev' | 'stage' | 'prod';

interface AppConfig {
  name: string;
  version: string;
  env: Environment;
  port: number;
  logLevel: string;
  apiTimeout: number;
  requestLimit: string;
}

interface SecurityConfig {
  bcryptRounds: number;
  jwtSecret: string;
  jwtExpiration: string;
}

interface KafkaConfig {
  brokers: string[];
  clientId: string;
  saslEnabled?: boolean;
  saslMechanism?: string;
  saslUsername?: string;
  saslPassword?: string;
}

interface PerformanceConfig {
  cachingEnabled: boolean;
  cacheTtl: number;
  connectionPoolSize?: number;
}

interface MonitoringConfig {
  metricsEnabled: boolean;
  metricsPort?: number;
  sentryDsn?: string;
}

export const appConfig = registerAs('app', (): AppConfig => ({
  name: process.env.APP_NAME || 'protego',
  version: process.env.APP_VERSION || '0.0.1',
  env: (process.env.NODE_ENV as Environment) || 'local',
  port: parseInt(process.env.PORT || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',
  apiTimeout: parseInt(process.env.API_TIMEOUT || '30000'),
  requestLimit: process.env.REQUEST_LIMIT || '100mb',
}));

export const securityConfig = registerAs('security', (): SecurityConfig => ({
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
}));

export const kafkaConfig = registerAs('kafka', (): KafkaConfig => ({
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  clientId: process.env.KAFKA_CLIENT_ID || 'protego',
  saslEnabled: process.env.KAFKA_SASL_ENABLED === 'true',
  saslMechanism: process.env.KAFKA_SASL_MECHANISM,
  saslUsername: process.env.KAFKA_SASL_USERNAME,
  saslPassword: process.env.KAFKA_SASL_PASSWORD,
}));

export const performanceConfig = registerAs(
  'performance',
  (): PerformanceConfig => ({
    cachingEnabled: process.env.ENABLE_CACHING === 'true',
    cacheTtl: parseInt(process.env.CACHE_TTL || '3600'),
    connectionPoolSize: parseInt(process.env.CONNECTION_POOL_SIZE || '10'),
  }),
);

export const monitoringConfig = registerAs(
  'monitoring',
  (): MonitoringConfig => ({
    metricsEnabled: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
    sentryDsn: process.env.SENTRY_DSN,
  }),
);
