import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { SignupRequestDto } from '../common/dto/auth.dto';
import { LoginResponseDto } from '../common/dto/auth.dto';

// The signup endpoint behaves very similarly to login but creates a user
// record first. It is protected by the global ApiKeyGuard defined in
// AppModule, so all requests must provide a valid API key (header or query).

@Controller('api/auth')
export class SignupController {
  constructor(private authService: AuthService) {}

  /**
   * User registration endpoint
   * Accepts email and encryptedPassword in body and returns a session token
   */
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  async signup(@Body() signupDto: SignupRequestDto): Promise<LoginResponseDto> {
    return this.authService.signup(signupDto);
  }
}
