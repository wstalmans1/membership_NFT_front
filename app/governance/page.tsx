'use client';

import dynamic from 'next/dynamic';

const Navbar = dynamic(() => import('@/components/Navbar').then(mod => ({ default: mod.Navbar })), {
  ssr: false,
  loading: () => <div className="h-16 bg-gray-900" />,
});

const GovernancePage = dynamic(() => import('@/components/GovernancePage').then(mod => ({ default: mod.GovernancePage })), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-gray-900" />,
});

export default function Governance() {
  return (
    <div className="min-h-screen bg-gray-900" suppressHydrationWarning>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" suppressHydrationWarning>
        <GovernancePage />
      </main>
    </div>
  );
}

