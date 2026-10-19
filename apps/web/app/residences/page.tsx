'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  GraduationCap,
  HeartHandshake,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { api } from '@/lib/api';
import { BRAND_LOGO_URL, BRAND_NAME } from '@/lib/brand';
import type { Residence } from '@/lib/types';

const residenceImages: Record<string, string> = {
  'Josum 1': '/residences/josum-1.jpg',
  'Josum 2':
    'https://josumres.co.za/wp-content/uploads/2025/08/WhatsApp-Image-2025-07-24-at-15.53.57_d81d34d8.jpg',
};

const values = [
  { title: 'Community', body: 'We cultivate a sense of belonging and connection among residents.', icon: UsersRound },
  { title: 'Respect', body: 'We promote diversity, inclusivity, and mutual respect.', icon: HeartHandshake },
  { title: 'Academic Excellence', body: "We support students' academic pursuits and provide resources for success.", icon: GraduationCap },
  { title: 'Well-being', body: 'We prioritize physical, mental, and emotional well-being.', icon: ShieldCheck },
];

export default function ResidencesPage() {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Residence[]>('/residences')
      .then(setResidences)
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Could not load residences'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-3 py-3 sm:px-4">
          <Link href="/login" className="focus-ring flex min-w-0 items-center gap-3 rounded-md">
            <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={144} height={48} className="h-12 w-28 object-contain object-left sm:w-36" />
            <span className="hidden text-sm font-bold sm:block">{BRAND_NAME}</span>
          </Link>
          <Link
            href="/login?portal=student"
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Student login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-3 py-12 sm:px-4 sm:py-16">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase text-brand">Bedworth Park, Vereeniging</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">Josum Student Residence</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Welcome to Josum Student Residence, where we provide a safe, supportive, and stimulating environment for
              students to live, learn, and prosper.
            </p>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              Our spaces blend convenience with comfort through dedicated study areas, communal kitchens, social spaces,
              reliable security, backup utilities, and supportive staff. Students are not just residents; they are part
              of a community.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 py-10 sm:px-4 sm:py-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Choose your residence</h2>
            <p className="mt-1 text-sm text-slate-500">Compare live availability, facilities, and campus distances.</p>
          </div>
          <p className="text-sm text-slate-500">Complimentary shuttle access to NWU campus</p>
        </div>

        {loading && (
          <div className="grid min-h-64 place-items-center text-sm text-slate-500">
            <RefreshCw className="mb-3 h-5 w-5 animate-spin text-brand" />
            Loading residences
          </div>
        )}
        {error && <p className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {residences.map((residence) => (
            <article key={residence.id} className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
              <Image
                src={residenceImages[residence.name]}
                alt={`${residence.name} exterior`}
                width={1200}
                height={600}
                className="aspect-[16/8] w-full object-cover"
              />
              <div className="p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{residence.name}</h2>
                    <p className="mt-1 flex items-start gap-2 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      {residence.address}
                    </p>
                  </div>
                  <span className="w-fit rounded-full border border-brand/20 bg-teal-50 px-3 py-1 text-sm font-semibold text-brand">
                    {residence.availableRooms} available
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4 text-sm sm:grid-cols-4">
                  <p><span className="text-slate-500">Type</span><br /><strong>{residence.residenceType}</strong></p>
                  <p><span className="text-slate-500">Rooms</span><br /><strong>{residence.totalRooms} single</strong></p>
                  <p><span className="text-slate-500">NWU</span><br /><strong>{residence.distanceToNWU} km</strong></p>
                  <p><span className="text-slate-500">Shopping</span><br /><strong>{residence.distanceToShoppingCentre} km</strong></p>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <ResidenceList title="Facilities" items={residence.facilities} />
                  <ResidenceList title="Amenities" items={residence.amenities} limit={7} />
                </div>

                <Link
                  href={`/login?portal=student&residenceId=${encodeURIComponent(residence.id)}`}
                  className="focus-ring mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-700 sm:w-auto"
                >
                  Apply for this residence
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-3 py-10 sm:px-4 sm:py-14">
          <div className="flex items-center gap-3">
            <BookOpenCheck className="h-6 w-6 text-brand" />
            <h2 className="text-2xl font-bold">Our values</h2>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ title, body, icon: Icon }) => (
              <div key={title}>
                <Icon className="h-5 w-5 text-brand" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function ResidenceList({ title, items, limit }: { title: string; items: string[]; limit?: number }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase text-slate-500">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-slate-700">
        {items.slice(0, limit).map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
