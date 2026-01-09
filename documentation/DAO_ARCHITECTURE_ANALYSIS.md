# Qawl DAO Architecture Analysis

## Purpose
This document provides a comprehensive analysis of the Qawl DAO architecture to serve as a foundation for creating a visual schema showing:
- How the community interacts with the DAO and its contracts
- How the community controls roles through governance
- Role allocations between contracts
- The complete governance flow

---

## 1. Core Contracts Overview

### 1.1 DAOGovernor (Proxy: `0xa2e4e3082BEf648D3e996E96A849Dd1D3EF952f1`)
**Purpose**: The central governance contract that manages proposal creation, voting, and execution coordination.

**Key Functions**:
- `propose()`: Create new governance proposals (any member can use this function)
- `castVote()`: Members vote on proposals (any member can use this function)
- `queue()`: Trigger scheduling of approved proposals for execution (anyone can use this function to initiate scheduling; internally, the Governor calls `TimelockController.scheduleBatch()`, which requires `PROPOSER_ROLE` - this role is granted to the Governor contract)
- `execute()`: Trigger execution of scheduled proposals after delay (anyone can use this function to initiate execution; internally, the Governor calls `TimelockController.executeBatch()`, which requires `EXECUTOR_ROLE` - this role is open to all, so anyone can trigger execution)

**Roles**:
  - **Rookie explanation**: Roles are like "keys" that unlock specific permissions. Each contract has different roles that allow different actions. Think of it like a building where different keys open different doors - you need the right role (key) to perform certain actions (open certain doors).
- `DEFAULT_ADMIN_ROLE`: Controls upgrades (UUPS proxy - UUPS stands for "Universal Upgradeable Proxy Standard", which allows contracts to be upgraded to new versions) → **Held by: Deployer**
  - **Rookie explanation**: This is the "superuser" role. Whoever has this role can upgrade the Governor contract to a new version. Currently held by the deployer, but should eventually be transferred to Timelock so the community controls upgrades through governance.
- `GOVERNANCE_ROLE`: Currently unused for execution → **Held by: Deployer**
  - **Rookie explanation**: This role exists but isn't actually used for executing proposals. It's kept for potential future use or emergency scenarios. Currently held by the deployer.

**Dependencies**:
- Uses `MembershipNFT` for voting power (ERC721Votes - a standard that allows NFTs to be used for voting, tracking voting power and delegation)
- Uses `TimelockController` for execution delay and safety
- Delegates execution to Timelock (through `GovernorTimelockControlUpgradeable`, the Governor calls Timelock functions instead of executing proposals directly)

---

### 1.2 TimelockController (Address: `0x6dfc323b65eE7D48f7913892Ff9d9B73436d2942`)
**Purpose**: Enforces a delay between proposal approval and execution, allowing community intervention in case of malicious proposals.

**Key Functions**:
- `scheduleBatch()`: Schedule operations (called internally by `DAOGovernor.queue()`; requires `PROPOSER_ROLE` - this role is granted to the Governor contract)
- `executeBatch()`: Execute operations after delay (called internally by `DAOGovernor.execute()`; requires `EXECUTOR_ROLE` - this role is open to all, so anyone can execute)
- `cancel()`: Cancel scheduled operations (operations waiting for execution; requires `CANCELLER_ROLE` - this role is granted to the Governor contract)

**Roles**:
  - **Rookie explanation**: Roles are like "keys" that unlock specific permissions. Each contract has different roles that allow different actions. Think of it like a building where different keys open different doors - you need the right role (key) to perform certain actions (open certain doors).
- `PROPOSER_ROLE`: Can schedule operations → **Held by: Governor**
  - **Rookie explanation**: This role allows scheduling operations in the Timelock. When a member calls `queue()` on the Governor, the Governor uses this role to schedule the operations in the Timelock. Think of it as "permission to add items to the execution queue."
- `EXECUTOR_ROLE`: Can execute operations → **Held by: Open to all (address(0))**
  - **Rookie explanation**: This role allows executing operations after the delay period. In this DAO, it's set to "open" (address(0) means "zero address" which represents "everyone" in smart contracts), meaning anyone can execute ready operations. This is safe because the Timelock delay provides security - malicious proposals can be cancelled during the delay period.
