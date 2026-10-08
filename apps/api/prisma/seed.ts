import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const eduloftAmenities = [
  'Private student rooms',
  'Facial biometric access control',
  '24-hour security',
  'CCTV surveillance and analytics',
  'Free internet connectivity',
  'Smart metering',
  'Serviced laundromat',
  'Generator support for essential services',
  'Bed and mattress',
  'Fridge, kettle, microwave, and TV in advertised room categories',
];

const eduloftFacilities = [
  'On-site reception',
  'Student living apartments',
  'Shared lounge areas',
  'Study hall and clubhouse planned with phase 2',
  'Laundry services',
  'Access-controlled guardhouse',
];

const roomTypes = [
  { roomTypeName: 'The Nook - 1 bed, 1 bath', totalRooms: 0, availableRooms: 0 },
  { roomTypeName: 'The Studio - 2 bed, 1 bath', totalRooms: 0, availableRooms: 0 },
  { roomTypeName: 'The Quarter - 1 bed, 1 bath', totalRooms: 0, availableRooms: 0 },
  { roomTypeName: 'The Loft - 1 bed, 1 bath', totalRooms: 0, availableRooms: 0 },
];

const residences = [
  {
    id: '22222222-2222-4222-8222-222222222201',
    name: 'Eduloft Centurion',
    address: 'Eco Park, Centurion, Gauteng',
    residenceType: 'Student apartments',
    totalRooms: 0,
    availableRooms: 0,
    description:
      'Stylish, secure, and fully serviced student apartments in Eco Park, Centurion. Exact room and bed inventory must be configured by Eduloft administrators before approvals.',
    facilities: eduloftFacilities,
    amenities: eduloftAmenities,
    distanceToNWU: 0,
    distanceToShoppingCentre: 2.9,
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

  for (const roomType of roomTypes) {
    await prisma.roomType.upsert({
      where: { roomTypeName: roomType.roomTypeName },
      create: roomType,
      update: roomType,
    });
  }

  for (const residence of residences) {
    await prisma.residence.upsert({
      where: { id: residence.id },
      create: residence,
      update: residence,
    });
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
