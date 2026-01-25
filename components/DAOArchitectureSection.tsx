'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle, ExternalLink } from 'lucide-react';
import { CONTRACTS } from '@/config/contracts';

export function DAOArchitectureSection() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const isExpanded = (sectionId: string) => expandedSections.has(sectionId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white"><span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> Architecture</h2>
          <div className="relative group" tabIndex={0}>
            <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
            <div className="absolute bottom-full mb-2 right-0 md:left-0 md:right-auto w-[80vw] sm:w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
              <p className="mb-2 font-semibold"><span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span> Architecture Overview</p>
              <p className="text-gray-300">
                Understanding how the <span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span> works: contracts, roles, and governance flows. Click sections to expand for detailed information.
              </p>
            </div>
          </div>
        </div>
        <a
          href="https://github.com/wstalmans1/membership_NFT/blob/main/documentation/DAO_ARCHITECTURE_ANALYSIS.md"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          title="View the complete DAO Architecture Analysis document on GitHub"
        >
          <span>View Full Documentation</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="space-y-4">
        {/* High-Level Overview */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            <strong className="text-gray-900 dark:text-white">Quick Overview:</strong> The <span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span> consists of 5 core contracts that work together. 
            Members create proposals, vote on them, and approved proposals are executed through the Timelock. 
            Click any section below to learn more.
          </p>
        </div>

        {/* Core Contracts */}
        <Section
          id="core-contracts"
          title="Core Contracts"
          summary="5 contracts that make up the QAWL DAO: Governor, Timelock, MembershipNFT, Constitution, and TreasuryExecutor"
          isExpanded={isExpanded('core-contracts')}
          onToggle={() => toggleSection('core-contracts')}
        >
          <ContractDetails />
        </Section>

        {/* Community Interaction Flow */}
        <Section
          id="interaction-flow"
          title="How Members Interact with the QAWL DAO"
          summary="Joining, creating proposals, voting, and executing proposals"
          isExpanded={isExpanded('interaction-flow')}
          onToggle={() => toggleSection('interaction-flow')}
        >
          <InteractionFlowDetails />
        </Section>

        {/* Roles & Permissions */}
        <Section
          id="roles"
          title="Roles & Permissions"
          summary="Who can do what: roles are like keys that unlock specific permissions"
          isExpanded={isExpanded('roles')}
          onToggle={() => toggleSection('roles')}
        >
          <RolesDetails />
        </Section>

        {/* Governance Actions */}
        <Section
          id="governance-actions"
          title="Common Governance Actions"
          summary="How to change parameters, execute payouts, manage memberships, and upgrade contracts"
          isExpanded={isExpanded('governance-actions')}
          onToggle={() => toggleSection('governance-actions')}
        >
          <GovernanceActionsDetails />
        </Section>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  summary,
  isExpanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
      >
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{summary}</p>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          {children}
        </div>
      )}
    </div>
  );
}

function ContractDetails() {
  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <div className="space-y-3">
        <div className="border-l-4 border-blue-500 pl-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">DAOGovernor</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Central governance contract. Members create proposals here, vote on them, and queue approved proposals for execution.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            <span className="font-mono">Address:</span> {CONTRACTS.SEPOLIA.GOVERNOR_PROXY}
          </p>
        </div>

        <div className="border-l-4 border-green-500 pl-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">TimelockController</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Adds a safety delay between proposal approval and execution. All governance actions must pass through the Timelock.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            <span className="font-mono">Address:</span> {CONTRACTS.SEPOLIA.TIMELOCK}
          </p>
        </div>

        <div className="border-l-4 border-purple-500 pl-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">MembershipNFT</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Represents <span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span> membership. Each NFT = 1 vote. Members mint NFTs by making a minimum donation.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            <span className="font-mono">Address:</span> {CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}
          </p>
        </div>

        <div className="border-l-4 border-yellow-500 pl-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Constitution</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Central parameter store. Defines minimum donation, spend caps, allowed recipients, and other <span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span> rules.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            <span className="font-mono">Address:</span> {CONTRACTS.SEPOLIA.CONSTITUTION_PROXY}
          </p>
        </div>

        <div className="border-l-4 border-red-500 pl-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">TreasuryExecutor</h4>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Holds and manages <span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span> treasury funds. Enforces spending rules from the Constitution.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            <span className="font-mono">Address:</span> {CONTRACTS.SEPOLIA.TREASURY_PROXY}
          </p>
        </div>
      </div>
    </div>
  );
}

