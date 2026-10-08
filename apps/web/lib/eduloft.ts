export const EDULOFT_RESIDENCE_NAME = 'Eduloft Centurion';
export const EDULOFT_LOCATION = 'Eco Park, Centurion, Gauteng';
export const EDULOFT_CONTACT_EMAIL = 'apply@eduloft.co.za';
export const EDULOFT_STORAGE_SITE = 'EDULOFT_CENTURION';

export const EDULOFT_GALLERY_IMAGES = [
  {
    src: '/eduloft/eduloft-lounge.jpg',
    alt: 'Eduloft furnished student lounge',
  },
  {
    src: '/eduloft/eduloft-study-lounge.jpg',
    alt: 'Eduloft student study lounge',
  },
  {
    src: '/eduloft/eduloft-reception.jpg',
    alt: 'Eduloft reception and access area',
  },
] as const;

export const EDULOFT_ROOM_OPTIONS = [
  {
    name: 'The Nook',
    layout: '1 bed, 1 bath',
    rateLabel: 'R6 250 pm',
    sizeLabel: '17 sqm',
    image: '/eduloft/eduloft-nook.webp',
    description:
      'A compact, self-contained student unit designed for focused study, rest, and daily independence.',
    highlights: ['Private room', 'Bed and mattress', 'Fridge, kettle and microwave', '50-inch TV'],
  },
  {
    name: 'The Studio',
    layout: '2 bed, 1 bath',
    rateLabel: 'R5 690 pp',
    sizeLabel: '31 sqm',
    image: '/eduloft/eduloft-studio.webp',
    description:
      'A shared two-bedroom student apartment with practical study and living zones for balanced student life.',
    highlights: ['Shared apartment', 'Modern layout', 'Essential furnishings', 'Free internet connectivity'],
  },
  {
    name: 'The Quarter',
    layout: '1 bed, 1 bath',
    rateLabel: 'R9 590 pm',
    sizeLabel: '26 sqm',
    image: '/eduloft/eduloft-quarter.webp',
    description:
      'A limited premium option with more room to breathe, modern finishes, and a comfortable private setup.',
    highlights: ['Limited rooms', 'Private apartment', 'Premium finishes', 'Secure and connected'],
  },
  {
    name: 'The Loft',
    layout: '1 bed, 1 bath',
    rateLabel: 'R9 990 pm',
    sizeLabel: '26 sqm',
    image: '/eduloft/eduloft-loft.webp',
    description:
      'Eduloft’s top-tier student living option, built around privacy, generous space, and refined finishes.',
    highlights: ['Limited rooms', 'Premium apartment', 'Smart design', 'Privacy and comfort'],
  },
] as const;

export const EDULOFT_FEATURES = [
  'Private student rooms across advertised apartment categories',
  'Facial biometric access control',
  '24-hour security',
  'CCTV surveillance and analytics',
  'Free internet connectivity',
  'Smart metering',
  'Serviced laundromat',
  'Generator support for essential services',
] as const;

export const EDULOFT_NEARBY = [
  ['Gautrain Bus Stop', '0.4 km'],
  ['Eco Boulevard Shopping Centre', '2.9 km'],
  ['Virgin Active Eco Park', '2.9 km'],
  ['Medi-Clinic Hospital', '3.9 km'],
  ['Centurion Mall', '5.1 km'],
  ['Gautrain Centurion Station', '5.5 km'],
] as const;
