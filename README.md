# QAWL DAO Frontend

A Next.js frontend for the QAWL DAO, built with TypeScript, Tailwind CSS, and Wagmi for Ethereum interactions.

## Features

- **Dashboard**: Overview of DAO status, treasury balance, and quick actions
- **Membership**: Mint and view membership NFTs
- **Governance**: Create proposals and vote on DAO decisions
- **Treasury**: View treasury balance and execute payouts
- **Constitution**: View all governance parameters and contract addresses

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Ethereum**: Wagmi + Viem
- **Wallet Connection**: Injected wallets only (MetaMask, Frame, Brave, etc.) - **No centralized services**
- **Metadata Storage**: Supabase (off-chain NFT metadata and photos) - See [DECENTRALIZATION.md](./DECENTRALIZATION.md) for details

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A wallet (MetaMask recommended)
- Supabase account (for NFT metadata storage) - [Sign up here](https://supabase.com)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
# Required: Supabase credentials for NFT metadata storage
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Use your own RPC endpoint for maximum decentralization
NEXT_PUBLIC_RPC_URL=https://your-node.example.com:8545
```

**Note**: 
- Supabase credentials are required for membership NFT metadata and photo storage
- If RPC URL is not provided, the app will use public RPC endpoints (no API keys required)

### Supabase Setup

**Why Supabase instead of IPFS?**
- IPFS is immutable—once data is stored, it cannot be updated or deleted (only new versions can be added, but old data remains)
- We need to allow users to update and delete their personal information (name, photo, date of birth)
- Supabase provides CRUD (Create, Read, Update, Delete) operations essential for user data control
- This is a pragmatic choice that balances user rights with decentralization goals

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Note your project URL and anon key from the project settings

2. **Set Up Database Table**
   - Create a table named `member_metadata` with columns:
     - `token_id` (bigint, nullable)
     - `name` (text)
     - `date_of_birth` (date)
     - `citizenship` (text, nullable)
     - `image` (text) - URL to photo in storage
     - `created_at` (timestamp)
     - `updated_at` (timestamp)

3. **Set Up Storage Bucket**
   - Create a storage bucket named `member_photos`
   - Configure bucket policies for public read access

4. **Add Environment Variables**
   - Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your `.env.local`

See [documentation/BASEURI_SUPABASE_EXPLANATION.md](./documentation/BASEURI_SUPABASE_EXPLANATION.md) for detailed information about how Supabase integrates with the NFT metadata system.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Contract Addresses

Contract addresses are configured in `config/contracts.ts`. Currently set to Sepolia testnet addresses.

## Project Structure

```
qawl2-frontend/
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Dashboard (home)
│   ├── membership/        # Membership page
│   ├── governance/        # Governance page
│   ├── treasury/          # Treasury page
│   └── constitution/       # Constitution page
├── components/            # React components
│   ├── Dashboard.tsx
│   ├── MembershipPage.tsx
│   ├── GovernancePage.tsx
│   ├── TreasuryPage.tsx
│   ├── ConstitutionPage.tsx
│   ├── Navbar.tsx
│   └── WalletConnect.tsx
├── config/                # Configuration files
│   ├── contracts.ts      # Contract addresses
│   └── wagmi.ts          # Wagmi configuration
├── abis/                  # Contract ABIs
│   ├── Constitution.json
│   ├── DAOGovernor.json
│   ├── MembershipNFT.json
│   └── TreasuryExecutor.json
└── lib/                   # Utility functions
    ├── utils.ts
    ├── supabase.ts        # Supabase client configuration
    ├── metadata.ts        # NFT metadata CRUD operations
    └── storage.ts         # Photo upload/delete to Supabase Storage
```

## Features in Development

- Proposal creation form with calldata encoding
- Proposal voting interface
- Proposal queue/execute functionality
- Real-time proposal tracking (via events or subgraph)
- Treasury payout history
- Allowed recipients management

## Decentralization

This frontend is designed to minimize reliance on centralized infrastructure:

- ✅ **No WalletConnect**: Uses only injected browser wallets (direct connection)
- ✅ **No API Keys Required**: Works with public RPC endpoints by default
- ✅ **Custom RPC Support**: Users can provide their own RPC endpoint
- ✅ **Static Build**: Can be hosted on IPFS, Arweave, or any static host
- ✅ **Blockchain Interactions**: All on-chain interactions go directly to blockchain
- ⚠️ **Supabase for Metadata**: NFT metadata and photos are stored in Supabase (off-chain) to enable user updates and deletions. IPFS is immutable (data cannot be updated or deleted), so we use Supabase to provide users with control over their personal data. This is a pragmatic choice with a path toward greater decentralization.

See [DECENTRALIZATION.md](./DECENTRALIZATION.md) for detailed information.

## Notes

- The frontend connects to contracts deployed on Sepolia testnet
- Make sure you're connected to Sepolia network in your wallet
- Some features require membership NFT (mint one first)
- For maximum decentralization, consider hosting on IPFS and accessing via ENS
