import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';
import { LoggerService } from '../services/logger.service';
import { ERROR_MESSAGES } from '../common/messages';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeyService,
    private logger: LoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      this.logger.warn(ERROR_MESSAGES.INVALID_API_KEY);
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_API_KEY);
    }

    const isValid = await this.apiKeyService.validateApiKey(apiKey);

    if (!isValid) {
      this.logger.warn(ERROR_MESSAGES.INVALID_API_KEY);
      throw new UnauthorizedException(ERROR_MESSAGES.INVALID_API_KEY);
    }

    // Attach client info to request for potential logging/auditing
    request.apiKey = apiKey;
    request.clientName = await this.apiKeyService.getApiKeyClientName(apiKey);

    return true;
  }

  private extractApiKey(request: any): string | undefined {
    // Check X-API-Key header
    const headerApiKey = request.headers['x-api-key'];
    if (headerApiKey) {
      return headerApiKey;
    }

    // Check query parameter as fallback
    return request.query?.['api_key'];
  }
}
