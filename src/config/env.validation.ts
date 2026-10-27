import { Transform, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvConfig {
  @Transform(({ value }) =>
    value === '' || value === undefined ? 3000 : Number(value),
  )
  @IsInt()
  @Min(1)
  PORT = 3000;
  @IsIn(['development', 'production', 'test']) NODE_ENV:
    | 'development'
    | 'production'
    | 'test' = 'development';
  @IsString() @MinLength(1) DATABASE_URL!: string;
  @IsString() @MinLength(32) JWT_SECRET!: string;
  @IsString() @MinLength(32) IP_TAG_SECRET!: string;
  @IsOptional() @IsString() TRUST_PROXY?: string;
  @IsOptional() @IsString() TRUSTED_IP_HEADER?: string;
  @IsString() @MinLength(1) CORS_ORIGINS!: string;
  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace']) LOG_LEVEL =
    'info';
  @IsString() MINIO_ENDPOINT = 'localhost';
  @Transform(({ value }) =>
    value === '' || value === undefined ? 9000 : Number(value),
  )
  @IsInt()
  @Min(1)
  MINIO_PORT = 9000;
  @IsString() @MinLength(1) MINIO_ACCESS_KEY!: string;
  @IsString() @MinLength(1) MINIO_SECRET_KEY!: string;
  @IsString() MINIO_BUCKET_NAME = 'chatix';
  @IsString() MINIO_PUBLIC_URL = 'http://localhost:9000';
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  MINIO_USE_SSL = false;
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  MINIO_PUBLIC_URL_HAS_BUCKET = false;
  @IsOptional() @IsString() MINIO_REGION?: string;
  @Transform(({ value }) =>
    value === undefined || value === '' ? true : value === true || value === 'true',
  )
  @IsBoolean()
  ROOMS_AUTO_APPROVE = true;
}

export type EnvConfigValues = InstanceType<typeof EnvConfig>;
export function validateEnv(raw: Record<string, unknown>): EnvConfigValues {
  const config = plainToInstance(EnvConfig, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length)
    throw new Error(
      errors
        .map(
          ({ property, constraints }) =>
            `${property}: ${Object.values(constraints ?? {}).join(', ')}`,
        )
        .join('; '),
    );
  return config;
}
export const parseCorsOrigins = (raw: string): string[] =>
  raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
import 'reflect-metadata';
