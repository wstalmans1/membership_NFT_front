'use client';

/**
 * Previously used useEmbeddedSmartAccountConnector to wire up a custom
 * ZeroDev/Pimlico smart account through wagmi.  That approach caused
 * transactions to hang indefinitely after Privy approval because the
 * bundler confirmation never resolved.
 *
 * Gas sponsorship for email/Google users is now handled via Privy's own
 * SmartWalletsProvider + useSmartWallets (dashboard-configured ZeroDev),
 * which is Privy's officially supported path and handles the full lifecycle
 * without a custom bundler integration.
 */
export function PrivyWalletSync() {
  return null;
}
