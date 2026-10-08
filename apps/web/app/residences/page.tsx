'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { BRAND_LOGO_URL, BRAND_NAME } from '@/lib/brand';
import {
  EDULOFT_CONTACT_EMAIL,
  EDULOFT_FEATURES,
  EDULOFT_LOCATION,
  EDULOFT_NEARBY,
  EDULOFT_ROOM_OPTIONS,
} from '@/lib/eduloft';
import type { Residence } from '@/lib/types';

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
            <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={168} height={48} className="h-12 w-32 object-contain object-left sm:w-40" />
            <span className="hidden text-sm font-bold sm:block">{BRAND_NAME}</span>
          </Link>
          <Link
            href="/login?portal=student"
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-ink hover:bg-amber-400"
          >
            Student login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-3 py-10 sm:px-4 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase text-brand">Student living, elevated</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">Eduloft Centurion student accommodation</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Stylish, secure, and fully serviced student apartments in Eco Park, Centurion. The public intake flow
              captures student interest, documents, and preferred Eduloft room category for staff review.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-700">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1">
                <MapPin className="h-4 w-4 text-brand" />
                {EDULOFT_LOCATION}
              </span>
              <a href={`mailto:${EDULOFT_CONTACT_EMAIL}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 font-semibold text-ink hover:border-brand">
                <Mail className="h-4 w-4 text-brand" />
                {EDULOFT_CONTACT_EMAIL}
              </a>
            </div>
          </div>
          <Image
            src="/eduloft/eduloft-common-areas.jpg"
            alt="Eduloft shared student living areas"
            width={1100}
            height={620}
            priority
            className="aspect-[16/10] w-full rounded-lg object-cover shadow-soft"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 py-10 sm:px-4 sm:py-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Verified public room categories</h2>
            <p className="mt-1 text-sm text-slate-500">Rates and layouts are taken from Eduloft public pages; live room allocation remains staff-managed.</p>
          </div>
          <Link href="/login?portal=student" className="focus-ring inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-black">
            Apply online
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {EDULOFT_ROOM_OPTIONS.map((room) => (
            <article key={room.name} className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
              <Image src={room.image} alt={`${room.name} apartment`} width={760} height={520} className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">{room.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{room.layout} - {room.sizeLabel}</p>
                  </div>
                  <span className="rounded-full bg-brand px-3 py-1 text-sm font-bold text-ink">{room.rateLabel}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{room.description}</p>
                <ul className="mt-4 grid gap-2 text-sm text-slate-700">
                  {room.highlights.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-3 py-10 sm:px-4 sm:py-14 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-brand" />
              <h2 className="text-2xl font-bold">Security, services, and student support</h2>
            </div>
            <ul className="mt-6 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              {EDULOFT_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <BookOpenCheck className="h-6 w-6 text-brand" />
              <h2 className="text-2xl font-bold">Nearby places</h2>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {EDULOFT_NEARBY.map(([name, distance]) => (
                <div key={name} className="rounded-lg border border-line bg-paper p-4">
                  <p className="text-sm font-semibold text-ink">{name}</p>
                  <p className="mt-1 text-sm text-slate-500">{distance}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 py-10 sm:px-4 sm:py-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">System residence intake</h2>
            <p className="mt-1 text-sm text-slate-500">The seed keeps actual inventory unassigned until administrators confirm capacity.</p>
          </div>
          {loading && (
            <span className="inline-flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin text-brand" />
              Loading live records
            </span>
          )}
        </div>
        {error && <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {residences.map((residence) => (
            <article key={residence.id} className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold">{residence.name}</h3>
                  <p className="mt-1 flex items-start gap-2 text-sm text-slate-600">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {residence.address}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-brand/40 bg-amber-50 px-3 py-1 text-sm font-semibold text-ink">
                  {residence.availableRooms > 0 ? `${residence.availableRooms} available` : 'Inventory pending'}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{residence.description}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4 text-sm sm:grid-cols-4">
                <p><span className="text-slate-500">Type</span><br /><strong>{residence.residenceType}</strong></p>
                <p><span className="text-slate-500">Rooms</span><br /><strong>{residence.totalRooms || 'Pending'}</strong></p>
                <p><span className="text-slate-500">Campus</span><br /><strong>Nearby</strong></p>
                <p><span className="text-slate-500">Shopping</span><br /><strong>{residence.distanceToShoppingCentre} km</strong></p>
              </div>
              <Link
                href={`/login?portal=student&residenceId=${encodeURIComponent(residence.id)}`}
                className="focus-ring mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-ink hover:bg-amber-400 sm:w-auto"
              >
                Apply for Eduloft
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-ink text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-3 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-brand">
              <Sparkles className="h-4 w-4" />
              Professional Eduloft application portal
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Students can apply and upload documents online; staff retain final review, room assignment, and policy confirmation.
            </p>
          </div>
          <Link href="/login?portal=student" className="focus-ring inline-flex h-11 w-fit items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-ink hover:bg-paper">
            Start application
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
