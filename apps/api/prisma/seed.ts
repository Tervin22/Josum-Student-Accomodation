import { PrismaClient } from '@prisma/client';
import { residenceCatalogue } from './residence-catalogue';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['../../.env.local', '../../.env', '.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}
const prisma = new PrismaClient();
async function main() {
  for (const name of ['STUDENT', 'ADMINISTRATOR', 'MANAGER', 'SECURITY', 'TECHNICIAN'] as const) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name, description: name.toLowerCase() } });
  }
  await prisma.$transaction(async tx => {
    for (const residence of residenceCatalogue) {
      const saved = await tx.residence.upsert({ where: { slug: residence.slug },
        create: { ...residence, totalRooms: 0, availableRooms: 0 }, update: {} });
      const category = await tx.roomType.upsert({ where: { roomTypeName: `${residence.name} - Residence room` },
        create: { roomTypeName: `${residence.name} - Residence room`, displayName: 'Residence room', residenceId: saved.id },
        update: {} });
      if (category.residenceId !== saved.id) throw new Error(`Room category is linked to the wrong residence: ${residence.name}`);
    }
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
