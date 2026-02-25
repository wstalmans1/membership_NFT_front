'use client';

import { useEffect, useState, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useBalance } from 'wagmi';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { formatEther } from '@/lib/utils';
import { Copy, ChevronDown, X, LogOut } from 'lucide-react';

export function WalletButton() {
  const { login, logout, ready, authenticated } = usePrivy();
  const { address } = useWalletAddress();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const { data: balance } = useBalance({ address });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowModal(false);
      }
    };
    if (showModal) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModal]);

  const handleCopy = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) =>
    `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`;

  if (!mounted || !ready) {
    return (
      <div className="w-32 h-9 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
    );
  }

  if (authenticated && address) {
    const balanceDisplay = balance
      ? parseFloat(formatEther(BigInt(balance.value.toString()))).toFixed(2)
      : '0.00';
    const truncatedAddress = formatAddress(address);

    return (
      <div className="relative">
        <button
          onClick={() => setShowModal(!showModal)}
          className="flex items-center gap-2.5 px-4 py-1.5 bg-blue-600 dark:bg-blue-700 text-white rounded-full hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-medium text-sm h-8"
        >
          <span className="font-semibold whitespace-nowrap">{balanceDisplay} Sepolia ETH</span>
          <span className="text-lg flex-shrink-0">🍉</span>
          <span className="font-mono font-semibold whitespace-nowrap">{truncatedAddress}</span>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${showModal ? 'rotate-180' : ''}`} />
        </button>

        {showModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowModal(false)}
          >
            <div
              ref={modalRef}
              className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 w-80 max-w-[90vw] relative shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>

              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-5xl">🍉</span>
                </div>
              </div>

              <div className="text-center mb-2">
                <p className="font-mono font-semibold text-gray-900 dark:text-white text-lg break-all">
                  {address}
                </p>
              </div>

              <div className="text-center mb-6">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {balanceDisplay} Sepolia ETH
                </p>
              </div>

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
                  onClick={() => { logout(); setShowModal(false); }}
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

  return (
    <button
      onClick={login}
      className="px-3 py-1.5 text-xs bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
    >
      Login
    </button>
  );
}
