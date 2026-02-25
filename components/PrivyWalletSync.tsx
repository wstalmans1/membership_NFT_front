'use client';

import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';

/**
 * Syncs Privy's active wallet with wagmi whenever the user logs in.
 * Must live inside both WagmiProvider and PrivyProvider.
 *
 * Problem it solves: MetaMask cannot be programmatically disconnected from the
 * browser, so wagmi's active account stays as the MetaMask address even after a
 * Privy email/social login. This component detects the embedded Privy wallet and
 * promotes it to the wagmi active wallet as soon as it is available.
 */
export function PrivyWalletSync() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  useEffect(() => {
    if (!authenticated || wallets.length === 0) return;
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
    if (embeddedWallet) setActiveWallet(embeddedWallet);
  }, [authenticated, wallets, setActiveWallet]);

  return null;
}
