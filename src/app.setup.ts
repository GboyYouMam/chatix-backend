import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfiguredIoAdapter } from './common/adapters/configured-io.adapter';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import { parseCorsOrigins } from './config/env.validation';
export function configureApp(
  app: INestApplication & { set(key: string, value: unknown): void },
  config: ConfigService,
): void {
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) {
    const hops = trustProxy.split(',').map((value) => value.trim());
    app.set(
      'trust proxy',
      hops.length === 1 && /^\d+$/.test(hops[0]) ? Number(hops[0]) : hops,
    );
  }
  app.use(helmet());
  app.enableCors({
    origin: parseCorsOrigins(config.getOrThrow('CORS_ORIGINS')),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, config));
}
