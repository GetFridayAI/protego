import { Injectable } from '@nestjs/common';
import { Neo4jService } from '../services/neo4j.service';
import { RedisService } from '../services/redis.service';
import { BcryptService } from '../services/bcrypt.service';
import { LoggerService } from '../services/logger.service';
import { LoginRequestDto, LoginResponseDto, SignupRequestDto } from '../common/dto/auth.dto';
import { ErrorCode, ERROR_CODE_MESSAGES } from '../common/errors/error-codes';
import { SessionVerificationReason } from '../common/enums/session-verification-reason.enum';
import { AUTH_MESSAGES, WARNING_MESSAGES, LOG_MESSAGES } from '../common/messages/messages';
import { generateSessionToken } from '../common/utils/token.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private neo4jService: Neo4jService,
    private redisService: RedisService,
    private bcryptService: BcryptService,
    private logger: LoggerService,
    private configService: ConfigService,
  ) {}

  /**
   * Authenticate user and create session
   */
  async login(credentials: LoginRequestDto): Promise<LoginResponseDto> {
    try {
      // Validate input
      if (!credentials.email || !credentials.password) {
        this.logger.warn(WARNING_MESSAGES.LOGIN_MISSING_INFO, {
          email: credentials.email ? 'provided' : 'missing',
        });
        return this.createErrorResponse(
          ErrorCode.MISSING_INFORMATION,
          false,
        );
      }

      // Find user in Neo4j
      const query = `
        MATCH (u:User {email: $email})
        RETURN {
          email: u.email,
          hashedPassword: u.hashedPassword,
          createdAt: u.createdAt
        } as user
      `;

      const result = await this.neo4jService.executeQuery(query, {
        email: credentials.email,
      });

      // Check if user exists
      if (result.records.length === 0) {
        this.logger.warn(WARNING_MESSAGES.LOGIN_USER_NOT_FOUND, {
          email: credentials.email,
        });
        return this.createErrorResponse(
          ErrorCode.EMAIL_NOT_FOUND,
          false,
        );
      }

      const user = result.records[0].get('user');

      // Verify password
      const isPasswordValid = await this.bcryptService.compare(
        credentials.password,
        user.hashedPassword,
      );

      if (!isPasswordValid) {
        this.logger.warn(WARNING_MESSAGES.LOGIN_INCORRECT_PASSWORD, {
          email: credentials.email,
        });
        return this.createErrorResponse(
          ErrorCode.INCORRECT_PASSWORD,
          false,
        );
      }

      // Generate session token
      const sessionToken = generateSessionToken();

      // Store session in Redis with metadata
      const sessionTtl = parseInt(
        this.configService.get('app.jwtExpiration') || '86400', // 24 hours default
      );

      await this.redisService.storeSession(
        sessionToken,
        {
          email: credentials.email,
          timestamp: new Date().toISOString(),
        },
        sessionTtl,
      );

      this.logger.info(LOG_MESSAGES.USER_LOGGED_IN, { email: credentials.email });

      return {
        success: true,
        sessionToken,
        message: AUTH_MESSAGES.LOGIN_SUCCESSFUL,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(LOG_MESSAGES.LOGIN_ERROR, error);
      return this.createErrorResponse(
        ErrorCode.DATABASE_ERROR,
        false,
      );
    }
  }

  /**
   * Create a new user, hash password, and start session
   */
  async signup(data: SignupRequestDto): Promise<LoginResponseDto> {
    try {
      if (!data.email || !data.encryptedPassword) {
        this.logger.warn(WARNING_MESSAGES.LOGIN_MISSING_INFO, {
          email: data.email ? 'provided' : 'missing',
        });
        return this.createErrorResponse(
          ErrorCode.MISSING_INFORMATION,
          false,
        );
      }

      // ensure user does not already exist
      const checkQuery = `
        MATCH (u:User {email: $email})
        RETURN u
      `;
      const existing = await this.neo4jService.executeQuery(checkQuery, {
        email: data.email,
      });

      if (existing.records.length > 0) {
        return this.createErrorResponse(
          ErrorCode.EMAIL_ALREADY_EXISTS,
          false,
        );
      }

      // hash incoming (decrypted) password
      const hashedPassword = await this.bcryptService.hash(
        data.encryptedPassword,
      );

      const createQuery = `
        CREATE (u:User {email: $email, hashedPassword: $hashedPassword, createdAt: datetime()})
      `;

      await this.neo4jService.executeQuery(createQuery, {
        email: data.email,
        hashedPassword,
      });

      // immediately create session token same as login
      const sessionToken = generateSessionToken();
      const sessionTtl = parseInt(
        this.configService.get('app.jwtExpiration') || '86400',
      );

      await this.redisService.storeSession(
        sessionToken,
        { email: data.email, timestamp: new Date().toISOString() },
        sessionTtl,
      );

      this.logger.info(LOG_MESSAGES.USER_LOGGED_IN, { email: data.email });

      return {
        success: true,
        sessionToken,
        message: AUTH_MESSAGES.SIGNUP_SUCCESSFUL,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(LOG_MESSAGES.LOGIN_ERROR, error);
      return this.createErrorResponse(
        ErrorCode.DATABASE_ERROR,
        false,
      );
    }
  }

  /**
   * Verify session token and distinguish between invalid and expired
   * @returns { valid: boolean, expired: boolean, code: ErrorCode | null }
   */
  async verifySession(
    sessionToken: string,
  ): Promise<{ valid: boolean; expired: boolean; code: ErrorCode | null }> {
    try {
      const status = await this.redisService.checkSessionStatus(sessionToken);

      if (status.valid) {
        return { valid: true, expired: false, code: null };
      }

      if (status.expired) {
        return { valid: false, expired: true, code: ErrorCode.SESSION_EXPIRED };
      }

      return { valid: false, expired: false, code: ErrorCode.SESSION_INVALID };
    } catch (error) {
      this.logger.error(LOG_MESSAGES.SESSION_VERIFICATION_ERROR, error);
      return { valid: false, expired: false, code: ErrorCode.DATABASE_ERROR };
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(sessionToken: string): Promise<void> {
    try {
      await this.redisService.deleteSession(sessionToken);
      this.logger.info(LOG_MESSAGES.USER_LOGGED_OUT, { sessionToken: sessionToken.slice(0, 8) + '...' });
    } catch (error) {
      this.logger.error(LOG_MESSAGES.LOGOUT_ERROR, error);
    }
  }

  /**
   * Get user info from session
   */
  async getUserFromSession(
    sessionToken: string,
  ): Promise<{ email: string } | null> {
    try {
      const sessionKey = `session:${sessionToken}`;
      const session = await this.redisService.get(sessionKey);

      if (!session) {
        return null;
      }

      return JSON.parse(session);
    } catch (error) {
      this.logger.error('Get user from session error', error);
      return null;
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    code: ErrorCode,
    success: boolean,
  ): LoginResponseDto {
    return {
      success,
      message: ERROR_CODE_MESSAGES[code],
      timestamp: new Date(),
    };
  }
}
