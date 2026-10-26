import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../auth/ws-auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UseFilters, UsePipes } from '@nestjs/common';
import { WsExceptionsFilter } from '../common/filters/ws-exception.filter';
import { wsValidationPipe } from '../common/pipes/ws-validation.pipe';
import { wsAuthError } from '../auth/ws-auth-error';
import { socketUserData } from '../auth/socket-user';
import { FightClubService } from './fight-club.service';
import type { CreateFightPayload, JoinFightPayload } from './types/types';

@UseFilters(WsExceptionsFilter)
@UsePipes(wsValidationPipe)
@WebSocketGateway({
  namespace: '/fight-club',
})
export class FightClubGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly fightClubService: FightClubService,
    private readonly auth: WsAuthService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.fightClubService.server = server;
    this.realtime.register('/fight-club', server);
  }

  async handleConnection(client: Socket) {
    try {
      const user = await this.auth.authenticate(client);
      const data = socketUserData(client);
      data.userId = user.userId;
      data.username = user.username;
      await client.join(`user:${user.userId}`);
      client.emit('fight:challenges', this.fightClubService.listChallenges());
    } catch (error) {
      client.emit('exception', wsAuthError(error));
      client.disconnect(true);
    }
  }

  @SubscribeMessage('fight:hit')
  async handleHit(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; k: string },
  ) {
    const { userId } = socketUserData(client);

    if (!userId || !payload?.matchId || !payload?.k) {
      client.emit('fight:error', {
        message: 'ayo how did u lost THAT important data, are we deadass????',
      });
      return;
    }

    await this.fightClubService.handleHit(
      client,
      payload.matchId,
      userId,
      payload.k,
    );
  }

  @SubscribeMessage('fight:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Omit<JoinFightPayload, 'userId'>,
  ) {
    const { userId } = socketUserData(client);

    if (!userId || !payload?.matchId) {
      client.emit('fight:error', { message: 'Missing game data' });
      return;
    }

    const joined = this.fightClubService.joinMatch(client, {
      ...payload,
      userId,
    });
    if (joined) {
      await client.join(payload.matchId);
      this.fightClubService.startMatch(payload.matchId);
    }
  }

  @SubscribeMessage('fight:create')
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateFightPayload,
  ) {
    const { userId, username } = socketUserData(client);
    if (!userId) {
      client.emit('fight:error', { message: 'Missing user data' });
      return;
    }

    const challenge = this.fightClubService.createMatch(
      userId,
      username ?? '',
      payload,
    );
    if (!challenge) {
      client.emit('fight:error', {
        message: 'Stake amount must be a positive integer',
      });
      return;
    }

    this.server.emit(
      'fight:challenges',
      this.fightClubService.listChallenges(),
    );
    this.server.emit('fight:challenge_created', challenge);
    return challenge;
  }

  async handleDisconnect(client: Socket) {
    const { userId } = socketUserData(client);
    if (userId) {
      await this.fightClubService.handlePlayerDisconnect(userId, client.id);
    }
  }
}
