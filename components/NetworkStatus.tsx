'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
  const [directChainId, setDirectChainId] = useState<number | null>(null);
  const lastKnownChainIdRef = useRef<number | null>(null);
  
  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle MetaMask's per-dapp network isolation
  // MetaMask now maintains separate network states for each dapp
  // We need to listen for chain changes and force wagmi to reconnect
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const ethereum = (window as any).ethereum;
    if (!ethereum || !ethereum.on) return;

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      console.log('🔔 MetaMask chainChanged event fired! New chainId:', newChainId);
      lastKnownChainIdRef.current = newChainId;
      setDirectChainId(newChainId);
    };

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('🔔 MetaMask accountsChanged event fired!', accounts);
    };

    const handleDisconnect = (error: any) => {
      console.log('🔔 MetaMask disconnect event fired!', error);
    };

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
  }, [mounted]);

  // Poll for chain changes as a fallback (MetaMask's per-dapp isolation can delay events)
  // This ensures we catch network changes even if events don't fire immediately
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const pollChainId = async () => {
      try {
        const ethereum = (window as any).ethereum;
        if (!ethereum?.request) return;

        // Get chain ID directly from MetaMask
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        const currentChainId = parseInt(chainIdHex, 16);
        if (Number.isNaN(currentChainId)) return;

        lastKnownChainIdRef.current = currentChainId;
        setDirectChainId(currentChainId);
      } catch (error) {
        console.error('Error polling chain ID:', error);
      }
    };

    pollChainId();
    const pollInterval = setInterval(pollChainId, 4000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [mounted]);

  // Use wagmi's chain ID as the primary source
  // This should update automatically when MetaMask switches networks
  // (as long as the chain is in wagmi config, which we've added)
  const currentChainId = directChainId ?? accountChainId ?? chainId;

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
    console.log('🔄 Manual refresh triggered - polling chain id');
    lastKnownChainIdRef.current = null;
    setDirectChainId(null);
  };

  if (isCorrectNetwork) {
    return (
      <div className="flex items-center justify-center gap-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-lg text-xs font-medium whitespace-nowrap h-6">
        <CheckCircle className="w-3 h-3 flex-shrink-0" />
        <span>Sepolia Network</span>
        <span className="relative group flex items-center" tabIndex={0} data-tooltip-anchor>
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full border border-green-300/60 text-[10px] leading-none text-green-700 dark:border-green-700/60 dark:text-green-300"
            aria-label="Network status help"
          >
            ?
          </span>
          <div data-tooltip className="absolute right-0 top-full mt-2 w-max max-w-[80vw] sm:max-w-xs p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700 whitespace-normal">
            MetaMask now locks networks per site. If you switched via this DApp, changing MetaMask's global network won't affect this site.
            <span className="block mt-2 text-gray-300">
              Use the DApp switch button or MetaMask → Connected sites → this site → Network.
            </span>
          </div>
        </span>
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
