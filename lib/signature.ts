import { Address } from 'viem';
import { CONTRACTS } from '@/config/contracts';

/**
 * EIP-712 domain for membership metadata updates
 */
export function getUpdateMembershipDomain(chainId: number) {
  return {
    name: 'QAWL DAO Membership',
    version: '1',
    chainId: chainId,
    verifyingContract: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY as Address,
  };
}

/**
 * EIP-712 types for membership metadata update
 */
export const UpdateMembershipTypes = {
  UpdateMembership: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'ownerAddress', type: 'address' },
    { name: 'name', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

/**
 * Create the message to sign for updating membership metadata
 */
export function createUpdateMembershipMessage(
  tokenId: number,
  ownerAddress: Address,
  name: string,
  timestamp: number = Math.floor(Date.now() / 1000)
) {
  return {
    tokenId: BigInt(tokenId),
    ownerAddress: ownerAddress.toLowerCase() as Address,
    name: name,
    timestamp: BigInt(timestamp),
  };
}

/**
 * Verify EIP-712 signature
 * @param signature - The signature to verify
 * @param message - The message that was signed
 * @param signer - The address that should have signed
 * @param chainId - The chain ID
 * @returns true if signature is valid
 */
export async function verifyUpdateMembershipSignature(
  signature: `0x${string}`,
  message: ReturnType<typeof createUpdateMembershipMessage>,
  signer: Address,
  chainId: number
): Promise<boolean> {
  try {
    const { verifyTypedData } = await import('viem');
    const domain = getUpdateMembershipDomain(chainId);
    
    console.log('🔍 verifyTypedData called with:', {
      address: signer,
      domain,
      types: UpdateMembershipTypes,
      primaryType: 'UpdateMembership',
      message,
      signature: signature.substring(0, 20) + '...',
    });
    
    const isValid = await verifyTypedData({
      address: signer,
      domain,
      types: UpdateMembershipTypes,
      primaryType: 'UpdateMembership',
      message,
      signature,
    });

    console.log('✅ verifyTypedData result:', isValid);
    return isValid;
  } catch (error: any) {
    console.error('❌ Error verifying signature:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
    });
    return false;
  }
}

