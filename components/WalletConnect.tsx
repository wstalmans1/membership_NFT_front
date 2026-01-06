'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { formatAddress } from '@/lib/utils';

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-medium text-gray-900 dark:text-white break-all">{address}</span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-xs bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition-colors flex-shrink-0"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Detect which wallet is available - only MetaMask or Brave
  const detectWallet = () => {
    if (typeof window === 'undefined') return null;
    
    const ethereum = (window as any).ethereum;
    if (!ethereum) return null;

    // Check for MetaMask first
    if (ethereum.isMetaMask) {
      const metaMaskConnector = connectors.find(c => 
        c.name.toLowerCase().includes('metamask')
      );
      if (metaMaskConnector) {
        return { name: 'MetaMask', connector: metaMaskConnector };
      }
    }
    
    // Check for Brave Wallet
    if (ethereum.isBraveWallet) {
      const braveConnector = connectors.find(c => 
        c.name.toLowerCase().includes('injected')
      );
      if (braveConnector) {
        return { name: 'Brave', connector: braveConnector };
      }
    }

    return null;
  };

  const wallet = detectWallet();

  if (!wallet) {
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1.5">
        Install MetaMask or Brave Wallet
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: wallet.connector })}
      disabled={isPending}
      className="px-3 py-1.5 text-xs bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Connecting...' : `Connect ${wallet.name}`}
    </button>
  );
}

