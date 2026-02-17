import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { LoggerService } from './logger.service';
import { DynamicConfigService } from './dynamic-config.service';
import { interpolateMessage, INFO_MESSAGES, ERROR_MESSAGES } from '../common/messages';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  constructor(
    private dynamicConfigService: DynamicConfigService,
    private logger: LoggerService,
  ) {}

  async onModuleInit() {
    const host = this.dynamicConfigService.getConfig<string>('redisHost');
    const port = this.dynamicConfigService.getConfig<number>('redisPort');
    const password = this.dynamicConfigService.getConfig<string>('redisPassword');
    const db = this.dynamicConfigService.getConfig<number>('redisDb');

    this.client = createClient({
      host,
      port,
      password: password || undefined,
      db,
    } as any);

    this.client.on('error', (err) => {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.CASSANDRA_QUERY_FAILED, {
          error: err.message,
        }),
      );
    });
    this.client.on('connect', () =>
      this.logger.info(INFO_MESSAGES.REDIS_CONNECTED),
    );

    await this.client.connect();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  /**
   * Store session with metadata tracking
   * @param sessionToken The session token
   * @param data Session data to store
   * @param ttl Time to live in seconds
   */
  async storeSession(
    sessionToken: string,
    data: Record<string, any>,
    ttl: number,
  ): Promise<void> {
    const sessionKey = `session:${sessionToken}`;
    const metadataKey = `session:metadata:${sessionToken}`;
    
    // Store actual session data with TTL
    await this.set(sessionKey, JSON.stringify(data), ttl);
    
    // Store metadata without TTL (or with longer TTL) for tracking
    const metadata = {
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      token: sessionToken,
    };
    
    // Store metadata with a longer TTL (2x session TTL) to track expired sessions
    await this.set(metadataKey, JSON.stringify(metadata), ttl * 2);
  }

  /**
   * Check session status and distinguish between invalid and expired
   * @returns { valid: boolean, expired: boolean }
   */
  async checkSessionStatus(
    sessionToken: string,
  ): Promise<{ valid: boolean; expired: boolean }> {
    const sessionKey = `session:${sessionToken}`;
    const metadataKey = `session:metadata:${sessionToken}`;

    const sessionData = await this.get(sessionKey);
    const metadata = await this.get(metadataKey);

    if (sessionData) {
      return { valid: true, expired: false };
    }

    if (metadata) {
      return { valid: false, expired: true };
    }

    return { valid: false, expired: false };
  }

  /**
   * Clear both session and metadata on logout
   */
  async deleteSession(sessionToken: string): Promise<void> {
    const sessionKey = `session:${sessionToken}`;
    const metadataKey = `session:metadata:${sessionToken}`;
    
    await Promise.all([
      this.delete(sessionKey),
      this.delete(metadataKey),
    ]);
  }
}