- `CANCELLER_ROLE`: Can cancel operations → **Held by: Governor**
  - **Rookie explanation**: This role allows cancelling operations that are scheduled but not yet executed. The Governor has this role so it can cancel proposals if needed (e.g., if a malicious proposal somehow was approved by voting).
- `DEFAULT_ADMIN_ROLE`: Role management → **Held by: Deployer**
  - **Rookie explanation**: This is the "superuser" role for the Timelock itself. Whoever has this can grant or revoke the other roles (PROPOSER, EXECUTOR, CANCELLER). Currently held by the deployer, but ideally should be transferred to a multisig or Timelock itself for full decentralization.

**Critical Role**: The Timelock acts as the **executor** for all governance actions. It must hold the appropriate roles on target contracts for proposals to execute successfully.

---

### 1.3 MembershipNFT (Proxy: `0x308bFFa77D93a7c37225De5bcEA492E95293DF29`)
**Purpose**: Represents DAO membership, provides voting power, and tracks delegation.

**Key Functions**:
- `mint()`: Public minting with minimum donation (anyone can use this function; requires ETH donation ≥ minimum)
- `delegate()`: Delegate voting power (any member can use this function; auto-delegates to self on mint)
- `revoke()`: Revoke membership (requires `REVOKER_ROLE`, currently held by deployer)

**Roles**:
  - **Rookie explanation**: Roles are like "keys" that unlock specific permissions. Each contract has different roles that allow different actions. Think of it like a building where different keys open different doors - you need the right role (key) to perform certain actions (open certain doors).
- `TREASURY_ROLE`: Can update treasury address → **Held by: Timelock**
  - **Rookie explanation**: This role allows changing which address receives the ETH donations when members mint NFTs. The Timelock has this role, so changing the treasury requires a governance proposal (community vote).
- `REVOKER_ROLE`: Can revoke memberships → **Held by: Deployer**
  - **Rookie explanation**: This role allows permanently revoking someone's membership NFT (burning it). Currently only the deployer can do this, but this role could be granted to Timelock via governance so the community can vote to revoke memberships.
- `MINTER_ROLE`: Reserved for future use → **Not currently allocated**
  - **Rookie explanation**: This role would allow minting NFTs without going through the public `mint()` function. Currently unused because anyone can mint by calling `mint()` with the minimum donation. Reserved for potential future features like airdrops or special mints. Not currently allocated to anyone.
- `DEFAULT_ADMIN_ROLE`: Upgrades and role management → **Held by: Deployer**
  - **Rookie explanation**: This is the "superuser" role. Whoever has this can upgrade the MembershipNFT contract and grant/revoke all other roles. Currently held by the deployer, but should be transferred to Timelock so the community controls upgrades through governance.

**Voting Power**: Each NFT = 1 vote. Uses ERC721Votes for snapshot-based voting (snapshot-based voting means voting power is measured at a specific block number when the proposal is created, not at the time of voting - this prevents members from buying/selling NFTs to manipulate votes).

---

### 1.4 Constitution (Proxy: `0x931E702cfdda455f77dAdD55F79D561588FbcD05`)
**Purpose**: Central parameter store for DAO configuration.

**Key Parameters**:
- `minDonationWei`: Minimum donation to mint NFT (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)
- `baseURI`: Base URI for NFT metadata (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)
- `revocationAuthority`: Address authorized to revoke memberships (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)
- `perTxSpendCapWei`: Maximum per-transaction treasury spend (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)
- `epochSpendCapWei`: Maximum per-epoch treasury spend (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)
- `epochDuration`: Duration of spending epochs (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)
- `isRecipientAllowed`: Allowlist for treasury recipients (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)
- `guardianEnabled`: Toggle for guardian veto functionality (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)

**Roles**:
  - **Rookie explanation**: Roles are like "keys" that unlock specific permissions. Each contract has different roles that allow different actions. Think of it like a building where different keys open different doors - you need the right role (key) to perform certain actions (open certain doors).
- `GOVERNANCE_ROLE`: Can modify all parameters → **Held by: Timelock and Deployer**
  - **Rookie explanation**: This role allows changing all the DAO's configuration parameters (minimum donation, spend caps, allowlist, etc.). The Timelock has this role, so changing any Constitution parameter requires a governance proposal and community vote. This ensures the community controls all DAO settings. The deployer also holds this role for emergency access.