function InteractionFlowDetails() {
  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">1. Joining the <span className="font-bold">QAWL</span> <span className="text-xs font-normal">DAO</span></h4>
          <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-2">
            <li>User calls <span className="font-mono">MembershipNFT.mint()</span> with ETH ≥ minimum donation</li>
            <li>NFT is minted, voting power is auto-delegated to self</li>
            <li>ETH is forwarded to TreasuryExecutor</li>
            <li>User becomes a member with 1 vote</li>
          </ol>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">2. Creating a Proposal</h4>
          <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-2">
            <li>Member calls <span className="font-mono">DAOGovernor.propose()</span></li>
            <li>Governor checks if member has enough voting power (proposal threshold)</li>
            <li>Proposal is created with a snapshot block (voting power is measured at this block)</li>
            <li>Proposal enters "Pending" state, voting starts after delay</li>
          </ol>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">3. Voting</h4>
          <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-2">
            <li>Member calls <span className="font-mono">DAOGovernor.castVote()</span> (For/Against/Abstain)</li>
            <li>Governor checks voting power at proposal snapshot</li>
            <li>Vote is recorded, proposal state updates</li>
          </ol>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">4. Execution Flow</h4>
          <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-2">
            <li>Proposal is approved by voting → State becomes "Succeeded"</li>
            <li>Anyone calls <span className="font-mono">DAOGovernor.queue()</span> to schedule execution</li>
            <li>Governor internally calls <span className="font-mono">TimelockController.scheduleBatch()</span></li>
            <li>Timelock schedules operation, sets execution ETA (current time + delay)</li>
            <li>After delay, anyone calls <span className="font-mono">DAOGovernor.execute()</span></li>
            <li>Governor internally calls <span className="font-mono">TimelockController.executeBatch()</span></li>
            <li>Timelock executes operations on target contracts using its roles</li>
            <li>Proposal actions are executed on-chain</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function RolesDetails() {
  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 mb-4">
        <p className="text-blue-900 dark:text-blue-200 font-semibold mb-1">What are Roles?</p>
        <p className="text-blue-800 dark:text-blue-300 text-xs">
          Roles are like "keys" that unlock specific permissions. Each contract has different roles that allow different actions. 
          Think of it like a building where different keys open different doors - you need the right role (key) to perform certain actions (open certain doors).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">TimelockController</h4>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li><span className="font-mono">PROPOSER_ROLE</span>: Held by Governor → Can schedule operations</li>
            <li><span className="font-mono">EXECUTOR_ROLE</span>: Open to all → Anyone can execute ready operations</li>
            <li><span className="font-mono">CANCELLER_ROLE</span>: Held by Governor → Can cancel queued operations</li>
            <li><span className="font-mono">DEFAULT_ADMIN_ROLE</span>: Held by Deployer → Can manage roles</li>
          </ul>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">DAOGovernor</h4>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li><span className="font-mono">DEFAULT_ADMIN_ROLE</span>: Held by Deployer → Controls upgrades</li>
            <li><span className="font-mono">GOVERNANCE_ROLE</span>: Held by Deployer → Currently unused</li>
          </ul>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Constitution</h4>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li><span className="font-mono">GOVERNANCE_ROLE</span>: Held by Timelock + Deployer → Can modify parameters</li>
            <li><span className="font-mono">DEFAULT_ADMIN_ROLE</span>: Held by Deployer → Controls upgrades</li>
            <li><span className="font-mono">GUARDIAN_ROLE</span>: Not allocated → Reserved for future use</li>
          </ul>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">TreasuryExecutor</h4>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li><span className="font-mono">EXECUTOR_ROLE</span>: Held by Timelock + Deployer → Can execute payouts</li>
            <li><span className="font-mono">GUARDIAN_ROLE</span>: Held by Deployer → Can signal violations</li>
            <li><span className="font-mono">DEFAULT_ADMIN_ROLE</span>: Held by Deployer → Controls upgrades</li>
          </ul>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">MembershipNFT</h4>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li><span className="font-mono">TREASURY_ROLE</span>: Held by Timelock → Can update treasury address</li>
            <li><span className="font-mono">REVOKER_ROLE</span>: Held by Deployer → Can revoke memberships</li>
            <li><span className="font-mono">MINTER_ROLE</span>: Not allocated → Reserved for future use</li>
            <li><span className="font-mono">DEFAULT_ADMIN_ROLE</span>: Held by Deployer → Controls upgrades</li>
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 mt-4">
        <p className="text-yellow-900 dark:text-yellow-200 font-semibold mb-1">Critical: Timelock Roles</p>
        <p className="text-yellow-800 dark:text-yellow-300 text-xs mb-2">
          For proposals to execute successfully, the Timelock must hold the required role on each target contract:
        </p>
        <ul className="text-xs text-yellow-800 dark:text-yellow-300 space-y-1">
          <li>• Constitution: <span className="font-mono">GOVERNANCE_ROLE</span></li>
          <li>• TreasuryExecutor: <span className="font-mono">EXECUTOR_ROLE</span></li>
          <li>• MembershipNFT: <span className="font-mono">TREASURY_ROLE</span></li>
        </ul>
      </div>
    </div>
  );
}

