'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

export function NetworkStatus() {
  const { isConnected, chainId: accountChainId } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const { wallets } = useWallets();
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
  if (!mounted) return null;

  // Email/Google users have a Privy embedded wallet whose smart wallet is
  // always routed to Sepolia — the wagmi chain ID is irrelevant for them.
  const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy');
  if (hasEmbeddedWallet) return null;

  if (!isConnected) return null;

  const isCorrectNetwork = currentChainId === sepolia.id;
  const chainName = CHAIN_NAMES[currentChainId] || `Chain ${currentChainId}`;

  // Manual refresh function - reloads the page to force wagmi to reconnect
  const refreshChainId = () => {
    console.log('🔄 Manual refresh triggered - polling chain id');
    lastKnownChainIdRef.current = null;
    setDirectChainId(null);
  };

  if (isCorrectNetwork) return null;

  return (
    <div className="flex items-center justify-center gap-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg text-xs font-medium h-6 max-w-full">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      <span className="text-xs truncate">Wrong Network</span>
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
