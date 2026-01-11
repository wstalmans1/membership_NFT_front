'use client';

import { useEffect, useState, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { formatEther } from '@/lib/utils';
import { Copy, ChevronDown, X, LogOut } from 'lucide-react';
import Link from 'next/link';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Get wallet balance
  const { data: balance } = useBalance({
    address: address,
  });

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowModal(false);
      }
    };

    if (showModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModal]);

  const handleCopy = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`;
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-32 h-9 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      </div>
    );
  }

  if (isConnected && address) {
    const balanceDisplay = balance ? parseFloat(formatEther(BigInt(balance.value.toString()))).toFixed(2) : '0.00';
    const truncatedAddress = formatAddress(address);

    return (
      <div className="relative">
        {/* Pill-shaped button */}
        <button
          onClick={() => setShowModal(!showModal)}
          className="flex items-center gap-2.5 px-4 py-1.5 bg-blue-600 dark:bg-blue-700 text-white rounded-full hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-medium text-sm h-8"
        >
          <span className="font-semibold whitespace-nowrap">{balanceDisplay} Sepolia ETH</span>
          <span className="text-lg flex-shrink-0">🍉</span>
          <span className="font-mono font-semibold whitespace-nowrap">{truncatedAddress}</span>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${showModal ? 'rotate-180' : ''}`} />
        </button>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <div
              ref={modalRef}
              className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 w-80 max-w-[90vw] relative shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>

              {/* Watermelon icon circle */}
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-5xl">🍉</span>
                </div>
              </div>

              {/* Address */}
              <div className="text-center mb-2">
                <p className="font-mono font-semibold text-gray-900 dark:text-white text-lg break-all">
                  {address}
                </p>
              </div>

              {/* Balance */}
              <div className="text-center mb-6">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {balanceDisplay} Sepolia ETH
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex flex-col items-center gap-2 px-4 py-3 bg-white dark:bg-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                >
                  <Copy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {copied ? 'Copied!' : 'Copy Address'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    disconnect();
                    setShowModal(false);
                  }}
                  className="flex-1 flex flex-col items-center gap-2 px-4 py-3 bg-white dark:bg-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                >
                  <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Disconnect
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
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
      <Link
        href="/getting-started"
        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline px-3 py-1.5 transition-colors"
      >
        Install MetaMask or Brave Wallet
      </Link>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: wallet.connector })}
      disabled={isPending}
      className="px-3 py-1.5 text-xs bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Connecting...' : `Connect ${wallet.name}`}
    </button>
  );
}

