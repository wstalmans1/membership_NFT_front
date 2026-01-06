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

      {!isConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">Please connect your wallet to interact with the DAO.</p>
          {!hasWalletExtension && (
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-2">Install MetaMask or Brave Wallet to continue.</p>
          )}
        </div>
      )}

      {isConnected && !isMember && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-200 mb-2">Become a Member</h2>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            Join the DAO by minting a membership NFT. Minimum donation: {minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} ETH
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
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Members</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {isLoadingMembers ? '...' : totalMembers}
          </p>
          <Link href="/membership" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Treasury Balance</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {treasuryBalance ? formatEther(BigInt(treasuryBalance.value.toString())) : '...'} ETH
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Active Proposals</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{proposalCount}</p>
          <Link href="/governance" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Your Status</h3>
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
        </div>
      </div>
    </div>
  );
}

