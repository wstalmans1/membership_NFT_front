'use client';

import { useAccount, useChainId, useBalance } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { CheckCircle, Circle, AlertCircle, ExternalLink } from 'lucide-react';
import { formatEther } from '@/lib/utils';

const SEPOLIA_FAUCETS = [
  { name: 'Alchemy', url: 'https://sepoliafaucet.com/' },
  { name: 'Infura', url: 'https://www.infura.io/faucet/sepolia' },
  { name: 'QuickNode', url: 'https://faucet.quicknode.com/ethereum/sepolia' },
];

export function OnboardingChecklist() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({
    address: address,
  });

  const hasWallet = typeof window !== 'undefined' && !!(window as any).ethereum;
  const isCorrectNetwork = chainId === sepolia.id;
  const hasBalance = balance ? parseFloat(formatEther(BigInt(balance.value.toString()))) >= 0.001 : false;
  const allComplete = hasWallet && isConnected && isCorrectNetwork && hasBalance;

  const steps = [
    {
      id: 'wallet',
      label: 'Install MetaMask or Brave Wallet',
      completed: hasWallet,
      description: 'A crypto wallet is required to interact with the DAO',
    },
    {
      id: 'connect',
      label: 'Connect your wallet',
      completed: isConnected,
      description: 'Click "Connect MetaMask" or "Connect Brave" in the top right',
    },
    {
      id: 'network',
      label: 'Switch to Sepolia network',
      completed: isCorrectNetwork,
      description: 'The DAO runs on Sepolia testnet, not mainnet',
    },
    {
      id: 'eth',
      label: 'Get Sepolia ETH from a faucet',
      completed: hasBalance,
      description: 'You need test ETH to pay for transactions',
    },
  ];

  if (allComplete) {
    return null; // Hide checklist when everything is complete
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Getting Started</h2>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {steps.filter(s => s.completed).length} of {steps.length} complete
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.id} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {step.completed ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-medium ${step.completed ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                  {step.label}
                </h3>
                {!step.completed && step.id === 'wallet' && (
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    Install <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {!step.completed && step.id === 'eth' && (
                  <div className="flex gap-2 flex-wrap">
                    {SEPOLIA_FAUCETS.map((faucet) => (
                      <a
                        key={faucet.name}
                        href={faucet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        {faucet.name} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {!hasWallet && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>New to crypto wallets?</strong> A wallet is like a digital bank account that lets you interact with blockchain applications. 
            MetaMask and Brave Wallet are free, secure, and easy to use.
          </p>
        </div>
      )}

      {isConnected && !isCorrectNetwork && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                Wrong Network Detected
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                You're currently on the wrong network. Please switch to Sepolia testnet to continue. 
                Look for a "Switch Network" button in your wallet or in the top navigation bar.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

