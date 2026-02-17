import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, auth } from 'cassandra-driver';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { CassandraConfig, loadCassandraConfig } from '../config/cassandra.config';
import { LoggerService } from './logger.service';
import { interpolateMessage, INFO_MESSAGES, ERROR_MESSAGES } from '../common/messages';

@Injectable()
export class CassandraService implements OnModuleInit, OnModuleDestroy {
  private client: Client;
  private connected: boolean = false;
  private config: CassandraConfig;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    this.config = loadCassandraConfig();
  }

  async onModuleInit() {
    await this.connect();
    await this.initializeKeyspace();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.client = new Client({
        contactPoints: this.config.contactPoints,
        port: this.config.port,
        keyspace: this.config.keyspace,
        authProvider: new auth.PlainTextAuthProvider(
          this.config.username,
          this.config.password,
        ),
        localDataCenter: this.config.localDataCenter || this.config.dataCenter,
        protocolOptions: {
          port: this.config.port,
        },
      });

      await this.client.connect();
      this.connected = true;
      this.logger.info(
        interpolateMessage(INFO_MESSAGES.CASSANDRA_CONNECTED, {
          host: this.config.contactPoints[0],
        }),
      );
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CASSANDRA_CONNECTION_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }

  private async initializeKeyspace(): Promise<void> {
    try {
      // Create keyspace if it doesn't exist
      const createKeyspaceQuery = `
        CREATE KEYSPACE IF NOT EXISTS ${this.config.keyspace}
        WITH replication = {
          'class': 'SimpleStrategy',
          'replication_factor': 1
        }
      `;

      await this.client.execute(createKeyspaceQuery);

      // Create API keys table if it doesn't exist
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${this.config.keyspace}.api_keys (
          key_id uuid PRIMARY KEY,
          api_key text,
          client_name text,
          is_active boolean,
          created_at timestamp,
          last_used timestamp,
          permissions list<text>
        )
      `;

      await this.client.execute(createTableQuery);

      // Create API key index for lookup
      const createIndexQuery = `
        CREATE INDEX IF NOT EXISTS ON ${this.config.keyspace}.api_keys (api_key)
      `;

      await this.client.execute(createIndexQuery);

      this.logger.info(
        interpolateMessage(INFO_MESSAGES.CASSANDRA_KEYSPACE_INITIALIZED, {
          keyspace: this.config.keyspace,
        }),
      );
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CASSANDRA_INITIALIZATION_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }

  async getApiKey(
    apiKey: string,
  ): Promise<{ keyId: string; clientName: string; isActive: boolean } | null> {
    try {
      const query = `
        SELECT key_id, client_name, is_active
        FROM ${this.config.keyspace}.api_keys
        WHERE api_key = ?
      `;

      const result = await this.client.execute(query, [apiKey], {
        prepare: true,
      });

      if (result.rowLength === 0) {
        return null;
      }

      const row = result.first();
      return {
        keyId: row.key_id.toString(),
        clientName: row.client_name,
        isActive: row.is_active,
      };
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CASSANDRA_QUERY_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }

  async createApiKey(
    clientName: string,
    permissions: string[] = [],
  ): Promise<string> {
    try {
      const keyId = uuidv4();
      const apiKey = crypto.randomBytes(32).toString('hex');
      const now = new Date();

      const query = `
        INSERT INTO ${this.config.keyspace}.api_keys
        (key_id, api_key, client_name, is_active, created_at, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await this.client.execute(
        query,
        [keyId, apiKey, clientName, true, now, permissions],
        { prepare: true },
      );

      return apiKey;
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CASSANDRA_QUERY_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }

  async updateLastUsed(apiKey: string): Promise<void> {
    try {
      const query = `
        UPDATE ${this.config.keyspace}.api_keys
        SET last_used = ?
        WHERE api_key = ?
      `;

      await this.client.execute(query, [new Date(), apiKey], {
        prepare: true,
      });
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CASSANDRA_QUERY_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.shutdown();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async execute(query: string, params?: any[], options?: any): Promise<any> {
    try {
      return await this.client.execute(query, params, options);
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CASSANDRA_QUERY_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }
}
