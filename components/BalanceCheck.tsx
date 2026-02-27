'use client';

import { useState, useEffect } from 'react';
import { useBalance, useChainId, useReadContract } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { formatEther } from '@/lib/utils';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { CONTRACTS } from '@/config/contracts';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { useWallets } from '@privy-io/react-auth';

const SEPOLIA_FAUCETS = [
  { name: 'Alchemy Sepolia Faucet', url: 'https://sepoliafaucet.com/' },
  { name: 'Infura Sepolia Faucet', url: 'https://www.infura.io/faucet/sepolia' },
  { name: 'QuickNode Sepolia Faucet', url: 'https://faucet.quicknode.com/ethereum/sepolia' },
  { name: 'PoW Faucet', url: 'https://sepolia-faucet.pk910.de/' },
];

export function BalanceCheck() {
  // ── All hooks first — no early returns before this block ─────────────────
  const { address, isConnected } = useWalletAddress();
  const { wallets } = useWallets();
  const chainId = useChainId();
  const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy');

  const { data: balance, isLoading } = useBalance({
    address: address,
    query: { enabled: !hasEmbeddedWallet && !!address },
  });

  const { data: membershipBalance, isLoading: isLoadingMembership } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !hasEmbeddedWallet && !!address },
  });

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

  // ── Conditional returns after all hooks ───────────────────────────────────

  // Embedded wallet users have gas sponsored by Pimlico — balance warning irrelevant.
  if (hasEmbeddedWallet) return null;

  const isCorrectNetwork = chainId === sepolia.id;
  const isConnectedStable = stableIsConnected ?? false;

  if (!isCorrectNetwork) return null;
  if (!hasInitialized || !isConnectedStable || !address) return null;

  const isMember = address && !isLoadingMembership && membershipBalance !== undefined
    ? Boolean(membershipBalance && Number(membershipBalance) > 0)
    : undefined;

  if (isMember === false) return null;
  if (isLoading || balance === undefined || isLoadingMembership || isMember === undefined) return null;

  const balanceEth = parseFloat(formatEther(BigInt(balance.value.toString())));
  if (balanceEth >= 0.001) return null;

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
              onClick={() => navigator.clipboard.writeText(address!)}
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
