import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../auth/ws-auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WsExceptionsFilter } from '../common/filters/ws-exception.filter';
import { wsValidationPipe } from '../common/pipes/ws-validation.pipe';
import { socketUserData } from '../auth/socket-user';

@UseFilters(WsExceptionsFilter)
@UsePipes(wsValidationPipe)
@WebSocketGateway({ namespace: '/admin' })
export class AdminGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AdminGateway.name);
  constructor(
    private readonly auth: WsAuthService,
    private readonly realtime: RealtimeService,
  ) {}
  afterInit(server: Server) {
    this.server = server;
    this.realtime.register('/admin', server);
    server.use(this.auth.middleware({ adminOnly: true }));
  }
  async handleConnection(client: Socket) {
    const user = socketUserData(client).user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    await client.join('admins');
    await client.join(`user:${user.userId}`);
    this.logger.log({
      event: 'ws.connect',
      userId: user.userId,
      socketId: client.id,
      namespace: '/admin',
    });
  }
  handleDisconnect(client: Socket) {
    this.logger.log({
      event: 'ws.disconnect',
      socketId: client.id,
      userId: socketUserData(client).user?.userId,
    });
  }
  sendLogToAdmins(entry: unknown) {
    this.realtime.emitToAdmins('newAdminLog', entry);
  }
}
