'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { formatEther } from '@/lib/utils';
import { CONTRACTS } from '@/config/contracts';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { Constitution } from '@/abis/Constitution';
import { MintMembershipForm } from './MintMembershipForm';
import { UpdateMembershipForm } from './UpdateMembershipForm';
import { NFTMetadata, deleteMetadata, getMetadata, getAllMembers } from '@/lib/metadata';
import { NFTDisplay } from './NFTDisplay';
import { HelpCircle } from 'lucide-react';

export function MembershipPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentMetadata, setCurrentMetadata] = useState<NFTMetadata | null>(null);
  const [allMembers, setAllMembers] = useState<Array<{ tokenId: number; metadata: NFTMetadata; ownerAddress: string }>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  
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

  // Load all members on component mount
  useEffect(() => {
    loadAllMembers();
  }, []);

  return (
    <div className="space-y-8">
      {!isConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">Please connect your wallet to view your membership.</p>
        </div>
      )}

      {isConnected && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Membership Status</h2>
          
          {isMember && tokenId ? (
            <div className="space-y-4">
              {/* NFT Display Component - Now includes all info */}
              <NFTDisplay tokenId={Number(tokenId)} ownerAddress={address!} />
              
              {/* Voting Power & Delegation Status */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voting Power Status</h3>
                  <div className="relative group">
                    <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                      <p className="mb-2 font-semibold">Voting Power</p>
                      <p className="text-gray-300">
                        Your voting power determines how much weight your vote has in governance proposals. Each membership NFT grants 1 vote, but you must delegate your votes (to yourself or another address) to activate them.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Current Voting Power:</span>
                      <div className="relative group">
                        <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                          <p className="mb-2 font-semibold">Current Voting Power</p>
                          <p className="text-gray-300">
                            The number of votes you currently have available for voting on proposals. This is 0 until you delegate your votes.
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${votingPower && Number(votingPower) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {votingPower ? Number(votingPower).toLocaleString() : '0'} vote{votingPower && Number(votingPower) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Delegated to:</span>
                      <div className="relative group">
                        <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                          <p className="mb-2 font-semibold">Delegation</p>
                          <p className="text-gray-300">
                            Delegation determines who can use your voting power. You can delegate to yourself (to vote directly) or to another address (to let them vote on your behalf). Delegation is required to activate your voting power.
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-gray-900 dark:text-white break-all">
                      {currentDelegate && currentDelegate !== '0x0000000000000000000000000000000000000000' 
                        ? (currentDelegate.toLowerCase() === address?.toLowerCase() 
                            ? 'Yourself' 
                            : `${currentDelegate.substring(0, 6)}...${currentDelegate.substring(38)}`)
                        : 'Not delegated'}
                    </span>
                  </div>

                  {votingPower && Number(votingPower) === 0 && !delegationSuccess && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        ⚠️ Your voting power is not activated. Delegate to yourself or another address to activate it.
                      </p>
                    </div>
                  )}

                  {delegationSuccess && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-800 dark:text-green-200">
                        ✅ Delegation updated successfully! Your voting power has been activated.
                      </p>
                    </div>
                  )}

                  {!showDelegationForm ? (
                    <button
                      onClick={() => {
                        setShowDelegationForm(true);
                        setDelegationMode(currentDelegate && currentDelegate.toLowerCase() === address?.toLowerCase() ? 'self' : 'self');
                        setDelegateToAddress('');
                      }}
                      className="w-full mt-3 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                      {votingPower && Number(votingPower) > 0 ? 'Change Delegation' : 'Activate Voting Power'}
                    </button>
                  ) : (
                    <div className="mt-3 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Change Delegation</h4>
                      
                      <div className="space-y-3">
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
                                    This activates your voting power so you can vote directly on proposals. This is the most common choice for individual members.
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
                                    This allows another address (e.g., a trusted delegate or voting service) to vote on your behalf. They will use your voting power when voting on proposals.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </label>
                        </div>

                        {delegationMode === 'other' && (
                          <div className="ml-6">
                            <input
                              type="text"
                              placeholder="0x..."
                              value={delegateToAddress}
                              onChange={(e) => setDelegateToAddress(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Enter the Ethereum address to delegate your voting power to
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => {
                              setShowDelegationForm(false);
                              setDelegateToAddress('');
                            }}
                            disabled={isDelegatePending || isDelegateConfirming}
                            className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (!address) return;
                              
                              const targetAddress = delegationMode === 'self' ? address : delegateToAddress;
                              
                              if (!targetAddress || (delegationMode === 'other' && !/^0x[a-fA-F0-9]{40}$/.test(targetAddress))) {
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
                            disabled={isDelegatePending || isDelegateConfirming || isDelegating || (delegationMode === 'other' && !delegateToAddress)}
                            className="flex-1 px-3 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDelegatePending || isDelegateConfirming || isDelegating ? 'Processing...' : 'Update Delegation'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Update and Delete Buttons - Less Prominent */}
              {!showUpdateForm && !showDeleteConfirm && (
                <div className="flex gap-2 pt-2 justify-end">
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
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
                  >
                    Delete
                  </button>
                </div>
              )}

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

              {/* Delete Confirmation */}
              {showDeleteConfirm && (
                <div className="mt-4 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                    Delete Membership?
                  </h3>
                  <p className="text-red-800 dark:text-red-300 mb-4">
                    Are you sure you want to delete your membership metadata? This action cannot be undone. 
                    Your NFT will remain on the blockchain, but all associated metadata (name, photo, etc.) will be permanently deleted.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setIsDeleting(true);
                        try {
                          await deleteMetadata(Number(tokenId), address!);
                          setShowDeleteConfirm(false);
                          // Refresh the page
                          window.location.reload();
                        } catch (err: any) {
                          setError(err.message || 'Failed to delete membership');
                          setIsDeleting(false);
                        }
                      }}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Join the DAO by minting a membership NFT</p>
                <p className="text-gray-700 dark:text-gray-300">
                  Join the DAO by minting a membership NFT. Minimum donation: <strong className="text-gray-900 dark:text-white">{minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} ETH</strong>
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                </div>
              )}

              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
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
                    }}
                  />
                </div>
              )}
            </div>
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

