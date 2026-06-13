import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import {Logger} from "@nestjs/common";

const logger = new Logger();

@WebSocketGateway({ cors: { origin: '*' } })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly messagesService: MessagesService) {}

  handleConnection(client: Socket) {
    logger.log(`bum connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`bum disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
      @MessageBody() roomId: string,
      @ConnectedSocket() client: Socket,
  ) {
    client.join(roomId);
    logger.log(`bum ${client.id} joined room: ${roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
      @MessageBody() payload: { roomId: string; authorId: string; text: string },
      @ConnectedSocket() client: Socket,
  ) {
    try {
      const savedMessage = await this.messagesService.sendMessage(
          payload.roomId,
          payload.authorId,
          payload.text,
          client.handshake.address
      );

      this.server.to(payload.roomId).emit('newMessage', savedMessage);

    } catch (error) {
      client.emit('errorMessage', { message: error.message });
    }
  }
}