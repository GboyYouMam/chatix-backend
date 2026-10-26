import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfiguredIoAdapter } from './common/adapters/configured-io.adapter';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
export function configureApp(
  app: INestApplication,
  config: ConfigService,
): void {
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
