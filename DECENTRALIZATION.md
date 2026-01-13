# Decentralization Guide

This document outlines how the QAWL DAO frontend is designed to minimize reliance on centralized infrastructure.

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

### 4. Metadata Storage (Pragmatic Choice)

- **Current Implementation**: NFT metadata and photos stored in Supabase (off-chain database)
- **Why Supabase instead of IPFS?**: 
  - IPFS is immutable—once data is stored, it cannot be updated or deleted (only new versions can be added, but old data remains)
  - We need to allow users to update and delete their personal information (name, photo, date of birth) to comply with data privacy rights
  - Supabase provides CRUD (Create, Read, Update, Delete) operations essential for user data control
- **User Control**: Users can update or delete their metadata at any time through the membership interface
- **Future Path**: Exploring decentralized alternatives (Ceramic, OrbitDB, mutable IPFS solutions) that support updates/deletes while maintaining decentralization
- **Base URI**: Configured in Constitution contract, but currently points to API route (requires separate hosting for static builds)

**Note**: This is a pragmatic choice that balances user data control with decentralization goals. See [Philosophy Page](/philosophy) for more details on our design decisions.

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

3. **Supabase (Metadata Storage)**
   - Currently used for NFT metadata and photo storage
   - Enables user data updates and deletions
   - Requires Supabase account and credentials
   - Future: Exploring decentralized alternatives (IPFS, Arweave)
   - See [Philosophy Page](/philosophy) for rationale

4. **CDN/Asset Delivery** (Optional)
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

### Why Supabase for Metadata? (Pragmatic Choice)

- **User Data Control**: Enables users to update and delete their personal information (name, photo, date of birth)
- **IPFS Limitation**: IPFS is immutable—once data is stored, it cannot be updated or deleted (only new versions can be added, but old data remains). This doesn't meet our requirement for user data control.
- **CRUD Operations**: Supabase provides Create, Read, Update, Delete operations essential for allowing users to manage their personal data
- **Practical Solution**: Provides necessary functionality (CRUD operations, file storage) that's challenging with fully decentralized solutions
- **Path to Decentralization**: Architecture allows migration to decentralized alternatives (Ceramic, OrbitDB, or mutable IPFS solutions) in the future that support updates/deletes
- **Transparency**: Users are informed about what data is stored where (see Philosophy page)
- **Balance**: Strikes a balance between user control and decentralization goals

## Future Enhancements

1. **Decentralized Metadata Storage**
   - Migrate from Supabase to IPFS or Arweave for metadata storage
   - Maintain user ability to update/delete their data
   - Use content-addressed storage for photos
   - Implement decentralized database solutions (Ceramic, OrbitDB, etc.)

2. **P2P Wallet Connection**
   - Consider integrating direct peer-to-peer wallet connections
   - Remove need for any intermediaries

3. **Decentralized RPC Aggregation**
   - Use multiple RPC providers with automatic failover
   - Weight providers by reliability/decentralization

4. **IPFS Integration**
   - Build-time IPFS upload
   - Automatic content addressing
   - Version management via IPFS

5. **ENS Integration**
   - Automatic ENS resolution
   - Content hash updates
   - Subdomain management

## Monitoring Decentralization

Check your setup:

- ✅ No WalletConnect dependency
- ✅ No API keys required (for RPC)
- ✅ Works offline (after initial load, except metadata)
- ✅ Can be hosted on IPFS
- ✅ User controls their own RPC endpoint
- ⚠️ Supabase used for metadata (pragmatic choice, path to decentralization)
- ✅ All blockchain interactions go directly to chain

## Resources

- [IPFS Documentation](https://docs.ipfs.io/)
- [ENS Documentation](https://docs.ens.domains/)
- [Arweave Documentation](https://docs.arweave.org/)
- [EIP-1193 Standard](https://eips.ethereum.org/EIPS/eip-1193)
- [Running Ethereum Node](https://ethereum.org/en/developers/docs/nodes-and-clients/)

