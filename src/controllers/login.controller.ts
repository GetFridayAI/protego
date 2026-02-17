import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import {
  LoginRequestDto,
  LoginResponseDto,
  SessionVerificationDto,
  SessionVerificationResponseDto,
} from '../common/dto/auth.dto';
import { SessionVerificationReason } from '../common/enums/session-verification-reason.enum';
import { AUTH_MESSAGES } from '../common/messages/messages';

@Controller('api/auth')
export class LoginController {
  constructor(private authService: AuthService) {}

  /**
   * Login endpoint
   * Expects email and password, returns sessionToken on success
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginRequestDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  /**
   * Verify session endpoint
   * Distinguishes between invalid and expired sessions
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifySession(
    @Body() body: SessionVerificationDto,
  ): Promise<SessionVerificationResponseDto> {
    const result = await this.authService.verifySession(body.sessionToken);

    if (result.valid) {
      return {
        valid: true,
        message: AUTH_MESSAGES.SESSION_VALID,
        code: null,
        timestamp: new Date(),
      };
    }

    if (result.expired) {
      return {
        valid: false,
        message: AUTH_MESSAGES.SESSION_EXPIRED,
        code: result.code,
        reason: SessionVerificationReason.EXPIRED,
        timestamp: new Date(),
      };
    }

    return {
      valid: false,
      message: AUTH_MESSAGES.SESSION_INVALID,
      code: result.code,
      reason: SessionVerificationReason.INVALID,
      timestamp: new Date(),
    };
  }

  /**
   * Logout endpoint
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() body: { sessionToken: string },
  ): Promise<{ message: string; timestamp: Date }> {
    await this.authService.logout(body.sessionToken);
    return { message: AUTH_MESSAGES.LOGOUT_SUCCESSFUL, timestamp: new Date() };
  }
}
