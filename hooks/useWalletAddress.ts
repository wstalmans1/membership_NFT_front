'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

/**
 * Returns the current user's effective wallet address, using Privy as the
 * source of truth.
 *
 * Priority:
 *   1. Smart wallet address   (Kernel smart account — email/Google users)
 *   2. Privy embedded wallet  (EOA fallback if smart account not yet created)
 *   3. Privy user.wallet      (any other Privy-linked wallet)
 *   4. wagmi active wallet    (MetaMask / external wallet)
 *   5. undefined              (not authenticated)
 *
 * For email/Google users the smart wallet address is what appears on-chain
 * for NFT ownership, contract reads/writes, and what is shown in the UI.
 * MetaMask users continue to use their injected wallet address directly.
 */
export function useWalletAddress(): {
  address: `0x${string}` | undefined;
  isConnected: boolean;
} {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress, isConnected } = useAccount();

  if (!authenticated) return { address: undefined, isConnected: false };

  // Smart wallet (Kernel) — created by Privy for email/Google users
  const smartWallet = user?.linkedAccounts?.find(a => a.type === 'smart_wallet');
  if (smartWallet && (smartWallet as any).address) {
    return { address: (smartWallet as any).address as `0x${string}`, isConnected: true };
  }

  // Embedded EOA — fallback while smart account is still being provisioned
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  if (embeddedWallet?.address) {
    return { address: embeddedWallet.address as `0x${string}`, isConnected: true };
  }

  // Any other Privy-linked wallet
  if (user?.wallet?.address) {
    return { address: user.wallet.address as `0x${string}`, isConnected: true };
  }

  // External wallet (MetaMask / Brave)
  return { address: wagmiAddress, isConnected };
}
