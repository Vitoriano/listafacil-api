import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from './ws-auth.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('WsGateway');

  constructor(private wsAuth: WsAuthService) {}

  async handleConnection(client: Socket) {
    const user = await this.wsAuth.authenticate(client);
    if (!user) {
      client.disconnect();
      return;
    }
    client.data.userId = user.id;
    client.join(`user:${user.id}`);
    this.logger.log(`Client connected: ${user.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.data.userId ?? 'unknown'}`);
  }

  @SubscribeMessage('join:list')
  handleJoinList(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { listId: string },
  ) {
    client.join(`list:${data.listId}`);
    this.logger.debug(`User ${client.data.userId} joined list:${data.listId}`);
  }

  @SubscribeMessage('leave:list')
  handleLeaveList(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { listId: string },
  ) {
    client.leave(`list:${data.listId}`);
  }

  @SubscribeMessage('join:purchase')
  handleJoinPurchase(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { purchaseId: string },
  ) {
    client.join(`purchase:${data.purchaseId}`);
  }

  @SubscribeMessage('leave:purchase')
  handleLeavePurchase(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { purchaseId: string },
  ) {
    client.leave(`purchase:${data.purchaseId}`);
  }

  // --- List events ---

  emitToList(listId: string, event: string, payload: any) {
    this.server.to(`list:${listId}`).emit(event, payload);
  }

  // --- Purchase events ---

  emitToPurchase(purchaseId: string, event: string, payload: any) {
    this.server.to(`purchase:${purchaseId}`).emit(event, payload);
  }

  // --- User events ---

  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
