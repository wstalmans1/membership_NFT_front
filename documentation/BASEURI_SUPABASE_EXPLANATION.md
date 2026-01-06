# How baseURI Connects to Supabase - Detailed Explanation

## The Complete Data Flow

### Step-by-Step Example

Let's say a user mints NFT with `tokenId = 5`:

---

## Step 1: Metadata Stored in Supabase

**What happens when user mints:**

```javascript
// User fills form → Photo uploads → Metadata created
{
  name: "Francesca Paola Albanese",
  photo: <file>,
  citizenship: "Honorary Palestinian"
}

// Frontend code (MintMembershipForm.tsx):
1. Upload photo to Supabase Storage → Gets URL: "https://xxx.supabase.co/storage/v1/object/public/member_photos/token-123.jpg"
2. Create metadata JSON:
   {
     "name": "Honorary Citizenship #Francesca",
     "image": "https://xxx.supabase.co/storage/v1/object/public/member_photos/token-123.jpg",
     "properties": { name: "Francesca", ... }
   }
3. Save to Supabase Database:
   INSERT INTO nft_metadata (token_id, owner_address, metadata_json)
   VALUES (NULL, '0x123...', '{...json...}')
```

**Result in Supabase:**

```
┌─────────────────────────────────────────────────────────┐
│ Supabase Database: nft_metadata table                   │
├─────────────────────────────────────────────────────────┤
│ token_id: NULL (not set yet)                           │
│ owner_address: "0x123..."                              │
│ metadata_json: {                                        │
│   "name": "Honorary Citizenship #Francesca",           │
│   "image": "https://xxx.supabase.co/storage/.../photo",│
│   "properties": { name: "Francesca", ... }             │
│ }                                                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Supabase Storage: member_photos bucket                 │
├─────────────────────────────────────────────────────────┤
│ File: token-123.jpg                                     │
│ URL: https://xxx.supabase.co/storage/v1/object/        │
│      public/member_photos/token-123.jpg                 │
└─────────────────────────────────────────────────────────┘
```

---

## Step 2: NFT Minted on Blockchain

**After minting:**

```solidity
// Smart contract mints NFT
MembershipNFT.mint() → tokenId = 5

// Frontend extracts tokenId from transaction event
// Then updates Supabase:
UPDATE nft_metadata 
SET token_id = 5 
WHERE owner_address = '0x123...' AND token_id IS NULL
```

**Result:**

```
┌─────────────────────────────────────────────────────────┐
│ Supabase Database: nft_metadata table                  │
├─────────────────────────────────────────────────────────┤
│ token_id: 5 ✅ (NOW SET)                               │
│ owner_address: "0x123..."                               │
│ metadata_json: { ... }                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Step 3: Setting baseURI in Contract

**You set baseURI in Constitution contract:**

```solidity
// Call this function on Constitution contract:
setBaseURI("https://your-app.com/api/metadata/")
```

**What this does:**

```
Constitution Contract Storage:
┌─────────────────────────────────────────┐
│ baseURI = "https://your-app.com/api/metadata/" │
└─────────────────────────────────────────┘
```

---

## Step 4: How tokenURI() Works

**When someone calls `tokenURI(5)` on the NFT contract:**

```solidity
// In MembershipNFT.sol:
function tokenURI(uint256 tokenId) public view returns (string) {
    string memory baseURI = _baseURI();  // Gets from Constitution
    // baseURI = "https://your-app.com/api/metadata/"
    
    return string.concat(baseURI, tokenId.toString());
    // Returns: "https://your-app.com/api/metadata/5"
}
```

**Result:**
```
tokenURI(5) → "https://your-app.com/api/metadata/5"
```

---

## Step 5: Wallet/Marketplace Fetches Metadata

**When a wallet (like MetaMask) or marketplace (like OpenSea) wants to display the NFT:**

```
1. Wallet calls: tokenURI(5)
   → Gets: "https://your-app.com/api/metadata/5"

2. Wallet makes HTTP GET request:
   GET https://your-app.com/api/metadata/5

3. This hits your Next.js API route:
   /app/api/metadata/[tokenId]/route.ts
```

---

## Step 6: API Route Queries Supabase

**What happens in the API route:**

```typescript
// /app/api/metadata/[tokenId]/route.ts

