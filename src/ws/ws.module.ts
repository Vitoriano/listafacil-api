import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsGateway } from './ws.gateway';
import { WsAuthService } from './ws-auth.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [WsGateway, WsAuthService],
  exports: [WsGateway],
})
export class WsModule {}
