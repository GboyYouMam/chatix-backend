import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { parseCorsOrigins } from '../../config/env.validation';

export class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      cors: {
        ...options?.cors,
        origin: parseCorsOrigins(this.config.getOrThrow('CORS_ORIGINS')),
        credentials: true,
      },
    }) as Server;
  }
}
