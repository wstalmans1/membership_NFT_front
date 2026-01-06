# Decentralization Guide

This document outlines how the Qawl DAO frontend is designed to minimize reliance on centralized infrastructure.

## Current Decentralization Measures

### 1. Wallet Connection (✅ Fully Decentralized)

- **No WalletConnect**: Removed WalletConnect dependency to avoid centralized relay servers
- **Injected Wallets Only**: Uses browser's native `window.ethereum` API
- **Supports**: MetaMask, Frame, Brave, Coinbase Wallet, and any EIP-1193 compatible wallet
- **User Control**: Users connect directly through their wallet, no third-party intermediaries

### 2. RPC Providers (Configurable)

The frontend supports multiple RPC strategies:

#### Option A: User's Own Node (Most Decentralized)
```env
NEXT_PUBLIC_RPC_URL=https://your-node.example.com:8545
```

#### Option B: Public RPC Endpoints (Default)
- Uses wagmi's default public RPC endpoints
- No API keys required
- Multiple fallback options

#### Option C: Decentralized RPC Services
Consider using:
- **Ethereum RPC**: Public endpoints (no API keys)
- **Self-hosted node**: Run your own Geth/Nethermind/Besu node
- **Community nodes**: Public RPC endpoints from various providers

### 3. Frontend Hosting (Recommendations)

#### Fully Decentralized Options:
1. **IPFS + ENS**
   - Build static site: `npm run build`
   - Upload to IPFS (via Pinata, Web3.Storage, or self-hosted)
   - Set ENS contenthash to IPFS hash
   - Access via: `yourdao.eth`

2. **Arweave**
   - Upload static build to Arweave
   - Permanent, decentralized storage
   - Access via Arweave gateway

3. **IPFS + DNS**
   - Host on IPFS
   - Point DNS A record to IPFS gateway
   - Or use Cloudflare's IPFS gateway

#### Self-Hosted Option:
- Host static build on your own server
- Use CDN for performance (optional)
- Full control over infrastructure

### 4. Metadata Storage (Already Decentralized)

- NFT metadata stored on IPFS
- Base URI configured in Constitution contract
- No centralized metadata servers

## Removing Centralized Dependencies

### Already Removed:
- ✅ WalletConnect (centralized relay servers)
- ✅ MetaMask SDK (optional, removed for simplicity)

### Remaining Considerations:

1. **Next.js Build Process**
   - Build is static HTML/CSS/JS
   - No server-side rendering at runtime
   - Can be hosted anywhere

2. **Package Dependencies**
   - All npm packages are open-source
   - No proprietary/centralized services in dependencies
   - Can audit all code

3. **CDN/Asset Delivery** (Optional)
   - Currently uses local assets
   - If using CDN, prefer decentralized options:
     - IPFS gateways
     - Arweave gateways
     - Self-hosted CDN

## Best Practices for Maximum Decentralization

### For Users:

1. **Run Your Own Node**
   ```bash
   # Install Geth
   geth --sepolia --http --http.api eth,net,web3
   
   # Set in .env.local
   NEXT_PUBLIC_RPC_URL=http://localhost:8545
   ```

2. **Use Browser Wallets**
   - MetaMask (most common)
   - Frame (privacy-focused)
   - Brave Wallet (built-in)
   - Any EIP-1193 compatible wallet

3. **Access via ENS/IPFS**
   - Use ENS domain pointing to IPFS
   - No reliance on centralized domains

### For Developers:

1. **Build Static Site**
   ```bash
   npm run build
   # Output in .next/static can be hosted anywhere
   ```

2. **Deploy to IPFS**
   ```bash
   # Install IPFS
   npm install -g ipfs
   
   # Add build output
   ipfs add -r .next/static
   
   # Pin via pinning service
   ```

3. **Set ENS Content Hash**
   ```javascript
   // Using ENS resolver
   await resolver.setContentHash(ensName, ipfsHash);
   ```

## Architecture Decisions

### Why Injected Wallets Only?

- **Direct Connection**: No relay servers or intermediaries
- **User Privacy**: Wallet interactions stay between user and blockchain
- **No API Keys**: No need for WalletConnect project IDs
- **Universal Support**: Works with any EIP-1193 wallet

### Why Fallback RPC?

- **Redundancy**: If one RPC fails, automatically tries another
- **User Choice**: Users can provide their own RPC
- **No Single Point of Failure**: Multiple fallback options

### Why Static Build?

- **No Server Required**: Pure HTML/CSS/JS
- **Host Anywhere**: IPFS, Arweave, GitHub Pages, your server
- **Censorship Resistant**: Can be mirrored easily
- **Fast**: No server-side processing

## Future Enhancements

1. **P2P Wallet Connection**
   - Consider integrating direct peer-to-peer wallet connections
   - Remove need for any intermediaries

2. **Decentralized RPC Aggregation**
   - Use multiple RPC providers with automatic failover
   - Weight providers by reliability/decentralization

3. **IPFS Integration**
   - Build-time IPFS upload
   - Automatic content addressing
   - Version management via IPFS

4. **ENS Integration**
   - Automatic ENS resolution
   - Content hash updates
   - Subdomain management

## Monitoring Decentralization

Check your setup:

- ✅ No WalletConnect dependency
- ✅ No API keys required
- ✅ Works offline (after initial load)
- ✅ Can be hosted on IPFS
- ✅ No centralized services in critical path
- ✅ User controls their own RPC endpoint

## Resources

- [IPFS Documentation](https://docs.ipfs.io/)
- [ENS Documentation](https://docs.ens.domains/)
- [Arweave Documentation](https://docs.arweave.org/)
- [EIP-1193 Standard](https://eips.ethereum.org/EIPS/eip-1193)
- [Running Ethereum Node](https://ethereum.org/en/developers/docs/nodes-and-clients/)