export async function GET(request, { params }) {
  const tokenId = parseInt(params.tokenId); // tokenId = 5
  
  // Query Supabase database:
  const metadata = await getMetadata(tokenId);
  // This calls: supabase.from('nft_metadata')
  //              .select('metadata_json')
  //              .eq('token_id', 5)
  //              .single()
  
  // Supabase returns:
  // {
  //   metadata_json: {
  //     "name": "Honorary Citizenship #Francesca",
  //     "image": "https://xxx.supabase.co/storage/.../photo.jpg",
  //     "properties": { ... }
  //   }
  // }
  
  return NextResponse.json(metadata.metadata_json);
}
```

**The SQL query Supabase executes:**

```sql
SELECT metadata_json 
FROM nft_metadata 
WHERE token_id = 5 
  AND deleted_at IS NULL
LIMIT 1;
```

---

## Step 7: Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER MINTS NFT                                          │
│    └─> Metadata saved to Supabase (token_id = NULL)       │
│    └─> NFT minted on-chain (tokenId = 5)                   │
│    └─> Supabase updated (token_id = 5)                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CONTRACT baseURI SET                                     │
│    Constitution.setBaseURI("https://app.com/api/metadata/") │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. WALLET CALLS tokenURI(5)                                 │
│    MembershipNFT.tokenURI(5)                                │
│    └─> Returns: "https://app.com/api/metadata/5"           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. WALLET FETCHES URL                                       │
│    GET https://app.com/api/metadata/5                       │
│    └─> Hits: /app/api/metadata/[tokenId]/route.ts         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. API ROUTE QUERIES SUPABASE                               │
│    getMetadata(5)                                           │
│    └─> Supabase query: WHERE token_id = 5                  │
│    └─> Returns: metadata_json                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. API RETURNS JSON                                         │
│    {                                                        │
│      "name": "Honorary Citizenship #Francesca",            │
│      "image": "https://xxx.supabase.co/storage/.../photo", │
│      "properties": { ... }                                  │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. WALLET DISPLAYS NFT                                      │
│    - Shows name, image, attributes                          │
│    - Image URL points to Supabase Storage                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Points

### 1. **baseURI is just a URL prefix**
- `baseURI = "https://app.com/api/metadata/"`
- `tokenURI(5) = baseURI + "5" = "https://app.com/api/metadata/5"`
- It's **NOT** stored in Supabase, it's stored **on-chain** in the Constitution contract

### 2. **The API route is the bridge**
- The API route (`/api/metadata/[tokenId]`) receives the tokenId from the URL
- It queries Supabase database using that tokenId
- It returns the JSON stored in Supabase

### 3. **Supabase stores TWO things:**
- **Database**: The metadata JSON (name, properties, etc.)
- **Storage**: The actual photo file

### 4. **The connection happens via tokenId:**
- Contract has: `tokenId = 5`
- Supabase has: `token_id = 5`
- API route uses tokenId to query Supabase: `WHERE token_id = 5`

---

## Visual Summary

```
Blockchain (On-Chain)          API Layer              Supabase (Off-Chain)
┌──────────────┐              ┌──────────────┐        ┌──────────────────┐
│              │              │              │        │                  │
│ baseURI:     │              │ GET /api/    │        │ Database:        │
│ "https://... │              │ metadata/5   │───────>│ token_id = 5     │
│ /api/        │              │              │        │ metadata_json    │
│ metadata/"   │              │              │        │                  │
│              │              │              │        │ Storage:         │
│ tokenURI(5)  │─────────────>│ Query        │        │ photo.jpg        │
│ returns URL  │              │ Supabase     │        │                  │
│              │              │              │        │                  │
└──────────────┘              └──────────────┘        └──────────────────┘
     │                              │                          │
     │                              │                          │
     └──────────────────────────────┴──────────────────────────┘
                    tokenId = 5 links everything together
```

---

## Why This Architecture?

1. **On-chain**: Only stores the URL pattern (baseURI) - minimal gas cost
2. **Off-chain**: Stores actual data (JSON, photos) - flexible, GDPR-compliant
3. **API Bridge**: Connects on-chain tokenId to off-chain data

This is the standard pattern for NFT metadata!

