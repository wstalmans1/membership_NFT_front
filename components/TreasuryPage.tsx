'use client';

import { useState } from 'react';
import { useAccount, useBalance, useReadContract, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTS } from '@/config/contracts';
import { Constitution } from '@/abis/Constitution';
import { TreasuryExecutor } from '@/abis/TreasuryExecutor';
import { formatEther, parseEther, formatAddress } from '@/lib/utils';
import { encodeFunctionData, Address, decodeEventLog } from 'viem';
import { HelpCircle, ExternalLink } from 'lucide-react';
import { BalanceCheck } from './BalanceCheck';
import { OnboardingChecklist } from './OnboardingChecklist';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function TreasuryPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  // Get treasury balance
  const { data: treasuryBalance } = useBalance({
    address: CONTRACTS.SEPOLIA.TREASURY_PROXY,
  });

  // Get spend caps
  const { data: perTxCap } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'perTxSpendCapWei',
  });

  const { data: epochCap } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'epochSpendCapWei',
  });

  const { data: epochDuration } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'epochDuration',
  });

  // Check if recipient is allowed
  const { data: isRecipientAllowed } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'isRecipientAllowed',
    args: recipient ? [recipient as Address] : undefined,
    query: { enabled: !!recipient && recipient.length === 42 && recipient.startsWith('0x') },
  });


  // Query recent payouts from PayoutExecuted events
  // Using chunked queries similar to governance proposals to avoid RPC limits
  const publicClient = usePublicClient();
  const CHUNK_SIZE = 800n; // Same as governance page to stay under RPC limits
  const DEPLOYMENT_BLOCK = 9944847n; // From CONTRACT_ADDRESSES.md
  
  const { data: recentPayouts, isLoading: isLoadingPayouts } = useQuery({
    queryKey: ['recentPayouts'],
    queryFn: async () => {
      if (!publicClient) return [];
      
      try {
        // Find the PayoutExecuted event in the ABI
        const payoutEvent = TreasuryExecutor.find((item: any) => 
          item.type === 'event' && item.name === 'PayoutExecuted'
        );
        
        if (!payoutEvent) {
          console.error('PayoutExecuted event not found in ABI!');
          return [];
        }

        const currentBlock = await publicClient.getBlockNumber();
        
        // Query only the latest chunk to avoid RPC limits
        // Start from deployment block or currentBlock - CHUNK_SIZE, whichever is more recent
        const fromBlock = currentBlock > CHUNK_SIZE 
          ? (currentBlock - CHUNK_SIZE > DEPLOYMENT_BLOCK 
              ? currentBlock - CHUNK_SIZE 
              : DEPLOYMENT_BLOCK)
          : DEPLOYMENT_BLOCK;
        
        console.log('Fetching recent payouts from block', fromBlock.toString(), 'to', currentBlock.toString(), `(${Number(currentBlock - fromBlock)} blocks)`);
        
        const logs = await publicClient.getLogs({
          address: CONTRACTS.SEPOLIA.TREASURY_PROXY as Address,
          event: payoutEvent as any,
          fromBlock: fromBlock,
          toBlock: currentBlock,
        });

        console.log(`Found ${logs.length} payout event(s) in latest ${CHUNK_SIZE.toString()} blocks`);

        // Decode events and sort by block number (newest first)
        const payouts = await Promise.all(
          logs.map(async (log) => {
            try {
              const decoded = decodeEventLog({
                abi: TreasuryExecutor,
                data: log.data,
                topics: log.topics,
              });
              
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              
              return {
                recipient: decoded.args.to as Address,
                amount: decoded.args.amount as bigint,
                blockNumber: log.blockNumber,
                timestamp: Number(block.timestamp),
                transactionHash: log.transactionHash,
              };
            } catch (err) {
              console.warn('Failed to decode payout event:', err);
              return null;
            }
          })
        );

        // Filter out nulls and sort by block number (newest first)
        return payouts
          .filter((p): p is NonNullable<typeof payouts[0]> => p !== null)
          .sort((a, b) => Number(b.blockNumber - a.blockNumber));
      } catch (err: any) {
        console.error('Failed to fetch recent payouts:', err);
        // If error is due to block range, try a smaller range
        if (err.message?.includes('limit') || err.message?.includes('range')) {
          console.warn('RPC limit hit, will retry with smaller range on next query');
        }
        return [];
      }
    },
    enabled: isConnected && !!publicClient,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Check if wallet extension is installed
  const hasWalletExtension = typeof window !== 'undefined' && !!(window as any).ethereum;

  const handleCreateProposal = () => {
    if (!recipient || !amount) {
      alert('Please fill in both recipient address and amount');
      return;
    }

    // Validate recipient address
    if (recipient.length !== 42 || !recipient.startsWith('0x')) {
      alert('Please enter a valid Ethereum address');
      return;
    }

    // Validate amount
    let amountWei: bigint;
    try {
      amountWei = parseEther(amount);
    } catch (error) {
      alert('Please enter a valid amount');
      return;
    }

    // Check per-transaction cap
    if (perTxCap && amountWei > BigInt(perTxCap.toString())) {
      alert(`Amount exceeds per-transaction cap of ${formatEther(BigInt(perTxCap.toString()))} Sepolia ETH`);
      return;
    }

    // Generate calldata for executePayout(recipient, amount, '0x')
    const calldata = encodeFunctionData({
      abi: TreasuryExecutor,
      functionName: 'executePayout',
      args: [recipient as Address, amountWei, '0x' as `0x${string}`],
    });

    // Store proposal data in localStorage for GovernancePage to pick up
    // Ensure amount is preserved as string to avoid any precision issues
    const amountString = String(amount).trim();
    const proposalDescription = `Treasury Payout Proposal\n\nRecipient: ${recipient}\nAmount: ${amountString} Sepolia ETH\n\nThis proposal will execute a payout from the DAO treasury to the specified recipient address.`;
    
    const proposalData = {
      targets: CONTRACTS.SEPOLIA.TREASURY_PROXY,
      calldatas: calldata,
      description: proposalDescription,
    };

    console.log('Storing treasury payout proposal:', {
      recipient,
      amount: amountString,
      description: proposalDescription,
    });

    localStorage.setItem('treasuryPayoutProposal', JSON.stringify(proposalData));

    // Navigate to governance page
    router.push('/governance');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Treasury</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">View DAO treasury balance and spending parameters. Payouts are executed through governance proposals.</p>
      </div>

      {/* Onboarding Checklist - Show if wallet not fully set up */}
      {hasWalletExtension && <OnboardingChecklist />}

      {/* Balance Check - Show if connected but low balance */}
      {isConnected && <BalanceCheck />}

      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Connect Your Wallet to View Treasury
              </h3>
              <p className="text-blue-800 dark:text-blue-300 mb-4">
                Connect your wallet to view the DAO treasury balance and spending parameters. 
                Treasury payouts are executed through governance proposals. Check the checklist above if you need help setting up.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/getting-started"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Getting Started Guide →
                </Link>
                <Link
                  href="/governance"
                  className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-medium"
                >
                  View Governance →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Treasury Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Treasury Balance</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Treasury Balance</p>
                <p className="text-gray-300">
                  The total amount of Sepolia ETH held by the DAO treasury. Funds come from membership donations and can be spent through governance proposals.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {treasuryBalance ? formatEther(BigInt(treasuryBalance.value.toString())) : '...'} Sepolia ETH
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Per-Transaction Cap</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Per-Transaction Cap</p>
                <p className="text-gray-300">
                  The maximum amount of Sepolia ETH that can be spent in a single treasury transaction. This prevents large unauthorized withdrawals.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {perTxCap ? formatEther(BigInt(perTxCap.toString())) : '...'} Sepolia ETH
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Epoch Cap</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Epoch Cap</p>
                <p className="text-gray-300">
                  The maximum total amount of Sepolia ETH that can be spent from the treasury within a single epoch (time period). This provides additional protection against rapid depletion of funds.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {epochCap ? formatEther(BigInt(epochCap.toString())) : '...'} Sepolia ETH
          </p>
          {epochDuration ? (
            <p className="text-xs text-gray-500 mt-1">
              Duration: {Number(epochDuration)} seconds
            </p>
          ) : null}
        </div>
      </div>

      {/* How to Execute Payouts */}
      {isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-xl">📋</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                How to Execute Treasury Payouts
              </h3>
              <p className="text-blue-800 dark:text-blue-300 mb-2">
                Treasury payouts are executed through governance proposals. To create a proposal, fill in the fields below and click on the button "Create Governance Proposal".
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                <span className="font-medium">Note:</span> The recipient address must be on the{' '}
                <Link href="/constitution" className="underline hover:text-blue-900 dark:hover:text-blue-200">
                  allowed recipients list
                </Link>
                {' '}managed in the Constitution. Only addresses on this list can receive funds from the DAO treasury.
              </p>
              
              <div className="space-y-4 mt-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-200">
                      Recipient Address
                    </label>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                        <p className="mb-2 font-semibold">Recipient Address</p>
                        <p className="text-gray-300">
                          The Ethereum address that will receive the payment. This address must be on the allowed recipients list (managed through governance).
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-2 border border-blue-200 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  />
                  {recipient && (
                    <p className={`mt-1 text-xs ${isRecipientAllowed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isRecipientAllowed === undefined && recipient.length === 42 && recipient.startsWith('0x') 
                        ? 'Checking recipient status...' 
                        : isRecipientAllowed 
                        ? '✓ Recipient is allowed' 
                        : '✗ Recipient is not allowed'}
                    </p>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-200">
                      Amount (Sepolia ETH)
                    </label>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                        <p className="mb-2 font-semibold">Amount</p>
                        <p className="text-gray-300">
                          The amount of Sepolia ETH to send to the recipient. Must not exceed the per-transaction cap.
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-2 border border-blue-200 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {amount && perTxCap && (() => {
                    try {
                      const amountWei = parseEther(amount);
                      return amountWei > BigInt(perTxCap.toString());
                    } catch {
                      return false;
                    }
                  })() ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Amount exceeds per-transaction cap of {formatEther(BigInt(perTxCap.toString()))} Sepolia ETH
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={handleCreateProposal}
                  disabled={!recipient || !amount || isRecipientAllowed === false || (isRecipientAllowed === undefined && recipient.length === 42 && recipient.startsWith('0x'))}
                  className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Create Governance Proposal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payout History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Payouts</h2>
        {isLoadingPayouts ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Loading payout history...</p>
          </div>
        ) : recentPayouts && recentPayouts.length > 0 ? (
          <div className="space-y-3">
            {recentPayouts.map((payout, index) => (
              <div
                key={`${payout.transactionHash}-${index}`}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      {formatEther(payout.amount)} ETH
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">→</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white break-all">
                      {payout.recipient}
                    </code>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>
                      Block: {payout.blockNumber.toString()}
                    </span>
                    <span>
                      {new Date(payout.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
                <a
                  href={`https://eth-sepolia.blockscout.com/tx/${payout.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  title="View transaction on Blockscout"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No payout history available.</p>
            <p className="text-sm mt-2">Payouts will appear here after execution.</p>
          </div>
        )}
      </div>
    </div>
  );
}

