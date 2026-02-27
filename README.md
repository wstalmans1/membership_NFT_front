# QAWL DAO Frontend

A Next.js frontend for the QAWL DAO—a decentralized autonomous organization for "World Citizens for Palestine." Built with TypeScript, Tailwind CSS, Privy (auth), Wagmi/Viem (Ethereum), and Supabase (off-chain metadata).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              QAWL DAO FRONTEND                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────────┐   │
│  │   PRIVY      │    │   WAGMI      │    │         SUPABASE                  │   │
│  │  (Auth)      │───▶│  (Ethereum)  │    │  (Off-chain metadata & photos)    │   │
│  │              │    │              │    │                                    │   │
│  │ • Email      │    │ • Reads      │    │ • member_metadata table           │   │
│  │ • Wallet     │    │ • Writes     │    │ • member_photos bucket             │   │
│  │ • Smart      │    │ • Sepolia    │    │ • CRUD for name, photo, DoB        │   │
│  │   Wallets    │    │              │    │                                    │   │
│  └──────────────┘    └──────┬───────┘    └──────────────────────────────────┘   │
│         │                   │                              │                     │
│         │                   ▼                              │                     │
│         │           ┌───────────────┐                        │                     │
│         │           │   SEPOLIA    │                        │                     │
│         │           │  (Testnet)   │                        │                     │
│         │           │              │                        │                     │
│         │           │ • Constitution│◀───────────────────────┘                     │
│         └──────────▶│ • Membership │   (metadata linked by owner_address          │
│                     │   NFT        │    and token_id)                             │
│                     │ • Governor   │                                              │
│                     │ • Treasury   │                                              │
│                     │ • Timelock   │                                              │
│                     └──────────────┘                                              │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Two Authentication Paths

| Path | Login Method | Wallet Type | Gas | Use Case |
|------|--------------|-------------|-----|----------|
| **Email** | Email OTP | Privy embedded EOA → ZeroDev Kernel smart account | Sponsored (Pimlico) | Low-friction onboarding |
| **Wallet** | MetaMask / Brave | Injected EOA | User pays | Crypto-native users |

Email users get an embedded wallet created by Privy; transactions are gas-sponsored via Privy’s SmartWalletsProvider (ZeroDev + Pimlico). Wallet users connect an external wallet and pay their own gas.

---

## Smart Contracts (Sepolia)

All interactions go through these proxies:

| Contract | Role |
|----------|------|
| **Constitution** | Governance parameters (min donation, spend caps, epochs, allowlist) |
| **MembershipNFT** | Mint membership NFTs; 1 NFT = 1 vote |
| **Governor** | Create proposals, vote, queue, execute |
| **TreasuryExecutor** | Execute approved payouts |
| **Timelock** | Delay between proposal approval and execution |

Addresses live in `config/contracts.ts`.

---

## Data Flow

### On-Chain

- **Membership**: ERC-721 NFTs; `mint()` creates a new membership; `tokenURI()` returns metadata URL
- **Governance**: Proposals, votes, delegation, queue, execute
- **Treasury**: Balances, payouts, allowlist

### Off-Chain (Supabase)

- **Metadata**: Name, date of birth, citizenship, photo URL, issued date—stored in `member_metadata` and keyed by `owner_address` and `token_id`
- **Photos**: Uploaded to `member_photos` bucket; URLs stored in metadata
- **Why Supabase**: Supports updates and deletes (unlike IPFS), so users can edit or remove personal data

Mint flow: (1) Create metadata in Supabase (no `token_id` yet) → (2) Mint NFT on-chain → (3) Parse `MemberMinted` event for `tokenId` → (4) Update Supabase with `token_id` and upload photo.

---

## Build Variants

Controlled by `NEXT_PUBLIC_BUILD_VARIANT`:

| Variant | Pages | Purpose |
|---------|-------|---------|
| **full** | Dashboard, Membership, Community, Governance, Treasury, Constitution, Philosophy, DAO Architecture, Trilemma, Getting Started | Complete DApp |
| **community** | Membership, Community only | Lightweight portal; link to Extended DAO for governance |

Feature flags in `config/features.ts` drive navigation and behavior.

