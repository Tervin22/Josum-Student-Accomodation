'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2, ChevronLeft, ChevronRight, ExternalLink, Mail, MapPin, Phone, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { Residence } from '@/lib/types';

export default function ResidencesPage() {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slides, setSlides] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<{ residence: Residence; index: number } | null>(null);
  const closePreviewRef = useRef<HTMLButtonElement>(null);
  function load() {
    setLoading(true); setError('');
    api<Residence[]>('/residences').then(setResidences)
      .catch(error => setError(error instanceof Error ? error.message : 'Could not load residences'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!preview) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closePreviewRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null);
      if (event.key === 'Tab') { event.preventDefault(); closePreviewRef.current?.focus(); }
    };
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [preview]);
  function move(residence: Residence, delta: number) {
    setSlides(current => ({ ...current, [residence.id]: ((current[residence.id] ?? 0) + delta + residence.imageUrls!.length) % residence.imageUrls!.length }));
  }
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/residences" className="focus-ring flex items-center gap-2 text-sm font-semibold"><Building2 className="h-5 w-5 text-brand" />Student Residence Portal</Link>
          <Link href="/login" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-brand">Sign in <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Botlogile, Mohunathagi and Roma</h1>
        <p className="mt-2 text-sm text-slate-600">Choose the residence you want to apply to.</p>
        {loading && <p role="status" className="mt-8 flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />Loading residences</p>}
        {error && <div role="alert" className="mt-6 flex items-center gap-3 text-sm text-red-700">{error}<button title="Retry" aria-label="Retry" onClick={load} className="focus-ring p-2"><RefreshCw className="h-4 w-4" /></button></div>}
        {!loading && !error && !residences.length && <p className="mt-6 text-sm">No residences are currently listed.</p>}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          {residences.map(residence => {
            const images = residence.imageUrls ?? [];
            const index = slides[residence.id] ?? 0;
            return <article key={residence.id} className="overflow-hidden rounded-lg border border-line bg-white">
              {images.length > 0 && <div className="relative aspect-[3/2] w-full bg-slate-100">
                <button className="focus-ring relative block h-full w-full" aria-label={`View ${residence.name} photograph`} title={`View ${residence.name} photograph`} onClick={() => setPreview({ residence, index })}>
                  <Image src={images[index]} alt={`${residence.name} accommodation photograph ${index + 1}`} fill unoptimized sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
                </button>
                {images.length > 1 && <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                  <button onClick={() => move(residence, -1)} title="Previous photograph" aria-label={`Previous photograph of ${residence.name}`} className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-white"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="rounded-md bg-white px-2 py-1 text-xs">{index + 1} / {images.length}</span>
                  <button onClick={() => move(residence, 1)} title="Next photograph" aria-label={`Next photograph of ${residence.name}`} className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-white"><ChevronRight className="h-4 w-4" /></button>
                </div>}
              </div>}
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="text-xl font-bold">{residence.name}</h2><p className="mt-1 text-sm text-slate-600">{residence.residenceType}</p></div>
                  {residence.logoUrl && <Image src={residence.logoUrl} alt={`${residence.name} logo`} width={140} height={56} unoptimized className="h-14 w-32 object-contain" />}
                </div>
                <p className="mt-4 flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{residence.address}</p>
                <p className="mt-3 text-sm leading-6">{residence.description}</p>
                <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-line py-4 text-sm">
                  <div><dt className="text-slate-500">Published capacity</dt><dd className="mt-1 font-semibold">{residence.advertisedCapacity ?? 'Not published'}</dd></div>
                  <div><dt className="text-slate-500">Confirmed available rooms</dt><dd className="mt-1 font-semibold">{residence.totalRooms ? residence.availableRooms : 'Awaiting room setup'}</dd></div>
                  <div><dt className="text-slate-500">Male capacity</dt><dd className="mt-1">{residence.maleCapacity ?? 'Not published'}</dd></div>
                  <div><dt className="text-slate-500">Female capacity</dt><dd className="mt-1">{residence.femaleCapacity ?? 'Not published'}</dd></div>
                </dl>
                <h3 className="mt-4 text-sm font-semibold">Eligible institutions</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{residence.allowedInstitutions?.join(', ')}</p>
                <h3 className="mt-4 text-sm font-semibold">Facilities</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{residence.amenities.join(', ')}</p>
                <div className="mt-4 grid gap-2 border-t border-line pt-4 text-sm">
                  {residence.applicationEmail && <a href={`mailto:${residence.applicationEmail}`} className="focus-ring flex items-start gap-2 text-brand"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-all">{residence.applicationEmail}</span></a>}
                  {residence.phone && <a href={`tel:${residence.phone.replace(/\s/g, '')}`} className="focus-ring flex items-center gap-2 text-slate-600"><Phone className="h-4 w-4 shrink-0" />{residence.phone}</a>}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  {residence.acceptingApplications !== false ? <Link href={`/login?portal=student&residenceId=${encodeURIComponent(residence.id)}`} className="focus-ring inline-flex min-h-11 max-w-full items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Apply to {residence.name}<ArrowRight className="h-4 w-4 shrink-0" /></Link> : <span className="text-sm text-slate-500">Applications closed</span>}
                  {residence.websiteUrl && <a href={residence.websiteUrl} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-1 text-sm text-brand">Residence website<ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
              </div>
            </article>;
          })}
        </div>
      </section>
      {preview && <div role="dialog" aria-modal="true" aria-label={`${preview.residence.name} photograph`} className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4" onClick={() => setPreview(null)}>
        <button ref={closePreviewRef} title="Close photograph" aria-label="Close photograph" className="focus-ring absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-md bg-white" onClick={() => setPreview(null)}><X className="h-5 w-5" /></button>
        <div className="relative h-[85dvh] w-full" onClick={event => event.stopPropagation()}><Image src={preview.residence.imageUrls![preview.index]} alt={`${preview.residence.name} full photograph`} fill unoptimized className="object-contain" /></div>
      </div>}
    </main>
  );
}