function GovernanceActionsDetails() {
  return (
    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Constitution Parameter Changes</h4>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            Change minimum donation, spend caps, allowlist, etc. Requires <span className="font-mono">GOVERNANCE_ROLE</span> (held by Timelock).
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500 dark:text-gray-500 ml-2">
            <li>Member creates proposal calling Constitution function</li>
            <li>Community votes</li>
            <li>Anyone queues proposal (Governor → Timelock schedules)</li>
            <li>After delay, anyone executes (Timelock executes using GOVERNANCE_ROLE)</li>
          </ol>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Treasury Payouts</h4>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            Send funds from treasury. Requires <span className="font-mono">EXECUTOR_ROLE</span> (held by Timelock). 
            Constitution enforces allowlist and spend caps.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500 dark:text-gray-500 ml-2">
            <li>Member creates proposal calling TreasuryExecutor.executePayout()</li>
            <li>Community votes</li>
            <li>Anyone queues proposal</li>
            <li>After delay, Timelock executes (using EXECUTOR_ROLE)</li>
            <li>Constitution enforces rules (allowlist, caps)</li>
          </ol>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Membership Management</h4>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            Revoke memberships. Currently requires <span className="font-mono">REVOKER_ROLE</span> (held by Deployer). 
            Can be granted to Timelock via governance.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500 dark:text-gray-500 ml-2">
            <li>Member creates proposal calling MembershipNFT.revoke()</li>
            <li>Community votes</li>
            <li>After approval, Timelock executes (if it has REVOKER_ROLE)</li>
            <li>NFT is burned, voting power removed</li>
          </ol>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Contract Upgrades</h4>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            Upgrade contracts to new versions. Requires <span className="font-mono">DEFAULT_ADMIN_ROLE</span>. 
            Currently held by Deployer (should be transferred to Timelock).
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500 dark:text-gray-500 ml-2">
            <li>Deploy new implementation contract</li>
            <li>Member creates proposal calling Contract.upgradeTo()</li>
            <li>Community votes</li>
            <li>Timelock executes (if it has DEFAULT_ADMIN_ROLE)</li>
            <li>Contract upgraded, same address, new code</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
