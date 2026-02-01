import { createConfig, http, fallback, webSocket } from 'wagmi';
import { sepolia, mainnet } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

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

const getSepoliaWsUrl = () => {
  if (process.env.NEXT_PUBLIC_SEPOLIA_WS_URL) {
    return process.env.NEXT_PUBLIC_SEPOLIA_WS_URL;
  }
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  return undefined;
};

// Use fallback transport for redundancy - tries multiple RPC endpoints
// Note: Alchemy may have limitations on eth_getLogs block ranges
// The fallback will automatically use public RPCs when Alchemy fails
const sepoliaRpcUrl = getSepoliaRpcUrl();
const sepoliaWsUrl = getSepoliaWsUrl();

const sepoliaTransports =
  sepoliaRpcUrl || sepoliaWsUrl
    ? fallback([
        ...(sepoliaWsUrl ? [webSocket(sepoliaWsUrl)] : []),
        ...(sepoliaRpcUrl ? [http(sepoliaRpcUrl)] : []),
        http(), // Final fallback to public RPCs
      ])
    : http(); // Use default public RPCs

const transports = {
  [sepolia.id]: sepoliaTransports,
  [mainnet.id]: http(), // Mainnet uses default public RPCs
};

export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet], // Include Mainnet so wagmi can detect when MetaMask switches to it
  connectors: [
    // Use injected wallet connector for MetaMask, Brave, and other EIP-1193 wallets
    injected(),
  ],
  transports,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
