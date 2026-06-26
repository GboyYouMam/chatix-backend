import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@WebSocketGateway({ cors: true })
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client attempting connection: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  sendLogToAdmins(logEntry: unknown) {
    this.server?.to('admin_room').emit('newAdminLog', logEntry);
  }

  @SubscribeMessage('joinAdminLogs')
  handleJoinAdminLogs(@ConnectedSocket() client: Socket) {
    void client.join('admin_room');
    this.logger.log(`Admin joined central terminal: ${client.id}`);
    return {
      event: 'logJoined',
      data: 'Connected to KILLSQUAD central log server',
    };
  }
}
