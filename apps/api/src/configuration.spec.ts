import { validateEnvironment } from './configuration';

const strongSecret = (char: string) => char.repeat(40);

const developmentConfig = {
  DATABASE_URL: 'postgresql://josum:josum@localhost:5432/josum',
  JWT_ACCESS_SECRET: strongSecret('a'),
  JWT_REFRESH_SECRET: strongSecret('b'),
  PUBLIC_APP_URL: 'http://localhost:3000',
  WEB_ORIGIN: 'http://localhost:3000',
};

const productionConfig = {
  ...developmentConfig,
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: strongSecret('c'),
  JWT_REFRESH_SECRET: strongSecret('d'),
  INSTALLATION_ADMIN_TOKEN: strongSecret('e'),
  FACTORY_RESET_RECOVERY_KEY: strongSecret('f'),
  STAFF_MANAGER_REGISTRATION_KEY: strongSecret('m'),
  STAFF_SECURITY_REGISTRATION_KEY: strongSecret('s'),
  STAFF_TECHNICIAN_REGISTRATION_KEY: strongSecret('t'),
  PUBLIC_APP_URL: 'https://portal.example.com',
  WEB_ORIGIN: 'https://portal.example.com,https://admin.example.com',
  SMTP_HOST: 'smtp.example.com',
  SMTP_FROM: 'Josum <noreply@example.com>',
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'josum-documents',
  S3_REGION: 'af-south-1',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key',
};

describe('validateEnvironment', () => {
  it('requires the base runtime configuration', () => {
    expect(() =>
      validateEnvironment({
        ...developmentConfig,
        DATABASE_URL: '',
      }),
    ).toThrow('Missing required environment variables: DATABASE_URL');
  });

  it('normalizes development defaults', () => {
    expect(validateEnvironment(developmentConfig)).toMatchObject({
      NODE_ENV: 'development',
      API_PORT: 4000,
      BCRYPT_ROUNDS: 12,
      THROTTLE_TTL_MS: 60000,
      THROTTLE_LIMIT: 120,
      APPLICATION_APPROVAL_EXPIRY_HOURS: 72,
      MAINTENANCE_ACK_SLA_HOURS: 24,
      MAINTENANCE_LOW_RESOLUTION_SLA_HOURS: 48,
      MAINTENANCE_HIGH_RESOLUTION_SLA_HOURS: 12,
      MAINTENANCE_SLA_SWEEP_INTERVAL_MS: 300000,
      PAYMENT_REMINDER_SWEEP_INTERVAL_MS: 3600000,
      PAYMENT_REMINDER_BATCH_SIZE: 500,
      MAX_UPLOAD_BYTES: 10485760,
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_PATH: 'uploads',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      S3_USE_IAM_ROLE: false,
      S3_FORCE_PATH_STYLE: false,
    });
  });

  it('accepts complete production configuration', () => {
    expect(validateEnvironment(productionConfig)).toMatchObject({
      NODE_ENV: 'production',
      STORAGE_DRIVER: 's3',
      SMTP_HOST: 'smtp.example.com',
      S3_BUCKET: 'josum-documents',
    });
  });

  it('rejects weak or placeholder production secrets', () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        JWT_ACCESS_SECRET: 'change-me',
      }),
    ).toThrow('Production secrets must be unique, non-placeholder values of at least 32 characters: JWT_ACCESS_SECRET');
  });

  it('rejects reused JWT secrets in production', () => {
    const reusedSecret = strongSecret('g');

    expect(() =>
      validateEnvironment({
        ...productionConfig,
        JWT_ACCESS_SECRET: reusedSecret,
        JWT_REFRESH_SECRET: reusedSecret,
      }),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  });

  it('requires strong staff registration keys in production', () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        STAFF_SECURITY_REGISTRATION_KEY: 'replace-me',
      }),
    ).toThrow(
      'Production secrets must be unique, non-placeholder values of at least 32 characters: STAFF_SECURITY_REGISTRATION_KEY',
    );
  });

  it('requires HTTPS public URLs in production', () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        PUBLIC_APP_URL: 'http://portal.example.com',
      }),
    ).toThrow('PUBLIC_APP_URL and every WEB_ORIGIN must use HTTPS in production');
  });

  it('requires SMTP details in production', () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        SMTP_HOST: '',
      }),
    ).toThrow('SMTP_HOST and SMTP_FROM are required in production');
  });

  it('requires S3 details when S3 storage is selected in production', () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        S3_BUCKET: '',
      }),
    ).toThrow('Missing S3 production configuration: S3_BUCKET');
  });

  it('accepts production S3 storage through an AWS IAM task role', () => {
    const iamRoleConfig: Record<string, unknown> = { ...productionConfig };
    delete iamRoleConfig.S3_ACCESS_KEY_ID;
    delete iamRoleConfig.S3_SECRET_ACCESS_KEY;

    expect(
      validateEnvironment({
        ...iamRoleConfig,
        S3_USE_IAM_ROLE: 'true',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      STORAGE_DRIVER: 's3',
      S3_USE_IAM_ROLE: true,
      S3_BUCKET: 'josum-documents',
    });
  });

  it('requires S3 access keys when IAM role storage is not enabled', () => {
    expect(() =>
      validateEnvironment({
        ...productionConfig,
        S3_ACCESS_KEY_ID: '',
      }),
    ).toThrow('Missing S3 production configuration: S3_ACCESS_KEY_ID');
  });
});
