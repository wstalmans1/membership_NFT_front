'use client';

import { useAccount, useBalance, useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTS } from '@/config/contracts';
import { formatEther } from '@/lib/utils';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { Constitution } from '@/abis/Constitution';
import { DAOGovernor } from '@/abis/DAOGovernor';
import { getTotalMembersCount } from '@/lib/metadata';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { WalletInstallGuide } from './WalletInstallGuide';
import { OnboardingChecklist } from './OnboardingChecklist';
import { BalanceCheck } from './BalanceCheck';

export function Dashboard() {
  const { address, isConnected } = useAccount();
  
  // Check if any wallet extension is installed
  const hasWalletExtension = typeof window !== 'undefined' && !!(window as any).ethereum;
  
  // Get membership NFT balance
  const { data: membershipBalance } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Get treasury balance
  const { data: treasuryBalance } = useBalance({
    address: CONTRACTS.SEPOLIA.TREASURY_PROXY,
  });

  // Get min donation
  const { data: minDonation } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'minDonationWei',
  });

  // Get proposal count (simplified - would need to track proposals)
  const proposalCount = 0; // TODO: Implement proposal counting

  // Get total members count
  const { data: totalMembers = 0, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['totalMembers'],
    queryFn: getTotalMembersCount,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const isMember = Boolean(membershipBalance && Number(membershipBalance) > 0);

  return (
    <div className="space-y-8" suppressHydrationWarning>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">DAO Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Welcome to Qawl DAO</p>
      </div>

      {/* Wallet Installation Guide - Show if no wallet detected */}
      {!hasWalletExtension && (
        <WalletInstallGuide />
      )}

      {/* Onboarding Checklist - Show if wallet not fully set up */}
      {hasWalletExtension && (
        <OnboardingChecklist />
      )}

      {/* Balance Check - Show if connected but low balance */}
      {isConnected && <BalanceCheck />}

      {!isConnected && hasWalletExtension && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-xl">🔗</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Connect Your Wallet to Get Started
              </h3>
              <p className="text-blue-800 dark:text-blue-300 mb-4">
                Connect your wallet to view your membership status, participate in governance, and interact with the DAO. 
                Look for the wallet button in the top right corner.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/getting-started"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  View Getting Started Guide →
                </Link>
                <span className="text-blue-700 dark:text-blue-400 text-sm self-center">
                  Or check the checklist above for step-by-step instructions
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link to getting started guide */}
      {!hasWalletExtension && (
        <div className="text-center">
          <Link
            href="/getting-started"
            className="inline-block px-4 py-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            View complete getting started guide →
          </Link>
        </div>
      )}

      {isConnected && !isMember && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-200 mb-2">Become a Member</h2>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            Join the DAO by minting a membership NFT. Minimum donation: {minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} Sepolia ETH
          </p>
          <Link
            href="/membership"
            className="inline-block px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Mint Membership
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Members</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Total Members</p>
                <p className="text-gray-300">
                  The total number of unique addresses that have minted a membership NFT. Each member has one vote in governance proposals.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {isLoadingMembers ? '...' : totalMembers}
          </p>
          <Link href="/membership" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Treasury Balance</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Treasury Balance</p>
                <p className="text-gray-300">
                  The total amount of Sepolia ETH held by the DAO treasury. Funds come from membership donations and can be spent through governance proposals to allowed recipients.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {treasuryBalance ? formatEther(BigInt(treasuryBalance.value.toString())) : '...'} Sepolia ETH
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Proposals</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Active Proposals</p>
                <p className="text-gray-300">
                  The number of governance proposals currently in the voting period. Members can vote on active proposals to decide DAO actions.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{proposalCount}</p>
          <Link href="/governance" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Your Status</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Your Status</p>
                <p className="text-gray-300">
                  Indicates whether your connected wallet address has minted a membership NFT. Members can vote on proposals and participate in DAO governance.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {isMember ? 'Member' : 'Not a Member'}
          </p>
          {isMember && (
            <Link href="/membership" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
              View membership →
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/membership"
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white">Membership</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Mint or view your membership NFT</p>
          </Link>
          <Link
            href="/governance"
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white">Governance</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create proposals and vote</p>
          </Link>
          <Link
            href="/treasury"
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white">Treasury</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">View treasury and execute payouts</p>
          </Link>
          <Link
            href="/constitution"
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white">Constitution</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">View governance parameters</p>
          </Link>
          <Link
            href="/philosophy"
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white">Design Philosophy</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Learn about our design principles</p>
          </Link>
          <Link
            href="/getting-started"
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white">Getting Started</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">New to crypto? Start here</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