---

## Project Structure

```
qawl2-frontend/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout, providers
│   ├── page.tsx              # Dashboard (home)
│   ├── providers.tsx         # Privy, Wagmi, QueryClient, DataContext, ViewMode
│   ├── membership/
│   ├── governance/
│   ├── treasury/
│   ├── constitution/
│   ├── community/
│   ├── philosophy/
│   ├── dao-architecture/
│   ├── trilemma/
│   └── getting-started/
├── components/
│   ├── Dashboard.tsx
│   ├── MembershipPage.tsx    # Mint, view, update, delete, download card
│   ├── MintMembershipForm.tsx
│   ├── UpdateMembershipForm.tsx
│   ├── NFTDisplay.tsx        # Membership card (SVG flags, QR, photo)
│   ├── GovernancePage.tsx    # Proposals, vote, queue, execute
│   ├── TreasuryPage.tsx
│   ├── ConstitutionPage.tsx
│   ├── Navbar.tsx
│   ├── WalletButton.tsx
│   ├── NetworkWarningBanner.tsx
│   ├── BalanceCheck.tsx
│   └── ...
├── config/
│   ├── contracts.ts          # Sepolia contract addresses
│   ├── privy.ts              # Login methods (email, wallet)
│   ├── wagmi.ts              # RPC transports
│   ├── features.ts           # Build-variant flags
│   └── smartAccount.ts       # ZeroDev/Pimlico (legacy; now via Privy)
├── contexts/
│   ├── DataContext.tsx       # Proposals & payouts cache
│   └── ViewModeContext.tsx   # community vs full
├── hooks/
│   ├── useWalletAddress.ts   # Resolves effective address (smart wallet or EOA)
│   └── useFeatures.ts
├── lib/
│   ├── metadata.ts           # Supabase CRUD for NFT metadata
│   ├── storage.ts            # Photo upload/delete
│   ├── supabase.ts
│   └── utils.ts
├── abis/                     # Contract ABIs
└── scripts/
    ├── fix-ipfs-routes.js    # Post-build for IPFS deployment
    └── dev-arm64.sh
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth | Privy (email, wallet) |
| Smart wallets | Privy SmartWalletsProvider (ZeroDev) |
| Ethereum | Wagmi 3, Viem |
| Data fetching | TanStack Query |
| Off-chain storage | Supabase (DB + Storage) |
| Card export | html2canvas (PNG download) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- Supabase project
- Privy app (dashboard.privy.io)
- Optional: Pimlico API key (for gas sponsorship; Privy may provide this)

### Installation

```bash
pnpm install
```

### Environment Variables

Create `.env.local`:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id

# Optional: RPC (defaults to public Sepolia RPC)
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
NEXT_PUBLIC_PIMLICO_API_KEY=your-pimlico-key  # if not via Privy
```

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Create table `member_metadata` with columns: `token_id` (bigint nullable), `owner_address` (text), `metadata_json` (jsonb), `created_at`, `updated_at`
3. Create storage bucket `member_photos` with public read access
4. Add RLS policies as needed for your use case

See `documentation/BASEURI_SUPABASE_EXPLANATION.md` for details.

### Development

```bash
pnpm dev           # Full build
pnpm dev:community # Community-only build
```

### Build

```bash
pnpm build        # Default (full)
pnpm build:full
pnpm build:community
pnpm start
```

The build runs `fix-ipfs-routes.js` to generate `index.html` in route folders for IPFS-style routing.

---

## Decentralization

- **Wallets**: Injected only (MetaMask, Brave); no WalletConnect
- **RPC**: Public Sepolia RPC by default; custom URL supported
- **Hosting**: Static output; suitable for IPFS, Arweave, ENS
- **Metadata**: Supabase used for user-editable data; IPFS is immutable and does not support updates/deletes

See [DECENTRALIZATION.md](./DECENTRALIZATION.md) for more detail.

---

## Notes

- Contracts run on Sepolia testnet
- Connect wallet to Sepolia to interact
- Membership NFT required for proposal creation and voting
- For IPFS deployment, build and serve the `out` directory (if configured) or use the static export from `.next`
