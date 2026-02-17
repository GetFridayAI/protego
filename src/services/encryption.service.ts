import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { LoggerService } from './logger.service';
import { DynamicConfigService } from './dynamic-config.service';
import { interpolateMessage, ERROR_MESSAGES } from '../common/messages';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class EncryptionService {
  private encryptionKey: Buffer;
  private algorithm: string;

  constructor(
    private dynamicConfigService: DynamicConfigService,
    private logger: LoggerService,
  ) {
    // Initialize with config
    this.initializeKeys();
  }

  private initializeKeys(): void {
    try {
      const keyStr = this.dynamicConfigService.getConfigWithFallback(
        'encryptionKey',
        process.env.ENCRYPTION_KEY || '',
      );

      if (keyStr.length < 32) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
      }

      // Convert hex string to buffer, or pad if necessary
      this.encryptionKey =
        Buffer.from(keyStr, 'hex').length === 32
          ? Buffer.from(keyStr, 'hex')
          : Buffer.from(keyStr.padEnd(32, '0').substring(0, 32));

      this.algorithm = this.dynamicConfigService.getConfigWithFallback(
        'encryptionAlgorithm',
        process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      );
    } catch (error) {
      this.logger.warn(
        `Failed to load encryption config: ${(error as Error).message}`,
      );
      // Fallback to environment variables
      const envKey = process.env.ENCRYPTION_KEY || '';
      if (envKey.length >= 32) {
        this.encryptionKey = Buffer.from(envKey, 'hex');
      } else {
        this.encryptionKey = Buffer.from(envKey.padEnd(32, '0').substring(0, 32));
      }
      this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm';
    }
  }

  encrypt(data: string): EncryptedPayload {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(data, 'utf-8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        ciphertext: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.ENCRYPTION_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }

  decrypt(payload: EncryptedPayload): string {
    try {
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        Buffer.from(payload.iv, 'hex'),
      );

      decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));

      let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      this.logger.error(
        interpolateMessage(ERROR_MESSAGES.DECRYPTION_FAILED, {
          error: (error as Error).message,
        }),
      );
      throw error;
    }
  }

  decryptFromRequest(encryptedData: EncryptedPayload | string): string {
    if (typeof encryptedData === 'string') {
      const parsed = JSON.parse(encryptedData) as EncryptedPayload;
      return this.decrypt(parsed);
    }
    return this.decrypt(encryptedData);
  }
}
