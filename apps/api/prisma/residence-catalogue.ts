// Website capacities are advertised, not a verified numbered-room register.
const bot = 'https://botlogileres.co.za';
const roma = 'https://romares.co.za';
const nwu = 'NWU (Vaal Triangle)';
const vut = 'VUT (Vanderbijlpark)';
const sedibeng = 'Sedibeng College (Heidelberg)';
const botImages = ['botlogile-1.jpg', 'botlogile-bedroom.jpg', 'botlogile-kitchen.jpg'].map(file => `${bot}/wp-content/uploads/2026/09/${file}`);
const villageImages = ['m-village.jpg'].map(file => `${bot}/wp-content/uploads/2026/09/${file}`);
const amenities = ['Wi-Fi', '24-hour security', 'Study spaces', 'Shared kitchens', 'Laundry', 'Backup power', 'Hot water', 'Parking'];
const unconfirmedAddress = 'Vanderbijlpark - confirm street address with residence management';

export const residenceCatalogue = [
  { id: '22222222-2222-4222-8222-222222222201', slug: 'botlogile-1', name: 'Botlogile 1',
    address: unconfirmedAddress, residenceType: 'Mixed residence', allowedGenders: ['Male', 'Female'], maleCapacity: 58, femaleCapacity: 58,
    advertisedCapacity: 116, allowedInstitutions: [nwu, vut], websiteUrl: bot,
    applicationUrl: `${bot}/botlogile-application/`, applicationEmail: 'applications@botlogileres.co.za',
    logoUrl: `${bot}/wp-content/uploads/2026/09/Combined-Logos-cropped.png`, imageUrls: botImages,
    description: 'Mixed student accommodation serving NWU and VUT, with study spaces and shared residential facilities.' },
  { id: '22222222-2222-4222-8222-222222222202', slug: 'botlogile-2', name: 'Botlogile 2',
    address: unconfirmedAddress, residenceType: 'Mixed residence', allowedGenders: ['Male', 'Female'], maleCapacity: 46, femaleCapacity: 80,
    advertisedCapacity: 126, allowedInstitutions: [nwu, vut], websiteUrl: bot,
    applicationUrl: `${bot}/botlogile-application/`, applicationEmail: 'applications@botlogileres.co.za',
    logoUrl: `${bot}/wp-content/uploads/2026/09/Combined-Logos-cropped.png`, imageUrls: botImages,
    description: 'Student accommodation for male and female NWU and VUT applicants. Applications are reviewed for this location separately.' },
  { id: '22222222-2222-4222-8222-222222222203', slug: 'mohunathagi-north', name: 'Mohunathagi Village North',
    address: unconfirmedAddress, residenceType: 'Mixed residence', allowedGenders: ['Male', 'Female'], maleCapacity: 166, femaleCapacity: 334,
    advertisedCapacity: 500, allowedInstitutions: [nwu, vut, 'Westcol (Krugersdorp)', sedibeng], websiteUrl: bot,
    applicationUrl: `${bot}/mohunathagi-village-north/`, applicationEmail: 'applicationsMV1@mohunathagivillage.co.za',
    logoUrl: `${bot}/wp-content/uploads/2026/09/mohunatagi-logo-cropped.png`, imageUrls: villageImages,
    description: 'Mixed accommodation supporting the institutions listed on its application form, with communal living and study facilities.' },
  { id: '22222222-2222-4222-8222-222222222204', slug: 'mohunathagi-south', name: 'Mohunathagi Village South',
    address: unconfirmedAddress, residenceType: 'Female-only residence', allowedGenders: ['Female'], maleCapacity: 0, femaleCapacity: 291,
    advertisedCapacity: 291, allowedInstitutions: [nwu, vut], websiteUrl: bot,
    applicationUrl: `${bot}/mohunathagi-village-south/`, applicationEmail: 'applicationsMV2@mohunathagivillage.co.za',
    logoUrl: `${bot}/wp-content/uploads/2026/09/mohunatagi-logo-cropped.png`, imageUrls: villageImages,
    description: 'Female-only student accommodation for NWU and VUT applicants, with communal living and study facilities.' },
  { id: '22222222-2222-4222-8222-222222222205', slug: 'roma', name: 'Res Roma',
    address: '31 Borea Avenue, Bedworth Park, Vereeniging, 1939', residenceType: 'Female-only residence', allowedGenders: ['Female'], maleCapacity: 0, femaleCapacity: 204,
    advertisedCapacity: 204, allowedInstitutions: [nwu, vut, sedibeng], websiteUrl: roma,
    applicationUrl: `${roma}/res-roma-application/`, applicationEmail: 'applications@romares.co.za',
    logoUrl: `${roma}/wp-content/uploads/2026/09/roma-logo-Cropped.png`,
    imageUrls: ['exterior-1.jpg', 'common-lounge.jpg', 'entrance.jpg'].map(file => `${roma}/wp-content/uploads/2026/09/${file}`),
    description: 'Female student residence in Bedworth Park, with study areas, a gym and shared residential facilities.' },
].map(residence => ({ ...residence, active: true, acceptingApplications: true, phone: '+27 11 913 8323',
  facilities: residence.slug === 'roma' ? ['Study areas', 'Gym', 'Communal kitchens', 'Laundry'] : ['Study areas', 'Communal kitchens', 'Lounges', 'Laundry'],
  amenities, distanceToNWU: null, distanceToShoppingCentre: null,
}));
