import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.resolve(root, process.argv[2] || '.env.production');
try {
  const config = parseEnv(fs.readFileSync(file, 'utf8'));
  const require = createRequire(path.join(root, 'apps/api/package.json'));
  const { validateEnvironment } = require(path.join(root, 'apps/api/dist/configuration.js'));
  validateEnvironment({ ...config, NODE_ENV: 'production' });
  const invalid = [];
  for (const key of ['PUBLIC_APP_URL', 'NEXT_PUBLIC_API_URL']) {
    try {
      const url = new URL(config[key]);
      if (url.protocol !== 'https:' || /localhost|example|yourdomain/i.test(url.hostname)) invalid.push(key);
    } catch { invalid.push(key); }
  }
  if (config.STORAGE_DRIVER !== 's3') invalid.push('STORAGE_DRIVER (managed-hosting baseline requires private S3-compatible storage)');
  if (!config.SMTP_FROM || /example|yourdomain|replace/i.test(`${config.SMTP_FROM} ${config.SMTP_HOST}`)) invalid.push('SMTP_HOST / SMTP_FROM');
  if (!config.DATABASE_URL || /REPLACE|PASSWORD|YOUR_HOST/i.test(config.DATABASE_URL)) invalid.push('DATABASE_URL');
  if (invalid.length) throw new Error(`Production values still need configuration: ${invalid.join(', ')}`);
  console.log('Production environment structure passes. DNS, TLS, mailbox delivery, storage permissions and restore testing still require operator acceptance.');
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'Build the API and provide a private production environment file before running this check.' : String(error.message));
  process.exitCode = 1;
}
