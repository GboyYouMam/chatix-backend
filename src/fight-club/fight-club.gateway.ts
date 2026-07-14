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
import { JwtService } from '@nestjs/jwt';
import { FightClubService } from './fight-club.service';
import type { JoinFightPayload, FightJwtPayload } from './types/types';

@WebSocketGateway({
    namespace: 'fight-club',
    cors: { origin: '*' },
})
export class FightClubGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly fightClubService: FightClubService,
        private readonly jwtService: JwtService,
    ) {}

    afterInit(server: Server) {
        this.fightClubService.server = server;
    }

    async handleConnection(client: Socket) {
        try {
            const payload = await this.jwtService.verifyAsync<FightJwtPayload>(
                this.getToken(client),
            );
            client.data.userId = payload.sub;
        } catch {
            client.emit('fight:error', { message: 'FUH U ARE UNAUTHORIZED GET OUT' });
            client.disconnect(true);
        }
    }

    @SubscribeMessage('fight:hit')
    async handleHit(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { matchId: string; k: string },
    ) {
        const userId = client.data.userId;

        if (!userId || !payload.matchId || !payload.k) {
            client.emit('fight:error', {
                message: 'ayo how did u lost THAT important data, are we deadass????',
            });
            return;
        }

        await this.fightClubService.handleHit(client, payload.matchId, userId, payload.k);
    }

    @SubscribeMessage('fight:join')
    handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: Omit<JoinFightPayload, 'userId'>,
    ) {
        const userId = client.data.userId;

        if (!userId || !payload?.matchId) {
            client.emit('fight:error', { message: 'Missing game data' });
            return;
        }

        const joined = this.fightClubService.joinMatch(client, { ...payload, userId });
        if (joined) client.join(payload.matchId);
    }

    async handleDisconnect(client: Socket) {
        const userId = client.data?.userId;
        if (userId) {
            await this.fightClubService.handlePlayerDisconnect(userId);
        }
    }

    private getToken(client: Socket) {
        const authToken = client.handshake.auth?.token;
        const header = client.handshake.headers.authorization;
        const token = authToken || header?.replace(/^Bearer\s+/i, '');

        if (!token) throw new Error('Missing token');
        return token;
    }
}
