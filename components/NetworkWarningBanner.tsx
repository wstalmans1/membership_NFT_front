'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { AlertCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';

// Common chain names mapping
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia',
  5: 'Goerli',
  137: 'Polygon',
  80001: 'Mumbai',
  42161: 'Arbitrum One',
  421614: 'Arbitrum Sepolia',
  10: 'Optimism',
  11155420: 'Optimism Sepolia',
};

export function NetworkWarningBanner() {
  const { isConnected, chainId: accountChainId } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const { wallets } = useWallets();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  // Don't show if wallet not connected
  if (!isConnected) {
    return null;
  }

  // Email/Google users have a Privy embedded wallet — their smart wallet is
  // always routed to Sepolia regardless of what wagmi's chain reports.
  // The wagmi chain showing "Mainnet" is a false positive for these users,
  // and useSwitchChain does not work for embedded wallets anyway.
  const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy');
  if (hasEmbeddedWallet) {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  const currentChainId = accountChainId ?? chainId;
  const isCorrectNetwork = currentChainId === sepolia.id;
  const chainName = CHAIN_NAMES[currentChainId] || `Chain ${currentChainId}`;

  // Don't show if on correct network
  if (isCorrectNetwork) {
    return null;
  }

  return (
    <div className="bg-red-600 dark:bg-red-700 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 sm:mt-0" />
          <p className="font-medium flex-1 min-w-0">
            You are connected to the wrong network ({chainName}). Please switch to Sepolia to interact with the QAWL DAO.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
          <button
            onClick={() => {
              try {
                switchChain({ chainId: sepolia.id });
              } catch (error) {
                console.error('Failed to switch chain:', error);
              }
            }}
            disabled={isPending}
            className="px-4 py-2 bg-gray-900 text-red-200 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isPending ? 'Switching...' : 'Switch to Sepolia'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-2 hover:bg-red-700 dark:hover:bg-red-800 rounded-lg transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
