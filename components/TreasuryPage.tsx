'use client';

import { useState } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { TreasuryExecutor } from '@/abis/TreasuryExecutor';
import { Constitution } from '@/abis/Constitution';
import { formatEther, parseEther, formatAddress } from '@/lib/utils';

export function TreasuryPage() {
  const { address, isConnected } = useAccount();
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

  // Get current epoch spent (would need to track this)
  const currentEpochSpent = 0n;

  // Check if recipient is allowed
  const { data: isRecipientAllowed } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'isRecipientAllowed',
    args: recipient ? [recipient as `0x${string}`] : undefined,
    query: { enabled: !!recipient },
  });

  const { writeContract, isPending } = useWriteContract();

  const handleExecutePayout = async () => {
    if (!recipient || !amount) {
      alert('Please fill in all fields');
      return;
    }

    try {
      writeContract({
        address: CONTRACTS.SEPOLIA.TREASURY_PROXY,
        abi: TreasuryExecutor,
        functionName: 'executePayout',
        args: [recipient as `0x${string}`, parseEther(amount)],
      });
    } catch (error) {
      console.error('Payout error:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Treasury</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Manage DAO treasury and execute payouts</p>
      </div>

      {!isConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">Please connect your wallet to view treasury information.</p>
        </div>
      )}

      {/* Treasury Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Treasury Balance</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {treasuryBalance ? formatEther(BigInt(treasuryBalance.value.toString())) : '...'} ETH
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Per-Transaction Cap</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {perTxCap ? formatEther(BigInt(perTxCap.toString())) : '...'} ETH
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Epoch Cap</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {epochCap ? formatEther(BigInt(epochCap.toString())) : '...'} ETH
          </p>
          {epochDuration ? (
            <p className="text-xs text-gray-500 mt-1">
              Duration: {Number(epochDuration)} seconds
            </p>
          ) : null}
        </div>
      </div>

      {/* Execute Payout */}
      {isConnected && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Execute Payout</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
              {recipient && (
                <p className={`mt-1 text-xs ${isRecipientAllowed ? 'text-green-600' : 'text-red-600'}`}>
                  {isRecipientAllowed ? '✓ Recipient is allowed' : '✗ Recipient is not allowed'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount (ETH)
              </label>
              <input
                type="number"
                step="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {amount && perTxCap && parseEther(amount) > BigInt(perTxCap.toString()) ? (
                <p className="mt-1 text-xs text-red-600">
                  Amount exceeds per-transaction cap of {formatEther(BigInt(perTxCap.toString()))} ETH
                </p>
              ) : null}
            </div>
            <button
              onClick={handleExecutePayout}
              disabled={isPending || !recipient || !amount || !isRecipientAllowed}
              className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Processing...' : 'Execute Payout'}
            </button>
          </div>
        </div>
      )}

      {/* Payout History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Payouts</h2>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No payout history available.</p>
          <p className="text-sm mt-2">Payouts will appear here after execution.</p>
        </div>
      </div>
    </div>
  );
}

