'use client';

export function PhilosophyPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Design Philosophy</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          The principles and choices that guide Qawl DAO's architecture and implementation
        </p>
      </div>

      {/* Core Principles */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Core Principles</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">1. Decentralization First</h3>
            <p className="text-gray-700 dark:text-gray-300">
              We prioritize decentralization at every layer of the stack. Our smart contracts are upgradeable but governed by the DAO itself. 
              We minimize reliance on centralized infrastructure, choosing decentralized alternatives whenever possible. The frontend can be deployed 
              to IPFS, and we avoid centralized services like WalletConnect in favor of direct wallet connections.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">2. Transparency and Verifiability</h3>
            <p className="text-gray-700 dark:text-gray-300">
              All smart contracts are verified on block explorers, allowing anyone to inspect the code. Governance parameters, treasury operations, 
              and membership records are fully transparent and auditable on-chain. Every decision and transaction is recorded immutably on the blockchain.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">3. User Sovereignty</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Members own their membership NFTs and control their voting power through delegation. The DAO cannot arbitrarily revoke memberships 
              (except through governance or the revocation authority for compliance). Users maintain full control over their digital identity and participation.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">4. Progressive Decentralization</h3>
            <p className="text-gray-700 dark:text-gray-300">
              We acknowledge that complete decentralization may not be achievable immediately. We use upgradeable contracts to allow the DAO to evolve, 
              and we make pragmatic choices (like using Supabase for GDPR-compliant metadata) while maintaining a path toward greater decentralization.
            </p>
          </div>
        </div>
      </div>

      {/* Technical Choices */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Technical Architecture Choices</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Smart Contracts</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>OpenZeppelin Contracts:</strong> We use battle-tested, audited OpenZeppelin contracts as the foundation for security and reliability.</li>
              <li><strong>UUPS Upgradeable Pattern:</strong> Contracts are upgradeable to allow the DAO to evolve, but upgrades require governance approval.</li>
              <li><strong>ERC721Votes:</strong> Membership NFTs use ERC721Votes for transparent, on-chain voting power tracking.</li>
              <li><strong>Timelock:</strong> Treasury operations go through a timelock to prevent hasty decisions and allow for review.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Frontend</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>IPFS-Ready:</strong> The frontend is designed to be deployed to IPFS for decentralized hosting.</li>
              <li><strong>Direct Wallet Connection:</strong> We use direct injected wallet connections (MetaMask, Brave) instead of centralized wallet services.</li>
              <li><strong>Client-Side Rendering:</strong> To avoid SSR/CSR mismatches and ensure consistent behavior across environments.</li>
              <li><strong>Dark Theme:</strong> A single, consistent dark theme for better UX and reduced complexity.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Data Storage</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>On-Chain:</strong> Critical data (membership, voting, treasury) is stored on-chain for immutability and transparency.</li>
              <li><strong>Supabase (Metadata):</strong> We use Supabase for NFT metadata and photos to enable GDPR compliance (update/delete rights) while maintaining a path to decentralization.</li>
              <li><strong>Hybrid Approach:</strong> Combining on-chain immutability with off-chain flexibility for user data rights.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Governance Design */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Governance Design</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">One Member, One Vote</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Each membership NFT grants exactly one vote, ensuring equal representation regardless of donation amount. This prevents plutocracy 
              and ensures that all members have an equal voice in DAO decisions.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delegation System</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Members can delegate their voting power to themselves or to trusted delegates. This allows for flexible participation—members can 
              vote directly or delegate to experts. Delegation is required to activate voting power, ensuring intentional participation.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Quorum and Thresholds</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Proposals require a quorum (percentage of total membership) to pass, preventing minority rule. A proposal threshold prevents spam 
              by requiring minimum voting power to create proposals. These parameters are set in the Constitution and can be changed through governance.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Timelock Protection</h3>
            <p className="text-gray-700 dark:text-gray-300">
              All treasury operations go through a timelock, giving members time to review and react to proposals before execution. This adds a 
              safety layer against hasty or malicious proposals.
            </p>
          </div>
        </div>
      </div>

      {/* Security Considerations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Security Considerations</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Spend Caps</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Treasury operations are protected by per-transaction and epoch spend caps. This limits the damage that can be done by a single 
              proposal or within a time period, even if governance is compromised.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Recipient Allowlist</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Only pre-approved addresses can receive treasury funds. This prevents funds from being sent to arbitrary addresses, even if a 
              proposal passes. The allowlist is managed through governance.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Revocation Authority</h3>
            <p className="text-gray-700 dark:text-gray-300">
              A designated revocation authority can revoke memberships outside of normal governance for compliance or legal reasons. This is 
              a necessary compromise for real-world operations while maintaining transparency (the authority is public and on-chain).
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Soulbound NFTs</h3>
            <p className="text-gray-700 dark:text-gray-300">
              Membership NFTs are non-transferable (soulbound), preventing vote buying or manipulation through NFT trading. This ensures that 
              voting power remains tied to the original member.
            </p>
          </div>
        </div>
      </div>

      {/* GDPR and Data Privacy */}
      <div id="gdpr" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 scroll-mt-20">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">GDPR Compliance and Data Privacy</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">What is Stored On-Chain</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              The following information is permanently stored on the blockchain and cannot be deleted:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>Your wallet address:</strong> The Ethereum address that owns the membership NFT</li>
              <li><strong>Token ID:</strong> The unique identifier of your membership NFT</li>
              <li><strong>Minting transaction:</strong> The transaction hash and block number when you minted</li>
              <li><strong>Voting records:</strong> Your votes on governance proposals (if you voted)</li>
              <li><strong>Delegation records:</strong> Who you delegated your voting power to</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              This on-chain data is immutable and publicly visible on block explorers. It cannot be deleted or modified, which ensures transparency and prevents manipulation of governance records.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">What is Stored Off-Chain (Supabase)</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              The following personal information displayed on your membership card is stored in a GDPR-compliant database (Supabase) and can be updated or deleted:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>Your name:</strong> As displayed on the membership card</li>
              <li><strong>Date of birth:</strong> If provided</li>
              <li><strong>Citizenship type:</strong> As displayed on the card</li>
              <li><strong>Photo:</strong> Your profile photo stored in Supabase Storage</li>
              <li><strong>Issued date:</strong> When the membership was created</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              This off-chain data is linked to your on-chain token ID but stored separately to enable GDPR compliance. You can update or delete this information at any time through the membership management interface.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              <strong>Important:</strong> The connection between your on-chain wallet address/NFT and your off-chain personal data exists only in the off-chain database. Someone viewing the blockchain alone cannot link your wallet address to your personal information—this link only exists in the off-chain database.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">GDPR Rights</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              As a member, you have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 ml-4">
              <li><strong>Right to Access:</strong> You can view all your personal data through the membership interface</li>
              <li><strong>Right to Rectification:</strong> You can update your name, date of birth, citizenship, and photo at any time</li>
              <li><strong>Right to Erasure:</strong> You can delete your personal data (name, photo, etc.) from the database. Note: Your on-chain membership NFT and voting records cannot be deleted</li>
              <li><strong>Right to Data Portability:</strong> You can export your data by viewing it in the interface</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              <strong>Important:</strong> Deleting your personal data from Supabase will remove it from the membership card display, but your on-chain membership NFT, voting power, and governance participation records will remain on the blockchain permanently. The NFT itself cannot be deleted or transferred (it's soulbound).
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Why This Hybrid Approach?</h3>
            <p className="text-gray-700 dark:text-gray-300">
              We use a hybrid approach combining on-chain and off-chain storage to balance transparency, immutability, and GDPR compliance. Critical governance data (membership, votes) must be immutable and transparent on-chain. Personal information (name, photo) needs to be updatable and deletable for GDPR compliance, so it's stored off-chain while remaining linked to your immutable on-chain membership NFT.
            </p>
          </div>
        </div>
      </div>

      {/* Future Considerations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Future Considerations</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Decentralized Indexing</h3>
            <p className="text-gray-700 dark:text-gray-300">
              We're exploring decentralized indexing solutions (like The Graph Network) to replace RPC-based event fetching, improving 
              reliability and decentralization for historical data queries.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Metadata Decentralization</h3>
            <p className="text-gray-700 dark:text-gray-300">
              While we currently use Supabase for GDPR compliance, we're exploring decentralized alternatives that maintain data rights 
              (update/delete) while reducing centralization.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Multi-Chain Support</h3>
            <p className="text-gray-700 dark:text-gray-300">
              The architecture is designed to be chain-agnostic, allowing for potential expansion to other EVM-compatible chains or Layer 2 solutions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

