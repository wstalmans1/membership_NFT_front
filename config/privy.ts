import type { PrivyClientConfig } from '@privy-io/react-auth';
import { sepolia, mainnet } from 'viem/chains';

export const privyConfig: PrivyClientConfig = {
  // Login methods: email first (low barrier), then social, then external wallets
  loginMethods: ['email', 'google', 'wallet'],

  // Create an embedded wallet only for users who have no wallet yet (email/social logins).
  // MetaMask/external wallet logins are skipped — they already have a wallet.
  // The nested ethereum.createOnLogin format is required by the current SDK.
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
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
