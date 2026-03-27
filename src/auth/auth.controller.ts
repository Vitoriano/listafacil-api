import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../core/decorators/public.decorator';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, TokenPairDto } from './dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 900_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: TokenPairDto })
  refresh(@Headers('authorization') auth: string): Promise<TokenPairDto> {
    const token = auth?.replace('Bearer ', '');
    return this.authService.refreshToken(token);
  }
}
