import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
try {
  const locations = await prisma.residence.findMany();
  assert.equal(locations.length, 5);
  assert.ok(locations.every(location => location.slug && location.active));
  assert.equal(await prisma.user.count(), 0);
  assert.equal(await prisma.application.count(), 0);
  assert.equal(await prisma.residenceRoom.count(), 0);
  assert.equal(await prisma.roomType.count(), 5);
  console.log('Clean starter verified: five locations, five categories, no accounts, applications or invented room inventory.');
} finally { await prisma.$disconnect(); }
