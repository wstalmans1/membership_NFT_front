'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { encodeFunctionData, decodeEventLog } from 'viem';
import { parseEther, formatEther } from '@/lib/utils';
import { CONTRACTS } from '@/config/contracts';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { Constitution } from '@/abis/Constitution';
import { MintMembershipForm } from './MintMembershipForm';
import { UpdateMembershipForm } from './UpdateMembershipForm';
import { NFTMetadata, updateMetadataWithTokenId, deleteMetadata, getMetadata, getAllMembers } from '@/lib/metadata';
import { NFTDisplay } from './NFTDisplay';
import { HelpCircle } from 'lucide-react';

export function MembershipPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [donationAmount, setDonationAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [metadataReady, setMetadataReady] = useState(false);
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
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

  // Mint membership
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
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

  // Handle write errors from hook
  useEffect(() => {
    if (writeError) {
      console.error('❌ WriteContract error from hook:', writeError);
      const errorMessage = writeError.message || 'Unknown error';
      if (errorMessage.includes('rejected') || errorMessage.includes('denied') || (writeError as any)?.code === 4001) {
        setError('Transaction was rejected. Please try again and approve the transaction in your wallet.');
      } else {
        setError(`Transaction failed: ${errorMessage}. Please try again.`);
      }
      setIsMinting(false);
    }
  }, [writeError]);

  // Handle metadata ready callback from form
  const handleMetadataReady = (preparedMetadata: NFTMetadata) => {
    setMetadata(preparedMetadata);
    setMetadataReady(true);
    setShowForm(false);
    setError(null);
  };

  // Handle minting after metadata is ready
  const handleMint = async () => {
    if (!address || !minDonation || !metadata) {
      setError('Please complete the metadata form first');
      return;
    }
    
    const minDonationBigInt = BigInt(minDonation.toString());
    const amount = donationAmount || formatEther(minDonationBigInt);
    const amountWei = parseEther(amount);
    
    if (amountWei < minDonationBigInt) {
      setError(`Minimum donation is ${formatEther(minDonationBigInt)} ETH`);
      return;
    }

    setIsMinting(true);
    setError(null);
    
    try {
      // Estimate gas first, then cap it at 15M to avoid RPC limits
      let gasLimit: bigint | undefined;
      if (publicClient) {
        try {
          const estimatedGas = await publicClient.estimateGas({
            account: address as `0x${string}`,
            to: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
            data: encodeFunctionData({
              abi: MembershipNFT,
              functionName: 'mint',
            }),
            value: amountWei,
          });
          // Cap at 15M (below MetaMask's 16.7M limit)
          gasLimit = estimatedGas > BigInt(15000000) ? BigInt(15000000) : estimatedGas;
          console.log('Estimated gas:', estimatedGas.toString(), 'Using:', gasLimit.toString());
        } catch (estimateError) {
          console.warn('Gas estimation failed, using default:', estimateError);
          gasLimit = BigInt(15000000); // Fallback to 15M
        }
      }

      console.log('🚀 Calling writeContract...');
      console.log('🚀 WriteContract params:', {
        address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
        functionName: 'mint',
        value: amountWei.toString(),
        gas: gasLimit?.toString(),
      });
      
      try {
        // writeContract doesn't return a hash directly - it's available via the hook's 'hash' state
        writeContract({
          address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
          abi: MembershipNFT,
          functionName: 'mint',
          value: amountWei,
          ...(gasLimit && { gas: gasLimit }),
        });
        console.log('✅ writeContract called, waiting for hash from hook...');
      } catch (writeError: any) {
        console.error('❌ writeContract error:', writeError);
        // Check if user rejected the transaction
        if (writeError?.message?.includes('rejected') || writeError?.message?.includes('denied') || writeError?.code === 4001) {
          setError('Transaction was rejected. Please try again and approve the transaction in your wallet.');
        } else {
          setError(`Failed to send transaction: ${writeError?.message || 'Unknown error'}. Please try again.`);
        }
        setIsMinting(false);
        return;
      }
      
      // Transaction hash will be handled by useEffect above when it becomes available
      console.log('✅ writeContract called. Transaction hash will be handled by useEffect when available.');
    } catch (error: any) {
      console.error('Mint error:', error);
      // Check if error is "Already minted"
      if (error.message?.includes('Already minted') || error.message?.includes('already minted')) {
        setError('You have already minted a membership NFT. Please refresh the page to view it.');
        // Refresh balance to show the NFT
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(error.message || 'Failed to mint NFT. Please try again.');
      }
      setIsMinting(false);
    }
  };

  // Handle transaction hash when it becomes available
  useEffect(() => {
    async function handleTransactionHash() {
      if (!hash || !publicClient || !address || !metadata) {
        return;
      }

      console.log('✅ Transaction hash available from hook:', hash);
      console.log('⏳ Waiting for transaction receipt...', hash);
      
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log('✅ Transaction receipt received:', receipt);
        console.log('✅ Transaction status:', receipt.status);
        console.log('✅ Number of logs:', receipt.logs.length);
        
        // Extract tokenId from event logs
        try {
          const decodedLogs = receipt.logs
            .map((log) => {
              try {
                return decodeEventLog({
                  abi: MembershipNFT,
                  data: log.data,
                  topics: log.topics,
                });
              } catch {
                return null;
              }
            })
            .filter(Boolean);

          const memberMintedEvent = decodedLogs.find(
            (log: any) => log?.eventName === 'MemberMinted'
          );

          console.log('📋 Decoded logs:', decodedLogs);
          console.log('🔍 MemberMinted event found:', memberMintedEvent);

          if (memberMintedEvent && memberMintedEvent.args) {
            const tokenId = Number((memberMintedEvent.args as any).tokenId);
            console.log('✅ Extracted tokenId:', tokenId);
            console.log('✅ Updating metadata for address:', address);

            // Update metadata with tokenId
            try {
              const { updateMetadataWithTokenId } = await import('@/lib/metadata');
              const updatePromise = updateMetadataWithTokenId(tokenId, address, {
                ...metadata,
                properties: {
                  ...metadata.properties,
                  tokenId: tokenId,
                },
              });
              
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Metadata update timed out after 30 seconds')), 30000)
              );
              
              await Promise.race([updatePromise, timeoutPromise]);
              console.log('✅✅✅ Successfully updated metadata with tokenId:', tokenId);
              
              // Show success message
              setError(null);
              
              // Invalidate and refetch all contract queries to update the UI
              console.log('🔄 Invalidating queries and refetching balance/tokenId...');
              
              // Invalidate all wagmi queries to force refresh
              queryClient.invalidateQueries();
              
              // Refetch balance immediately
              const balanceResult = await refetchBalance();
              console.log('📊 Balance refetch result:', balanceResult);
              
              // Wait for blockchain state to propagate (blocks take ~12 seconds on Sepolia)
              // Then refetch both balance and tokenId
              setTimeout(async () => {
                console.log('🔄 Refetching balance and tokenId after delay...');
                await refetchBalance();
                const tokenResult = await refetchTokenId();
                console.log('📊 TokenId refetch result:', tokenResult);
                console.log('✅ UI should now show the NFT');
              }, 3000);
              
              setIsMinting(false);
            } catch (updateError: any) {
              console.error('Failed to update metadata:', updateError);
              setError(`Mint successful, but failed to update metadata: ${updateError.message}. You can manually update it later.`);
              setIsMinting(false);
            }
          } else {
            console.warn('MemberMinted event not found in transaction logs');
            setError('Mint successful, but could not extract tokenId. Please refresh the page.');
            setIsMinting(false);
          }
        } catch (error) {
          console.error('Error parsing event logs:', error);
          setError('Mint successful, but failed to parse transaction. Please refresh the page.');
          setIsMinting(false);
        }
      } catch (error: any) {
        console.error('Error waiting for transaction receipt:', error);
        setError(`Transaction sent but failed: ${error.message}`);
        setIsMinting(false);
      }
    }

    handleTransactionHash();
  }, [hash, publicClient, address, metadata]);

  // Reset form when minting is successful
  useEffect(() => {
    if (isSuccess) {
      setIsMinting(false);
      setMetadataReady(false);
      setMetadata(null);
      setShowForm(false);
    }
  }, [isSuccess]);

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
    async function loadAllMembers() {
      setIsLoadingMembers(true);
      try {
        const members = await getAllMembers();
        setAllMembers(members);
      } catch (err: any) {
        console.error('Failed to load all members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    }
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Become a Member</p>
                <p className="text-gray-700 dark:text-gray-300">
                  Join the DAO by minting a membership NFT. Minimum donation: <strong className="text-gray-900 dark:text-white">{minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} ETH</strong>
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                </div>
              )}

              {!showForm && !metadataReady && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
                >
                  Start Membership Application
                </button>
              )}

              {showForm && !metadataReady && (
                <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Membership Information
                  </h3>
                  <MintMembershipForm
                    onMetadataReady={handleMetadataReady}
                    onError={setError}
                  />
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setError(null);
                    }}
                    className="mt-4 w-full px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {metadataReady && metadata && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-green-800 dark:text-green-200 text-sm font-medium mb-2">
                      ✓ Metadata prepared successfully
                    </p>
                    <p className="text-green-700 dark:text-green-300 text-xs">
                      Your information has been saved. Complete your donation to mint your membership NFT.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="donation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Donation Amount (ETH)
                    </label>
                    <input
                      id="donation"
                      type="number"
                      step="0.001"
                      min={minDonation ? formatEther(BigInt(minDonation.toString())) : '0'}
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      placeholder={minDonation ? formatEther(BigInt(minDonation.toString())) : '0.0'}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Minimum: {minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} ETH
                    </p>
                  </div>

                  <button
                    onClick={handleMint}
                    disabled={isPending || isConfirming || isMinting}
                    className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isPending || isConfirming || isMinting ? 'Processing...' : 'Mint Membership NFT'}
                  </button>

                  {isSuccess && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-green-800 dark:text-green-200 font-medium">Membership NFT minted successfully!</p>
                      <p className="text-green-700 dark:text-green-400 text-sm mt-2">
                        Your membership NFT has been created and your metadata has been linked.
                      </p>
                      {hash && (
                        <a
                          href={`https://eth-sepolia.blockscout.com/tx/${hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 dark:text-green-400 hover:underline text-sm mt-2 inline-block"
                        >
                          View transaction →
                        </a>
                      )}
                    </div>
                  )}
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

