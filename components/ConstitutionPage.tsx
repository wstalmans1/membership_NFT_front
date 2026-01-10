'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { Constitution } from '@/abis/Constitution';
import { DAOGovernor } from '@/abis/DAOGovernor';
import { formatEther } from '@/lib/utils';
import { encodeFunctionData, Address } from 'viem';
import { HelpCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ConstitutionPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isAllowlistFormExpanded, setIsAllowlistFormExpanded] = useState(false);

  // Constitution parameters
  const { data: minDonation } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'minDonationWei',
  });

  const { data: revocationAuthority } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'revocationAuthority',
  });

  const { data: perTxSpendCap } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'perTxSpendCapWei',
  });

  const { data: epochSpendCap } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'epochSpendCapWei',
  });

  const { data: epochDuration } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'epochDuration',
  });

  // Governor parameters
  const { data: votingDelay } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'votingDelay',
  });

  const { data: votingPeriod } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'votingPeriod',
  });

  const { data: proposalThreshold } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'proposalThreshold',
  });

  const { data: quorumNumerator } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'quorumNumerator',
  });

  // Fetch allowed recipients directly from contract (using new enumerable function)
  const { data: allowedRecipients, isLoading: isLoadingRecipients } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'getAllowedRecipients',
    query: {
      enabled: isConnected,
    },
  });

  // Check if the entered address is already in the allowlist
  const isAddressAllowed = recipientAddress && allowedRecipients
    ? (allowedRecipients as Address[]).some(addr => addr.toLowerCase() === recipientAddress.toLowerCase())
    : undefined;

  const handleCreateAllowlistProposal = () => {
    if (!recipientAddress) {
      alert('Please enter a recipient address');
      return;
    }

    // Validate recipient address
    if (recipientAddress.length !== 42 || !recipientAddress.startsWith('0x')) {
      alert('Please enter a valid Ethereum address');
      return;
    }

    // Check if address is already allowed
    if (isAddressAllowed) {
      alert('This address is already in the allowed recipients list');
      return;
    }

    // Generate calldata for setRecipientAllowed(address, true)
    const calldata = encodeFunctionData({
      abi: Constitution,
      functionName: 'setRecipientAllowed',
      args: [recipientAddress as Address, true],
    });

    // Store proposal data in localStorage for GovernancePage to pick up
    const proposalDescription = `Add Recipient to Allowlist\n\nRecipient: ${recipientAddress}\n\nThis proposal will add the specified address to the allowed recipients list, enabling it to receive funds from the DAO treasury through governance proposals.`;
    
    const proposalData = {
      targets: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
      calldatas: calldata,
      description: proposalDescription,
    };

    console.log('Storing allowlist proposal:', {
      recipient: recipientAddress,
      description: proposalDescription,
    });

    localStorage.setItem('allowlistProposal', JSON.stringify(proposalData));
    
    // Navigate to governance page
    router.push('/governance');
  };

  return (
    <div className="space-y-8 min-w-0 w-full max-w-full overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Constitution</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">View DAO governance parameters and rules</p>
      </div>

      {/* Membership Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 min-w-0 overflow-hidden">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Membership Parameters</h2>
        <div className="space-y-4 min-w-0 overflow-hidden">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Minimum Donation</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Minimum Donation</p>
                  <p className="text-gray-300">
                    The minimum amount of Sepolia ETH required to mint a membership NFT. This donation goes directly to the DAO treasury.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {minDonation !== undefined && minDonation !== null
                ? `${formatEther(BigInt(minDonation.toString()))} Sepolia ETH`
                : 'Loading...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Revocation Authority</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Revocation Authority</p>
                  <p className="text-gray-300">
                    The address authorized to revoke membership NFTs outside of normal governance processes. 
                    This is typically used for compliance or legal requirements where immediate revocation may be necessary.
                  </p>
                </div>
              </div>
            </div>
            {revocationAuthority !== undefined && revocationAuthority !== null ? (
              <a
                href={`https://eth-sepolia.blockscout.com/address/${String(revocationAuthority)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                {String(revocationAuthority)}
              </a>
            ) : (
              <span className="font-mono text-sm text-gray-900 dark:text-white">Loading...</span>
            )}
          </div>
        </div>
      </div>

      {/* Treasury Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 min-w-0 overflow-hidden">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Treasury Parameters</h2>
        <div className="space-y-4 min-w-0 overflow-hidden">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
              <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">Per-Transaction Spend Cap</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Per-Transaction Spend Cap</p>
                  <p className="text-gray-300">
                    The maximum amount of Sepolia ETH that can be spent in a single treasury transaction. This prevents large unauthorized withdrawals.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0 ml-4">
              {perTxSpendCap !== undefined && perTxSpendCap !== null
                ? `${formatEther(BigInt(perTxSpendCap.toString()))} Sepolia ETH`
                : 'Loading...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Epoch Spend Cap</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Epoch Spend Cap</p>
                  <p className="text-gray-300">
                    The maximum total amount of Sepolia ETH that can be spent from the treasury within a single epoch (time period). This provides additional protection against rapid depletion of funds.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {epochSpendCap !== undefined && epochSpendCap !== null
                ? `${formatEther(BigInt(epochSpendCap.toString()))} Sepolia ETH`
                : 'Loading...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Epoch Duration</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Epoch Duration</p>
                  <p className="text-gray-300">
                    The length of time (in seconds) that defines one epoch. The epoch spend cap resets after each epoch duration period.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {epochDuration !== undefined && epochDuration !== null
                ? `${Number(epochDuration)} seconds`
                : 'Loading...'}
            </span>
          </div>
          <div className="py-3 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-3 min-w-0 overflow-hidden">
              <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">Allowed Recipients</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Allowed Recipients</p>
                  <p className="text-gray-300">
                    The list of addresses that are authorized to receive payments from the DAO treasury. Only addresses on this allowlist can receive funds through governance proposals.
                  </p>
                </div>
              </div>
            </div>

            {/* Add Recipient to Allowlist Form - Discrete, collapsed by default */}
            {isConnected && (
              <div className="mb-4 min-w-0 overflow-hidden">
                <button
                  onClick={() => setIsAllowlistFormExpanded(!isAllowlistFormExpanded)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors min-w-0"
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">➕</span>
                    <span className="truncate">Add recipient to allowlist</span>
                  </span>
                  {isAllowlistFormExpanded ? (
                    <ChevronUp className="w-4 h-4 flex-shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
                  )}
                </button>
                
                {isAllowlistFormExpanded && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-lg min-w-0 overflow-hidden">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 break-words">
                      Fill in the address below and click "Create Governance Proposal". The proposal will need to be voted on and executed through governance.
                    </p>
                    
                    <div className="space-y-3 min-w-0 overflow-hidden">
                      <div className="min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                            Recipient Address
                          </label>
                          <div className="relative group flex-shrink-0">
                            <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                              <p className="mb-1 font-semibold">Recipient Address</p>
                              <p className="text-gray-300">
                                The Ethereum address to add to the allowed recipients list. This address will be able to receive funds from the DAO treasury after the proposal is executed.
                              </p>
                            </div>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          placeholder="0x..."
                          className="w-full min-w-0 max-w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono box-border"
                        />
                        {recipientAddress && (
                          <p className={`mt-1 text-xs min-w-0 break-words ${isAddressAllowed === true ? 'text-green-600 dark:text-green-400' : isAddressAllowed === false ? 'text-gray-500 dark:text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {isAddressAllowed === undefined && recipientAddress.length === 42 && recipientAddress.startsWith('0x') 
                              ? 'Checking address status...' 
                              : isAddressAllowed === true
                              ? '✓ Address is already in the allowlist' 
                              : recipientAddress.length === 42 && recipientAddress.startsWith('0x')
                              ? '✓ Ready to add to allowlist'
                              : recipientAddress.length > 0
                              ? 'Please enter a valid Ethereum address'
                              : ''}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={handleCreateAllowlistProposal}
                        disabled={!recipientAddress || recipientAddress.length !== 42 || !recipientAddress.startsWith('0x') || isAddressAllowed === true}
                        className="w-full px-3 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Create Governance Proposal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isLoadingRecipients ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                <p className="text-sm">Loading allowed recipients...</p>
              </div>
            ) : allowedRecipients && (allowedRecipients as Address[]).length > 0 ? (
              <div className="space-y-2">
                {(allowedRecipients as Address[]).map((address) => (
                  <div key={address} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <a
                      href={`https://eth-sepolia.blockscout.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {address}
                    </a>
                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded">
                      Allowed
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No allowed recipients found</p>
            )}
          </div>
        </div>
      </div>

      {/* Governance Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Governance Parameters</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Voting Delay</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Voting Delay</p>
                  <p className="text-gray-300">
                    The number of blocks that must pass after a proposal is created before voting can begin. This gives members time to review proposals before voting starts.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {votingDelay !== undefined && votingDelay !== null
                ? `${Number(votingDelay)} blocks`
                : 'Loading...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Voting Period</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Voting Period</p>
                  <p className="text-gray-300">
                    The number of blocks during which members can cast their votes on a proposal. After this period ends, the proposal is finalized based on the vote results.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {votingPeriod !== undefined && votingPeriod !== null
                ? `${Number(votingPeriod)} blocks`
                : 'Loading...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Proposal Threshold</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Proposal Threshold</p>
                  <p className="text-gray-300">
                    The minimum number of votes (voting power) required to create a proposal. This prevents spam and ensures only serious proposals are submitted.
                  </p>
                  <p className="text-gray-300 mt-2">
                    <strong>Note:</strong> A threshold of 0 means anyone can create proposals, even without a membership NFT. A threshold of 1 means only members with at least 1 vote (1 delegated NFT) can create proposals.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {proposalThreshold !== undefined && proposalThreshold !== null
                ? proposalThreshold.toString()
                : 'Loading...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Quorum Numerator</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Quorum Numerator</p>
                  <p className="text-gray-300">
                    The numerator used to calculate the quorum percentage. Quorum = (numerator / 100) × total membership supply. For example, a numerator of 10 means minimum 10% of members must vote for a proposal to be considered.
                  </p>
                </div>
              </div>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {quorumNumerator !== undefined && quorumNumerator !== null
                ? quorumNumerator.toString()
                : 'Loading...'}
            </span>
          </div>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Contract Addresses</h2>
          <div className="relative group">
            <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
              <p className="mb-2 font-semibold">Contract Addresses</p>
              <p className="text-gray-300">
                These are the on-chain addresses of the DAO's smart contracts. All contracts are verified on Blockscout, allowing anyone to inspect the code and verify their functionality. Click any address to view it on the block explorer.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Constitution:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Constitution Contract</p>
                  <p className="text-gray-300">
                    Defines the core DAO parameters including minimum donation, spend caps, allowed recipients, and base URI. This contract acts as the source of truth for governance rules and treasury constraints.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.CONSTITUTION_PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.CONSTITUTION_PROXY}
            </a>
          </div>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Governor:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Governor Contract</p>
                  <p className="text-gray-300">
                    Manages the governance process: proposal creation, voting, and execution. Members create proposals here, vote on them, and successful proposals are queued for execution through the Timelock.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.GOVERNOR_PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.GOVERNOR_PROXY}
            </a>
          </div>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Membership NFT:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Membership NFT Contract</p>
                  <p className="text-gray-300">
                    Issues soulbound (non-transferable) membership NFTs to DAO members. Each NFT grants 1 vote in governance. Members mint NFTs by making a minimum donation to the treasury.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY}
            </a>
          </div>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Treasury:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Treasury Executor Contract</p>
                  <p className="text-gray-300">
                    Manages DAO treasury funds and executes payouts. Enforces spend caps and recipient allowlists. All treasury operations must go through governance proposals and the Timelock.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.TREASURY_PROXY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.TREASURY_PROXY}
            </a>
          </div>
          <div className="py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 dark:text-gray-400">Timelock:</span>
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Timelock Controller</p>
                  <p className="text-gray-300">
                    Adds a delay between proposal execution and actual execution. This gives members time to review and react to proposals before they take effect, providing an additional security layer.
                  </p>
                </div>
              </div>
            </div>
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.TIMELOCK}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {CONTRACTS.SEPOLIA.TIMELOCK}
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
