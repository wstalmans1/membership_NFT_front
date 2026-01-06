import { supabase, METADATA_TABLE } from './supabase';

export interface NFTMetadata {
  name: string;
  description: string;
  image: string; // Photo URL from Supabase Storage
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    tokenId?: number;
    ownerAddress: string;
    name: string;
    dateOfBirth?: string;
    citizenship: string;
    issuedDate: string;
    photoUrl: string;
    [key: string]: any; // Allow additional properties
  };
}

/**
 * Create metadata record in Supabase (before minting, tokenId will be null)
 * @param ownerAddress - Ethereum address of the owner
 * @param metadata - The metadata object
 * @returns The created record
 */
export async function createMetadata(
  ownerAddress: string,
  metadata: NFTMetadata
): Promise<any> {
  try {
    const { data, error } = await supabase
      .from(METADATA_TABLE)
      .insert({
        owner_address: ownerAddress.toLowerCase(),
        metadata_json: metadata,
        token_id: null, // Will be updated after minting
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create metadata: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error creating metadata:', error);
    throw error;
  }
}

/**
 * Update metadata record with tokenId after minting
 * @param tokenId - The NFT token ID
 * @param ownerAddress - Ethereum address of the owner (for verification)
 * @param metadata - Updated metadata object
 */
export async function updateMetadataWithTokenId(
  tokenId: number,
  ownerAddress: string,
  metadata: NFTMetadata
): Promise<void> {
  try {
    const lowerAddress = ownerAddress.toLowerCase();
    console.log('🔍 Starting metadata update:', {
      tokenId,
      ownerAddress: lowerAddress,
      table: METADATA_TABLE,
    });

    // Step 1: Check if record exists
    const { data: existingRecord, error: selectError } = await supabase
      .from(METADATA_TABLE)
      .select('owner_address, token_id')
      .eq('owner_address', lowerAddress)
      .single();

    console.log('📋 Existing record:', existingRecord);
    
    if (selectError) {
      console.error('❌ SELECT error:', selectError);
      throw new Error(`Failed to query metadata: ${selectError.message}`);
    }

    if (!existingRecord) {
      throw new Error(`❌ No metadata record found for address: ${lowerAddress}`);
    }

    // Step 2: Check if token_id is already set
    if (existingRecord.token_id !== null && existingRecord.token_id !== undefined) {
      if (existingRecord.token_id === tokenId) {
        console.log('✅ TokenId already set correctly');
        return;
      }
      throw new Error(`❌ Record already has token_id: ${existingRecord.token_id}. Cannot update to ${tokenId}.`);
    }

    // Step 3: Update by owner_address (now the primary key)
    console.log('💾 Updating record by owner_address:', lowerAddress);
    console.log('💾 Update values:', {
      token_id: tokenId,
      owner_address: lowerAddress,
      token_id_is_null: existingRecord.token_id === null || existingRecord.token_id === undefined,
    });
    
    const { data: updateData, error: updateError } = await supabase
      .from(METADATA_TABLE)
      .update({
        token_id: tokenId,
        metadata_json: metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('owner_address', lowerAddress)
      .is('token_id', null) // Only update if token_id is null
      .select();

    console.log('📤 Update response:', {
      data: updateData,
      error: updateError,
      dataLength: updateData?.length,
    });

    if (updateError) {
      console.error('❌ UPDATE error:', updateError);
      console.error('Error code:', updateError.code);
      console.error('Error message:', updateError.message);
      console.error('Error details:', JSON.stringify(updateError, null, 2));
      
      // Try without the .is('token_id', null) check
      console.log('🔄 Retrying update without token_id null check...');
      const { data: retryData, error: retryError } = await supabase
        .from(METADATA_TABLE)
        .update({
          token_id: tokenId,
          metadata_json: metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('owner_address', lowerAddress)
        .select();
      
      if (retryError) {
        console.error('❌ Retry also failed:', retryError);
        throw new Error(`Failed to update metadata. Error: ${updateError.message}. Retry error: ${retryError.message}. Check your UPDATE policy!`);
      }
      
      if (!retryData || retryData.length === 0) {
        throw new Error(`Update query succeeded but no rows were updated. This means the UPDATE policy is blocking it. Run: CREATE POLICY "Anon can update metadata" ON public.member_metadata FOR UPDATE TO anon USING (true) WITH CHECK (true);`);
      }
      
      console.log('✅ Successfully updated metadata (retry):', retryData);
      return;
    }

    if (!updateData || updateData.length === 0) {
      console.error('⚠️ Update succeeded but no rows returned. This usually means:');
      console.error('1. UPDATE policy is blocking it');
      console.error('2. token_id is already set (not null)');
      console.error('3. owner_address doesn\'t match exactly');
      throw new Error(`Update query succeeded but no rows were updated. Check: 1) UPDATE policy allows anon, 2) token_id is null, 3) owner_address matches exactly. Current owner_address: ${lowerAddress}`);
    }

    console.log('✅ Successfully updated metadata:', updateData);
  } catch (error: any) {
    console.error('❌ Fatal error updating metadata:', error);
    throw error;
  }
}

/**
 * Get metadata for a specific token ID
 * @param tokenId - The NFT token ID
 * @returns The metadata object or null if not found
 */
export async function getMetadata(tokenId: number): Promise<NFTMetadata | null> {
  try {
    console.log('🔍 getMetadata: Querying Supabase for tokenId:', tokenId);
    const { data, error } = await supabase
      .from(METADATA_TABLE)
      .select('metadata_json, owner_address, token_id')
      .eq('token_id', tokenId)
      .is('deleted_at', null) // Only get non-deleted records
      .single();

    console.log('📋 getMetadata: Supabase response:', { data, error });

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        console.warn('⚠️ getMetadata: No metadata found for tokenId:', tokenId);
        return null;
      }
      console.error('❌ getMetadata: Supabase error:', error);
      throw new Error(`Failed to get metadata: ${error.message}`);
    }

    if (!data) {
      console.warn('⚠️ getMetadata: Data is null');
      return null;
    }

    console.log('✅ getMetadata: Returning metadata_json:', data.metadata_json);
    return data?.metadata_json as NFTMetadata | null;
  } catch (error) {
    console.error('❌ getMetadata: Exception:', error);
    throw error;
  }
}

/**
 * Update metadata (allows users to update their personal information)
 * @param tokenId - The NFT token ID
 * @param ownerAddress - Ethereum address of the owner (for verification)
 * @param metadata - Updated metadata object
 * @param signature - EIP-712 signature proving ownership
 * @param chainId - Chain ID for signature verification
 * @param signedMessage - The exact message that was signed (optional, for verification)
 * @param signedTimestamp - The exact timestamp used in signing (optional, for verification)
 */
export async function updateMetadata(
  tokenId: number,
  ownerAddress: string,
  metadata: NFTMetadata,
  signature: `0x${string}`,
  chainId: number,
  signedMessage?: any,
  signedTimestamp?: number
): Promise<void> {
  try {
    console.log('🔍 updateMetadata called with:', { tokenId, ownerAddress, chainId, hasSignature: !!signature });
    
    // Verify ownership
    const existing = await supabase
      .from(METADATA_TABLE)
      .select('owner_address')
      .eq('token_id', tokenId)
      .is('deleted_at', null)
      .single();

    if (existing.error || !existing.data) {
      console.error('❌ Metadata not found:', existing.error);
      throw new Error('Metadata not found');
    }

    if (existing.data.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
      console.error('❌ Not authorized:', { 
        existing: existing.data.owner_address, 
        provided: ownerAddress 
      });
      throw new Error('Not authorized to update this metadata');
    }

    // Verify signature using the exact message that was signed
    const { verifyUpdateMembershipSignature } = await import('./signature');
    
    // Use the signed message if provided, otherwise create a new one (for backward compatibility)
    let message;
    if (signedMessage) {
      message = signedMessage;
      console.log('🔐 Using provided signed message:', message);
    } else {
      const { createUpdateMembershipMessage } = await import('./signature');
      const timestamp = signedTimestamp || Math.floor(Date.now() / 1000);
      message = createUpdateMembershipMessage(
        tokenId,
        ownerAddress.toLowerCase() as `0x${string}`,
        metadata.properties.name,
        timestamp
      );
      console.log('🔐 Created new message for verification:', message);
    }

    console.log('🔐 Verifying signature with message:', message);
    console.log('🔐 Signature:', signature);
    console.log('🔐 Signer address:', ownerAddress.toLowerCase());
    console.log('🔐 Chain ID:', chainId);
    
    const isValid = await verifyUpdateMembershipSignature(
      signature,
      message,
      ownerAddress.toLowerCase() as `0x${string}`,
      chainId
    );

    console.log('✅ Signature verification result:', isValid);

    if (!isValid) {
      console.error('❌ Signature verification failed!');
      throw new Error('Invalid signature. Please sign the message to verify ownership.');
    }
    
    console.log('✅ Signature verified successfully!');

    // Update metadata
    const { error } = await supabase
      .from(METADATA_TABLE)
      .update({
        metadata_json: metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('token_id', tokenId)
      .eq('owner_address', ownerAddress.toLowerCase());

    if (error) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  } catch (error) {
    console.error('Error updating metadata:', error);
    throw error;
  }
}

/**
 * Delete metadata (allows users to delete their personal information) - Hard delete
 * @param tokenId - The NFT token ID
 * @param ownerAddress - Ethereum address of the owner (for verification)
 */
export async function deleteMetadata(
  tokenId: number,
  ownerAddress: string
): Promise<void> {
  try {
    // Verify ownership
    const existing = await supabase
      .from(METADATA_TABLE)
      .select('owner_address, metadata_json')
      .eq('token_id', tokenId)
      .is('deleted_at', null)
      .single();

    if (existing.error || !existing.data) {
      throw new Error('Metadata not found');
    }

    if (existing.data.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
      throw new Error('Not authorized to delete this metadata');
    }

    // Hard delete (remove record entirely)
    const { error } = await supabase
      .from(METADATA_TABLE)
      .delete()
      .eq('token_id', tokenId)
      .eq('owner_address', ownerAddress.toLowerCase());

    if (error) {
      throw new Error(`Failed to delete metadata: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting metadata:', error);
    throw error;
  }
}

/**
 * Get all metadata for a specific owner address
 * @param ownerAddress - Ethereum address of the owner
 * @returns Array of metadata records
 */
export async function getMetadataByOwner(ownerAddress: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from(METADATA_TABLE)
      .select('*')
      .eq('owner_address', ownerAddress.toLowerCase())
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get metadata: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error getting metadata by owner:', error);
    throw error;
  }
}

/**
 * Get total number of members
 * @returns Total count of members with token IDs
 */
export async function getTotalMembersCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(METADATA_TABLE)
      .select('*', { count: 'exact', head: true })
      .not('token_id', 'is', null)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get total members count: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting total members count:', error);
    throw error;
  }
}

/**
 * Get all members (all metadata records with token_id)
 * @returns Array of metadata records with token IDs
 */
export async function getAllMembers(): Promise<Array<{ tokenId: number; metadata: NFTMetadata; ownerAddress: string }>> {
  try {
    const { data, error } = await supabase
      .from(METADATA_TABLE)
      .select('token_id, metadata_json, owner_address')
      .not('token_id', 'is', null)
      .is('deleted_at', null)
      .order('token_id', { ascending: true });

    if (error) {
      throw new Error(`Failed to get all members: ${error.message}`);
    }

    return (data || []).map((record) => ({
      tokenId: record.token_id,
      metadata: record.metadata_json as NFTMetadata,
      ownerAddress: record.owner_address,
    }));
  } catch (error) {
    console.error('Error getting all members:', error);
    throw error;
  }
}

