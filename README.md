# Qawl DAO Frontend

A Next.js frontend for the Qawl DAO, built with TypeScript, Tailwind CSS, and Wagmi for Ethereum interactions.

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

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A wallet (MetaMask recommended)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file (optional):

```env
# Optional: Use your own RPC endpoint for maximum decentralization
NEXT_PUBLIC_RPC_URL=https://your-node.example.com:8545
```

**Note**: If not provided, the app will use public RPC endpoints. No API keys required!

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
    └── utils.ts
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
- ✅ **No Centralized Services**: All interactions go directly to blockchain

See [DECENTRALIZATION.md](./DECENTRALIZATION.md) for detailed information.

## Notes

- The frontend connects to contracts deployed on Sepolia testnet
- Make sure you're connected to Sepolia network in your wallet
- Some features require membership NFT (mint one first)
- For maximum decentralization, consider hosting on IPFS and accessing via ENS
