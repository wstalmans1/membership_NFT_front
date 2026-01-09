'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

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

export function NetworkStatus() {
  const { isConnected, chainId: accountChainId } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  
  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle MetaMask's per-dapp network isolation
  // MetaMask now maintains separate network states for each dapp
  // We need to listen for chain changes and force wagmi to reconnect
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !isConnected) return;

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      console.log('🔔 MetaMask chainChanged event fired! New chainId:', newChainId);
      // Reload page to ensure wagmi picks up the change
      // This is the recommended approach per MetaMask docs
      window.location.reload();
    };

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('🔔 MetaMask accountsChanged event fired!', accounts);
      // When accounts change, the chain might have changed too
      // Reload to ensure everything is in sync
      window.location.reload();
    };

    const handleDisconnect = (error: any) => {
      console.log('🔔 MetaMask disconnect event fired!', error);
      // Some MetaMask versions emit disconnect after network switch
      // Reload to reconnect properly
      window.location.reload();
    };

    const ethereum = (window as any).ethereum;
    if (ethereum && ethereum.on) {
      // Listen to all relevant events
      ethereum.on('chainChanged', handleChainChanged);
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('disconnect', handleDisconnect);
      
      return () => {
        if (ethereum && ethereum.removeListener) {
          ethereum.removeListener('chainChanged', handleChainChanged);
          ethereum.removeListener('accountsChanged', handleAccountsChanged);
          ethereum.removeListener('disconnect', handleDisconnect);
        }
      };
    }
  }, [mounted, isConnected]);

  // Poll for chain changes as a fallback (MetaMask's per-dapp isolation can delay events)
  // This ensures we catch network changes even if events don't fire immediately
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !isConnected) return;

    let lastKnownChainId = accountChainId ?? chainId;

    const pollChainId = async () => {
      try {
        const ethereum = (window as any).ethereum;
        if (!ethereum) return;

        // Get chain ID directly from MetaMask
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        const currentChainId = parseInt(chainIdHex, 16);

        // If chain ID changed, reload to sync wagmi
        if (lastKnownChainId !== undefined && currentChainId !== lastKnownChainId) {
          console.log('🔄 Chain ID changed via polling!', {
            old: lastKnownChainId,
            new: currentChainId,
          });
          window.location.reload();
        }

        lastKnownChainId = currentChainId;
      } catch (error) {
        console.error('Error polling chain ID:', error);
      }
    };

    // Poll every 3 seconds (less aggressive than before, but still catches changes)
    const pollInterval = setInterval(pollChainId, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [mounted, isConnected, accountChainId, chainId]);

  // Use wagmi's chain ID as the primary source
  // This should update automatically when MetaMask switches networks
  // (as long as the chain is in wagmi config, which we've added)
  const currentChainId = accountChainId ?? chainId;

  // Log chain ID for debugging
  useEffect(() => {
    if (mounted && isConnected) {
      console.log('🔍 Chain ID Detection:', {
        'wagmi useAccount().chainId': accountChainId,
        'wagmi useChainId()': chainId,
        'Final (currentChainId)': currentChainId,
        'Expected (Sepolia)': sepolia.id,
        'Is correct?': currentChainId === sepolia.id,
        'Timestamp': new Date().toISOString(),
      });
    }
  }, [accountChainId, chainId, currentChainId, mounted, isConnected]);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  if (!isConnected) {
    return null; // Don't show network status if wallet not connected
  }

  const isCorrectNetwork = currentChainId === sepolia.id;
  const chainName = CHAIN_NAMES[currentChainId] || `Chain ${currentChainId}`;

  // Manual refresh function - reloads the page to force wagmi to reconnect
  const refreshChainId = () => {
    console.log('🔄 Manual refresh triggered - reloading page');
    window.location.reload();
  };

  if (isCorrectNetwork) {
    return (
      <div className="flex items-center justify-center gap-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-lg text-xs font-medium whitespace-nowrap h-6">
        <CheckCircle className="w-3 h-3 flex-shrink-0" />
        <span>Sepolia Network</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg text-xs font-medium whitespace-nowrap h-6">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span className="text-xs">Wrong Network ({chainName})</span>
      <button
        onClick={() => {
          try {
            switchChain({ chainId: sepolia.id });
          } catch (error) {
            console.error('Failed to switch chain:', error);
          }
        }}
        disabled={isPending}
        className="px-2 py-0.5 bg-red-600 dark:bg-red-700 text-white rounded text-xs hover:bg-red-700 dark:hover:bg-red-800 transition-colors disabled:opacity-50 whitespace-nowrap h-5"
      >
        {isPending ? 'Switching...' : 'Switch'}
      </button>
    </div>
  );
}

