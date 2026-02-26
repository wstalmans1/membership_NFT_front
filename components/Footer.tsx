'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useFeatures } from '@/hooks/useFeatures';

const allFooterLinks = [
  { href: '/dao-architecture', label: 'DAO Architecture' },
  { href: '/philosophy', label: 'Design Philosophy' },
  { href: '/getting-started', label: 'Getting Started' },
];

export function Footer() {
  const pathname = usePathname();
  const features = useFeatures();
  const footerLinks = features.showMorePages ? allFooterLinks : [];

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-semibold text-gray-900 dark:text-white mb-1"><span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span></p>
            <p>Decentralized Autonomous Organization</p>
          </div>
          
          <nav className="flex flex-wrap justify-center gap-4 md:gap-6">
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {item.href === '/dao-architecture' ? (
                  <><span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span> Architecture</>
                ) : (
                  item.label
                )}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-500">
          <p>© {new Date().getFullYear()} <span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span>. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
