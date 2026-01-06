'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from './WalletButton';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/membership', label: 'Membership' },
  { href: '/governance', label: 'Governance' },
  { href: '/treasury', label: 'Treasury' },
  { href: '/constitution', label: 'Constitution' },
  { href: '/philosophy', label: 'Design Philosophy' },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
              Qawl DAO
            </Link>
            <div className="flex gap-4">
              {navItems.map((item) => {
                const isPhilosophy = item.href === '/philosophy';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3 py-2 text-sm font-medium transition-colors",
                      isPhilosophy
                        ? pathname === item.href
                          ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400"
                          : "text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
                        : pathname === item.href
                          ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}

