'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useChainId } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { uploadPhoto } from '@/lib/storage';
import { createMetadata, updateMetadataWithTokenId, NFTMetadata } from '@/lib/metadata';
import { CONTRACTS } from '@/config/contracts';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { Constitution } from '@/abis/Constitution';
import { formatEther, parseEther } from '@/lib/utils';
import { encodeFunctionData, decodeEventLog } from 'viem';
import { useQueryClient } from '@tanstack/react-query';

interface MintMembershipFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function MintMembershipForm({ onSuccess, onError, onCancel }: MintMembershipFormProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    citizenship: 'World Citizen for Palestine',
    photo: null as File | null,
    donationAmount: '',
  });

  // Get min donation
  const { data: minDonation } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'minDonationWei',
  });

  // Mint contract calls
  const { writeContract, data: hash, error: writeError, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle write errors from hook
  useEffect(() => {
    if (writeError) {
      console.error('❌ WriteContract error from hook:', writeError);
      const errorMessage = writeError.message || writeError.shortMessage || 'Unknown error';
      setIsMinting(false);
      
      // Check error code and message
      const errorCode = (writeError as any)?.code;
      const errorName = (writeError as any)?.name;
      
      if (errorCode === 4001 || errorMessage.toLowerCase().includes('rejected') || errorMessage.toLowerCase().includes('denied') || errorName === 'UserRejectedRequestError') {
        onError('Transaction was rejected. Please try again and approve the transaction in your wallet.');
      } else if (errorMessage.toLowerCase().includes('insufficient funds') || errorMessage.toLowerCase().includes('insufficient balance')) {
        onError('Insufficient balance. Please ensure you have enough Sepolia ETH to cover the donation and gas fees.');
      } else if (errorMessage.toLowerCase().includes('user rejected') || errorMessage.toLowerCase().includes('cancelled')) {
        onError('Transaction was cancelled. Please try again when ready.');
      } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('chain')) {
        onError('Network error. Please ensure you are connected to Sepolia network and try again.');
      } else {
        onError(`Transaction failed: ${errorMessage}. Please check your wallet and try again.`);
      }
    }
  }, [writeError, onError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        onError('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        onError('Image size must be less than 5MB');
        return;
      }
      setFormData({ ...formData, photo: file });
    }
  };

  // Handle transaction hash when it becomes available
  useEffect(() => {
    async function handleTransactionHash() {
      if (!hash || !publicClient || !address || !formData.name || !formData.photo) {
        return;
      }

      console.log('✅ Transaction hash available from hook:', hash);
      console.log('⏳ Waiting for transaction receipt...', hash);
      
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log('✅ Transaction receipt received:', receipt);
        
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

          if (memberMintedEvent && memberMintedEvent.args) {
            const tokenId = Number((memberMintedEvent.args as any).tokenId);
            console.log('✅ Extracted tokenId:', tokenId);

            // Upload photo and create metadata
            const photoFileName = `token-${Date.now()}-${address.slice(2, 10)}.${formData.photo.name.split('.').pop()}`;
            const photoUrl = await uploadPhoto(formData.photo, photoFileName);

            const issuedDate = new Date().toISOString().split('T')[0];
            
            const metadata: NFTMetadata = {
              name: `Honorary Citizenship #${formData.name}`,
              description: `Honorary citizenship certificate for ${formData.name}`,
              image: photoUrl,
              attributes: [
                { trait_type: 'Name', value: formData.name },
                { trait_type: 'Date of Birth', value: formData.dateOfBirth || 'Not provided' },
                { trait_type: 'Citizenship', value: formData.citizenship },
                { trait_type: 'Issued Date', value: issuedDate },
              ],
              properties: {
                ownerAddress: address,
                name: formData.name,
                dateOfBirth: formData.dateOfBirth || undefined,
                citizenship: formData.citizenship,
                issuedDate: issuedDate,
                photoUrl: photoUrl,
                photoFileName: photoFileName,
              },
            };

            // Create metadata first, then update with tokenId
            await createMetadata(address, metadata);
            await updateMetadataWithTokenId(tokenId, address, metadata);
            console.log('✅✅✅ Successfully updated metadata with tokenId:', tokenId);
            
            // Invalidate queries to refresh UI
            queryClient.invalidateQueries();
            
            setIsMinting(false);
            onSuccess();
          } else {
            console.warn('MemberMinted event not found in transaction logs');
            onError('Mint successful, but could not extract tokenId. Please refresh the page.');
            setIsMinting(false);
          }
        } catch (error) {
          console.error('Error parsing event logs:', error);
          onError('Mint successful, but failed to parse transaction. Please refresh the page.');
          setIsMinting(false);
        }
      } catch (error: any) {
        console.error('Error waiting for transaction receipt:', error);
        onError(`Transaction sent but failed: ${error.message}`);
        setIsMinting(false);
      }
    }

    handleTransactionHash();
  }, [hash, publicClient, address, formData, queryClient, onSuccess, onError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address || !isConnected) {
      onError('Please connect your wallet');
      return;
    }

    // Check if on correct network
    if (chainId !== sepolia.id) {
      onError(`Please switch to Sepolia network. Current network: ${chainId}`);
      return;
    }

    if (!formData.name.trim()) {
      onError('Please enter your name');
      return;
    }

    if (!formData.photo) {
      onError('Please upload a photo');
      return;
    }

    if (!formData.donationAmount) {
      onError('Please enter a donation amount');
      return;
    }

    const minDonationEth = minDonation ? formatEther(BigInt(minDonation.toString())) : '0';
    const donationAmountEth = parseFloat(formData.donationAmount);
    const minDonationFloat = parseFloat(minDonationEth);

    if (donationAmountEth < minDonationFloat) {
      onError(`Donation must be at least ${minDonationEth} Sepolia ETH`);
      return;
    }

    setIsMinting(true);

    try {
      const amountWei = parseEther(formData.donationAmount);
      console.log('🚀 Starting mint transaction...', {
        address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
        value: amountWei.toString(),
        userAddress: address,
      });

      // Estimate gas first, then cap it at 15M to avoid RPC limits
      let gasLimit: bigint | undefined;
      if (publicClient) {
        try {
          console.log('⛽ Estimating gas...');
          const estimatedGas = await publicClient.estimateGas({
            account: address as `0x${string}`,
            to: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
            data: encodeFunctionData({
              abi: MembershipNFT,
              functionName: 'mint',
            }),
            value: amountWei,
          });
          gasLimit = estimatedGas > BigInt(15000000) ? BigInt(15000000) : estimatedGas;
          console.log('⛽ Gas estimated:', gasLimit.toString());
        } catch (estimateError: any) {
          console.error('⛽ Gas estimation error:', estimateError);
          if (estimateError?.message?.includes('Already minted') || estimateError?.shortMessage?.includes('Already minted')) {
            onError('You have already minted a membership NFT. Please refresh the page.');
            setIsMinting(false);
            return;
          }
          if (estimateError?.message?.includes('insufficient funds') || estimateError?.shortMessage?.includes('insufficient')) {
            onError('Insufficient balance. Please ensure you have enough Sepolia ETH to cover the donation and gas fees.');
            setIsMinting(false);
            return;
          }
          console.warn('Gas estimation failed, using default:', estimateError);
          gasLimit = BigInt(15000000);
        }
      }

      // Verify wallet is still connected before calling writeContract
      if (!address || !isConnected) {
        throw new Error('Wallet disconnected. Please reconnect your wallet.');
      }

      console.log('📝 Calling writeContract with params:', {
        address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
        functionName: 'mint',
        value: amountWei.toString(),
        gas: gasLimit?.toString(),
        chainId: chainId,
        userAddress: address,
      });

      // writeContract doesn't throw synchronously - errors come via the hook's error state
      // It should trigger MetaMask to open immediately
      writeContract({
        address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
        abi: MembershipNFT,
        functionName: 'mint',
        value: amountWei,
        ...(gasLimit && { gas: gasLimit }),
      });
      
      console.log('✅ writeContract called successfully');
      console.log('⏳ MetaMask should open now. If it doesn\'t, check:');
      console.log('   1. MetaMask extension is enabled');
      console.log('   2. You are on Sepolia network');
      console.log('   3. Browser console for errors');
      
      // Note: We don't set isMinting(false) here because we need to wait for either:
      // 1. The hash to appear (user approved in MetaMask)
      // 2. An error from the hook (user rejected or error occurred)
      // The error handler useEffect will handle rejection cases
      
    } catch (error: any) {
      console.error('❌ Unexpected error in handleSubmit:', error);
      setIsMinting(false);
      onError(error?.message || 'Failed to initiate transaction. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Francesca Paola Albanese"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date of Birth
        </label>
        <input
          id="dateOfBirth"
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="citizenship" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Citizenship Type
        </label>
        <input
          id="citizenship"
          type="text"
          value={formData.citizenship}
          onChange={(e) => setFormData({ ...formData, citizenship: e.target.value })}
          placeholder="World Citizen for Palestine"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="photo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Photo <span className="text-red-500">*</span>
        </label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          required
          onChange={handleFileChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
        />
        {formData.photo && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Selected: {formData.photo.name} ({(formData.photo.size / 1024).toFixed(2)} KB)
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
        </p>
      </div>

      <div>
        <label htmlFor="donationAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Donation Amount (Sepolia ETH) <span className="text-red-500">*</span>
        </label>
        <input
          id="donationAmount"
          type="number"
          step="0.001"
          min={minDonation ? formatEther(BigInt(minDonation.toString())) : '0'}
          value={formData.donationAmount}
          onChange={(e) => setFormData({ ...formData, donationAmount: e.target.value })}
          placeholder={minDonation ? formatEther(BigInt(minDonation.toString())) : '0.0'}
          required
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Minimum: {minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} Sepolia ETH
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading || isMinting || isConfirming || isWritePending}
          className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:dark:bg-transparent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isUploading || isMinting || isConfirming || isWritePending}
          className="flex-1 px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isUploading ? 'Uploading Photo...' : isMinting || isWritePending ? 'Waiting for MetaMask...' : isConfirming ? 'Confirming Transaction...' : 'Mint Membership NFT'}
        </button>
      </div>
    </form>
  );
}

