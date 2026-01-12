'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatEther } from '@/lib/utils';
import { AlertCircle, ExternalLink } from 'lucide-react';

const SEPOLIA_FAUCETS = [
  { name: 'Alchemy Sepolia Faucet', url: 'https://sepoliafaucet.com/' },
  { name: 'Infura Sepolia Faucet', url: 'https://www.infura.io/faucet/sepolia' },
  { name: 'QuickNode Sepolia Faucet', url: 'https://faucet.quicknode.com/ethereum/sepolia' },
  { name: 'PoW Faucet', url: 'https://sepolia-faucet.pk910.de/' },
];

export function BalanceCheck() {
  const { address, isConnected } = useAccount();
  const { data: balance, isLoading } = useBalance({
    address: address,
  });
  
  // Stabilize connection state to prevent flickering (similar to Dashboard)
  const [stableIsConnected, setStableIsConnected] = useState<boolean | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  useEffect(() => {
    if (!hasInitialized) {
      const initTimer = setTimeout(() => {
        setStableIsConnected(isConnected);
        setHasInitialized(true);
      }, 300);
      return () => clearTimeout(initTimer);
    } else {
      const updateTimer = setTimeout(() => {
        setStableIsConnected(isConnected);
      }, 200);
      return () => clearTimeout(updateTimer);
    }
  }, [isConnected, hasInitialized]);
  
  const isConnectedStable = stableIsConnected ?? false;

  if (!hasInitialized || !isConnectedStable || !address) {
    return null;
  }

  // Don't render anything until balance is loaded to avoid false positives
  if (isLoading || balance === undefined) {
    return null;
  }

  const balanceEth = parseFloat(formatEther(BigInt(balance.value.toString())));
  const hasLowBalance = balanceEth < 0.001; // Less than 0.001 ETH

  if (!hasLowBalance) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
            Low Sepolia ETH Balance
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
            You need Sepolia ETH to interact with the DAO. Your current balance: <strong>{balanceEth.toFixed(4)} Sepolia ETH</strong>
          </p>
          <div>
            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-2">Get free Sepolia ETH from these faucets:</p>
            <div className="space-y-2">
              {SEPOLIA_FAUCETS.map((faucet) => (
                <a
                  key={faucet.name}
                  href={faucet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  {faucet.name}
                </a>
              ))}
            </div>
            <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs text-yellow-800 dark:text-yellow-200">
              <p className="font-medium mb-1">How to use a faucet:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Click on a faucet link above</li>
                <li>Paste your wallet address: <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded font-mono text-[10px]">{address}</code></li>
                <li>Complete any required verification (CAPTCHA, social login, etc.)</li>
                <li>Wait a few minutes for the Sepolia ETH to arrive</li>
                <li>Refresh this page to see your updated balance</li>
              </ol>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(address)}
              className="mt-2 px-3 py-1.5 text-xs bg-yellow-600 dark:bg-yellow-700 text-white rounded hover:bg-yellow-700 dark:hover:bg-yellow-800 transition-colors"
            >
              Copy My Address
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

