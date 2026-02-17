import { Injectable, OnModuleInit } from '@nestjs/common';
import { CassandraService } from './cassandra.service';
import { LoggerService } from './logger.service';
import {
  ApplicationConfig,
  ConfigSchema,
  DEFAULT_CONFIGS,
} from '../config/application-config.schema';
import { interpolateMessage, INFO_MESSAGES, ERROR_MESSAGES } from '../common/messages';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DynamicConfigService implements OnModuleInit {
  private config: ApplicationConfig | null = null;
  private configCache: Map<string, any> = new Map();
  private cacheTTL: number = 300000; // 5 minutes default
  private lastLoadTime: number = 0;
  private environment: string;

  constructor(
    private cassandraService: CassandraService,
    private logger: LoggerService,
  ) {
    this.environment = process.env.NODE_ENV || 'local';
  }

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure Cassandra is connected
      if (!this.cassandraService.isConnected()) {
        this.logger.warn(
          'Cassandra not yet connected, waiting for connection...',
        );
        // Brief delay to allow Cassandra to connect
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Initialize config table
      await this.initializeConfigTable();

      // Load or seed configs
      await this.loadConfigsFromCassandra();

      this.logger.info(
        interpolateMessage(INFO_MESSAGES.CONFIG_LOADED_FROM_CASSANDRA, {
          environment: this.environment,
        }),
      );
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CONFIG_LOAD_FAILED, {
          error: (error as Error).message,
        }),
      );
      // Fallback to default configs
      this.config = this.buildConfigFromDefaults();
      this.logger.warn(
        interpolateMessage(ERROR_MESSAGES.CONFIG_USING_DEFAULTS, {
          environment: this.environment,
        }),
      );
    }
  }

  private async initializeConfigTable(): Promise<void> {
    try {
      const keyspace = process.env.CASSANDRA_KEYSPACE || 'protego_keyspace';

      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${keyspace}.application_config (
          config_id uuid PRIMARY KEY,
          environment text,
          config_key text,
          config_value text,
          config_type text,
          category text,
          created_at timestamp,
          updated_at timestamp
        )
      `;

      await this.cassandraService.execute(createTableQuery);

      // Create indexes
      const createEnvironmentIndexQuery = `
        CREATE INDEX IF NOT EXISTS ON ${keyspace}.application_config (environment)
      `;

      await this.cassandraService.execute(createEnvironmentIndexQuery);

      const createKeyIndexQuery = `
        CREATE INDEX IF NOT EXISTS ON ${keyspace}.application_config (config_key)
      `;

      await this.cassandraService.execute(createKeyIndexQuery);

      this.logger.info('Application config table initialized');
    } catch (error) {
      this.logger.warn(
        `Config table may already exist: ${(error as Error).message}`,
      );
    }
  }

  private async loadConfigsFromCassandra(): Promise<void> {
    try {
      const keyspace = process.env.CASSANDRA_KEYSPACE || 'protego_keyspace';

      // Check if configs exist for this environment
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM ${keyspace}.application_config
        WHERE environment = ?
      `;

      const result = await this.cassandraService.execute(checkQuery, [
        this.environment,
      ]);

      const count = result.rows[0]?.count || 0;

      if (count === 0) {
        // Seed default configs for this environment
        await this.seedDefaultConfigs();
      }

      // Load all configs for this environment
      const loadQuery = `
        SELECT config_key, config_value, config_type
        FROM ${keyspace}.application_config
        WHERE environment = ?
      `;

      const configResult = await this.cassandraService.execute(loadQuery, [
        this.environment,
      ]);

      const configMap: any = {};

      for (const row of configResult.rows) {
        const value = this.parseConfigValue(
          row.config_value,
          row.config_type,
        );
        const key = this.camelCaseKey(row.config_key);
        configMap[key] = value;
      }

      this.config = configMap as ApplicationConfig;
      this.lastLoadTime = Date.now();
    } catch (error) {
      throw new Error(
        `Failed to load configs from Cassandra: ${(error as Error).message}`,
      );
    }
  }

  private async seedDefaultConfigs(): Promise<void> {
    try {
      const keyspace = process.env.CASSANDRA_KEYSPACE || 'protego_keyspace';
      const defaultConfig = DEFAULT_CONFIGS[this.environment] || DEFAULT_CONFIGS['local'];

      const insertQuery = `
        INSERT INTO ${keyspace}.application_config
        (config_id, environment, config_key, config_value, config_type, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const now = new Date();
      const categories: Record<string, string> = {
        port: 'app',
        appName: 'app',
        appVersion: 'app',
        apiTimeout: 'app',
        requestLimit: 'app',
        logLevel: 'logging',
        logFormat: 'logging',
        logOutput: 'logging',
        neo4jScheme: 'neo4j',
        neo4jHost: 'neo4j',
        neo4jPort: 'neo4j',
        neo4jUsername: 'neo4j',
        neo4jPassword: 'neo4j',
        redisHost: 'redis',
        redisPort: 'redis',
        redisPassword: 'redis',
        redisDb: 'redis',
        redisTls: 'redis',
        bcryptRounds: 'security',
        jwtSecret: 'security',
        jwtExpiration: 'security',
        encryptionKey: 'security',
        encryptionAlgorithm: 'security',
        kafkaBrokers: 'kafka',
        kafkaClientId: 'kafka',
        kafkaSaslEnabled: 'kafka',
        kafkaSaslMechanism: 'kafka',
        kafkaSaslUsername: 'kafka',
        kafkaSaslPassword: 'kafka',
        enableCaching: 'performance',
        cacheTtl: 'performance',
        connectionPoolSize: 'performance',
        enableMetrics: 'monitoring',
        metricsPort: 'monitoring',
      };

      for (const [key, value] of Object.entries(defaultConfig)) {
        const configType = typeof value;
        const category = categories[key] || 'app';

        await this.cassandraService.execute(
          insertQuery,
          [
            uuidv4(),
            this.environment,
            this.snakeCaseKey(key),
            String(value),
            configType,
            category,
            now,
            now,
          ],
          { prepare: true },
        );
      }

      this.logger.info(
        interpolateMessage(INFO_MESSAGES.CONFIG_SEEDED, {
          environment: this.environment,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Seeding configs failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private buildConfigFromDefaults(): ApplicationConfig {
    const defaultConfig = DEFAULT_CONFIGS[this.environment] || DEFAULT_CONFIGS['local'];
    const result: any = {};

    for (const [key, value] of Object.entries(defaultConfig)) {
      result[this.camelCaseKey(key)] = value;
    }

    return result as ApplicationConfig;
  }

  private camelCaseKey(snakeCase: string): string {
    return snakeCase
      .toLowerCase()
      .replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  private snakeCaseKey(camelCase: string): string {
    return camelCase.replace(/([A-Z])/g, '_$1').toUpperCase();
  }

  private parseConfigValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseInt(value, 10) || 0;
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Get a specific config value
   */
  getConfig<T = any>(key: keyof ApplicationConfig): T {
    if (!this.config) {
      this.logger.warn(`Config not initialized, returning default for ${String(key)}`);
      const defaultConfig = this.buildConfigFromDefaults();
      return defaultConfig[key] as T;
    }

    return this.config[key] as T;
  }

  /**
   * Get entire config object
   */
  getFullConfig(): ApplicationConfig {
    if (!this.config) {
      return this.buildConfigFromDefaults();
    }
    return this.config;
  }

  /**
   * Get config with fallback
   */
  getConfigWithFallback<T = any>(
    key: keyof ApplicationConfig,
    fallback: T,
  ): T {
    try {
      const value = this.getConfig<T>(key);
      return value !== undefined ? value : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Reload configs from Cassandra
   */
  async reloadConfigs(): Promise<void> {
    try {
      await this.loadConfigsFromCassandra();
      this.logger.info('Configs reloaded from Cassandra');
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CONFIG_RELOAD_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }

  /**
   * Check if config needs refresh (based on TTL)
   */
  needsRefresh(): boolean {
    return Date.now() - this.lastLoadTime > this.cacheTTL;
  }

  /**
   * Set cache TTL
   */
  setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }

  /**
   * Get environment
   */
  getEnvironment(): string {
    return this.environment;
  }
}
