import { createConfig, http, fallback } from 'wagmi';
import { sepolia, mainnet } from 'wagmi/chains';
import { metaMask, injected } from 'wagmi/connectors';

// Support custom RPC URLs for decentralization
// Users can provide their own RPC endpoint via environment variable
// Falls back to public RPCs if not provided
const getSepoliaRpcUrl = () => {
  // Check for Sepolia-specific RPC URL (e.g., Alchemy)
  if (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) {
    return process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  }
  
  // Fallback to general RPC URL if provided
  if (process.env.NEXT_PUBLIC_RPC_URL) {
    return process.env.NEXT_PUBLIC_RPC_URL;
  }
  
  // Fallback to public RPC endpoints
  return undefined; // Will use wagmi's default public RPCs
};

// Use fallback transport for redundancy - tries multiple RPC endpoints
// Note: Alchemy may have limitations on eth_getLogs block ranges
// The fallback will automatically use public RPCs when Alchemy fails
const sepoliaRpcUrl = getSepoliaRpcUrl();
const transports = sepoliaRpcUrl
  ? {
      [sepolia.id]: fallback([
        http(sepoliaRpcUrl), // Custom RPC first (e.g., Alchemy)
        http(), // Fallback to public RPCs if custom fails (handles large block ranges)
      ]),
      [mainnet.id]: http(), // Mainnet uses default public RPCs
    }
  : {
      [sepolia.id]: http(), // Use default public RPCs
      [mainnet.id]: http(), // Mainnet uses default public RPCs
    };

export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet], // Include Mainnet so wagmi can detect when MetaMask switches to it
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

