import type { PrivyClientConfig } from '@privy-io/react-auth';
import { sepolia, mainnet } from 'viem/chains';

export const privyConfig: PrivyClientConfig = {
  // Login methods: email first (low barrier), then social, then external wallets
  loginMethods: ['email', 'google', 'wallet'],

  // Always create an embedded Ethereum wallet on login.
  // 'all-users' (not 'users-without-wallets') is required because Privy treats
  // a previously-linked MetaMask as "already has a wallet" and skips creation
  // otherwise — leaving email/social users pointing at the MetaMask address.
  // The nested ethereum.createOnLogin format is required by the current SDK.
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'all-users',
    },
  },

  // Default to Sepolia for development; matches the rest of the app
  defaultChain: sepolia,
  supportedChains: [sepolia, mainnet],

  appearance: {
    theme: 'dark',
    accentColor: '#3b82f6', // blue-500, matches the app's button colour
    showWalletLoginFirst: false, // show email/social login first
    walletList: ['metamask', 'detected_wallets'],
  },
};
