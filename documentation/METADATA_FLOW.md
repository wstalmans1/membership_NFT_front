# How NFT Metadata References Supabase

## The Complete Flow

### 1. **Metadata Storage (What We Have)**
```
Supabase Database Table: nft_metadata
├── token_id: 1
├── owner_address: "0x123..."
├── metadata_json: {
│     "name": "Honorary Citizenship #1",
│     "image": "https://supabase.co/storage/.../photo.jpg",
│     "properties": { ... }
│   }
└── created_at, updated_at, deleted_at
```

### 2. **NFT Contract's tokenURI() Function**
```
MembershipNFT.tokenURI(tokenId) 
  → Returns: baseURI + tokenId.toString()
  → Example: "https://your-app.com/api/metadata/1"
```

**Current Problem**: `baseURI` in Constitution contract is probably empty or pointing somewhere else!

### 3. **The Missing Link: API Endpoint**

We need a Next.js API route that:
- Receives: `GET /api/metadata/1`
- Queries: Supabase for `token_id = 1`
- Returns: The `metadata_json` field as JSON

### 4. **Complete Flow**

```
┌─────────────────┐
│  NFT Contract   │
│  tokenURI(1)     │
└────────┬────────┘
         │ Returns: "https://app.com/api/metadata/1"
         ▼
┌─────────────────┐
│  Wallet/Market  │
│  Fetches URL    │
└────────┬────────┘
         │ HTTP GET
         ▼
┌─────────────────┐
│  Next.js API    │
│  /api/metadata/1│
└────────┬────────┘
         │ Queries Supabase
         ▼
┌─────────────────┐
│  Supabase DB    │
│  Returns JSON   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Wallet/Market  │
│  Displays NFT   │
└─────────────────┘
```

## What's Missing

We need to create:
1. **Next.js API Route**: `/app/api/metadata/[tokenId]/route.ts`
   - Queries Supabase
   - Returns metadata JSON

2. **Update baseURI**: Set Constitution contract's `baseURI` to:
   ```
   https://your-app-domain.com/api/metadata/
   ```
   (Or use relative URL if same domain)

## Current Implementation Status

✅ **Done**:
- Metadata stored in Supabase
- Frontend can upload/fetch metadata
- Minting flow saves metadata

❌ **Missing**:
- API endpoint to serve metadata
- baseURI pointing to API endpoint

