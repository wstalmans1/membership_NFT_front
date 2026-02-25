'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';

/**
 * Returns the current user's wallet address, using Privy as the source of truth.
 *
 * Why not just useAccount() from wagmi?
 * MetaMask cannot be programmatically disconnected from the browser. After a
 * Privy email/social login wagmi's useAccount() still returns the MetaMask
 * address until setActiveWallet() resolves (async). This hook bypasses that
 * race condition by reading the address directly from Privy's synchronous state.
 *
 * Priority:
 *   1. Privy embedded wallet  (email / social login)
 *   2. Privy user.wallet      (any other Privy-linked wallet)
 *   3. wagmi active wallet    (MetaMask / external, fallback)
 */
export function useWalletAddress(): {
  address: `0x${string}` | undefined;
  isConnected: boolean;
} {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { address: wagmiAddress, isConnected } = useAccount();

  if (!authenticated) return { address: undefined, isConnected: false };

  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  if (embeddedWallet?.address) {
    return { address: embeddedWallet.address as `0x${string}`, isConnected: true };
  }

  if (user?.wallet?.address) {
    return { address: user.wallet.address as `0x${string}`, isConnected: true };
  }

  return { address: wagmiAddress, isConnected };
}
