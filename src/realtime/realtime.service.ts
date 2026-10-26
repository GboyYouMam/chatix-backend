import { Injectable } from '@nestjs/common';
import { Namespace, Server } from 'socket.io';
@Injectable()
export class RealtimeService {
  private readonly servers = new Map<string, Namespace | Server>();
  register(
    namespace: '/' | '/fight-club' | '/admin',
    server: Namespace | Server,
  ) {
    this.servers.set(namespace, server);
  }
  emitToUser(id: string, event: string, payload: unknown) {
    this.servers.get('/')?.to(`user:${id}`).emit(event, payload);
  }
  emitToAdmins(event: string, payload: unknown) {
    this.servers.get('/admin')?.to('admins').emit(event, payload);
  }
  emitToRoom(id: string, event: string, payload: unknown) {
    this.servers.get('/')?.to(id).emit(event, payload);
  }
  disconnectUser(id: string) {
    for (const server of this.servers.values())
      server.in(`user:${id}`).disconnectSockets(true);
  }
}
