'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

export function NetworkStatus() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const isCorrectNetwork = chainId === sepolia.id;

  if (!isConnected) {
    return null; // Don't show network status if wallet not connected
  }

  if (isCorrectNetwork) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-lg text-xs font-medium whitespace-nowrap">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>Sepolia Network</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg text-xs font-medium whitespace-nowrap">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>Wrong Network</span>
      <button
        onClick={() => {
          try {
            switchChain({ chainId: sepolia.id });
          } catch (error) {
            console.error('Failed to switch chain:', error);
          }
        }}
        disabled={isPending}
        className="ml-2 px-2.5 py-1 bg-red-600 dark:bg-red-700 text-white rounded text-xs hover:bg-red-700 dark:hover:bg-red-800 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? 'Switching...' : 'Switch to Sepolia'}
      </button>
    </div>
  );
}

