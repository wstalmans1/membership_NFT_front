'use client';

import { useReadContract } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { Constitution } from '@/abis/Constitution';
import { DAOGovernor } from '@/abis/DAOGovernor';
import { formatEther } from '@/lib/utils';

export function ConstitutionPage() {
  // Constitution parameters
  const { data: minDonation } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'minDonationWei',
  });

  const { data: baseURI } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'baseURI',
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Constitution</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">View DAO governance parameters and rules</p>
      </div>

      {/* Membership Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Membership Parameters</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Minimum Donation</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} ETH
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Base URI</span>
            <span className="font-mono text-sm text-gray-900 dark:text-white">{baseURI ? String(baseURI) : '...'}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Revocation Authority</span>
            {revocationAuthority ? (
              <a
                href={`https://eth-sepolia.blockscout.com/address/${String(revocationAuthority)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                {String(revocationAuthority)}
              </a>
            ) : (
              <span className="font-mono text-sm text-gray-900 dark:text-white">...</span>
            )}
          </div>
        </div>
      </div>

      {/* Treasury Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Treasury Parameters</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Per-Transaction Spend Cap</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {perTxSpendCap ? formatEther(BigInt(perTxSpendCap.toString())) : '...'} ETH
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Epoch Spend Cap</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {epochSpendCap ? formatEther(BigInt(epochSpendCap.toString())) : '...'} ETH
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Epoch Duration</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {epochDuration ? `${Number(epochDuration)} seconds` : '...'}
            </span>
          </div>
        </div>
      </div>

      {/* Governance Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Governance Parameters</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Voting Delay</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {votingDelay ? `${Number(votingDelay)} blocks` : '...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Voting Period</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {votingPeriod ? `${Number(votingPeriod)} blocks` : '...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Proposal Threshold</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {proposalThreshold ? proposalThreshold.toString() : '...'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Quorum Numerator</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {quorumNumerator ? quorumNumerator.toString() : '...'}
            </span>
          </div>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contract Addresses</h2>
        <div className="space-y-3 text-sm">
          <div className="py-2">
            <span className="text-gray-600 dark:text-gray-400 block mb-1">Constitution:</span>
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
            <span className="text-gray-600 dark:text-gray-400 block mb-1">Governor:</span>
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
            <span className="text-gray-600 dark:text-gray-400 block mb-1">Membership NFT:</span>
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
            <span className="text-gray-600 dark:text-gray-400 block mb-1">Treasury:</span>
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
            <span className="text-gray-600 dark:text-gray-400 block mb-1">Timelock:</span>
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

