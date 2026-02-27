'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { WalletButton } from './WalletButton';
import { NetworkStatus } from './NetworkStatus';
import { Menu, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { versionSwitch } from '@/config/features';
import { useFeatures } from '@/hooks/useFeatures';
import { useViewMode } from '@/contexts/ViewModeContext';

const allNavItems = [
  { href: '/',             label: 'Dashboard',   featureKey: 'showDashboard'   },
  { href: '/membership',   label: 'Membership',  featureKey: null              }, // always shown
  { href: '/community',    label: 'Community',   featureKey: 'showCommunity'   },
  { href: '/governance',   label: 'Governance',  featureKey: 'showGovernance'  },
  { href: '/treasury',     label: 'Treasury',    featureKey: 'showTreasury'    },
  { href: '/constitution', label: 'Constitution',featureKey: 'showConstitution'},
] as const;

const allMoreMenuItems = [
  { href: '/dao-architecture', label: 'DAO Architecture' },
  { href: '/philosophy',       label: 'Design Philosophy' },
  { href: '/trilemma',         label: 'Blockchain Nation Trilemma' },
  { href: '/getting-started',  label: 'Getting Started Guide' },
];

/** Subtle text-link toggle sitting just below the logo */
function ViewModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useViewMode();

  return (
    <div className={cn('flex items-center gap-1 text-[10px] leading-none', className)}>
      <button
        onClick={() => setMode('community')}
        className={cn(
          'transition-colors whitespace-nowrap',
          mode === 'community'
            ? 'text-blue-500 dark:text-blue-400 font-medium'
            : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400',
        )}
      >
        community
      </button>
      <span className="text-gray-300 dark:text-gray-700 select-none">·</span>
      <button
        onClick={() => setMode('full')}
        className={cn(
          'transition-colors whitespace-nowrap',
          mode === 'full'
            ? 'text-blue-500 dark:text-blue-400 font-medium'
            : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400',
        )}
      >
        extended dao
      </button>
    </div>
  );
}

export function Navbar() {
  const features = useFeatures();
  const { canToggle } = useViewMode();
  const pathnameFromHook = usePathname();
  const router = useRouter();
  const [pathname, setPathname] = useState(pathnameFromHook || '/');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Compute visible nav items reactively from feature flags
  const navItems = allNavItems.filter(item =>
    item.featureKey === null ? true : features[item.featureKey as keyof typeof features],
  );
  const moreMenuItems = features.showMorePages ? allMoreMenuItems : [];

  // Sync pathname from window.location for static builds
  useEffect(() => {
    const updatePathname = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname.replace(/\/$/, '') || '/';
        setPathname(path);
      } else if (pathnameFromHook) {
        setPathname(pathnameFromHook);
      }
    };

    updatePathname();
    window.addEventListener('popstate', updatePathname);
    return () => window.removeEventListener('popstate', updatePathname);
  }, [pathnameFromHook]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    if (moreMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  useEffect(() => { setMoreMenuOpen(false); }, [pathname]);

  // --- Community build: minimal header (no full nav, external link to Extended DAO) ---
  if (!canToggle) {
    return (
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl text-white">
              <span className="font-bold">QAWL</span> <span className="text-base font-normal">DAO</span>
            </Link>
            <div className="flex gap-2">
              {navItems.map((item) => {
                const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                const normalizedHref = item.href.replace(/\/$/, '') || '/';
                const isActive = normalizedPathname === normalizedHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'text-blue-400 border-b-2 border-blue-400'
                        : 'text-gray-400 hover:text-white',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <a
              href={versionSwitch.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-full transition-colors"
            >
              {versionSwitch.label} ↗
            </a>
          </div>
          <div className="flex flex-col items-center justify-center h-16 gap-1">
            <WalletButton />
            <NetworkStatus />
          </div>
        </div>
      </header>
    );
  }

  // --- Full / single build: full navbar with inline toggle ---
  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4 md:gap-6">
            {/* Logo + view mode toggle stacked */}
            <div className="flex flex-col justify-center gap-0.5">
              <Link href="/" className="text-xl text-gray-900 dark:text-white leading-tight">
                <span className="font-bold">QAWL</span> <span className="text-base font-normal">DAO</span>
              </Link>
              {canToggle && <ViewModeToggle />}
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex gap-4 items-center">
              {navItems.map((item) => {
                const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                const normalizedHref = item.href.replace(/\/$/, '') || '/';
                const isActive = normalizedPathname === normalizedHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* More Menu Dropdown */}
              {moreMenuItems.length > 0 && (
                <div className="relative" ref={moreMenuRef}>
                  {(() => {
                    const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                    const isMoreMenuActive = moreMenuItems.some(
                      item => (item.href.replace(/\/$/, '') || '/') === normalizedPathname,
                    );
                    return (
                      <>
                        <button
                          onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                          className={cn(
                            'px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1',
                            isMoreMenuActive
                              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                          )}
                        >
                          More
                          <ChevronDown className={cn('w-4 h-4 transition-transform', moreMenuOpen && 'rotate-180')} />
                        </button>
                        {moreMenuOpen && (
                          <div className="absolute top-full left-0 mt-1 w-48 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                            <div className="py-1">
                              {moreMenuItems.map((item) => {
                                const normalizedHref = item.href.replace(/\/$/, '') || '/';
                                const isItemActive = (pathname.split('?')[0].replace(/\/$/, '') || '/') === normalizedHref;
                                return (
                                  <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMoreMenuOpen(false)}
                                    className={cn(
                                      'block px-4 py-2 text-sm transition-colors',
                                      isItemActive
                                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700',
                                    )}
                                  >
                                    {item.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 md:gap-3">
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
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 py-4">
            <div className="space-y-1">
              {navItems.map((item) => {
                const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                const normalizedHref = item.href.replace(/\/$/, '') || '/';
                const isActive = normalizedPathname === normalizedHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'block px-3 py-2 text-sm font-medium transition-colors rounded-md',
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}

              {/* More menu in mobile */}
              {moreMenuItems.length > 0 && (
                <div className="mt-2">
                  {(() => {
                    const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                    const isMoreMenuActive = moreMenuItems.some(
                      item => (item.href.replace(/\/$/, '') || '/') === normalizedPathname,
                    );
                    return (
                      <>
                        <button
                          onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors rounded-md',
                            isMoreMenuActive
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
                          )}
                        >
                          More
                          <ChevronDown className={cn('w-4 h-4 transition-transform', moreMenuOpen && 'rotate-180')} />
                        </button>
                        {moreMenuOpen && (
                          <div className="pl-4 mt-1 space-y-1">
                            {moreMenuItems.map((item) => {
                              const normalizedHref = item.href.replace(/\/$/, '') || '/';
                              const isItemActive = (pathname.split('?')[0].replace(/\/$/, '') || '/') === normalizedHref;
                              return (
                                <a
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => { setMobileMenuOpen(false); setMoreMenuOpen(false); }}
                                  className={cn(
                                    'block px-3 py-2 text-sm transition-colors rounded-md cursor-pointer',
                                    isItemActive
                                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800',
                                  )}
                                >
                                  {item.label}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* View mode toggle (mobile) */}
            {canToggle && (
              <div className="mt-3 px-3">
                <ViewModeToggle />
              </div>
            )}

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
