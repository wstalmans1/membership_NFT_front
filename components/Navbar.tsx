'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from './WalletButton';
import { NetworkStatus } from './NetworkStatus';
import { Menu, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/membership', label: 'Membership' },
  { href: '/governance', label: 'Governance' },
  { href: '/treasury', label: 'Treasury' },
  { href: '/constitution', label: 'Constitution' },
];

const moreMenuItems = [
  { href: '/dao-architecture', label: 'DAO Architecture' },
  { href: '/philosophy', label: 'Design Philosophy' },
  { href: '/getting-started', label: 'Getting Started Guide' },
];

export function Navbar() {
  const pathnameFromHook = usePathname();
  const [pathname, setPathname] = useState(pathnameFromHook || '/');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  
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
    
    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', updatePathname);
    
    return () => {
      window.removeEventListener('popstate', updatePathname);
    };
  }, [pathnameFromHook]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }

    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moreMenuOpen]);

  // Close dropdown when pathname changes
  useEffect(() => {
    setMoreMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="text-xl text-gray-900 dark:text-white">
              <span className="font-bold">QAWL</span> <span className="text-base font-normal">DAO</span>
            </Link>
            {/* Desktop Navigation */}
            <div className="hidden lg:flex gap-4 items-center">
              {navItems.map((item) => {
                // Normalize both pathname and href for comparison (remove trailing slashes and query params)
                const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                const normalizedHref = item.href.replace(/\/$/, '') || '/';
                const isActive = normalizedPathname === normalizedHref;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {/* More Menu Dropdown */}
              <div className="relative" ref={moreMenuRef}>
                {(() => {
                  const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                  const isMoreMenuActive = moreMenuItems.some(item => {
                    const normalizedHref = item.href.replace(/\/$/, '') || '/';
                    return normalizedPathname === normalizedHref;
                  });
                  
                  return (
                    <>
                      <button
                        onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                        className={cn(
                          "px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1",
                          isMoreMenuActive
                            ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        More
                        <ChevronDown className={cn("w-4 h-4 transition-transform", moreMenuOpen && "rotate-180")} />
                      </button>
                      {moreMenuOpen && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                          <div className="py-1">
                            {moreMenuItems.map((item) => {
                              const normalizedHref = item.href.replace(/\/$/, '') || '/';
                              const isItemActive = normalizedPathname === normalizedHref;
                              
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => setMoreMenuOpen(false)}
                                  className={cn(
                                    "block px-4 py-2 text-sm transition-colors",
                                    isItemActive
                                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
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
                const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                const normalizedHref = item.href.replace(/\/$/, '') || '/';
                const isActive = normalizedPathname === normalizedHref;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "block px-3 py-2 text-sm font-medium transition-colors rounded-md",
                      isActive
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {/* More Menu in Mobile */}
              <div className="mt-2">
                {(() => {
                  const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '/';
                  const isMoreMenuActive = moreMenuItems.some(item => {
                    const normalizedHref = item.href.replace(/\/$/, '') || '/';
                    return normalizedPathname === normalizedHref;
                  });
                  
                  return (
                    <>
                      <button
                        onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors rounded-md",
                          isMoreMenuActive
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        More
                        <ChevronDown className={cn("w-4 h-4 transition-transform", moreMenuOpen && "rotate-180")} />
                      </button>
                      {moreMenuOpen && (
                        <div className="pl-4 mt-1 space-y-1">
                          {moreMenuItems.map((item) => {
                            const normalizedHref = item.href.replace(/\/$/, '') || '/';
                            const isItemActive = normalizedPathname === normalizedHref;
                            
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => {
                                  setMobileMenuOpen(false);
                                  setMoreMenuOpen(false);
                                }}
                                className={cn(
                                  "block px-3 py-2 text-sm transition-colors rounded-md",
                                  isItemActive
                                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                                )}
                              >
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
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


