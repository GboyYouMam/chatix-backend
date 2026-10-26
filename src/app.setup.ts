import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfiguredIoAdapter } from './common/adapters/configured-io.adapter';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import { parseCorsOrigins } from './config/env.validation';
export function configureApp(
  app: INestApplication,
  config: ConfigService,
): void {
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
