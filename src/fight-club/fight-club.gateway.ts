import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../auth/ws-auth.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WsExceptionsFilter } from '../common/filters/ws-exception.filter';
import { wsValidationPipe } from '../common/pipes/ws-validation.pipe';
import { socketUserData } from '../auth/socket-user';
import { FightClubService } from './fight-club.service';
import { FightCreateDto } from './dto/fight-create.dto';
import { FightHitDto } from './dto/fight-hit.dto';
import { FightJoinDto } from './dto/fight-join.dto';

@UseFilters(WsExceptionsFilter)
@UsePipes(wsValidationPipe)
@WebSocketGateway({ namespace: '/fight-club' })
export class FightClubGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(FightClubGateway.name);

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
    server.use(this.auth.middleware());
  }

  async handleConnection(client: Socket) {
    const user = socketUserData(client).user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    await client.join(`user:${user.userId}`);
    client.emit('fight:challenges', this.fightClubService.listChallenges());
  }

  @SubscribeMessage('fight:hit')
  async handleHit(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: FightHitDto,
  ) {
    const user = socketUserData(client).user;
    if (!user) return;
    const result = await this.fightClubService.handleHit(
      user.userId,
      client.id,
      payload,
      Date.now(),
    );
    if (result.kind === 'rejected') {
      this.logger.debug({
        event: 'fight.hit.rejected',
        matchId: payload.matchId,
        userId: user.userId,
        socketId: client.id,
        reason: result.reason,
      });
    } else if (result.kind === 'miss') {
      client.emit('fight:stun', { stunDuration: result.stunMs });
    } else if (result.kind === 'ko') {
      this.server.to(payload.matchId).emit('fight:update', result.update);
      this.server.to(payload.matchId).emit('fight:game_over', {
        winnerId: result.winnerId,
        loserId: result.loserId,
        stakeType: result.stakeType,
        stakeAmount: result.stakeAmount,
      });
    } else if (result.kind === 'hit') {
      this.server.to(payload.matchId).emit('fight:update', result.update);
    }
  }

  @SubscribeMessage('fight:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: FightJoinDto,
  ) {
    const user = socketUserData(client).user;
    if (!user) return;
    const state = this.fightClubService.joinMatch(user, client.id, payload);
    await client.join(payload.matchId);
    this.fightClubService.startMatch(payload.matchId);
    client.emit(
      'fight:state',
      this.fightClubService.getFightState(user.userId, payload.matchId) ??
        state,
    );
  }

  @SubscribeMessage('fight:create')
  handleCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: FightCreateDto,
  ) {
    const user = socketUserData(client).user;
    if (!user) return;
    const challenge = this.fightClubService.createMatch(
      user,
      client.id,
      payload,
    );
    this.server.emit(
      'fight:challenges',
      this.fightClubService.listChallenges(),
    );
    this.server.emit('fight:challenge_created', challenge);
    return challenge;
  }

  async handleDisconnect(client: Socket) {
    const userId = socketUserData(client).user?.userId;
    if (userId) {
      await this.fightClubService.handlePlayerDisconnect(userId, client.id);
    }
  }
}
