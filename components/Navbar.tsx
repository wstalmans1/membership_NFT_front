'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from './WalletButton';
import { NetworkStatus } from './NetworkStatus';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/membership', label: 'Membership' },
  { href: '/governance', label: 'Governance' },
  { href: '/treasury', label: 'Treasury' },
  { href: '/constitution', label: 'Constitution' },
  { href: '/philosophy', label: 'Design Philosophy' },
  { href: '/getting-started', label: 'Getting Started' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="text-xl font-bold text-gray-900 dark:text-white">
              Qawl DAO
            </Link>
            {/* Desktop Navigation */}
            <div className="hidden lg:flex gap-4">
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
          
          {/* Right side: Wallet Button, Network Status, and Mobile Menu Button */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex sm:flex-col sm:items-center sm:justify-center sm:h-16 sm:gap-1">
              <WalletButton />
              <NetworkStatus />
            </div>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 py-4">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isPhilosophy = item.href === '/philosophy';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "block px-3 py-2 text-sm font-medium transition-colors rounded-md",
                      isPhilosophy
                        ? pathname === item.href
                          ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20"
                          : "text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        : pathname === item.href
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            {/* Mobile Wallet and Network Status */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
              <div className="sm:hidden">
                <NetworkStatus />
              </div>
              <div className="sm:hidden">
                <WalletButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}


