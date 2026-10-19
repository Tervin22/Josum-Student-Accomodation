import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sharedAmenities = [
  'Backup power supply',
  'Backup power for Wi-Fi',
  'Fully equipped gas stoves',
  'Cleaning and caretaking staff',
  'Complimentary shuttle service for residents',
  'Study lounges and quiet areas',
  'Backup water supply',
  'Unlimited hot water with gas-powered geysers',
  'On-site laundry facilities',
  'Reliable 24-hour security',
  'Fully furnished rooms',
  'Recreational spaces',
  'Regular social events and activities',
];

const residences = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    name: 'Josum 1',
    address: '50 Cassandra Avenue, Bedworth Park, Vereeniging',
    residenceType: 'Mixed - boys and girls',
    totalRooms: 78,
    availableRooms: 78,
    description:
      'A welcoming mixed residence with furnished single rooms, dedicated study areas, communal living spaces, and reliable support services.',
    facilities: ['4 communal bathrooms', '3 communal kitchens', '2 TV rooms', '1 laundry room', '1 study room'],
    amenities: sharedAmenities,
    distanceToNWU: 3.6,
    distanceToShoppingCentre: 0.6,
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    name: 'Josum 2',
    address: '3 Ganymede Avenue, Bedworth Park, Vereeniging',
    residenceType: 'Girls only',
    totalRooms: 120,
    availableRooms: 120,
    description:
      'A secure girls-only residence with furnished single rooms, generous shared facilities, quiet study areas, and a multipurpose community space.',
    facilities: [
      '4 communal bathrooms',
      '4 communal kitchens',
      '2 TV rooms',
      '1 laundry room',
      '1 study room',
      '1 multipurpose room',
    ],
    amenities: sharedAmenities,
    distanceToNWU: 3.1,
    distanceToShoppingCentre: 0.95,
  },
];

async function main() {
  const roles = [
    { name: 'STUDENT', description: 'Student portal user' },
    { name: 'ADMINISTRATOR', description: 'System administrator' },
    { name: 'MANAGER', description: 'Residence manager' },
    { name: 'SECURITY', description: 'Security staff' },
    { name: 'TECHNICIAN', description: 'Maintenance technician' },
  ] as const;

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  for (const residence of residences) {
    const existing = await prisma.residence.findUnique({ where: { id: residence.id } });
    await prisma.residence.upsert({
      where: { id: residence.id },
      create: residence,
      update: {
        ...residence,
        availableRooms: existing?.availableRooms ?? residence.availableRooms,
      },
    });
  }

  const roomSeed = residences.flatMap((residence) =>
    Array.from({ length: residence.totalRooms }, (_, index) => {
      const roomNumber = index + 1;
      return {
        residenceId: residence.id,
        roomNumber,
        name: `Room ${roomNumber}`,
        genderAllocation: residence.name === 'Josum 2' || roomNumber <= 50 ? 'Female' : 'Male',
        roomTypeName: 'Single Room',
        capacity: 1,
      };
    }),
  );
  await prisma.residenceRoom.createMany({ data: roomSeed, skipDuplicates: true });
  await prisma.residenceRoom.updateMany({
    data: { roomTypeName: 'Single Room', capacity: 1 },
  });
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
