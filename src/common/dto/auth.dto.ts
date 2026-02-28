import { ErrorCode } from '../errors/error-codes';
import { SessionVerificationReason } from '../enums/session-verification-reason.enum';

export class LoginRequestDto {
  email: string;
  password: string;
}

export class LoginResponseDto {
  success: boolean;
  sessionToken?: string;
  message: string;
  code?: ErrorCode;
  timestamp: Date;
}

export class SessionVerificationDto {
  sessionToken: string;
}

export class SessionVerificationResponseDto {
  valid: boolean;
  message: string;
  code: ErrorCode | null;
  reason?: SessionVerificationReason;
  timestamp: Date;
}

// Used for both login and signup requests; password field contains the
// AES-encrypted password coming from the client. It will be hashed prior
// to storage during signup.
export class SignupRequestDto {
  email: string;
  encryptedPassword: string;
} 
