'use client';

import dynamic from 'next/dynamic';

const NetworkWarningBanner = dynamic(
  () => import('@/components/NetworkWarningBanner').then(mod => ({ default: mod.NetworkWarningBanner })),
  { ssr: false }
);

export function NetworkWarningBannerWrapper() {
  return <NetworkWarningBanner />;
}
