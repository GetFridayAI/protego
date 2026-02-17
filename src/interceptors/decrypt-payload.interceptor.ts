import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { EncryptionService, EncryptedPayload } from '../services/encryption.service';
import { LoggerService } from '../services/logger.service';
import { interpolateMessage, ERROR_MESSAGES, LOG_MESSAGES } from '../common/messages';

@Injectable()
export class DecryptPayloadInterceptor implements NestInterceptor {
  constructor(
    private encryptionService: EncryptionService,
    private logger: LoggerService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Only decrypt for POST, PUT, PATCH methods
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const encryptedData = request.body;

        if (!encryptedData) {
          throw new BadRequestException(ERROR_MESSAGES.MISSING_ENCRYPTED_PAYLOAD);
        }

        // Check if the payload is encrypted (has required fields)
        if (
          !encryptedData.ciphertext ||
          !encryptedData.iv ||
          !encryptedData.authTag
        ) {
          // If it's not encrypted, assume it's a plain request
          // This allows for unencrypted endpoints if needed
          return next.handle();
        }

        try {
          const decryptedString = this.encryptionService.decryptFromRequest(
            encryptedData as EncryptedPayload,
          );

          // Parse the decrypted JSON
          const decryptedData = JSON.parse(decryptedString);
          request.body = decryptedData;

          this.logger.info(LOG_MESSAGES.PAYLOAD_DECRYPTED);
        } catch (error) {
          this.logger.error(
            interpolateMessage(LOG_MESSAGES.PAYLOAD_DECRYPTION_ERROR, {
              error: (error as Error).message,
            }),
          );
          throw new BadRequestException(ERROR_MESSAGES.INVALID_ENCRYPTED_FORMAT);
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error(
          interpolateMessage(LOG_MESSAGES.PAYLOAD_DECRYPTION_ERROR, {
            error: (error as Error).message,
          }),
        );
        throw new BadRequestException(ERROR_MESSAGES.INVALID_ENCRYPTED_FORMAT);
      }
    }

    return next.handle();
  }
}
