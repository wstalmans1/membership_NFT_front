'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets';
import { WagmiProvider } from '@privy-io/wagmi';
import { wagmiConfig } from '@/config/wagmi';
import { privyConfig } from '@/config/privy';
import { useState } from 'react';
import { DataProvider } from '@/contexts/DataContext';
import { DataPrefetcher } from '@/components/DataPrefetcher';
import { PrivyWalletSync } from '@/components/PrivyWalletSync';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  }));

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={privyConfig}
    >
      <SmartWalletsProvider>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <DataProvider>
              <PrivyWalletSync />
              <DataPrefetcher />
              {children}
            </DataProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}

