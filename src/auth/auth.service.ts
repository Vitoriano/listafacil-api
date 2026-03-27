import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../core/prisma/prisma.service';
import { RegisterDto, LoginDto, AuthResponseDto, TokenPairDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        joinedAt: user.joinedAt,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        joinedAt: user.joinedAt,
      },
      ...tokens,
    };
  }

  async refreshToken(oldToken: string): Promise<TokenPairDto> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: oldToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(stored.user.id, stored.user.email);
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<TokenPairDto> {
    const accessToken = this.jwt.sign(
      { sub: userId, email },
      {
        privateKey: this.config.get<string>('JWT_PRIVATE_KEY'),
        algorithm: 'RS256',
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRATION', '15m') as any,
      },
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expirationDays = this.config.get<number>(
      'JWT_REFRESH_EXPIRATION_DAYS',
      30,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(
          Date.now() + expirationDays * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return { accessToken, refreshToken };
  }
}