- `DEFAULT_ADMIN_ROLE`: Upgrades and role management → **Held by: Deployer**
  - **Rookie explanation**: This is the "superuser" role. Whoever has this can upgrade the Constitution contract and grant/revoke all other roles. Currently held by the deployer, but should be transferred to Timelock so the community controls upgrades through governance.
- `GUARDIAN_ROLE`: Reserved for future use → **Not currently allocated**
  - **Rookie explanation**: This role is defined but not currently used in the code. It's reserved for potential future features, such as a guardian who could pause or restrict certain operations in emergency situations. Not currently allocated to anyone.

**Usage**: All contracts read from Constitution to enforce DAO rules.

---

### 1.5 TreasuryExecutor (Proxy: `0xDD21739Ec074C8C3480C689dDDbA2C7451169F33`)
**Purpose**: Holds and manages DAO treasury funds with spending controls.

**Key Functions**:
- `executePayout()`: Execute treasury payouts (requires `EXECUTOR_ROLE`, currently held by Timelock; enforces Constitution rules)
- `guardianCancel()`: Guardian can signal violations (requires `GUARDIAN_ROLE`, currently held by deployer; doesn't block execution)

**Roles**:
  - **Rookie explanation**: Roles are like "keys" that unlock specific permissions. Each contract has different roles that allow different actions. Think of it like a building where different keys open different doors - you need the right role (key) to perform certain actions (open certain doors).
- `EXECUTOR_ROLE`: Can execute payouts → **Held by: Timelock and Deployer**
  - **Rookie explanation**: This role allows executing treasury payouts (sending ETH from the treasury to recipients). The Timelock has this role, so all treasury payouts must go through governance proposals. The Constitution enforces rules like recipient allowlists and spend caps, so even with this role, payouts must follow the DAO's rules. The deployer also holds this role for emergency access.
- `GUARDIAN_ROLE`: Can use guardianCancel function → **Held by: Deployer**
  - **Rookie explanation**: This role allows using the `guardianCancel()` function to signal that a proposed payout violates DAO rules. The guardian can't actually block execution (that would require cancelling in the Timelock), but they can signal violations. This is a "watchdog" role for detecting malicious proposals. Currently held by the deployer.
- `DEFAULT_ADMIN_ROLE`: Upgrades and setConstitution → **Held by: Deployer**
  - **Rookie explanation**: This is the "superuser" role. Whoever has this can upgrade the TreasuryExecutor contract and change which Constitution contract it reads from. Currently held by the deployer, but should be transferred to Timelock so the community controls upgrades through governance.

**Enforcement**: Reads from Constitution to enforce:
- Recipient allowlist
- Per-transaction spend caps
- Per-epoch spend caps
- Epoch duration windows

---

## 2. Community Interaction Flow

### 2.1 Joining the DAO
1. **User** → Uses the `MembershipNFT.mint()` function with ETH ≥ `minDonationWei`
2. **MembershipNFT** → Mints NFT, auto-delegates to self (calls `delegate()` internally), forwards ETH to TreasuryExecutor (calls `treasury.call{value: msg.value}()` to transfer funds)
3. **Result**: User becomes a member with 1 vote (activated through self-delegation - the NFT automatically delegates voting power to the owner when minted)

### 2.2 Creating a Proposal
1. **Member** → Uses the `DAOGovernor.propose(targets, values, calldatas, description)` function
2. **DAOGovernor** → Checks `proposalThreshold()` (reads voting power from `MembershipNFT` to verify member has ≥ threshold votes)
3. **DAOGovernor** → Creates proposal, sets snapshot block (snapshot = the block number at which voting power is measured - members' voting power is "frozen" at this point for this proposal; the Governor reads voting power from `MembershipNFT` at this block)
4. **Result**: Proposal enters "Pending" state (waiting for voting to begin), voting starts after `votingDelay`

### 2.3 Voting on Proposals
1. **Member** → Uses the `DAOGovernor.castVote(proposalId, support)` function (For/Against/Abstain)
2. **DAOGovernor** → Checks voting power at proposal snapshot (reads voting power from `MembershipNFT` at the block when the proposal was created, not at the time of voting)
3. **MembershipNFT** → Provides voting power through ERC721Votes (the Governor calls `MembershipNFT.getVotes()` to read voting power; ERC721Votes is a standard that allows NFTs to be used for voting - it tracks voting power and delegation)
4. **Result**: Vote is recorded, proposal state updates based on votes

### 2.4 Proposal Execution Flow
1. **Proposal is Approved by Voting** → State becomes "Succeeded" (proposal has enough votes to pass)
2. **Member/Anyone** → Uses the `DAOGovernor.queue(proposalId)` function to trigger scheduling of the approved proposal for execution (this function internally calls `TimelockController.scheduleBatch()`)
3. **DAOGovernor** → Internally calls `TimelockController.scheduleBatch()` (through `_queueOperations()`; uses `PROPOSER_ROLE` which is granted to the Governor contract)
4. **TimelockController** → Schedules operations, sets execution ETA (current time + delay)
5. **After Delay** → Anyone can use the `DAOGovernor.execute(proposalId)` function to trigger execution (this function internally calls `TimelockController.executeBatch()`)
6. **DAOGovernor** → Internally calls `TimelockController.executeBatch()` (through `_executeOperations()`; uses `EXECUTOR_ROLE` which is open to all)
7. **TimelockController** → Executes operations on target contracts using `executeBatch()` (using its roles on those contracts - e.g., `GOVERNANCE_ROLE` on Constitution, `EXECUTOR_ROLE` on TreasuryExecutor)
8. **Result**: Proposal actions are executed on-chain

**Note**: From a user's perspective, they use the `queue()` and `execute()` functions on the Governor. Internally, the Governor translates these into `scheduleBatch()` and `executeBatch()` calls on the Timelock. "Queueing" (putting in line for execution) and "scheduling" (setting a time for execution) refer to the same action from different perspectives - users "queue" proposals, while the Governor "schedules" operations in the Timelock.

---

## 3. Role Control and Governance

### 3.1 Current Role Holders

#### Deployer/Admin (`0xD78C12137087D394c0FA49634CAa80D0a1985A8A`)
**Current Roles**:
- All `DEFAULT_ADMIN_ROLE` on all contracts (temporary, should be transferred to Timelock)
- `REVOKER_ROLE` on MembershipNFT
- `GUARDIAN_ROLE` on TreasuryExecutor
- `GOVERNANCE_ROLE` on Constitution (alongside Timelock)

**Purpose**: Initial setup and emergency break-glass access.

#### TimelockController (`0x6dfc323b65eE7D48f7913892Ff9d9B73436d2942`)
**Roles Granted**:
- `PROPOSER_ROLE` on TimelockController → **Granted by: Deployer** (the deployer granted this role to the Governor contract)
- `CANCELLER_ROLE` on TimelockController → **Granted by: Deployer** (the deployer granted this role to the Governor contract)
- `GOVERNANCE_ROLE` on Constitution → **Granted by: Deployer** (the deployer granted this role to the Timelock contract)
- `EXECUTOR_ROLE` on TreasuryExecutor → **Granted by: Deployer** (the deployer granted this role to the Timelock contract)
- `TREASURY_ROLE` on MembershipNFT → **Granted by: Deployer** (the deployer granted this role to the Timelock contract)

**Purpose**: Acts as the executor for all governance proposals.

#### DAOGovernor (`0xa2e4e3082BEf648D3e996E96A849Dd1D3EF952f1`)
**Roles Granted**:
- `PROPOSER_ROLE` on TimelockController → **Granted by: Deployer** (the deployer granted this role to the Governor contract)
- `CANCELLER_ROLE` on TimelockController → **Granted by: Deployer** (the deployer granted this role to the Governor contract)

**Purpose**: Can schedule and cancel operations in Timelock (the Governor contract calls Timelock functions through `_queueOperations` and `_cancel`; it has `PROPOSER_ROLE` and `CANCELLER_ROLE` on the Timelock to do this).

---

### 3.2 How Community Controls Roles

**Current State**: Most `DEFAULT_ADMIN_ROLE` are still held by deployer. Community can gain control through governance proposals.

**Governance Path to Role Control**:
1. **Community** → Creates proposal to grant `DEFAULT_ADMIN_ROLE` to Timelock on a contract
2. **Proposal is Approved by Voting** → Scheduled for execution in Timelock (via `DAOGovernor.queue()` which internally calls `TimelockController.scheduleBatch()`)
3. **Timelock Executes** → Grants role to itself (or another address) (the Timelock calls `executeBatch()`, which executes `Constitution.grantRole()`; the Timelock can do this because it holds the required role)
4. **Result**: Community now controls that role through future governance proposals

**Example**: To transfer Constitution `DEFAULT_ADMIN_ROLE` to Timelock:
- Proposal: `Constitution.grantRole(DEFAULT_ADMIN_ROLE, Timelock)`
- After execution: Timelock controls Constitution upgrades
- Future upgrades: Require governance proposal → Timelock execution

---

## 4. Role Flow Diagram (Conceptual)

```
Community (Members)
    │
    ├─→ [Vote on Proposals] → DAOGovernor
    │                              │
    │                              ├─→ [Queue Operations] → TimelockController
    │                              │                              │
    │                              │                              ├─→ [Execute] → Constitution (GOVERNANCE_ROLE)
    │                              │                              │
    │                              │                              ├─→ [Execute] → TreasuryExecutor (EXECUTOR_ROLE)
    │                              │                              │
    │                              │                              └─→ [Execute] → MembershipNFT (TREASURY_ROLE)
    │                              │
    │                              └─→ [Read Voting Power] → MembershipNFT
    │
    └─→ [Mint NFT] → MembershipNFT → [Forward ETH] → TreasuryExecutor
```

---

## 5. Key Governance Actions

### 5.1 Constitution Parameter Changes
**Flow**: 
1. **Member** → Creates a proposal through the Governor contract (`DAOGovernor.propose()`), which includes calling `Constitution.setMinDonationWei(value)` (requires `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**)
2. **Community** → Votes on the proposal
3. **Proposal Approved** → When the proposal is approved by voting, anyone can trigger scheduling in the Timelock using `DAOGovernor.queue()` (this function internally calls `TimelockController.scheduleBatch()`)
4. **Timelock Schedules** → The Timelock's `scheduleBatch()` function schedules the operation and sets execution ETA (current time + delay)
5. **After Delay** → Anyone can trigger execution of the proposal using `DAOGovernor.execute()` (this function internally calls `TimelockController.executeBatch()`)
6. **Timelock Executes** → The Timelock's `executeBatch()` function executes `Constitution.setMinDonationWei(value)`; the Timelock can execute this because it holds `GOVERNANCE_ROLE` on Constitution
7. **Result**: Minimum donation updated

**Other Constitution Actions** (all require `GOVERNANCE_ROLE` → **Held by: Timelock and Deployer**):
- `setBaseURI()`
- `setSpendCaps()`
- `setRecipientAllowed()`
- `setGuardianEnabled()`
- `setRevocationAuthority()`

### 5.2 Treasury Payouts
**Flow**:
1. **Member** → Creates a proposal through the Governor contract (`DAOGovernor.propose()`), which includes calling `TreasuryExecutor.executePayout(recipient, amount, data)` (requires `EXECUTOR_ROLE` → **Held by: Timelock and Deployer**)
2. **Community** → Votes on the proposal
3. **Proposal Approved** → When the proposal is approved by voting, anyone can trigger scheduling in the Timelock using `DAOGovernor.queue()` (this function internally calls `TimelockController.scheduleBatch()`)
4. **Timelock Schedules** → The Timelock's `scheduleBatch()` function schedules the operation and sets execution ETA (current time + delay)
5. **After Delay** → Anyone can trigger execution of the proposal using `DAOGovernor.execute()` (this function internally calls `TimelockController.executeBatch()`)
6. **Timelock Executes** → The Timelock calls `executeBatch()`, which executes `TreasuryExecutor.executePayout()`; the Timelock can execute this because it holds `EXECUTOR_ROLE` on TreasuryExecutor
7. **Constitution Enforces** → The TreasuryExecutor's `executePayout()` function reads from Constitution (calls `constitution.isRecipientAllowed()`, `constitution.perTxSpendCapWei()`, etc.) to enforce: allowlist, spend caps, epoch limits
8. **Result**: Funds transferred to recipient

### 5.3 Membership Management
**Flow** (Revoking a Membership):
1. **Member** → Creates a proposal through the Governor contract (`DAOGovernor.propose()`), which includes calling `MembershipNFT.revoke(member)` (requires `REVOKER_ROLE` → **Currently held by: Deployer**; can be granted to Timelock via governance)
2. **Community** → Votes on the proposal
3. **Proposal Approved** → When the proposal is approved by voting, anyone can trigger scheduling in the Timelock using `DAOGovernor.queue()` (this function internally calls `TimelockController.scheduleBatch()`)
4. **Timelock Schedules** → The Timelock's `scheduleBatch()` function schedules the operation and sets execution ETA (current time + delay)
5. **After Delay** → Anyone can trigger execution of the proposal using `DAOGovernor.execute()` (this function internally calls `TimelockController.executeBatch()`)
6. **Timelock Executes** → The Timelock's `executeBatch()` function executes `MembershipNFT.revoke(member)`; the Timelock can execute this if it holds `REVOKER_ROLE` on MembershipNFT (currently only Deployer has this role, but it can be granted to Timelock via governance)
7. **Result**: Membership NFT is burned, voting power is removed, delegation is cleaned up, and the member can no longer vote or participate in governance

**Note**: Currently, `REVOKER_ROLE` is held by the Deployer, so membership revocation requires a governance proposal to first grant `REVOKER_ROLE` to the Timelock. After that, future revocations can be done through governance proposals.

### 5.4 MembershipNFT Configuration
**Flow** (Updating Treasury Address):
1. **Member** → Creates a proposal through the Governor contract (`DAOGovernor.propose()`), which includes calling `MembershipNFT.setTreasury(newTreasury)` (requires `TREASURY_ROLE` → **Held by: Timelock**)
2. **Community** → Votes on the proposal
3. **Proposal Approved** → When the proposal is approved by voting, anyone can trigger scheduling in the Timelock using `DAOGovernor.queue()` (this function internally calls `TimelockController.scheduleBatch()`)
4. **Timelock Schedules** → The Timelock's `scheduleBatch()` function schedules the operation and sets execution ETA (current time + delay)
5. **After Delay** → Anyone can trigger execution of the proposal using `DAOGovernor.execute()` (this function internally calls `TimelockController.executeBatch()`)
6. **Timelock Executes** → The Timelock's `executeBatch()` function executes `MembershipNFT.setTreasury(newTreasury)`; the Timelock can execute this because it holds `TREASURY_ROLE` on MembershipNFT
7. **Result**: Treasury address updated (future NFT mints will forward ETH to the new treasury address)

### 5.5 Contract Upgrades
**Flow**:
1. **Member** → Creates a proposal through the Governor contract (`DAOGovernor.propose()`), which includes calling `Contract.upgradeTo(newImplementation)` (requires `DEFAULT_ADMIN_ROLE` → **Currently held by: Deployer**)
2. **Community** → Votes on the proposal
3. **Proposal Approved** → When the proposal is approved by voting, anyone can trigger scheduling in the Timelock using `DAOGovernor.queue()` (this function internally calls `TimelockController.scheduleBatch()`)
4. **Timelock Schedules** → The Timelock's `scheduleBatch()` function schedules the operation and sets execution ETA (current time + delay)
5. **After Delay** → Anyone can trigger execution of the proposal using `DAOGovernor.execute()` (this function internally calls `TimelockController.executeBatch()`)
6. **Currently**: Deployer executes directly (the deployer calls `Contract.upgradeTo()` directly because they hold `DEFAULT_ADMIN_ROLE`; this bypasses governance and the Timelock)
7. **Future**: Timelock executes (after governance grants `DEFAULT_ADMIN_ROLE` to Timelock, the Timelock will call `executeBatch()`, which executes `Contract.upgradeTo()`; the Timelock will have `DEFAULT_ADMIN_ROLE` on the contract, so it can call this function)
8. **Result**: Contract upgraded to new implementation

---

## 6. Governance Parameters

### 6.1 Voting Parameters (Set in DAOGovernor)
- **Voting Delay**: Blocks between proposal creation and voting start
- **Voting Period**: Blocks during which voting is open
- **Proposal Threshold**: Minimum votes required to create a proposal
- **Quorum**: Minimum "For" + "Abstain" votes required for proposal to pass (calculated as a percentage of total voting supply at the proposal snapshot block)

### 6.2 Execution Parameters (Set in TimelockController)
- **Min Delay**: Minimum time (seconds) between scheduling a proposal and executing it
- **Current Delay**: Can be updated through `updateDelay()` (requires `DEFAULT_ADMIN_ROLE` - whoever has this role can change the delay)

---

## 7. Security and Safety Mechanisms

### 7.1 Timelock Delay
- All governance actions pass through Timelock
- Delay allows community to review and potentially cancel malicious proposals
- Delay is enforced on-chain

### 7.2 Constitution Enforcement
- Treasury spending is constrained by Constitution parameters
- Recipient allowlist prevents unauthorized payouts
- Spend caps limit maximum amounts per transaction/epoch

### 7.3 Guardian Mechanism (Future)
- `GUARDIAN_ROLE` can signal violations
- Guardian cannot redirect funds, only signal
- Toggle controlled by governance (`setGuardianEnabled`)

---

## 8. Upgradeability

### 8.1 Upgrade Pattern
- All contracts use **UUPS (Universal Upgradeable Proxy Standard)** - this is a pattern that allows contracts to be upgraded to new versions while keeping the same address
- Upgrades require `DEFAULT_ADMIN_ROLE` (whoever has this role can upgrade the contract)
- Current admin: Deployer (should be transferred to Timelock so the community controls upgrades through governance)

### 8.2 Upgrade Process
1. Deploy new implementation (the new version of the contract code)
2. Governance proposal: `Contract.upgradeTo(newImplementation)` (community votes to upgrade)
3. Timelock executes (if Timelock holds `DEFAULT_ADMIN_ROLE`, the Timelock calls `executeBatch()` which executes the upgrade; the Timelock has the role, so it can call the upgrade function)
4. Contract upgraded (the contract now runs the new code, but keeps the same address)

---

## 9. Questions for Visual Schema Design

1. **Visual Style**: Should we use:
   - Flowcharts (showing process flows)?
   - Entity-relationship diagrams (showing contract relationships)?
   - Role hierarchy diagrams (showing who controls what)?
   - All of the above in separate diagrams?

2. **Detail Level**: Should the schema show:
   - High-level interactions only?
   - Detailed function calls?
   - Role grants/revocations?
   - All governance parameters?

3. **Community Control**: How should we visualize:
   - Current state (deployer control)?
   - Ideal state (Timelock control)?
   - Transition path (how to achieve ideal state)?

4. **Interaction Types**: Should we distinguish:
   - Direct calls (member → contract)?
   - Governance-mediated calls (member → proposal → Timelock → contract)?
   - Read-only calls (viewing state)?

---

## 10. Recommended Schema Structure

### 10.1 Main Diagram: Contract Relationships
- Show all 5 core contracts
- Show role grants between contracts
- Show data flow (voting power, parameters, funds)

### 10.2 Governance Flow Diagram
- Proposal creation → Voting → Scheduling (queueing) → Execution
- Show state transitions
- Show who can trigger each step

### 10.3 Role Control Diagram
- Show current role holders
- Show governance path to role control
- Show which roles enable which actions

### 10.4 Community Interaction Diagram
- Show how members interact with each contract
- Distinguish direct vs. governance-mediated interactions
- Show voting power flow

---

## 11. Key Insights for Schema

1. **Timelock is Central**: All governance execution flows through Timelock. It must hold roles on target contracts.

2. **Community Control is Indirect**: Community doesn't directly use contract functions. They vote on proposals, which the Timelock executes.

3. **Role Hierarchy**: 
   - `DEFAULT_ADMIN_ROLE` → Can grant/revoke any role
   - Specific roles → Can perform specific actions
   - Governance → Can grant roles to Timelock (if admin role is transferred)

4. **Constitution is Parameter Store**: All contracts read from Constitution, but only governance can modify it.

5. **MembershipNFT Provides Voting Power**: Governor reads voting power from MembershipNFT for snapshot-based voting.

---

## Next Steps

1. **Clarify Visual Style**: Decide on diagram types (flowchart, ERD, hierarchy, etc.)
2. **Define Detail Level**: Determine how granular the schema should be
3. **Choose Tools**: Select diagramming tool (Mermaid, PlantUML, draw.io, etc.)
4. **Create Draft**: Build initial visual schema based on this analysis
5. **Iterate**: Refine based on feedback and requirements
