import { parseCorsOrigins, validateEnv } from './env.validation';

describe('validateEnv', () => {
  const required = {
    DATABASE_URL: 'postgres://localhost/chatix',
    JWT_SECRET: 'x'.repeat(32),
    CORS_ORIGINS: 'http://localhost:5173',
  };

  it('requires a strong JWT secret', () => {
    expect(() => validateEnv({ ...required, JWT_SECRET: undefined })).toThrow();
    expect(() => validateEnv({ ...required, JWT_SECRET: 'short' })).toThrow();
  });

  it('sets defaults and transforms values', () => {
    expect(validateEnv(required)).toMatchObject({
      LOG_LEVEL: 'info',
      MINIO_USE_SSL: false,
    });
    expect(
      validateEnv({ ...required, MINIO_USE_SSL: 'true' }).MINIO_USE_SSL,
    ).toBe(true);
  });
});

it('parses comma separated cors origins', () => {
  expect(parseCorsOrigins(' http://a.com, ,http://b.com ')).toEqual([
    'http://a.com',
    'http://b.com',
  ]);
});
