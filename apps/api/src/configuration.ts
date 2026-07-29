const required = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'PUBLIC_APP_URL',
  'WEB_ORIGIN',
];

export function validateEnvironment(config: Record<string, unknown>) {
  const missing = required.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const nodeEnv = String(config.NODE_ENV ?? 'development');
  if (nodeEnv === 'production') {
    validateProductionEnvironment(config);
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    API_PORT: Number(config.API_PORT ?? 4000),
    BCRYPT_ROUNDS: Number(config.BCRYPT_ROUNDS ?? 12),
    THROTTLE_TTL_MS: Number(config.THROTTLE_TTL_MS ?? 60000),
    THROTTLE_LIMIT: Number(config.THROTTLE_LIMIT ?? 120),
    APPLICATION_APPROVAL_EXPIRY_HOURS: Number(config.APPLICATION_APPROVAL_EXPIRY_HOURS ?? 72),
    MAINTENANCE_ACK_SLA_HOURS: Number(config.MAINTENANCE_ACK_SLA_HOURS ?? 24),
    MAINTENANCE_LOW_RESOLUTION_SLA_HOURS: Number(config.MAINTENANCE_LOW_RESOLUTION_SLA_HOURS ?? 48),
    MAINTENANCE_HIGH_RESOLUTION_SLA_HOURS: Number(config.MAINTENANCE_HIGH_RESOLUTION_SLA_HOURS ?? 12),
    MAINTENANCE_SLA_SWEEP_INTERVAL_MS: Number(config.MAINTENANCE_SLA_SWEEP_INTERVAL_MS ?? 300000),
    PAYMENT_REMINDER_SWEEP_INTERVAL_MS: Number(config.PAYMENT_REMINDER_SWEEP_INTERVAL_MS ?? 3600000),
    PAYMENT_REMINDER_BATCH_SIZE: Number(config.PAYMENT_REMINDER_BATCH_SIZE ?? 500),
    MAX_UPLOAD_BYTES: Number(config.MAX_UPLOAD_BYTES ?? 10485760),
    STORAGE_DRIVER: String(config.STORAGE_DRIVER ?? 'local'),
    LOCAL_STORAGE_PATH: String(config.LOCAL_STORAGE_PATH ?? 'uploads'),
    SMTP_PORT: Number(config.SMTP_PORT ?? 587),
    SMTP_SECURE: String(config.SMTP_SECURE ?? 'false') === 'true',
    S3_USE_IAM_ROLE: String(config.S3_USE_IAM_ROLE ?? 'false') === 'true',
    S3_FORCE_PATH_STYLE: String(config.S3_FORCE_PATH_STYLE ?? 'false') === 'true',
  };
}

function validateProductionEnvironment(config: Record<string, unknown>) {
  const secrets = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'INSTALLATION_ADMIN_TOKEN',
    'FACTORY_RESET_RECOVERY_KEY',
    'STAFF_MANAGER_REGISTRATION_KEY',
    'STAFF_SECURITY_REGISTRATION_KEY',
    'STAFF_TECHNICIAN_REGISTRATION_KEY',
  ];
  const invalidSecrets = secrets.filter((key) => {
    const value = String(config[key] ?? '');
    return value.length < 32 || /replace|change-me|example/i.test(value);
  });
  if (invalidSecrets.length) {
    throw new Error(`Production secrets must be unique, non-placeholder values of at least 32 characters: ${invalidSecrets.join(', ')}`);
  }
  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  const publicAppUrl = String(config.PUBLIC_APP_URL);
  const webOrigins = String(config.WEB_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!isHttpsUrl(publicAppUrl) || webOrigins.some((origin) => !isHttpsUrl(origin))) {
    throw new Error('PUBLIC_APP_URL and every WEB_ORIGIN must use HTTPS in production');
  }

  if (!config.SMTP_HOST || !config.SMTP_FROM) {
    throw new Error('SMTP_HOST and SMTP_FROM are required in production');
  }

  const storageDriver = String(config.STORAGE_DRIVER ?? 'local');
  if (!['local', 's3'].includes(storageDriver)) {
    throw new Error('STORAGE_DRIVER must be either local or s3');
  }
  if (storageDriver === 's3') {
    const useIamRole = String(config.S3_USE_IAM_ROLE ?? 'false') === 'true';
    const requiredS3 = useIamRole
      ? ['S3_BUCKET', 'S3_REGION']
      : ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
    const missingS3 = requiredS3.filter((key) => !config[key]);
    if (missingS3.length) {
      throw new Error(`Missing S3 production configuration: ${missingS3.join(', ')}`);
    }
  }
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
