'use client';

import { notFound } from 'next/navigation';
import { features } from '@/config/features';
import { ExtendedOnly } from '@/components/ExtendedOnly';

import dynamic from 'next/dynamic';

const Navbar = dynamic(() => import('@/components/Navbar').then(mod => ({ default: mod.Navbar })), {
  ssr: false,
  loading: () => <div className="h-16 bg-gray-900" />,
});

const ConstitutionPage = dynamic(() => import('@/components/ConstitutionPage').then(mod => ({ default: mod.ConstitutionPage })), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-gray-900" />,
});

const Footer = dynamic(() => import('@/components/Footer').then(mod => ({ default: mod.Footer })), {
  ssr: false,
});

export default function Constitution() {
  if (!features.showConstitution) notFound();
  return (
    <ExtendedOnly>
      <div className="min-h-screen bg-gray-900 flex flex-col" suppressHydrationWarning>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full min-w-0 overflow-hidden" suppressHydrationWarning>
          <ConstitutionPage />
        </main>
        <Footer />
      </div>
    </ExtendedOnly>
  );
}

