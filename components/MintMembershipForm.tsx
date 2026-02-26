'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useChainId, useReadContract } from 'wagmi';
import { sepolia } from 'viem/chains';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { useWallets } from '@privy-io/react-auth';
import { uploadPhoto } from '@/lib/storage';
import { createMetadata, updateMetadataWithTokenId, NFTMetadata } from '@/lib/metadata';
import { CONTRACTS } from '@/config/contracts';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { Constitution } from '@/abis/Constitution';
import { formatEther, parseEther } from '@/lib/utils';
import { decodeEventLog } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { useWalletAddress } from '@/hooks/useWalletAddress';

interface MintMembershipFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function MintMembershipForm({ onSuccess, onError, onCancel }: MintMembershipFormProps) {
  const { address, isConnected } = useWalletAddress();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  // Smart wallet client for email/Google users (Privy-managed ZeroDev account)
  const { client: smartWalletClient } = useSmartWallets();
  const { wallets } = useWallets();
  const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy');

  const [isUploading, setIsUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    citizenship: 'World Citizen for Palestine',
    photo: null as File | null,
    donationAmount: '',
  });

  // Get min donation from the Constitution contract
  const { data: minDonation } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'minDonationWei',
  });

  // wagmi hooks — used only for the external wallet (MetaMask) path
  const { writeContract, data: hash, error: writeError, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  // Handle errors from the wagmi writeContract hook (MetaMask path only)
  useEffect(() => {
    if (writeError) {
      console.error('❌ WriteContract error from hook:', writeError);
      const errorMessage = writeError.message || (writeError as any).shortMessage || 'Unknown error';
      setIsMinting(false);
      const errorCode = (writeError as any)?.code;
      const errorName = (writeError as any)?.name;
      if (errorCode === 4001 || errorMessage.toLowerCase().includes('rejected') || errorMessage.toLowerCase().includes('denied') || errorName === 'UserRejectedRequestError') {
        onError('Transaction was rejected. Please try again and approve the transaction in your wallet.');
      } else if (errorMessage.toLowerCase().includes('user rejected') || errorMessage.toLowerCase().includes('cancelled')) {
        onError('Transaction was cancelled. Please try again when ready.');
      } else if (errorMessage.toLowerCase().includes('insufficient funds') || errorMessage.toLowerCase().includes('insufficient balance')) {
        onError('Insufficient balance. Please ensure you have enough Sepolia ETH to cover gas fees.');
      } else {
        onError(`Transaction failed: ${errorMessage}`);
      }
    }
  }, [writeError, onError]);

  /**
   * Shared receipt processing — called by both the smart wallet path (inline)
   * and the wagmi/MetaMask path (via useEffect below).
   */
  async function processReceipt(
    txHash: `0x${string}`,
    fromAddress: `0x${string}`
  ) {
    console.log('⏳ Waiting for transaction receipt…', txHash);
    const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
    console.log('✅ Receipt received:', receipt);

    const decodedLogs = receipt.logs
      .map((log) => {
        try {
          return decodeEventLog({ abi: MembershipNFT, data: log.data, topics: log.topics });
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const memberMintedEvent = decodedLogs.find((log: any) => log?.eventName === 'MemberMinted');
    if (!memberMintedEvent || !memberMintedEvent.args) {
      console.warn('MemberMinted event not found in receipt logs');
      onError('Mint successful, but could not extract token ID. Please refresh the page.');
      setIsMinting(false);
      return;
    }

    const tokenId = Number((memberMintedEvent.args as any).tokenId);
    console.log('✅ Token ID:', tokenId);

    setIsUploading(true);
    const photoFileName = `token-${Date.now()}-${fromAddress.slice(2, 10)}.${formData.photo!.name.split('.').pop()}`;
    const photoUrl = await uploadPhoto(formData.photo!, photoFileName);
    setIsUploading(false);

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
        ownerAddress: fromAddress,
        name: formData.name,
        dateOfBirth: formData.dateOfBirth || undefined,
        citizenship: formData.citizenship,
        issuedDate,
        photoUrl,
        photoFileName,
      },
    };

    await createMetadata(fromAddress, metadata);
    await updateMetadataWithTokenId(tokenId, fromAddress, metadata);
    console.log('✅ Metadata saved, token ID:', tokenId);

    queryClient.invalidateQueries();
    setIsMinting(false);
    onSuccess();
  }

  // Handle transaction hash from the wagmi writeContract hook (MetaMask path)
  useEffect(() => {
    if (!hash || !publicClient || !address || !formData.name || !formData.photo) return;
    console.log('✅ Transaction hash from wagmi hook:', hash);

    processReceipt(hash, address as `0x${string}`).catch((error: any) => {
      console.error('Error processing MetaMask receipt:', error);
      onError(`Transaction sent but failed: ${error.message}`);
      setIsMinting(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { onError('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { onError('Image size must be less than 5MB'); return; }
    setFormData({ ...formData, photo: file });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !isConnected) { onError('Please connect your wallet'); return; }
    // Embedded wallet users are always on Sepolia via their smart wallet — skip chain check.
    if (!hasEmbeddedWallet && chainId !== sepolia.id) {
      onError(`Please switch to Sepolia network. Current network: ${chainId}`);
      return;
    }
    if (!formData.name.trim()) { onError('Please enter your name'); return; }
    if (!formData.photo) { onError('Please upload a photo'); return; }

    // Donation validation only applies to external wallet users.
    const effectiveDonation = hasEmbeddedWallet ? '0' : formData.donationAmount;
    if (!hasEmbeddedWallet) {
      if (!effectiveDonation) { onError('Please enter a donation amount'); return; }
      const minDonationEth = minDonation ? formatEther(BigInt(minDonation.toString())) : '0';
      if (parseFloat(effectiveDonation) < parseFloat(minDonationEth)) {
        onError(`Donation must be at least ${minDonationEth} Sepolia ETH`);
        return;
      }
    }

    setIsMinting(true);
    const amountWei = parseEther(effectiveDonation);
    console.log('🚀 Starting mint…', { contract: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY, value: amountWei.toString(), from: address });

    try {
      // ── Smart wallet path (email / Google login) ──────────────────────────
      if (hasEmbeddedWallet && smartWalletClient) {
        console.log('🔑 Using Privy smart wallet for gas-sponsored mint…');
        const txHash = await smartWalletClient.writeContract({
          address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
          abi: MembershipNFT,
          functionName: 'mint',
          value: amountWei,
          chain: sepolia,
          account: smartWalletClient.account as any,
        });
        console.log('✅ Smart wallet tx hash:', txHash);
        await processReceipt(txHash as `0x${string}`, smartWalletClient.account!.address as `0x${string}`);
        return;
      }

      // ── External wallet path (MetaMask / Brave Wallet) ────────────────────
      console.log('🦊 Using external wallet — sending via wagmi writeContract…');
      writeContract({
        address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
        abi: MembershipNFT,
        functionName: 'mint',
        value: amountWei,
      });
      console.log('✅ writeContract called — waiting for wallet approval…');
      // receipt handling is done in the useEffect that watches `hash`

    } catch (error: any) {
      console.error('❌ Mint error:', error);
      setIsMinting(false);
      const msg = error?.shortMessage || error?.message || 'Failed to initiate transaction.';
      if (msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('denied')) {
        onError('Transaction was rejected.');
      } else {
        onError(`Transaction failed: ${msg}`);
      }
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

      {!hasEmbeddedWallet && (
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
            Minimum: {minDonation ? formatEther(BigInt(minDonation.toString())) : '…'} Sepolia ETH
          </p>
        </div>
      )}

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
          className="flex-1 px-4 py-3 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isUploading
            ? 'Uploading Photo…'
            : isMinting || isWritePending
            ? 'Waiting for approval…'
            : isConfirming
            ? 'Confirming Transaction…'
            : 'Mint Membership NFT'}
        </button>
      </div>
    </form>
  );
}
