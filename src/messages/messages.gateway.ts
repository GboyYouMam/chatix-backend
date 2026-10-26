import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { WsAuthService } from '../auth/ws-auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WsExceptionsFilter } from '../common/filters/ws-exception.filter';
import { wsValidationPipe } from '../common/pipes/ws-validation.pipe';
import { wsAuthError } from '../auth/ws-auth-error';
import { socketUserData } from '../auth/socket-user';

@UseFilters(WsExceptionsFilter)
@UsePipes(wsValidationPipe)
@WebSocketGateway()
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MessagesGateway.name);
  constructor(
    private readonly messagesService: MessagesService,
    private readonly auth: WsAuthService,
    private readonly realtime: RealtimeService,
  ) {}
  afterInit(server: Server) {
    this.server = server;
    this.realtime.register('/', server);
  }
  async handleConnection(client: Socket) {
    try {
      const user = await this.auth.authenticate(client);
      await client.join(`user:${user.userId}`);
      this.logger.log({
        event: 'ws.connect',
        userId: user.userId,
        socketId: client.id,
        namespace: '/',
      });
    } catch (error) {
      client.emit('exception', wsAuthError(error));
      client.disconnect(true);
    }
  }
  handleDisconnect(client: Socket) {
    this.logger.log({
      event: 'ws.disconnect',
      socketId: client.id,
      userId: socketUserData(client).user?.userId,
    });
  }
  broadcastMessage(roomId: string, message: unknown) {
    this.server.to(roomId).emit('newMessage', message);
  }
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    await client.join(roomId);
  }
}
