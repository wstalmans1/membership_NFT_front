'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { uploadPhoto } from '@/lib/storage';
import { createMetadata, updateMetadataWithTokenId, NFTMetadata } from '@/lib/metadata';

interface MintMembershipFormProps {
  onMetadataReady: (metadata: NFTMetadata) => void;
  onError: (error: string) => void;
}

export function MintMembershipForm({ onMetadataReady, onError }: MintMembershipFormProps) {
  const { address } = useAccount();
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    citizenship: 'World Citizen for Palestine',
    photo: null as File | null,
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      onError('Please connect your wallet');
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

    setIsUploading(true);

    try {
      // Step 1: Upload photo to Supabase Storage
      const photoFileName = `token-${Date.now()}-${address.slice(2, 10)}.${formData.photo.name.split('.').pop()}`;
      const photoUrl = await uploadPhoto(formData.photo, photoFileName);

      // Step 2: Create metadata object
      const issuedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const metadata: NFTMetadata = {
        name: `Honorary Citizenship #${formData.name}`,
        description: `Honorary citizenship certificate for ${formData.name}`,
        image: photoUrl, // Photo URL from Supabase Storage
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
          photoFileName: photoFileName, // Store filename for deletion later
        },
      };

      // Step 3: Save metadata to Supabase (without tokenId initially)
      await createMetadata(address, metadata);

      // Step 4: Call parent callback with metadata
      onMetadataReady(metadata);

    } catch (error: any) {
      console.error('Error preparing metadata:', error);
      onError(error.message || 'Failed to prepare metadata. Please try again.');
    } finally {
      setIsUploading(false);
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

      <button
        type="submit"
        disabled={isUploading}
        className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {isUploading ? 'Uploading...' : 'Continue to Mint'}
      </button>
    </form>
  );
}

