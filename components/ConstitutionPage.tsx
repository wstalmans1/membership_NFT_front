'use client';

import { useState } from 'react';
import { useReadContract, usePublicClient } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { Constitution } from '@/abis/Constitution';
import { DAOGovernor } from '@/abis/DAOGovernor';
import { formatEther } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle } from 'lucide-react';

export function ConstitutionPage() {
  // Constitution parameters
  const { data: minDonation } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'minDonationWei',
  });

  const { data: baseURI } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'baseURI',
  });

  const { data: revocationAuthority } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'revocationAuthority',
  });

  const { data: perTxSpendCap } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'perTxSpendCapWei',
  });

  const { data: epochSpendCap } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'epochSpendCapWei',
  });

  const { data: epochDuration } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'epochDuration',
  });

  // Governor parameters
  const { data: votingDelay } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'votingDelay',
  });

  const { data: votingPeriod } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'votingPeriod',
  });

  const { data: proposalThreshold } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'proposalThreshold',
  });

  const { data: quorumNumerator } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'quorumNumerator',
  });

  // Fetch allowed recipients from events
  const publicClient = usePublicClient();
  const { data: allowedRecipients = [] } = useQuery({
    queryKey: ['allowedRecipients', CONTRACTS.SEPOLIA.CONSTITUTION_PROXY],
    queryFn: async () => {
      if (!publicClient) return [];

      try {
        // Fetch RecipientAllowlistUpdated events from deployment block
        const deploymentBlock = 9944847; // From CONTRACT_ADDRESSES.md
        const currentBlock = await publicClient.getBlockNumber();
        
        // Calculate block range (limit to 1000 blocks to avoid RPC limits)
        const fromBlock = currentBlock - BigInt(1000) > BigInt(deploymentBlock) 
          ? currentBlock - BigInt(1000) 
          : BigInt(deploymentBlock);
        
        // Fetch and decode events
        const logs = await publicClient.getLogs({
          address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
          event: {
            type: 'event',
            name: 'RecipientAllowlistUpdated',
            inputs: [
              { type: 'address', indexed: true, name: 'account' },
              { type: 'bool', indexed: false, name: 'allowed' },
            ],
          } as const,
          fromBlock,
          toBlock: currentBlock,
        });

        // Process events to get current state (latest event for each address determines if allowed)
        const recipientMap = new Map<string, boolean>();
        
        for (const log of logs) {
          if (log.args && 'account' in log.args && 'allowed' in log.args) {
            const account = log.args.account as string;
            const allowed = log.args.allowed as boolean;
            recipientMap.set(account.toLowerCase(), allowed);
          }
        }

        // Return only addresses that are currently allowed
        return Array.from(recipientMap.entries())
          .filter(([_, allowed]) => allowed)
          .map(([address, _]) => address);
      } catch (error) {
        console.error('Error fetching allowed recipients:', error);
        return [];
      }
    },
    enabled: !!publicClient,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Constitution</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">View DAO governance parameters and rules</p>
      </div>

      {/* Membership Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Membership Parameters</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Minimum Donation</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Minimum Donation</p>
                  <p className="text-gray-300">
                    The minimum amount of Sepolia ETH required to mint a membership NFT. This donation goes directly to the DAO treasury.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} Sepolia ETH
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Base URI</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Base URI</p>
                  <p className="text-gray-300">
                    The base URL used to construct metadata URIs for membership NFTs. The token ID is appended to this URI to fetch individual NFT metadata.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-mono text-sm text-gray-900 dark:text-white">{baseURI ? String(baseURI) : '...'}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Revocation Authority</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Revocation Authority</p>
                  <p className="text-gray-300">
                    The address authorized to revoke membership NFTs outside of normal governance processes. 
                    This is typically used for compliance or legal requirements where immediate revocation may be necessary.
                  </p>
                </div>
              </div>
            </div>
            {revocationAuthority ? (
              <a
                href={`https://eth-sepolia.blockscout.com/address/${String(revocationAuthority)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                {String(revocationAuthority)}
              </a>
            ) : (
              <span className="font-mono text-sm text-gray-900 dark:text-white">...</span>
            )}
          </div>
        </div>
      </div>

      {/* Treasury Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Treasury Parameters</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Per-Transaction Spend Cap</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Per-Transaction Spend Cap</p>
                  <p className="text-gray-300">
                    The maximum amount of Sepolia ETH that can be spent in a single treasury transaction. This prevents large unauthorized withdrawals.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {perTxSpendCap ? formatEther(BigInt(perTxSpendCap.toString())) : '...'} Sepolia ETH
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Epoch Spend Cap</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Epoch Spend Cap</p>
                  <p className="text-gray-300">
                    The maximum total amount of Sepolia ETH that can be spent from the treasury within a single epoch (time period). This provides additional protection against rapid depletion of funds.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {epochSpendCap ? formatEther(BigInt(epochSpendCap.toString())) : '...'} Sepolia ETH
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Epoch Duration</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Epoch Duration</p>
                  <p className="text-gray-300">
                    The length of time (in seconds) that defines one epoch. The epoch spend cap resets after each epoch duration period.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {epochDuration ? `${Number(epochDuration)} seconds` : '...'}
            </span>
          </div>
          <div className="py-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-600 dark:text-gray-400">Allowed Recipients</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Allowed Recipients</p>
                  <p className="text-gray-300">
                    The list of addresses that are authorized to receive payments from the DAO treasury. Only addresses on this allowlist can receive funds through governance proposals.
                  </p>
                </div>
              </div>
            </div>
            {allowedRecipients.length > 0 ? (
              <div className="space-y-2">
                {allowedRecipients.map((address) => (
                  <div key={address} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <a
                      href={`https://eth-sepolia.blockscout.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {address}
                    </a>
                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded">
                      Allowed
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No allowed recipients found</p>
            )}
          </div>
        </div>
      </div>

      {/* Governance Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Governance Parameters</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Voting Delay</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Voting Delay</p>
                  <p className="text-gray-300">
                    The number of blocks that must pass after a proposal is created before voting can begin. This gives members time to review proposals before voting starts.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {votingDelay ? `${Number(votingDelay)} blocks` : '...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Voting Period</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Voting Period</p>
                  <p className="text-gray-300">
                    The number of blocks during which members can cast their votes on a proposal. After this period ends, the proposal is finalized based on the vote results.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {votingPeriod ? `${Number(votingPeriod)} blocks` : '...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Proposal Threshold</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Proposal Threshold</p>
                  <p className="text-gray-300">
                    The minimum number of votes (voting power) required to create a proposal. This prevents spam and ensures only serious proposals are submitted.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {proposalThreshold ? proposalThreshold.toString() : '...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Quorum Numerator</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Quorum Numerator</p>
                  <p className="text-gray-300">
                    The numerator used to calculate the quorum percentage. Quorum = (numerator / 100) × total membership supply. For example, a numerator of 10 means 10% of members must vote for a proposal to pass.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {quorumNumerator ? quorumNumerator.toString() : '...'}
            </span>
          </div>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Contract Addresses</h2>
          <div className="relative group">
            <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
              <p className="mb-2 font-semibold">Contract Addresses</p>
              <p className="text-gray-300">
                These are the on-chain addresses of the DAO's smart contracts. All contracts are verified on Blockscout, allowing anyone to inspect the code and verify their functionality. Click any address to view it on the block explorer.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Constitution:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Constitution Contract</p>
                  <p className="text-gray-300">
                    Defines the core DAO parameters including minimum donation, spend caps, allowed recipients, and base URI. This contract acts as the source of truth for governance rules and treasury constraints.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.CONSTITUTION_PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.CONSTITUTION_PROXY}
            </a>
          </div>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Governor:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Governor Contract</p>
                  <p className="text-gray-300">
                    Manages the governance process: proposal creation, voting, and execution. Members create proposals here, vote on them, and successful proposals are queued for execution through the Timelock.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.GOVERNOR_PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.GOVERNOR_PROXY}
            </a>
          </div>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Membership NFT:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Membership NFT Contract</p>
                  <p className="text-gray-300">
                    Issues soulbound (non-transferable) membership NFTs to DAO members. Each NFT grants 1 vote in governance. Members mint NFTs by making a minimum donation to the treasury.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}
            </a>
          </div>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Treasury:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Treasury Executor Contract</p>
                  <p className="text-gray-300">
                    Manages DAO treasury funds and executes payouts. Enforces spend caps and recipient allowlists. All treasury operations must go through governance proposals and the Timelock.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.TREASURY_PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.TREASURY_PROXY}
            </a>
          </div>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Timelock:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Timelock Controller</p>
                  <p className="text-gray-300">
                    Adds a delay between proposal execution and actual execution. This gives members time to review and react to proposals before they take effect, providing an additional security layer.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.TIMELOCK}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.TIMELOCK}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

