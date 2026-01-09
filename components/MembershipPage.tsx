'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWatchContractEvent } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { formatEther } from '@/lib/utils';
import { CONTRACTS } from '@/config/contracts';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { Constitution } from '@/abis/Constitution';
import { MintMembershipForm } from './MintMembershipForm';
import { UpdateMembershipForm } from './UpdateMembershipForm';
import { NFTMetadata, deleteMetadata, getMetadata, getAllMembers } from '@/lib/metadata';
import { NFTDisplay } from './NFTDisplay';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { BalanceCheck } from './BalanceCheck';
import { OnboardingChecklist } from './OnboardingChecklist';
import Link from 'next/link';

export function MembershipPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [delegationReturnedNotification, setDelegationReturnedNotification] = useState<string | null>(null);
  const [currentMetadata, setCurrentMetadata] = useState<NFTMetadata | null>(null);
  const [allMembers, setAllMembers] = useState<Array<{ tokenId: number; metadata: NFTMetadata; ownerAddress: string }>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [isMembershipStatusExpanded, setIsMembershipStatusExpanded] = useState(true);
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [privacyInitialized, setPrivacyInitialized] = useState(false);
  
  // Prevent hydration mismatch and ensure smooth initial render
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Delegation state
  const [delegationMode, setDelegationMode] = useState<'self' | 'other'>('self');
  const [delegateToAddress, setDelegateToAddress] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);
  const [showDelegationForm, setShowDelegationForm] = useState(false);
  const [delegationSuccess, setDelegationSuccess] = useState(false);

  // Get membership balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Get token ID if member - use tokenOfOwner (simpler, more reliable)
  const { data: tokenId, isLoading: isLoadingTokenId, error: tokenIdError, refetch: refetchTokenId } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'tokenOfOwner',
    args: address && balance && Number(balance) > 0 ? [address] : undefined,
    query: { enabled: !!address && !!balance && Number(balance) > 0 },
  });

  // Determine if user is a member (must be defined before hooks that use it)
  const isMember = balance ? Number(balance) > 0 : false;

  // Set initial privacy expanded state based on membership status
  // If user has NFT: collapsed (they can see their NFT card)
  // If user doesn't have NFT: expanded (they need to see the mint form)
  useEffect(() => {
    if (!privacyInitialized && address && balance !== undefined) {
      // Balance has loaded, set initial state
      setIsPrivacyExpanded(!isMember); // Expanded if not a member, collapsed if member
      setPrivacyInitialized(true);
    }
  }, [address, balance, isMember, privacyInitialized]);

  // Log tokenId fetch status for debugging
  useEffect(() => {
    if (address && balance && Number(balance) > 0) {
      console.log('🔍 TokenId fetch status:', {
        address,
        balance: balance.toString(),
        tokenId: tokenId?.toString(),
        isLoadingTokenId,
        tokenIdError: tokenIdError?.message,
      });
    }
  }, [address, balance, tokenId, isLoadingTokenId, tokenIdError]);

  // Get min donation
  const { data: minDonation } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'minDonationWei',
  });


  // Delegation contract calls
  const { writeContract: writeDelegate, data: delegateHash, isPending: isDelegatePending } = useWriteContract();
  const { isLoading: isDelegateConfirming, isSuccess: isDelegateSuccess } = useWaitForTransactionReceipt({
    hash: delegateHash,
  });

  // Burn contract calls
  const { writeContract: writeBurn, data: burnHash, isPending: isBurnPending } = useWriteContract();
  const { isLoading: isBurnConfirming, isSuccess: isBurnSuccess } = useWaitForTransactionReceipt({
    hash: burnHash,
  });

  // Get current delegation status
  const { data: currentDelegate, refetch: refetchDelegate } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'delegates',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isMember },
  });

  // Get current voting power
  const { data: votingPower, refetch: refetchVotingPower } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isMember },
  });

  // Function to load all members
  const loadAllMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const members = await getAllMembers();
      setAllMembers(members);
    } catch (err: any) {
      console.error('Failed to load all members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Handle successful mint
  const handleMintSuccess = () => {
    setShowForm(false);
    setError(null);
    // Invalidate queries to refresh UI
    queryClient.invalidateQueries();
    
    // Immediate refetch of members list (in case metadata update was fast)
    loadAllMembers();
    
    // Refetch balance, tokenId, and members list after delays to ensure everything is synced
    setTimeout(async () => {
      await refetchBalance();
      await refetchTokenId();
      await loadAllMembers(); // Refetch members list again
    }, 2000);
    
    // Final refetch after longer delay to ensure database propagation
    setTimeout(async () => {
      await loadAllMembers();
    }, 5000);
  };


  // Handle delegation success
  useEffect(() => {
    if (isDelegateSuccess) {
      setIsDelegating(false);
      setShowDelegationForm(false);
      setDelegateToAddress('');
      setDelegationSuccess(true);
      refetchDelegate();
      refetchVotingPower();
      // Clear success message after 5 seconds
      setTimeout(() => {
        setDelegationSuccess(false);
        setError(null);
      }, 5000);
    }
  }, [isDelegateSuccess, refetchDelegate, refetchVotingPower]);

  // Watch for DelegationReturned events
  useWatchContractEvent({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    eventName: 'DelegationReturned',
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (log.args?.delegator && log.args.delegator.toLowerCase() === address?.toLowerCase()) {
          setDelegationReturnedNotification(
            `Your voting power has been returned because ${log.args.previousDelegate?.substring(0, 6)}...${log.args.previousDelegate?.substring(38)} burned their NFT. Your votes are now delegated to yourself.`
          );
          // Auto-hide after 10 seconds
          setTimeout(() => setDelegationReturnedNotification(null), 10000);
          // Refetch delegation and voting power
          refetchDelegate();
          refetchVotingPower();
        }
      });
    },
  });

  // Handle burn success
  useEffect(() => {
    if (isBurnSuccess && burnHash) {
      // Delete metadata from Supabase after successful burn
      if (tokenId && address) {
        deleteMetadata(Number(tokenId), address).catch((err) => {
          console.error('Failed to delete metadata after burn:', err);
          // Don't show error to user as NFT is already burned
        });
      }
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      // Refresh the page to show updated state
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }, [isBurnSuccess, burnHash, tokenId, address]);

  // Load all members on component mount
  useEffect(() => {
    loadAllMembers();
  }, []);

  // Check if wallet extension is installed
  const hasWalletExtension = typeof window !== 'undefined' && !!(window as any).ethereum;

  return (
    <div className="space-y-8">
      {/* Onboarding Checklist - Show if wallet not fully set up */}
      {hasWalletExtension && <OnboardingChecklist />}

      {/* Balance Check - Show if connected but low balance */}
      {isConnected && <BalanceCheck />}

      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-xl">🎫</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Connect Your Wallet to View Your Membership
              </h3>
              <p className="text-blue-800 dark:text-blue-300 mb-4">
                Connect your wallet to see your membership NFT, mint a new membership, or manage your existing membership. 
                If you haven't set up a wallet yet, check the checklist above or visit our getting started guide.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/getting-started"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Getting Started Guide →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsMembershipStatusExpanded(!isMembershipStatusExpanded)}
            className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity mb-4"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Membership Status</h2>
            {isMembershipStatusExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 ml-2" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 ml-2" />
            )}
          </button>
          
          {isMembershipStatusExpanded && (
            <>
              {isMember && tokenId ? (
            <div className="space-y-4">
              {/* Data Privacy and Storage Notice */}
              {privacyInitialized && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <button
                    onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
                    className="w-full flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <span className="text-lg">🔒</span>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                        Your Data Privacy
                      </h3>
                      {isPrivacyExpanded ? (
                        <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2 transition-transform" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2 transition-transform" />
                      )}
                    </div>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isPrivacyExpanded ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="ml-11 space-y-2">
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        The personal information shown on your membership card is stored off-chain in a database. Only your wallet address, token ID, and governance records (proposal creation and voting records) are stored permanently on-chain.
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        <strong>What You Can Edit/Delete:</strong> You can edit or delete your name, photo, date of birth, and citizenship information at any time through the "Update" button on your membership card.
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        <strong>What You Cannot Edit/Delete:</strong> Your wallet address, token ID, issued date, and governance records (proposal creation and voting records) are permanent and cannot be modified.
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        <strong>Important:</strong> The connection between your on-chain wallet address/NFT and your off-chain personal data exists only in the off-chain database. Someone viewing the blockchain alone cannot link your wallet address to your personal information—this link only exists in the off-chain database.
                      </p>
                      <a
                        href="/philosophy#data-privacy"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium inline-block"
                      >
                        Learn more about data privacy and storage →
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* NFT Display Component with Update/Delete buttons */}
              <div className="flex flex-col md:flex-row gap-4 items-start">
                {/* NFT Card */}
                <div className="flex-1">
                  <NFTDisplay tokenId={Number(tokenId)} ownerAddress={address!} />
                </div>
                
                {/* Update and Delete Buttons - Right side */}
                {!showUpdateForm && !showDeleteConfirm && (
                  <div className="flex flex-row md:flex-col gap-2 md:pt-0 pt-2">
                    <button
                      onClick={async () => {
                        try {
                          const metadata = await getMetadata(Number(tokenId));
                          if (metadata) {
                            setCurrentMetadata(metadata);
                            setShowUpdateForm(true);
                          } else {
                            setError('Could not load current metadata');
                          }
                        } catch (err: any) {
                          setError(err.message || 'Failed to load metadata');
                        }
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 whitespace-nowrap"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 whitespace-nowrap"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Update Form */}
              {showUpdateForm && currentMetadata && (
                <div className="mt-4 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Update Membership Information
                  </h3>
                  <UpdateMembershipForm
                    tokenId={Number(tokenId)}
                    ownerAddress={address!}
                    currentMetadata={currentMetadata}
                    onSuccess={async () => {
                      setShowUpdateForm(false);
                      setCurrentMetadata(null);
                      // Refresh the page to show updated data
                      window.location.reload();
                    }}
                    onError={(err) => {
                      setError(err);
                    }}
                    onCancel={() => {
                      setShowUpdateForm(false);
                      setCurrentMetadata(null);
                    }}
                  />
                </div>
              )}
              
              {/* Voting Power & Delegation Status */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voting Power Status</h3>
                  <div className="relative group">
                    <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                      <p className="mb-2 font-semibold">Voting Power</p>
                      <p className="text-gray-300">
                        Your voting power determines how much weight your vote has in governance proposals. Each membership NFT grants 1 vote, which is automatically delegated to yourself when you mint. You can change delegation to vote directly or delegate to another address.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Voting Power:</span>
                      <div className="relative group">
                        <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                          <p className="mb-2 font-semibold">Voting Power</p>
                          <p className="text-gray-300">
                            Each DAO member has 1 vote, which can be delegated to yourself or to another address. When delegated to yourself, you can vote directly. When delegated to another address, that address can vote on your behalf.
                          </p>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      // Always show 1 vote if user is a member, regardless of delegation status
                      const displayVotingPower = isMember ? 1n : 0n;
                      const votingPowerBigInt = votingPower ? (typeof votingPower === 'bigint' ? votingPower : BigInt(votingPower.toString())) : 0n;
                      // Use green if voting power is activated (delegated to self), otherwise use default color
                      const isActivated = votingPowerBigInt > 0n;
                      return (
                        <span className={`text-sm font-semibold ${isActivated ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          {displayVotingPower.toString()} vote
                        </span>
                      );
                    })()}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Delegated to:</span>
                      <div className="relative group">
                        <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                          <p className="mb-2 font-semibold">Delegation</p>
                          <p className="text-gray-300">
                            Delegation determines who can use your voting power. You can delegate to yourself (to vote directly) or to another address (to let them vote on your behalf). New memberships are automatically delegated to yourself.
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-gray-900 dark:text-white break-all">
                      {currentDelegate && typeof currentDelegate === 'string' && currentDelegate !== '0x0000000000000000000000000000000000000000' 
                        ? (currentDelegate.toLowerCase() === address?.toLowerCase() 
                            ? 'Yourself' 
                            : `${currentDelegate.substring(0, 6)}...${currentDelegate.substring(38)}`)
                        : 'Not delegated'}
                    </span>
                  </div>

                  {(() => {
                    const votingPowerBigInt = votingPower ? (typeof votingPower === 'bigint' ? votingPower : BigInt(votingPower.toString())) : 0n;
                    return (
                      <>
                        {delegationSuccess && (
                          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                            <p className="text-xs text-green-800 dark:text-green-200">
                              ✅ Delegation updated successfully!
                            </p>
                          </div>
                        )}

                        {!showDelegationForm ? (
                          <button
                            onClick={() => {
                              setShowDelegationForm(true);
                              // If already delegated to self, default to 'other' mode
                              const isAlreadyDelegatedToSelf = currentDelegate && typeof currentDelegate === 'string' && currentDelegate.toLowerCase() === address?.toLowerCase();
                              setDelegationMode(isAlreadyDelegatedToSelf ? 'other' : 'self');
                              setDelegateToAddress('');
                            }}
                            className="w-full mt-3 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            Change Delegation
                          </button>
                        ) : (
                          <div className="mt-3 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Change Delegation</h4>
                            
                            <div className="space-y-3">
                              {/* Check if already delegated to self */}
                              {(() => {
                                const isAlreadyDelegatedToSelf = currentDelegate && typeof currentDelegate === 'string' && currentDelegate.toLowerCase() === address?.toLowerCase();
                                
                                // If already delegated to self, show only address input (no radio buttons)
                                if (isAlreadyDelegatedToSelf) {
                                  return (
                                    <div>
                                      <label htmlFor="delegateToAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Delegate to Address
                                        <div className="relative group inline-block ml-2">
                                          <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                                          <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                                            <p className="mb-2 font-semibold">Delegate to Another Address</p>
                                            <p className="text-gray-300">
                                              Allow another address to vote on your behalf. This is useful if you trust someone else to make governance decisions for you.
                                            </p>
                                          </div>
                                        </div>
                                      </label>
                                      <input
                                        id="delegateToAddress"
                                        type="text"
                                        value={delegateToAddress}
                                        onChange={(e) => setDelegateToAddress(e.target.value)}
                                        placeholder="0x..."
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                                      />
                                      {delegateToAddress && delegateToAddress.length !== 42 && !delegateToAddress.startsWith('0x') && (
                                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                          Please enter a valid Ethereum address (0x followed by 40 characters)
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                                
                                // If not delegated to self, show radio buttons with both options
                                return (
                                  <>
                                    <div>
                                      <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name="delegation"
                                          checked={delegationMode === 'self'}
                                          onChange={() => {
                                            setDelegationMode('self');
                                            setDelegateToAddress('');
                                          }}
                                          className="w-4 h-4 text-blue-600 dark:text-blue-400"
                                        />
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm text-gray-700 dark:text-gray-300">Delegate to myself</span>
                                          <div className="relative group">
                                            <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                                            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                                              <p className="mb-2 font-semibold">Delegate to Myself</p>
                                              <p className="text-gray-300">
                                                This allows you to vote directly on proposals using your voting power.
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </label>
                                    </div>
                                    
                                    <div>
                                      <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                          type="radio"
                                          name="delegation"
                                          checked={delegationMode === 'other'}
                                          onChange={() => setDelegationMode('other')}
                                          className="w-4 h-4 text-blue-600 dark:text-blue-400"
                                        />
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm text-gray-700 dark:text-gray-300">Delegate to another address</span>
                                          <div className="relative group">
                                            <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                                            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                                              <p className="mb-2 font-semibold">Delegate to Another Address</p>
                                              <p className="text-gray-300">
                                                Allow another address to vote on your behalf. This is useful if you trust someone else to make governance decisions for you.
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </label>
                                    </div>
                                    
                                    {delegationMode === 'other' && (
                                      <div>
                                        <label htmlFor="delegateToAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                          Delegate Address
                                        </label>
                                        <input
                                          id="delegateToAddress"
                                          type="text"
                                          value={delegateToAddress}
                                          onChange={(e) => setDelegateToAddress(e.target.value)}
                                          placeholder="0x..."
                                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                                        />
                                        {delegateToAddress && delegateToAddress.length !== 42 && !delegateToAddress.startsWith('0x') && (
                                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                            Please enter a valid Ethereum address (0x followed by 40 characters)
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowDelegationForm(false);
                                    setDelegationMode('self');
                                    setDelegateToAddress('');
                                  }}
                                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!address) return;
                                    
                                    // Determine target address based on current delegation status
                                    const isAlreadyDelegatedToSelf = currentDelegate && typeof currentDelegate === 'string' && currentDelegate.toLowerCase() === address?.toLowerCase();
                                    const targetAddress = isAlreadyDelegatedToSelf 
                                      ? delegateToAddress 
                                      : (delegationMode === 'self' ? address : delegateToAddress);
                                    
                                    if (!targetAddress || (!isAlreadyDelegatedToSelf && delegationMode === 'other' && !/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) || (isAlreadyDelegatedToSelf && !/^0x[a-fA-F0-9]{40}$/.test(targetAddress))) {
                                      setError('Please enter a valid Ethereum address');
                                      return;
                                    }

                                    setIsDelegating(true);
                                    setError(null);

                                    try {
                                      writeDelegate({
                                        address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
                                        abi: MembershipNFT,
                                        functionName: 'delegate',
                                        args: [targetAddress as `0x${string}`],
                                      });
                                    } catch (err: any) {
                                      console.error('Delegation error:', err);
                                      setError(err.message || 'Failed to delegate');
                                      setIsDelegating(false);
                                    }
                                  }}
                                  disabled={(() => {
                                    const isAlreadyDelegatedToSelf = currentDelegate && typeof currentDelegate === 'string' && currentDelegate.toLowerCase() === address?.toLowerCase();
                                    if (isAlreadyDelegatedToSelf) {
                                      return isDelegatePending || isDelegateConfirming || isDelegating || !delegateToAddress || delegateToAddress.length !== 42 || !delegateToAddress.startsWith('0x');
                                    }
                                    return isDelegatePending || isDelegateConfirming || isDelegating || (delegationMode === 'other' && (!delegateToAddress || delegateToAddress.length !== 42 || !delegateToAddress.startsWith('0x')));
                                  })()}
                                  className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                >
                                  {isDelegatePending || isDelegateConfirming || isDelegating ? 'Processing...' : 'Update Delegation'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Delegation Returned Notification */}
              {delegationReturnedNotification && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-green-900 dark:text-green-200 mb-1">
                        Voting Power Returned
                      </h3>
                      <p className="text-sm text-green-800 dark:text-green-300">
                        {delegationReturnedNotification}
                      </p>
                    </div>
                    <button
                      onClick={() => setDelegationReturnedNotification(null)}
                      className="ml-4 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Confirmation */}
              {showDeleteConfirm && (
                <div className="mt-4 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                    Burn Membership NFT?
                  </h3>
                  <p className="text-red-800 dark:text-red-300 mb-4">
                    <strong>Warning:</strong> This will permanently burn your membership NFT and remove your voting power. This action cannot be undone.
                  </p>
                  <ul className="text-red-800 dark:text-red-300 mb-4 space-y-2 text-sm list-disc list-inside">
                    <li>Your NFT will be permanently destroyed</li>
                    <li>Your voting power will be removed</li>
                    <li>If others delegated to you, their voting power will be automatically returned to them</li>
                    <li>Your membership metadata will be deleted</li>
                    <li>You will be able to mint again after burning</li>
                  </ul>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting || isBurnPending || isBurnConfirming}
                      className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!address || !tokenId) {
                          setError('Missing address or token ID');
                          return;
                        }

                        setIsDeleting(true);
                        setError(null);

                        try {
                          // Call burn() on the contract
                          writeBurn({
                            address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
                            abi: MembershipNFT,
                            functionName: 'burn',
                          });
                        } catch (err: any) {
                          console.error('Burn error:', err);
                          setError(err.message || 'Failed to initiate burn transaction');
                          setIsDeleting(false);
                        }
                      }}
                      disabled={isDeleting || isBurnPending || isBurnConfirming}
                      className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {isBurnPending ? 'Waiting for MetaMask...' : isBurnConfirming ? 'Burning NFT...' : isDeleting ? 'Processing...' : 'Burn NFT Permanently'}
                    </button>
                  </div>
                  {(isBurnPending || isBurnConfirming) && (
                    <p className="mt-3 text-xs text-red-700 dark:text-red-400">
                      Transaction in progress. Please wait...
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-gray-700 dark:text-gray-300">
                  Join the DAO by minting a membership NFT. Minimum donation: <strong className="text-gray-900 dark:text-white">{minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} Sepolia ETH</strong>
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                </div>
              )}

              {/* Data Privacy Notice */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-lg">🔒</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                      Data Privacy Notice
                    </h3>
                    <div className="space-y-2 text-xs text-blue-800 dark:text-blue-300 mb-3">
                      <p>
                        Before minting your membership NFT, please understand:
                      </p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>
                          <strong>Personal Information (Off-Chain):</strong> Your name, photo, date of birth, and citizenship 
                          information will be stored in an off-chain database (not on the blockchain)
                        </li>
                        <li>
                          <strong>On-Chain Data (Permanent):</strong> Only your wallet address, token ID, and governance records 
                          (proposal creation and voting records) are stored permanently on the blockchain and cannot be changed
                        </li>
                        <li>
                          <strong>What You Can Edit/Delete:</strong> You can edit or delete your name, photo, date of birth, and citizenship 
                          information at any time through the membership page
                        </li>
                        <li>
                          <strong>What You Cannot Edit/Delete:</strong> Your wallet address, token ID, issued date, and governance 
                          records (proposal creation and voting records) are permanent and cannot be modified
                        </li>
                        <li>
                          <strong>Privacy:</strong> Someone viewing only the blockchain cannot link your wallet 
                          address to your personal information—this link exists only in the off-chain database
                        </li>
                      </ul>
                      <a
                        href="/philosophy#data-privacy"
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-block"
                      >
                        Learn more about data privacy and storage →
                      </a>
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privacyNoticeAccepted}
                        onChange={(e) => setPrivacyNoticeAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <span className="text-sm text-blue-900 dark:text-blue-200">
                        I understand how my data will be stored and used
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  disabled={!privacyNoticeAccepted}
                  className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 dark:disabled:hover:bg-blue-500"
                >
                  Mint Membership
                </button>
              )}

              {showForm && (
                <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Mint Membership NFT
                  </h3>
                  <MintMembershipForm
                    onSuccess={handleMintSuccess}
                    onError={setError}
                    onCancel={() => {
                      setShowForm(false);
                      setError(null);
                      setPrivacyNoticeAccepted(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* All Members Section */}
      {allMembers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            All Members ({allMembers.length})
          </h2>
          {isLoadingMembers ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Loading members...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allMembers.map((member) => (
                <NFTDisplay
                  key={member.tokenId}
                  tokenId={member.tokenId}
                  ownerAddress={member.ownerAddress}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

