import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsGateway } from './ws.gateway';
import { WsAuthService } from './ws-auth.service';
import { WsDocsController } from './ws-docs.controller';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [WsDocsController],
  providers: [WsGateway, WsAuthService],
  exports: [WsGateway],
})
export class WsModule {}
