import { EncryptedPayload } from '../services/encryption.service';

export class EncryptedRequestDto implements EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class SecurityHeadersDto {
  'x-api-key': string;
}

export class ApiKeyMetadataDto {
  keyId: string;
  clientName: string;
  isActive: boolean;
  lastUsed?: Date;
}
