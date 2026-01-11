'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignTypedData, useChainId } from 'wagmi';
import { uploadPhoto, deletePhoto } from '@/lib/storage';
import { updateMetadata, getMetadata, NFTMetadata } from '@/lib/metadata';
import { getUpdateMembershipDomain, UpdateMembershipTypes, createUpdateMembershipMessage } from '@/lib/signature';

interface UpdateMembershipFormProps {
  tokenId: number;
  ownerAddress: string;
  currentMetadata: NFTMetadata;
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export function UpdateMembershipForm({ 
  tokenId, 
  ownerAddress, 
  currentMetadata, 
  onSuccess, 
  onError, 
  onCancel 
}: UpdateMembershipFormProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  
  const { signTypedDataAsync, isPending: isSigningPending } = useSignTypedData();
  const [formData, setFormData] = useState({
    name: currentMetadata.properties.name || '',
    dateOfBirth: currentMetadata.properties.dateOfBirth || '',
    citizenship: currentMetadata.properties.citizenship || 'World Citizen for Palestine',
    photo: null as File | null,
    keepExistingPhoto: true,
  });

  useEffect(() => {
    // Pre-fill form with current metadata
    setFormData({
      name: currentMetadata.properties.name || '',
      dateOfBirth: currentMetadata.properties.dateOfBirth || '',
      citizenship: currentMetadata.properties.citizenship || 'World Citizen for Palestine',
      photo: null,
      keepExistingPhoto: true,
    });
  }, [currentMetadata]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        onError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        onError('Image size must be less than 5MB');
        return;
      }
      setFormData({ ...formData, photo: file, keepExistingPhoto: false });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address || address.toLowerCase() !== ownerAddress.toLowerCase()) {
      onError('Please connect the correct wallet');
      return;
    }

    if (!formData.name.trim()) {
      onError('Please enter your name');
      return;
    }

    setIsUpdating(true);

    try {
      let photoUrl = currentMetadata.image;
      let photoFileName = currentMetadata.properties.photoFileName;

      // If new photo uploaded, delete old one and upload new
      if (formData.photo && !formData.keepExistingPhoto) {
        // Delete old photo if it exists
        if (currentMetadata.properties.photoFileName) {
          try {
            await deletePhoto(currentMetadata.properties.photoFileName);
          } catch (deleteError) {
            console.warn('Failed to delete old photo:', deleteError);
            // Continue anyway - old photo deletion is not critical
          }
        }

        // Upload new photo
        photoFileName = `token-${Date.now()}-${address.slice(2, 10)}.${formData.photo.name.split('.').pop()}`;
        photoUrl = await uploadPhoto(formData.photo, photoFileName);
      }

      // Create updated metadata object
      const updatedMetadata: NFTMetadata = {
        name: `Honorary Citizenship #${formData.name}`,
        description: `Honorary citizenship certificate for ${formData.name}`,
        image: photoUrl,
        attributes: [
          { trait_type: 'Name', value: formData.name },
          { trait_type: 'Date of Birth', value: formData.dateOfBirth || 'Not provided' },
          { trait_type: 'Citizenship', value: formData.citizenship },
          { trait_type: 'Issued Date', value: currentMetadata.properties.issuedDate },
        ],
        properties: {
          ...currentMetadata.properties,
          name: formData.name,
          dateOfBirth: formData.dateOfBirth || undefined,
          citizenship: formData.citizenship,
          photoUrl: photoUrl,
          photoFileName: photoFileName,
        },
      };

      // Step 1: Request EIP-712 signature
      setIsSigning(true);
      const timestamp = Math.floor(Date.now() / 1000);
      const message = createUpdateMembershipMessage(
        tokenId,
        address!,
        formData.name,
        timestamp
      );

      let signature: `0x${string}`;
      try {
        signature = await signTypedDataAsync({
          domain: getUpdateMembershipDomain(chainId),
          types: UpdateMembershipTypes,
          primaryType: 'UpdateMembership',
          message,
        });
        console.log('✅ Signature received:', signature);
        console.log('📋 Message signed:', message);
      } catch (signError: any) {
        setIsSigning(false);
        console.error('❌ Signature error:', signError);
        if (signError.message?.includes('User rejected') || signError.message?.includes('rejected')) {
          onError('Signature rejected. Update cancelled.');
        } else {
          onError(`Failed to sign message: ${signError.message || 'Unknown error'}`);
        }
        return;
      } finally {
        setIsSigning(false);
      }

      // Step 2: Update metadata in Supabase with signature
      // Pass the exact message and timestamp used for signing
      console.log('🚀 Calling updateMetadata with signature...');
      setIsUpdating(true);
      
      try {
        await updateMetadata(tokenId, ownerAddress, updatedMetadata, signature, chainId, message, timestamp);
        console.log('✅ Metadata updated successfully!');
        onSuccess();
      } catch (updateError: any) {
        console.error('❌ Error updating metadata:', updateError);
        throw updateError; // Re-throw to be caught by outer catch
      } finally {
        setIsUpdating(false);
      }
    } catch (error: any) {
      console.error('❌ Error in handleSubmit:', error);
      setIsUpdating(false);
      setIsSigning(false);
      const errorMessage = error?.message || error?.toString() || 'Failed to update metadata. Please try again.';
      console.error('Error message:', errorMessage);
      onError(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="update-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          id="update-name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Francesca Paola Albanese"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="update-dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Date of Birth
        </label>
        <input
          id="update-dateOfBirth"
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="update-citizenship" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Citizenship Type
        </label>
        <input
          id="update-citizenship"
          type="text"
          value={formData.citizenship}
          onChange={(e) => setFormData({ ...formData, citizenship: e.target.value })}
          placeholder="World Citizen for Palestine"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label htmlFor="update-photo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Photo (Optional - leave empty to keep current)
        </label>
        <input
          id="update-photo"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
        />
        {formData.photo && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            New photo selected: {formData.photo.name} ({(formData.photo.size / 1024).toFixed(2)} KB)
          </p>
        )}
        {formData.keepExistingPhoto && !formData.photo && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Current photo will be kept
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUpdating}
          className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isUpdating || isSigning || isSigningPending}
          className="flex-1 px-4 py-3 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSigning || isSigningPending ? 'Sign Message...' : isUpdating ? 'Updating...' : 'Update Membership'}
        </button>
      </div>
    </form>
  );
}

