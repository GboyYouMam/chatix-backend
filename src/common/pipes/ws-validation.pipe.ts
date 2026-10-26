import { ValidationPipe } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

export const wsValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) =>
    new WsException(
      errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .join('; '),
    ),
});
