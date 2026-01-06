import { createConfig, http, fallback } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { metaMask, injected } from 'wagmi/connectors';
import { CHAIN_ID } from './contracts';

// Support custom RPC URLs for decentralization
// Users can provide their own RPC endpoint via environment variable
// Falls back to public RPCs if not provided
const getRpcUrl = () => {
  // Check for custom RPC URL first (user's own node)
  if (process.env.NEXT_PUBLIC_RPC_URL) {
    return process.env.NEXT_PUBLIC_RPC_URL;
  }
  
  // Fallback to public RPC endpoints (in order of preference)
  // These are decentralized/public options
  return undefined; // Will use wagmi's default public RPCs
};

// Use fallback transport for redundancy - tries multiple RPC endpoints
const rpcUrl = getRpcUrl();
const transports = rpcUrl
  ? {
      [sepolia.id]: fallback([
        http(rpcUrl), // User's custom RPC first
        http(), // Fallback to public RPCs
      ]),
    }
  : {
      [sepolia.id]: http(), // Use default public RPCs
    };

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    // Only MetaMask and Brave Wallet - simple and clean
    metaMask(),
    injected(),
  ],
  transports,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}

