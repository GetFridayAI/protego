import { Injectable } from '@nestjs/common';
import { CassandraService } from './cassandra.service';
import { LoggerService } from './logger.service';
import { interpolateMessage, LOG_MESSAGES } from '../common/messages';

@Injectable()
export class ApiKeyService {
  constructor(
    private cassandraService: CassandraService,
    private logger: LoggerService,
  ) {}

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const keyData = await this.cassandraService.getApiKey(apiKey);

      if (!keyData) {
        this.logger.warn(
          interpolateMessage(LOG_MESSAGES.API_KEY_NOT_FOUND, {
            apiKey: this.maskApiKey(apiKey),
          }),
        );
        return false;
      }

      if (!keyData.isActive) {
        this.logger.warn(
          interpolateMessage(LOG_MESSAGES.API_KEY_INACTIVE, {
            clientName: keyData.clientName,
          }),
        );
        return false;
      }

      // Update last used timestamp
      await this.cassandraService.updateLastUsed(apiKey);

      this.logger.info(
        interpolateMessage(LOG_MESSAGES.API_KEY_VALIDATED, {
          clientName: keyData.clientName,
        }),
      );

      return true;
    } catch (error) {
      this.logger.error(
        interpolateMessage(LOG_MESSAGES.API_KEY_VALIDATION_ERROR, {
          error: (error as Error).message,
        }),
      );
      return false;
    }
  }

  async getApiKeyClientName(apiKey: string): Promise<string | null> {
    try {
      const keyData = await this.cassandraService.getApiKey(apiKey);
      return keyData?.clientName || null;
    } catch (error) {
      this.logger.error(
        interpolateMessage(LOG_MESSAGES.API_KEY_LOOKUP_ERROR, {
          error: (error as Error).message,
        }),
      );
      return null;
    }
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '*'.repeat(apiKey.length);
    }
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  }
}
