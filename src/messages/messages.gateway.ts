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
import {
  HttpException,
  Logger,
  UnauthorizedException,
  UseFilters,
  UsePipes,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { WsAuthService } from '../auth/ws-auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WsExceptionsFilter } from '../common/filters/ws-exception.filter';
import { wsValidationPipe } from '../common/pipes/ws-validation.pipe';
import { socketUserData } from '../auth/socket-user';
import { JoinRoomDto } from './dto/join-room.dto';
import { getSocketClientIp } from '../common/net/client-ip';
import { ConfigService } from '@nestjs/config';

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
    private readonly config: ConfigService,
  ) {}
  afterInit(server: Server) {
    this.server = server;
    this.realtime.register('/', server);
    server.use(this.auth.middleware());
  }
  async handleConnection(client: Socket) {
    const user = socketUserData(client).user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    await client.join(`user:${user.userId}`);
    this.logger.log({
      event: 'ws.connect',
      userId: user.userId,
      socketId: client.id,
      clientIp: getSocketClientIp(client, {
        trustProxy: this.config.get<string>('TRUST_PROXY'),
        trustedIpHeader: this.config.get<string>('TRUSTED_IP_HEADER'),
      }),
      namespace: '/',
    });
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
    @MessageBody() payload: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = socketUserData(client).user?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');
    try {
      await this.messagesService.assertCanAccess(payload.roomId, userId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw new WsException(error.getResponse());
      }
      throw error;
    }
    await client.join(payload.roomId);
  }
}
