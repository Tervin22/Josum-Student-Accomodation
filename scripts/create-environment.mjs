import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';

const mode = process.argv[2] || 'local';
const files = { local: ['.env.local.example', '.env.local'], docker: ['.env.example', '.env'], production: ['.env.production.example', '.env.production'] };
if (!files[mode]) throw new Error('Choose local, docker or production');
const [template, destination] = files[mode];
if (fs.existsSync(destination)) throw new Error(`${destination} already exists. Existing credentials were not changed.`);
const values = parseEnv(fs.readFileSync(template, 'utf8'));
for (const key of ['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','INSTALLATION_ADMIN_TOKEN','FACTORY_RESET_RECOVERY_KEY','STAFF_MANAGER_REGISTRATION_KEY','STAFF_SECURITY_REGISTRATION_KEY','STAFF_TECHNICIAN_REGISTRATION_KEY']) {
  values[key] = randomBytes(32).toString('hex');
}
if (mode !== 'production') {
  values.POSTGRES_PASSWORD = randomBytes(24).toString('hex');
  const url = new URL(values.DATABASE_URL);
  url.password = values.POSTGRES_PASSWORD;
  values.DATABASE_URL = url.href;
}
fs.writeFileSync(destination, Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Created private ${destination}. Configure the database, SMTP and storage before use. No secret values were printed.`);
