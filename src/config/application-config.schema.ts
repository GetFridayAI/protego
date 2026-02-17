export interface ApplicationConfig {
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

export interface ConfigSchema {
  configId: string; // uuid
  environment: string; // local, dev, stage, prod
  configKey: string; // e.g., 'PORT', 'NEO4J_HOST'
  configValue: string; // stored as string, parsed as needed
  configType: string; // 'string', 'number', 'boolean'
  category: string; // 'app', 'neo4j', 'redis', 'security', 'kafka', 'performance', 'monitoring'
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_CONFIGS: Record<string, Record<string, any>> = {
  local: {
    port: 3000,
    appName: 'protego',
    appVersion: '0.0.1',
    apiTimeout: 30000,
    requestLimit: '100mb',
    logLevel: 'debug',
    logFormat: 'json',
    logOutput: 'console',
    neo4jScheme: 'bolt',
    neo4jHost: 'localhost',
    neo4jPort: 7687,
    neo4jUsername: 'neo4j',
    neo4jPassword: 'password',
    redisHost: 'localhost',
    redisPort: 6379,
    redisPassword: '',
    redisDb: 0,
    bcryptRounds: 10,
    jwtSecret: 'your-secret-key-local',
    jwtExpiration: '24h',
    encryptionKey: '0123456789abcdef0123456789abcdef',
    encryptionAlgorithm: 'aes-256-gcm',
    kafkaBrokers: 'localhost:9092',
    kafkaClientId: 'protego-local',
    enableCaching: false,
    enableMetrics: false,
  },
  dev: {
    port: 3000,
    appName: 'protego',
    appVersion: '0.0.1',
    apiTimeout: 30000,
    requestLimit: '100mb',
    logLevel: 'debug',
    logFormat: 'json',
    logOutput: 'console,file',
    neo4jScheme: 'bolt',
    neo4jHost: 'neo4j',
    neo4jPort: 7687,
    neo4jUsername: 'neo4j',
    neo4jPassword: 'password',
    redisHost: 'redis',
    redisPort: 6379,
    redisPassword: '',
    redisDb: 0,
    bcryptRounds: 12,
    jwtSecret: 'your-secret-key-dev',
    jwtExpiration: '24h',
    encryptionKey: 'fedcba9876543210fedcba9876543210',
    encryptionAlgorithm: 'aes-256-gcm',
    kafkaBrokers: 'kafka:9092',
    kafkaClientId: 'protego-dev',
    enableCaching: true,
    cacheTtl: 1800,
    enableMetrics: false,
  },
  stage: {
    port: 3000,
    appName: 'protego',
    appVersion: '0.0.1',
    apiTimeout: 30000,
    requestLimit: '50mb',
    logLevel: 'info',
    logFormat: 'json',
    logOutput: 'file',
    neo4jScheme: 'bolt',
    neo4jHost: 'neo4j-stage.internal',
    neo4jPort: 7687,
    neo4jUsername: 'neo4j',
    neo4jPassword: 'changeme',
    redisHost: 'redis-stage.internal',
    redisPort: 6379,
    redisPassword: '',
    redisDb: 0,
    bcryptRounds: 12,
    jwtSecret: 'your-secret-key-stage',
    jwtExpiration: '12h',
    encryptionKey: 'stage-encryption-key-changeme1234',
    encryptionAlgorithm: 'aes-256-gcm',
    kafkaBrokers: 'kafka-stage.internal:9092',
    kafkaClientId: 'protego-stage',
    enableCaching: true,
    cacheTtl: 3600,
    connectionPoolSize: 10,
    enableMetrics: true,
    metricsPort: 9090,
  },
  prod: {
    port: 3000,
    appName: 'protego',
    appVersion: '0.0.1',
    apiTimeout: 30000,
    requestLimit: '25mb',
    logLevel: 'warn',
    logFormat: 'json',
    logOutput: 'file',
    neo4jScheme: 'bolt+s',
    neo4jHost: 'neo4j-prod.internal',
    neo4jPort: 7687,
    neo4jUsername: 'neo4j',
    neo4jPassword: 'changeme',
    redisHost: 'redis-prod.internal',
    redisPort: 6379,
    redisPassword: 'changeme',
    redisDb: 0,
    redisTls: true,
    bcryptRounds: 15,
    jwtSecret: 'your-secret-key-prod-changeme',
    jwtExpiration: '8h',
    encryptionKey: 'prod-encryption-key-changeme12345',
    encryptionAlgorithm: 'aes-256-gcm',
    kafkaBrokers: 'kafka-prod.internal:9092',
    kafkaClientId: 'protego-prod',
    kafkaSaslEnabled: true,
    kafkaSaslMechanism: 'plain',
    kafkaSaslUsername: 'kafka-user',
    kafkaSaslPassword: 'changeme',
    enableCaching: true,
    cacheTtl: 7200,
    connectionPoolSize: 20,
    enableMetrics: true,
    metricsPort: 9090,
  },
};
