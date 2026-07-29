import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
    seed: 'ts-node apps/api/prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
