import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthService {
  private logger = new Logger('WsAuthService');

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async authenticate(client: Socket): Promise<{ id: string; email: string } | null> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('WebSocket connection without token');
        return null;
      }

      const payload = await this.jwt.verifyAsync(token, {
        publicKey: this.config.get<string>('JWT_PUBLIC_KEY', ''),
        algorithms: ['RS256'],
      });

      return { id: payload.sub, email: payload.email };
    } catch (err) {
      this.logger.warn(`WebSocket auth failed: ${err.message}`);
      return null;
    }
  }
}
