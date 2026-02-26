'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useViewMode } from '@/contexts/ViewModeContext';

/**
 * Wraps content that is only accessible in Extended DAO mode.
 * In Community mode the user is immediately redirected to the home page.
 * This is used by pages that are available in the full build but hidden
 * in community mode (either via the runtime toggle or the community build variant).
 */
export function ExtendedOnly({ children }: { children: React.ReactNode }) {
  const { isExtended } = useViewMode();
  const router = useRouter();

  useEffect(() => {
    if (!isExtended) {
      router.replace('/');
    }
  }, [isExtended, router]);

  if (!isExtended) return null;

  return <>{children}</>;
}
