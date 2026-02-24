'use client';

import dynamic from 'next/dynamic';
import { features } from '@/config/features';

const Navbar = dynamic(() => import('@/components/Navbar').then(mod => ({ default: mod.Navbar })), {
  ssr: false,
  loading: () => <div className="h-16 bg-gray-900" />,
});

const Dashboard = dynamic(() => import('@/components/Dashboard').then(mod => ({ default: mod.Dashboard })), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-gray-900" />,
});

const MembershipPage = dynamic(() => import('@/components/MembershipPage').then(mod => ({ default: mod.MembershipPage })), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-gray-900" />,
});

const Footer = dynamic(() => import('@/components/Footer').then(mod => ({ default: mod.Footer })), {
  ssr: false,
});

export default function Home() {
  if (!features.showDashboard) {
    // Membership-only build: Navbar renders a minimal header (logo + wallet, no nav links)
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col" suppressHydrationWarning>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full min-w-0 overflow-hidden" suppressHydrationWarning>
          <MembershipPage />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col" suppressHydrationWarning>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full min-w-0 overflow-hidden" suppressHydrationWarning>
        <Dashboard />
      </main>
      <Footer />
    </div>
  );
}
