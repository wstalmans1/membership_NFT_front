'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo, useSyncExternalStore } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useChainId, useWatchContractEvent, useWatchBlockNumber } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CONTRACTS } from '@/config/contracts';
import { DAOGovernor } from '@/abis/DAOGovernor';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { formatAddress } from '@/lib/utils';
import { Address, BaseError, ContractFunctionRevertedError, encodeFunctionData, parseEther, keccak256, toBytes, stringToBytes, pad, toHex, encodePacked, decodeEventLog } from 'viem';
import { HelpCircle, ChevronDown, ChevronUp, ChevronRight, Loader2, Clock } from 'lucide-react';
import { BalanceCheck } from './BalanceCheck';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDataContext } from '@/contexts/DataContext';

const formatViemError = (err: unknown) => {
  if (err instanceof BaseError) {
    const revertError = err.walk((cause) => cause instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | undefined;
    if (revertError?.reason) {
      return `Execution reverted: ${revertError.reason}`;
    }
    if (revertError?.data?.errorName) {
      return `Execution reverted: ${revertError.data.errorName}`;
    }
    if (revertError?.shortMessage) {
      return revertError.shortMessage;
    }
    if (err.shortMessage) {
      return err.shortMessage;
    }
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: string }).message);
  }
  return 'Failed to execute proposal. Please try again.';
};

const areArraysEqual = (a?: any[], b?: any[]) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const areVotesEqual = (a?: { forVotes: string; againstVotes: string; abstainVotes: string }, b?: { forVotes: string; againstVotes: string; abstainVotes: string }) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.forVotes === b.forVotes && a.againstVotes === b.againstVotes && a.abstainVotes === b.abstainVotes;
};

const areVoteAnalysisEqual = (a?: { quorumReached: boolean; voteSucceeded: boolean; reason: string } | null, b?: { quorumReached: boolean; voteSucceeded: boolean; reason: string } | null) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.quorumReached === b.quorumReached && a.voteSucceeded === b.voteSucceeded && a.reason === b.reason;
};

const areProposalsEqual = (a: any, b: any) => {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.id === b.id &&
    a.state === b.state &&
    a.voteStart === b.voteStart &&
    a.voteEnd === b.voteEnd &&
    a.proposalEta === b.proposalEta &&
    a.blockNumber === b.blockNumber &&
    a.description === b.description &&
    a.proposer === b.proposer &&
    a.descriptionHash === b.descriptionHash &&
    a.quorum === b.quorum &&
    areArraysEqual(a.targets, b.targets) &&
    areArraysEqual(a.values, b.values) &&
    areArraysEqual(a.calldatas, b.calldatas) &&
    areVotesEqual(a.votes, b.votes) &&
    areVoteAnalysisEqual(a.voteAnalysis, b.voteAnalysis)
  );
};

const PROPOSAL_STATE_MAP: Record<number, string> = {
  0: 'Pending',
  1: 'Active',
  2: 'Canceled',
  3: 'Defeated',
  4: 'Succeeded',
  5: 'Queued',
  6: 'Expired',
  7: 'Executed',
};

const PROPOSAL_STATE_LABELS: Record<number, string> = {
  0: '⏳ Waiting to Start',
  1: '🗳️ Voting Open',
  2: '❌ Canceled',
  3: '❌ Defeated',
  4: '✅ Proposal Passed',
  5: '⏳ Review & Opposition Window',
  6: '⏰ Expired',
  7: '✅ Executed',
};

const PROPOSAL_PAGE_SIZE = 10;

type BlockListener = () => void;

let blockNumberSnapshot: bigint | null = null;
let blockListeners = new Set<BlockListener>();
let blockInterval: ReturnType<typeof setInterval> | null = null;
let blockClient: ReturnType<typeof usePublicClient> | null = null;
let blockFetchInFlight = false;

const notifyBlockListeners = () => {
  blockListeners.forEach((listener) => listener());
};

const updateBlockNumberSnapshot = (nextBlock: bigint | null) => {
  if (blockNumberSnapshot !== nextBlock) {
    blockNumberSnapshot = nextBlock;
    notifyBlockListeners();
  }
};

const fetchBlockNumber = async () => {
  if (!blockClient || blockFetchInFlight) return;
  blockFetchInFlight = true;
  try {
    const block = await blockClient.getBlock({ blockTag: 'latest' });
    updateBlockNumberSnapshot(block.number ?? null);
  } catch (error) {
    console.error('Error fetching current block number:', error);
  } finally {
    blockFetchInFlight = false;
  }
};

const startBlockPolling = () => {
  if (blockInterval || !blockClient) return;
  fetchBlockNumber();
  blockInterval = setInterval(fetchBlockNumber, 12000);
};

const stopBlockPolling = () => {
  if (blockInterval) {
    clearInterval(blockInterval);
    blockInterval = null;
  }
};

const subscribeToBlockNumber = (listener: BlockListener) => {
  blockListeners.add(listener);
  if (blockListeners.size === 1) {
    startBlockPolling();
  }
  return () => {
    blockListeners.delete(listener);
    if (blockListeners.size === 0) {
      stopBlockPolling();
    }
  };
};

const getBlockNumberSnapshot = () => blockNumberSnapshot;

const useCurrentBlockNumber = () => {
  const publicClient = usePublicClient();
  useWatchBlockNumber({
    chainId: sepolia.id,
    enabled: !!publicClient,
    onBlockNumber: (blockNumber) => {
      updateBlockNumberSnapshot(blockNumber);
    },
  });

  useEffect(() => {
    blockClient = publicClient ?? null;
    if (!blockClient) {
      stopBlockPolling();
      updateBlockNumberSnapshot(null);
      return;
    }
    if (blockListeners.size > 0) {
      startBlockPolling();
    }
  }, [publicClient]);

  return useSyncExternalStore(subscribeToBlockNumber, getBlockNumberSnapshot, getBlockNumberSnapshot);
};

const sortProposals = (list: any[]) =>
  list
    .slice()
    .sort((a, b) => {
      const blockDiff = (b.blockNumber || 0) - (a.blockNumber || 0);
      if (blockDiff !== 0) return blockDiff;
      return Number(BigInt(b.id) - BigInt(a.id));
    });

const mergeProposals = (prev: any[], next: any[]) => {
  if (next.length === 0) return prev;
  if (prev.length === 0) return sortProposals(next);

  const prevById = new Map(prev.map((proposal) => [proposal.id, proposal]));
  const mergedById = new Map(prevById);
  let hasChanges = false;

  next.forEach((proposal) => {
    const previous = prevById.get(proposal.id);
    if (previous && areProposalsEqual(previous, proposal)) {
      mergedById.set(proposal.id, previous);
    } else {
      mergedById.set(proposal.id, proposal);
      hasChanges = true;
    }
  });

  const merged = sortProposals(Array.from(mergedById.values()));

  if (!hasChanges && merged.length === prev.length) {
    for (let i = 0; i < merged.length; i += 1) {
      if (merged[i] !== prev[i]) {
        hasChanges = true;
        break;
      }
    }
  }

  return hasChanges ? merged : prev;
};

export function GovernancePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const proposalsDataVersionRef = useRef(0);
  
  // Check if on correct network
  const isCorrectNetwork = chainId === sepolia.id;
  
  // Handler for navigating to membership page with expand parameter
  // This ensures query parameters are preserved in static builds
  const handleBecomeMember = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const url = '/membership?expand=membership';
    // Update URL directly first to ensure it's set (MembershipPage listens for this)
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', url);
      // Trigger popstate event so MembershipPage detects the change immediately
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    // Use router.push for Next.js navigation (works in both dev and static builds)
    router.push(url);
  };
  const [description, setDescription] = useState('');
  const [targets, setTargets] = useState('');
  const [calldatas, setCalldatas] = useState('');
  const [valuesInput, setValuesInput] = useState('0');
  const [valuesUnit, setValuesUnit] = useState<'wei' | 'eth'>('wei');
  const [withOnChainExecution, setWithOnChainExecution] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);
  const [isVotingRulesExpanded, setIsVotingRulesExpanded] = useState(false);
  const [queuedProposalIds, setQueuedProposalIds] = useState<Set<string>>(new Set());
  const [queuedProposalETAs, setQueuedProposalETAs] = useState<Map<string, number>>(new Map());
  const [queueingProposalId, setQueueingProposalId] = useState<string | null>(null);
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(null);
  const [executedProposalIds, setExecutedProposalIds] = useState<Set<string>>(new Set());
  const lastExecuteHashRef = useRef<string | undefined>(undefined);
  
  // Use context for persistent state across page navigation
  const {
    allProposals,
    setAllProposals,
    oldestLoadedProposalBlock: oldestLoadedBlock,
    setOldestLoadedProposalBlock: setOldestLoadedBlock,
    noMoreProposals,
    setNoMoreProposals,
    hasAutoSearchedProposals: hasAutoSearched,
    setHasAutoSearchedProposals: setHasAutoSearched,
    loadedProposalCount,
    setLoadedProposalCount,
  } = useDataContext();
  
  // Local state for UI-only concerns
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [searchProgress, setSearchProgress] = useState<string | null>(null);

  // Check for pre-filled proposal data from Treasury page or Constitution page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for treasury payout proposal
      const treasuryProposal = localStorage.getItem('treasuryPayoutProposal');
      if (treasuryProposal) {
        try {
          const proposalData = JSON.parse(treasuryProposal);
          console.log('Loading treasury payout proposal from localStorage:', proposalData);
          setTargets(proposalData.targets || '');
          setCalldatas(proposalData.calldatas || '');
          if (proposalData.values) {
            const storedValues = Array.isArray(proposalData.values) ? proposalData.values.join(', ') : String(proposalData.values);
            setValuesInput(storedValues);
          } else {
            setValuesInput('0');
            setValuesUnit('wei');
          }
          setDescription(proposalData.description || '');
          setWithOnChainExecution(true); // Treasury payouts require on-chain execution
          setShowCreateForm(true);
          // Clear the stored data after using it
          localStorage.removeItem('treasuryPayoutProposal');
        } catch (error) {
          console.error('Failed to parse stored treasury proposal data:', error);
          localStorage.removeItem('treasuryPayoutProposal');
        }
        return; // Exit early if treasury proposal found
      }

      // Check for allowlist proposal
      const allowlistProposal = localStorage.getItem('allowlistProposal');
      if (allowlistProposal) {
        try {
          const proposalData = JSON.parse(allowlistProposal);
          console.log('Loading allowlist proposal from localStorage:', proposalData);
          setTargets(proposalData.targets || '');
          setCalldatas(proposalData.calldatas || '');
          if (proposalData.values) {
            const storedValues = Array.isArray(proposalData.values) ? proposalData.values.join(', ') : String(proposalData.values);
            setValuesInput(storedValues);
          } else {
            setValuesInput('0');
            setValuesUnit('wei');
          }
          setDescription(proposalData.description || '');
          setWithOnChainExecution(true); // Allowlist proposals require on-chain execution
          setShowCreateForm(true);
          // Clear the stored data after using it
          localStorage.removeItem('allowlistProposal');
        } catch (error) {
          console.error('Failed to parse stored allowlist proposal data:', error);
          localStorage.removeItem('allowlistProposal');
        }
      }
    }
  }, []);

  const { writeContract, data: hash, isPending, isError, error: proposalError } = useWriteContract();
  const { writeContract: writeVote, data: voteHash, isPending: isVoting, isError: isVoteError } = useWriteContract();
  const { writeContract: writeQueue, data: queueHash, isPending: isQueueing, error: queueError } = useWriteContract();
  const { writeContract: writeExecute, data: executeHash, isPending: isExecuting, error: executeError } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const proposalsQueryKey = useMemo(() => ['proposals', CONTRACTS.SEPOLIA.GOVERNOR_PROXY] as const, []);
  const lastProposalCountRef = useRef<number | null>(null);
  const isFetchingNewProposalsRef = useRef(false);
  
  // Check membership status
  const { data: membershipBalance, isLoading: isLoadingMembership } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  
  const isMember = address && !isLoadingMembership && membershipBalance !== undefined
    ? Boolean(membershipBalance && Number(membershipBalance) > 0)
    : undefined;
  
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isTransactionError, error: transactionError } = useWaitForTransactionReceipt({
    hash,
  });

  const { isLoading: isVoteConfirming, isSuccess: isVoteConfirmed, data: voteReceipt } = useWaitForTransactionReceipt({
    hash: voteHash,
  });

  const { isLoading: isQueueConfirming, isSuccess: isQueueConfirmed } = useWaitForTransactionReceipt({
    hash: queueHash,
  });

  const { isLoading: isExecuteConfirming, isSuccess: isExecuteConfirmed } = useWaitForTransactionReceipt({
    hash: executeHash,
  });

  // Handle proposal transaction errors
  useEffect(() => {
    if (proposalError || isError) {
      const error = proposalError || (isError ? new Error('Transaction failed') : null);
      if (error) {
        const errorMessage = formatViemError(error);
        // Check if error is related to membership (proposer votes below threshold)
        if (errorMessage.toLowerCase().includes('proposer votes below proposal threshold') || 
            errorMessage.toLowerCase().includes('proposal threshold') ||
            errorMessage.toLowerCase().includes('not a member')) {
          setError('MEMBERSHIP_REQUIRED');
        } else {
          setError(errorMessage);
        }
      }
    }
  }, [proposalError, isError]);

  // Handle transaction receipt errors (when transaction is confirmed but failed)
  useEffect(() => {
    if (isTransactionError && transactionError) {
      const errorMessage = formatViemError(transactionError);
      // Check if error is related to membership
      if (errorMessage.toLowerCase().includes('proposer votes below proposal threshold') || 
          errorMessage.toLowerCase().includes('proposal threshold') ||
          errorMessage.toLowerCase().includes('not a member')) {
        setError('MEMBERSHIP_REQUIRED');
      } else {
        setError(errorMessage);
      }
    }
  }, [isTransactionError, transactionError]);

  useEffect(() => {
    if (executeError) {
      console.error('Execute transaction error:', executeError);
      setError(formatViemError(executeError));
      setExecutingProposalId(null);
    }
  }, [executeError]);

  // Log vote transaction receipt when confirmed
  useEffect(() => {
    if (voteReceipt && isVoteConfirmed) {
      console.log('Vote transaction receipt:', voteReceipt);
      console.log('Transaction status:', voteReceipt.status);
    }
  }, [voteReceipt, isVoteConfirmed]);

  // Handle vote transaction errors
  useEffect(() => {
    if (isVoteError) {
      console.error('Vote transaction error occurred');
      setError('Failed to cast vote. Please check your wallet and try again.');
      setVotingProposalId(null);
    }
  }, [isVoteError]);

  // Check if user has voted on the expanded proposal (must be declared before useEffect that uses it)
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [showVotingForProposal, setShowVotingForProposal] = useState<string | null>(null);
  const { data: hasVotedData, refetch: refetchHasVoted } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'hasVoted',
    args: showVotingForProposal && address ? [BigInt(showVotingForProposal), address] : undefined,
    query: { enabled: !!showVotingForProposal && !!address },
  });
  const hasVoted = hasVotedData as boolean | undefined;

  // Get voting delay and period
  const { data: votingDelay, isLoading: isLoadingVotingDelay } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'votingDelay',
  });

  const { data: votingPeriod, isLoading: isLoadingVotingPeriod } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'votingPeriod',
  });

  const { data: proposalThreshold, isLoading: isLoadingProposalThreshold } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'proposalThreshold',
  });

  const { data: quorumNumerator } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'quorumNumerator',
  });

  // Get timelock delay from TimelockController
  const { data: timelockDelaySeconds, isLoading: isLoadingTimelockDelay } = useReadContract({
    address: CONTRACTS.SEPOLIA.TIMELOCK,
    abi: [
      {
        inputs: [],
        name: 'getMinDelay',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getMinDelay',
  });

  // Check if all governance parameters are loaded
  const isLoadingGovernanceParams = isLoadingProposalThreshold || isLoadingVotingDelay || isLoadingVotingPeriod || isLoadingTimelockDelay;

  // Get proposal count using new on-chain enumerability
  const { data: proposalCount, isLoading: isLoadingProposalCount, refetch: refetchProposalCount } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'proposalCount',
  });

  // Ensure proposalCount is a number
  const proposalCountNum = typeof proposalCount === 'bigint' ? Number(proposalCount) : (typeof proposalCount === 'number' ? proposalCount : 0);

  useEffect(() => {
    if (proposalCountNum > 0 && loadedProposalCount === 0) {
      setLoadedProposalCount(Math.min(PROPOSAL_PAGE_SIZE, proposalCountNum));
    }
  }, [proposalCountNum, loadedProposalCount, setLoadedProposalCount]);

  const effectiveLoadedCount = useMemo(() => {
    if (proposalCountNum === 0) return 0;
    const baseCount = loadedProposalCount > 0 ? loadedProposalCount : PROPOSAL_PAGE_SIZE;
    return Math.min(baseCount, proposalCountNum);
  }, [loadedProposalCount, proposalCountNum]);

  const startIndex = useMemo(() => {
    if (proposalCountNum === 0) return 0;
    return Math.max(proposalCountNum - effectiveLoadedCount, 0);
  }, [proposalCountNum, effectiveLoadedCount]);

  // Fetch proposals in pages using proposalDetailsAt (most recent first by index range)
  const proposalContracts = useMemo(() => {
    if (proposalCountNum === 0 || effectiveLoadedCount === 0) return [];
    return Array.from({ length: effectiveLoadedCount }, (_, i) => ({
      address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY as Address,
      abi: DAOGovernor,
      functionName: 'proposalDetailsAt' as const,
      args: [BigInt(startIndex + i)] as [bigint],
    }));
  }, [proposalCountNum, effectiveLoadedCount, startIndex]);

  const { data: proposalsData, isLoading: isLoadingProposalsData } = useReadContracts({
    contracts: proposalContracts,
    query: {
      enabled: proposalCountNum > 0 && proposalContracts.length > 0,
      staleTime: 5_000, // Reduced cache time to 5 seconds for faster updates
      // Only refetch proposalsData if there might be new proposals (proposalCount could change)
      // But we don't need to continuously refetch if all proposals are final
      // The latestProposals query will handle selective refetching
      refetchInterval: false, // Don't continuously refetch - let latestProposals handle it
    },
  });

  const buildProposalFromDetails = useCallback(async (proposalDetails: any) => {
    if (!publicClient || !proposalDetails || !Array.isArray(proposalDetails)) return null;

    const [proposalId, targets, values, calldatas, descriptionHash] = proposalDetails as [
      bigint,
      Address[],
      bigint[],
      `0x${string}`[],
      `0x${string}`
    ];

    try {
      // Fetch proposal state, votes, and other details
      // CRITICAL: Always read fresh state from contract - never use cache
      const [state, proposalVotesResult, proposalSnapshot, proposalDeadline, proposalEtaResult] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
          abi: DAOGovernor,
          functionName: 'state',
          args: [proposalId],
          blockTag: 'latest', // Explicitly use latest block to ensure fresh state
        }),
        publicClient.readContract({
          address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
          abi: DAOGovernor,
          functionName: 'proposalVotes',
          args: [proposalId],
        }).catch(() => null),
        publicClient.readContract({
          address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
          abi: DAOGovernor,
          functionName: 'proposalSnapshot',
          args: [proposalId],
        }).catch(() => null),
        publicClient.readContract({
          address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
          abi: DAOGovernor,
          functionName: 'proposalDeadline',
          args: [proposalId],
        }).catch(() => null),
        publicClient.readContract({
          address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
          abi: DAOGovernor,
          functionName: 'proposalEta',
          args: [proposalId],
        }).catch(() => null),
      ]);

      // Get proposal creation block from events (for display purposes)
      // We'll use a fallback - try to get from the first event or use current block
      let blockNumber = 0;
      try {
        const proposalCreatedEvent = DAOGovernor.find((item: any) => item.type === 'event' && item.name === 'ProposalCreated');
        if (proposalCreatedEvent && publicClient) {
          const logs = await publicClient.getLogs({
            address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
            event: proposalCreatedEvent as any,
            args: { proposalId },
            fromBlock: 0n,
            toBlock: 'latest',
          });
          if (logs.length > 0) {
            blockNumber = Number(logs[0].blockNumber);
          }
        }
      } catch (err) {
        console.warn('Could not fetch proposal creation block:', err);
      }

      // Fetch quorum
      let quorumResult: bigint | null = null;
      const currentBlockSnapshot = getBlockNumberSnapshot();
      const snapshot = typeof proposalSnapshot === 'bigint' ? proposalSnapshot : null;
      const canReadQuorum = snapshot !== null && currentBlockSnapshot !== null && currentBlockSnapshot > snapshot;
      if (canReadQuorum) {
        try {
          quorumResult = (await publicClient.readContract({
            address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
            abi: DAOGovernor,
            functionName: 'quorum',
            args: [snapshot],
          })) as bigint;
        } catch (err) {
          console.warn('Failed to fetch quorum:', err);
        }
      }

      // Calculate vote analysis
      const proposalVotes = proposalVotesResult as [bigint, bigint, bigint] | null;
      const quorum = quorumResult as bigint | null;
      let voteAnalysis: { quorumReached: boolean; voteSucceeded: boolean; reason: string } | null = null;
      
      if (proposalVotes && quorum !== null) {
        const againstVotes = proposalVotes[0] || 0n;
        const forVotes = proposalVotes[1] || 0n;
        const abstainVotes = proposalVotes[2] || 0n;
        const totalVotes = forVotes + abstainVotes;
        const quorumReached = totalVotes >= quorum;
        const voteSucceeded = forVotes > againstVotes;
        
        let reason = '';
        if (quorumReached && voteSucceeded) {
          reason = `Quorum reached (${totalVotes.toLocaleString()} votes ≥ ${quorum.toLocaleString()} required) and majority for (${forVotes.toLocaleString()} for vs ${againstVotes.toLocaleString()} against)`;
        } else if (!quorumReached) {
          reason = `Quorum not reached (${totalVotes.toLocaleString()} votes < ${quorum.toLocaleString()} required)`;
        } else if (!voteSucceeded) {
          reason = `Quorum reached but majority against (${againstVotes.toLocaleString()} against vs ${forVotes.toLocaleString()} for)`;
        }
        
        voteAnalysis = { quorumReached, voteSucceeded, reason };
      }

      // Get proposer from events (fallback)
      let proposer: Address = '0x0000000000000000000000000000000000000000' as Address;
      try {
        const proposalCreatedEvent = DAOGovernor.find((item: any) => item.type === 'event' && item.name === 'ProposalCreated');
        if (proposalCreatedEvent && publicClient) {
          const logs = await publicClient.getLogs({
            address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
            event: proposalCreatedEvent as any,
            args: { proposalId },
            fromBlock: 0n,
            toBlock: 'latest',
          });
          if (logs.length > 0) {
            const decoded = decodeEventLog({
              abi: DAOGovernor,
              data: logs[0].data,
              topics: logs[0].topics,
            });
            if (decoded.args && typeof decoded.args === 'object' && 'proposer' in decoded.args) {
              proposer = (decoded.args as any).proposer as Address;
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch proposer:', err);
      }

      // Get description from events (fallback)
      let description = `Proposal ${proposalId.toString()}`;
      try {
        const proposalCreatedEvent = DAOGovernor.find((item: any) => item.type === 'event' && item.name === 'ProposalCreated');
        if (proposalCreatedEvent && publicClient) {
          const logs = await publicClient.getLogs({
            address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
            event: proposalCreatedEvent as any,
            args: { proposalId },
            fromBlock: 0n,
            toBlock: 'latest',
          });
          if (logs.length > 0) {
            const decoded = decodeEventLog({
              abi: DAOGovernor,
              data: logs[0].data,
              topics: logs[0].topics,
            });
            if (decoded.args && typeof decoded.args === 'object' && 'description' in decoded.args) {
              description = (decoded.args as any).description as string;
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch description:', err);
      }

      const voteStart = proposalSnapshot ? Number(proposalSnapshot) : 0;
      const voteEnd = proposalDeadline ? Number(proposalDeadline) : 0;
      const proposalEta = proposalEtaResult && typeof proposalEtaResult === 'bigint' && proposalEtaResult > 0n ? Number(proposalEtaResult) : null;

      return {
        id: proposalId.toString(),
        proposalId: proposalId.toString(),
        proposer,
        description,
        targets: targets as Address[],
        values: values.map((v: bigint) => v.toString()),
        calldatas: calldatas as `0x${string}`[],
        descriptionHash: descriptionHash as `0x${string}`,
        voteStart,
        voteEnd,
        state: PROPOSAL_STATE_MAP[Number(state)] || 'Unknown',
        stateLabel: PROPOSAL_STATE_LABELS[Number(state)] || 'Unknown',
        blockNumber: blockNumber || voteStart,
        proposalEta,
        votes: proposalVotes ? {
          againstVotes: proposalVotes[0]?.toString() || '0',
          forVotes: proposalVotes[1]?.toString() || '0',
          abstainVotes: proposalVotes[2]?.toString() || '0',
        } : undefined,
        quorum: quorum?.toString() || undefined,
        voteAnalysis,
      };
    } catch (err) {
      console.error('Error processing proposal:', err);
      return null;
    }
  }, [publicClient]);

  // Process proposals data - transform from contract calls
  const { data: latestProposals = [], refetch: refetchLatestProposals, isLoading: isLoadingProposals } = useQuery({
    queryKey: proposalsQueryKey,
    staleTime: 3_000, // 3 seconds cache time
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Dynamic refetchInterval: only refetch if there are proposals that need monitoring (not final)
    refetchInterval: (query) => {
      const proposals = query.state.data as any[] | undefined;
      const currentBlock = getBlockNumberSnapshot();
      
      if (!proposals || !currentBlock) return 8_000; // Default 8 seconds if no data yet
      
      // Check if any proposal is still in a non-terminal state (e.g., Pending/Active/Succeeded)
      // Also check if any proposal's voteEnd just passed (within last few blocks) - might need one more refetch
      let hasHighFrequency = false;
      let hasQueued = false;

      for (const p of proposals) {
        if (p.state === 'Queued') {
          hasQueued = true;
        }

        const isTerminalState =
          p.state === 'Defeated' ||
          p.state === 'Executed' ||
          p.state === 'Canceled' ||
          p.state === 'Expired';

        if (!p.voteEnd) {
          hasHighFrequency = true;
          break;
        }

        if (p.state === 'Pending' || p.state === 'Active' || p.state === 'Succeeded') {
          hasHighFrequency = true;
          break;
        }

        const voteEndBigInt = BigInt(p.voteEnd);
        if (currentBlock <= voteEndBigInt) {
          hasHighFrequency = true;
          break;
        }

        if (currentBlock <= voteEndBigInt + 5n) {
          const isFinalState = isTerminalState || p.state === 'Succeeded' || p.state === 'Queued';
          if (!isFinalState) {
            hasHighFrequency = true;
            break;
          }
        }

        if (!isTerminalState && p.state !== 'Queued') {
          hasHighFrequency = true;
          break;
        }
      }

      if (hasHighFrequency) return 8_000;
      if (hasQueued) return 30_000;
      return false; // stop refetching
    },
    queryFn: async () => {
      console.log('🔄 queryFn EXECUTING - reading fresh state from contract');
      if (!publicClient || !proposalsData || !Array.isArray(proposalsData) || proposalsData.length === 0) {
        console.log('⚠️ queryFn: Missing requirements, returning empty array');
        return [];
      }

      try {
        // Process each proposal
        const proposalPromises = proposalsData.map(async (result: any) => {
          if (!result || !result.result || !Array.isArray(result.result)) return null;
          return buildProposalFromDetails(result.result);
        });

        const proposals = (await Promise.all(proposalPromises)).filter((p): p is NonNullable<typeof p> => p !== null);
        
        // Sort by blockNumber (reverse chronological - newest first), then by proposalId as tiebreaker
        return proposals.sort((a, b) => {
          // Primary sort: blockNumber (higher block = newer = should come first)
          const blockDiff = (b.blockNumber || 0) - (a.blockNumber || 0);
          if (blockDiff !== 0) return blockDiff;
          // Secondary sort: proposalId (higher ID = newer = should come first)
          return Number(BigInt(b.id) - BigInt(a.id));
        });
      } catch (error: any) {
        console.error('Error fetching proposals:', error);
        return [];
      }
    },
    enabled: !!publicClient && !!proposalsData && proposalsData.length > 0,
  });

  // Legacy constants for backward compatibility (no longer used for event scanning)
  const CHUNK_SIZE = 800n;
  const FIRST_PROPOSAL_BLOCK = 9983760n;

  const fetchNewProposals = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!publicClient || toIndex <= fromIndex || isFetchingNewProposalsRef.current) return;
    isFetchingNewProposalsRef.current = true;
    try {
      const indices = Array.from({ length: toIndex - fromIndex }, (_, i) => fromIndex + i);
      const details = await Promise.all(
        indices.map((index) =>
          publicClient
            .readContract({
              address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
              abi: DAOGovernor,
              functionName: 'proposalDetailsAt',
              args: [BigInt(index)],
            })
            .catch(() => null)
        )
      );
      const proposalPromises = details.map((detail) => (detail ? buildProposalFromDetails(detail) : null));
      const newProposals = (await Promise.all(proposalPromises)).filter(
        (p): p is NonNullable<typeof p> => p !== null
      );

      if (newProposals.length > 0) {
        queryClient.setQueryData(proposalsQueryKey, (prev: any[] | undefined) => {
          const prevList = Array.isArray(prev) ? prev : [];
          return mergeProposals(prevList, newProposals);
        });
      }
    } finally {
      isFetchingNewProposalsRef.current = false;
    }
  }, [publicClient, buildProposalFromDetails, proposalsQueryKey, queryClient]);

  // Incrementally fetch new proposals when proposalCount increases
  useEffect(() => {
    if (!publicClient) return;

    if (lastProposalCountRef.current === null) {
      lastProposalCountRef.current = proposalCountNum;
      return;
    }

    if (proposalCountNum <= lastProposalCountRef.current) {
      lastProposalCountRef.current = proposalCountNum;
      return;
    }

    const previousCount = lastProposalCountRef.current;
    lastProposalCountRef.current = proposalCountNum;
    fetchNewProposals(previousCount, proposalCountNum);
  }, [proposalCountNum, publicClient, fetchNewProposals]);

  // Update proposals directly from the new on-chain query (no backward search needed)
  useEffect(() => {
    setAllProposals((prev) => mergeProposals(prev, latestProposals));
  }, [latestProposals, setAllProposals]);

  const handleLoadMoreProposals = useCallback(() => {
    if (isLoadingOlder || proposalCountNum === 0) return;
    setIsLoadingOlder(true);
    setLoadedProposalCount((prev) => Math.min((prev || PROPOSAL_PAGE_SIZE) + PROPOSAL_PAGE_SIZE, proposalCountNum));
  }, [isLoadingOlder, proposalCountNum, setLoadedProposalCount]);

  useEffect(() => {
    if (!isLoadingOlder) return;
    if (allProposals.length >= effectiveLoadedCount) {
      setIsLoadingOlder(false);
    }
  }, [isLoadingOlder, allProposals.length, effectiveLoadedCount]);

  // Use proposals directly from the new on-chain query
  const proposals = allProposals;

  const visibleProposals = useMemo(() => {
    if (effectiveLoadedCount <= 0) return [];
    return proposals.slice(0, Math.min(effectiveLoadedCount, proposals.length));
  }, [proposals, effectiveLoadedCount]);

  const canLoadMoreProposals = effectiveLoadedCount < proposalCountNum;

  const eventRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleGovernanceRefresh = useCallback((reason: string) => {
    if (!isCorrectNetwork || !publicClient) return;
    if (eventRefreshTimeoutRef.current) return;
    eventRefreshTimeoutRef.current = setTimeout(async () => {
      eventRefreshTimeoutRef.current = null;
      try {
        console.log(`🔔 Governance event detected (${reason}) - refreshing proposals`);
        await refetchProposalCount();
        await refetchLatestProposals();
      } catch (error) {
        console.error('Failed to refresh proposals after event:', error);
      }
    }, 500);
  }, [isCorrectNetwork, publicClient, refetchProposalCount, refetchLatestProposals]);

  useEffect(() => {
    return () => {
      if (eventRefreshTimeoutRef.current) {
        clearTimeout(eventRefreshTimeoutRef.current);
        eventRefreshTimeoutRef.current = null;
      }
    };
  }, []);

  useWatchContractEvent({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    eventName: 'ProposalCreated',
    chainId: sepolia.id,
    enabled: isCorrectNetwork,
    onLogs: () => scheduleGovernanceRefresh('ProposalCreated'),
  });

  useWatchContractEvent({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    eventName: 'ProposalQueued',
    chainId: sepolia.id,
    enabled: isCorrectNetwork,
    onLogs: () => scheduleGovernanceRefresh('ProposalQueued'),
  });

  useWatchContractEvent({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    eventName: 'ProposalExecuted',
    chainId: sepolia.id,
    enabled: isCorrectNetwork,
    onLogs: () => scheduleGovernanceRefresh('ProposalExecuted'),
  });

  useWatchContractEvent({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    eventName: 'ProposalCanceled',
    chainId: sepolia.id,
    enabled: isCorrectNetwork,
    onLogs: () => scheduleGovernanceRefresh('ProposalCanceled'),
  });

  useEffect(() => {
    if (!isCorrectNetwork || !publicClient) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refetchProposalCount();
    }, 120_000);
    return () => clearInterval(interval);
  }, [isCorrectNetwork, publicClient, refetchProposalCount]);

  useEffect(() => {
    if (!isCorrectNetwork || !publicClient) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        scheduleGovernanceRefresh('visibility');
        fetchBlockNumber();
      }
    };

    const handleFocus = () => {
      scheduleGovernanceRefresh('focus');
      fetchBlockNumber();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isCorrectNetwork, publicClient, scheduleGovernanceRefresh]);

  const [voteEventBatch, setVoteEventBatch] = useState<{ nonce: number; proposalIds: string[] }>({
    nonce: 0,
    proposalIds: [],
  });

  const scheduleVoteEventRefresh = useCallback((proposalIds: string[]) => {
    if (!proposalIds.length) return;
    setVoteEventBatch((prev) => ({
      nonce: prev.nonce + 1,
      proposalIds,
    }));
  }, []);

  useWatchContractEvent({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    eventName: 'VoteCast',
    chainId: sepolia.id,
    enabled: isCorrectNetwork,
    onLogs: (logs) => {
      const ids = logs
        .map((log) => {
          const args = (log as any).args as { proposalId?: bigint } | undefined;
          return args?.proposalId !== undefined ? args.proposalId.toString() : null;
        })
        .filter((id): id is string => !!id);
      if (ids.length) {
        scheduleVoteEventRefresh(Array.from(new Set(ids)));
      }
    },
  });

  useWatchContractEvent({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    eventName: 'VoteCastWithParams',
    chainId: sepolia.id,
    enabled: isCorrectNetwork,
    onLogs: (logs) => {
      const ids = logs
        .map((log) => {
          const args = (log as any).args as { proposalId?: bigint } | undefined;
          return args?.proposalId !== undefined ? args.proposalId.toString() : null;
        })
        .filter((id): id is string => !!id);
      if (ids.length) {
        scheduleVoteEventRefresh(Array.from(new Set(ids)));
      }
    },
  });

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!description.trim()) {
      setError('Please enter a proposal description');
      return;
    }

    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    // Check if user is a member before allowing proposal creation
    if (isMember === false) {
      setError('MEMBERSHIP_REQUIRED'); // Special error code to show membership message
      return;
    }

    if (isMember === undefined && isLoadingMembership) {
      setError('Checking membership status...');
      return;
    }

    try {
      const parseValueInput = (rawValue: string) => {
        const trimmed = rawValue.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('0x')) {
          return BigInt(trimmed);
        }
        if (valuesUnit === 'eth') {
          return parseEther(trimmed);
        }
        if (trimmed.includes('.')) {
          throw new Error('Wei values must be whole numbers');
        }
        return BigInt(trimmed);
      };

      // Parse targets (comma-separated addresses)
      let targetAddresses: Address[] = [];
      let values: bigint[] = [];
      let calldataArray: `0x${string}`[] = [];

      if (withOnChainExecution) {
        // Require targets and calldatas if on-chain execution is enabled
        if (!targets.trim()) {
          setError('Please provide target contract addresses when on-chain execution is enabled');
          return;
        }
        if (!calldatas.trim()) {
          setError('Please provide calldata when on-chain execution is enabled');
          return;
        }
        
        // Parse targets (comma-separated addresses)
        targetAddresses = targets
          .split(',')
          .map((addr) => addr.trim() as Address)
          .filter((addr) => addr.length === 42 && addr.startsWith('0x'));
        
        if (targetAddresses.length === 0) {
          setError('Invalid target addresses. Please provide valid Ethereum addresses separated by commas.');
          return;
        }

        // Parse calldatas (comma-separated hex strings)
        calldataArray = calldatas
          .split(',')
          .map((cd) => cd.trim() as `0x${string}`)
          .filter((cd) => cd.startsWith('0x'));
        
        if (calldataArray.length !== targetAddresses.length) {
          setError('Number of calldatas must match number of targets');
          return;
        }

        // Parse values (comma-separated). Empty -> all 0. Single -> apply to all.
        const rawValues = valuesInput
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0);

        if (rawValues.length === 0) {
          values = targetAddresses.map(() => 0n);
        } else if (rawValues.length === 1) {
          const parsed = parseValueInput(rawValues[0]);
          if (parsed === null) {
            setError('Please provide a valid value amount');
            return;
          }
          values = targetAddresses.map(() => parsed);
        } else {
          if (rawValues.length !== targetAddresses.length) {
            setError('Number of values must match number of targets (or provide a single value for all)');
            return;
          }
          try {
            values = rawValues.map((value) => {
              const parsed = parseValueInput(value);
              if (parsed === null) {
                throw new Error('Invalid value');
              }
              return parsed;
            });
          } catch (error) {
            setError('Values must be valid numbers, decimals (ETH), or hex amounts');
            return;
          }
        }
      } else {
        // For proposals without on-chain execution (description-only), use dummy target
        targetAddresses = [CONTRACTS.SEPOLIA.GOVERNOR_PROXY as Address];
        values = [0n];
        calldataArray = ['0x' as `0x${string}`];
      }


      console.log('Submitting proposal:', {
        targets: targetAddresses,
        values,
        calldatas: calldataArray,
        description,
      });

      writeContract({
        address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
        abi: DAOGovernor,
        functionName: 'propose',
        args: [targetAddresses, values, calldataArray, description],
      });
    } catch (err: any) {
      console.error('Error submitting proposal:', err);
      setError(err.message || 'Failed to submit proposal. Please try again.');
    }
  };

  // Track if proposal was just submitted to keep button disabled
  const [justSubmitted, setJustSubmitted] = useState(false);
  
  // Reset form and show success message, then refresh proposals
  useEffect(() => {
    if (isConfirmed) {
      setJustSubmitted(true); // Keep button disabled
      setSuccess('Proposal submitted successfully! Refreshing proposals...');
      setDescription('');
      setTargets('');
      setCalldatas('');
      setValuesInput('0');
      setWithOnChainExecution(false);
      
      // Refetch proposals after a short delay to allow block to be mined
      // Refetch proposalCount first so we can incrementally load new proposals
      setTimeout(() => {
        // Invalidate proposalCount so incremental loading can fetch the new proposal
        queryClient.invalidateQueries({ queryKey: ['proposalCount'] });
        
        // First refetch proposalCount to get the updated count
        refetchProposalCount().then(() => {
          // Then refetch the processed proposals (states/votes) without rebuilding the full list
          setTimeout(() => {
            refetchLatestProposals();
            // Reset justSubmitted after proposals are refreshed and form is closed
            setTimeout(() => {
              setJustSubmitted(false);
            }, 1000);
          }, 1000);
        });
        
        setTimeout(() => {
          setShowCreateForm(false);
          setSuccess(null);
        }, 4000);
      }, 2000);
    }
  }, [isConfirmed, refetchLatestProposals, refetchProposalCount, queryClient]);

  // Handle queue errors
  useEffect(() => {
    if (queueError) {
      console.error('Queue transaction error:', queueError);
      setError(queueError.message || 'Failed to queue proposal. Please try again.');
      setQueueingProposalId(null);
    }
  }, [queueError]);

  // Handle queue confirmation - fetch actual ETA from contract when queue is confirmed
  useEffect(() => {
    if (isQueueConfirmed && queueHash && publicClient && queueingProposalId) {
      const fetchActualETA = async () => {
        try {
          // Wait a moment for the transaction to be mined and state to update
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Fetch the actual proposalEta from the contract
          const proposalEta = await publicClient.readContract({
            address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
            abi: DAOGovernor,
            functionName: 'proposalEta',
            args: [BigInt(queueingProposalId)],
          });

          if (proposalEta && typeof proposalEta === 'bigint' && proposalEta > 0n) {
            const etaTimestamp = Number(proposalEta);
            const currentTime = Math.floor(Date.now() / 1000);
            const timeUntilEta = etaTimestamp - currentTime;
            
            console.log('Fetched actual proposalEta:', {
              etaTimestamp,
              currentTime,
              timeUntilEta,
              proposalId: queueingProposalId,
              willShowReady: timeUntilEta <= 0
            });
            
            // Only set ETA if it's in the future (at least 5 seconds from now)
            // If ETA is in the past or too close, something is wrong - use a fallback
            if (timeUntilEta < 5) {
              console.warn('WARNING: proposalEta is too close to now or in the past! Using fallback estimate.', {
                etaTimestamp,
                currentTime,
                timeUntilEta
              });
              // Use fallback estimate
              const timelockDelaySeconds = 36; // 3 blocks * 12 seconds per block
              const fallbackEta = currentTime + timelockDelaySeconds;
              setQueuedProposalETAs(prev => {
                const newMap = new Map(prev);
                newMap.set(queueingProposalId, fallbackEta);
                return newMap;
              });
            } else {
              setQueuedProposalETAs(prev => {
                const newMap = new Map(prev);
                newMap.set(queueingProposalId, etaTimestamp);
                return newMap;
              });
            }
          } else {
            // Fallback: use estimate if contract hasn't updated yet
            const timelockDelaySeconds = 36; // 3 blocks * 12 seconds per block
            const eta = Math.floor(Date.now() / 1000) + timelockDelaySeconds;
            setQueuedProposalETAs(prev => {
              const newMap = new Map(prev);
              newMap.set(queueingProposalId, eta);
              return newMap;
            });
            console.log('Using estimated ETA (contract not updated yet):', eta);
          }
        } catch (err) {
          console.error('Error fetching proposalEta:', err);
          // Fallback: use estimate if fetch fails
          const timelockDelaySeconds = 36;
          const eta = Math.floor(Date.now() / 1000) + timelockDelaySeconds;
          setQueuedProposalETAs(prev => {
            const newMap = new Map(prev);
            newMap.set(queueingProposalId, eta);
            return newMap;
          });
        }

        setQueuedProposalIds(prev => {
          const newSet = new Set(prev);
          newSet.add(queueingProposalId);
          return newSet;
        });
        setQueueingProposalId(null);
        
        setSuccess('Proposal scheduled successfully! It is now in the review/opposition window before execution.');
        setTimeout(() => {
          refetchLatestProposals();
          setTimeout(() => {
            setSuccess(null);
          }, 3000);
        }, 2000);
      };

      fetchActualETA();
    }
  }, [isQueueConfirmed, queueHash, publicClient, queueingProposalId, refetchLatestProposals]);

  // Handle execute confirmation
  useEffect(() => {
    if (isExecuteConfirmed && executeHash && executingProposalId) {
      if (executeHash !== lastExecuteHashRef.current) {
        setExecutedProposalIds(prev => new Set(prev).add(executingProposalId));
        lastExecuteHashRef.current = executeHash;
      }
      setExecutingProposalId(null);
      setSuccess('Proposal executed successfully! All changes have been applied.');
      
      // Immediately refetch proposals to update state
      refetchLatestProposals();
      // Refetch multiple times with delays to ensure state has updated on-chain
      setTimeout(() => {
        refetchLatestProposals();
      }, 2000);
      setTimeout(() => {
        refetchLatestProposals();
        // Also invalidate queries to force refresh
        queryClient.invalidateQueries({ queryKey: proposalsQueryKey });
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      }, 5000);
    }
  }, [isExecuteConfirmed, executeHash, executingProposalId, refetchLatestProposals, queryClient, proposalsQueryKey]);

  // Clean up tracking when proposal state updates to Queued - use actual ETA from contract
  useEffect(() => {
    proposals.forEach((proposal: any) => {
      if (proposal.state === 'Queued' && queuedProposalIds.has(proposal.id)) {
        // Proposal state has updated to Queued, update ETA from actual proposal data if available
        if (proposal.proposalEta) {
          setQueuedProposalETAs(prev => {
            const newMap = new Map(prev);
            newMap.set(proposal.id, proposal.proposalEta);
            return newMap;
          });
        }
      }
    });
  }, [proposals, queuedProposalIds]);

  // Show error from transaction
  if (isError && error === null) {
    setError('Transaction failed. Please check your wallet and try again.');
  }

  // Handle vote confirmation
  useEffect(() => {
    if (isVoteConfirmed && votingProposalId) {
      const confirmedProposalId = votingProposalId; // Store before clearing state
      console.log('Vote confirmed for proposal:', confirmedProposalId);
      console.log('Vote receipt:', voteReceipt);
      setSuccess('Vote cast successfully! Refreshing vote counts...');
      
      // Close the voting section
      setShowVotingForProposal(null);
      setVotingProposalId(null);
      
      // Invalidate cache immediately
      queryClient.invalidateQueries({ queryKey: proposalsQueryKey });
      
      // Refetch immediately
      console.log('Refetching proposals immediately after vote confirmation...');
      refetchLatestProposals().then((result) => {
        console.log('First refetch completed, proposals:', result.data?.length);
        if (result.data) {
          const votedProposal = result.data.find((p: any) => p.id === confirmedProposalId);
          if (votedProposal?.votes) {
            console.log('Vote counts after first refetch:', votedProposal.votes);
          } else {
            console.warn('Proposal not found or no votes in first refetch for proposal:', confirmedProposalId);
          }
        }
      });
      refetchHasVoted();
      
      // Refetch multiple times with increasing delays to ensure state has updated
      setTimeout(() => {
        console.log('Refetching proposals after 3 seconds...');
        queryClient.invalidateQueries({ queryKey: ['latestProposals', CONTRACTS.SEPOLIA.GOVERNOR_PROXY] });
        refetchLatestProposals().then((result) => {
          console.log('Second refetch completed');
          if (result.data) {
            const votedProposal = result.data.find((p: any) => p.id === confirmedProposalId);
            if (votedProposal?.votes) {
              console.log('Vote counts after second refetch:', votedProposal.votes);
            } else {
              console.warn('Proposal not found or no votes in second refetch for proposal:', confirmedProposalId);
            }
          }
        });
        refetchHasVoted();
      }, 3000);
      
      setTimeout(() => {
        console.log('Refetching proposals after 8 seconds...');
        queryClient.invalidateQueries({ queryKey: ['latestProposals', CONTRACTS.SEPOLIA.GOVERNOR_PROXY] });
        refetchLatestProposals().then((result) => {
          console.log('Third refetch completed');
          if (result.data) {
            const votedProposal = result.data.find((p: any) => p.id === confirmedProposalId);
            if (votedProposal?.votes) {
              console.log('Vote counts after third refetch:', votedProposal.votes);
            } else {
              console.warn('Proposal not found or no votes in third refetch for proposal:', confirmedProposalId);
            }
          }
        });
        refetchHasVoted();
        setSuccess(null);
      }, 8000);
    }
  }, [isVoteConfirmed, votingProposalId, refetchLatestProposals, refetchHasVoted, queryClient, voteReceipt]);

  const handleVote = async (proposalId: string, support: number) => {
    if (!address || !isConnected) {
      setError('Please connect your wallet to vote');
      return;
    }

    setVotingProposalId(proposalId);
    setError(null);

    try {
      console.log('Casting vote:', { proposalId, support, address });
      writeVote({
        address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
        abi: DAOGovernor,
        functionName: 'castVote',
        args: [BigInt(proposalId), support],
      });
    } catch (err: any) {
      console.error('Error casting vote:', err);
      setError(err.message || 'Failed to cast vote. Please try again.');
      setVotingProposalId(null);
    }
  };

  const handleQueue = useCallback(async (proposal: any) => {
    if (!address || !isConnected) {
      setError('Please connect your wallet to queue the proposal');
      return;
    }

    if (!writeQueue) {
      console.error('writeQueue is not available');
      setError('Transaction function not available. Please refresh the page.');
      return;
    }

    // Check if proposal has required fields
    if (!proposal.targets || !proposal.values || !proposal.calldatas || !proposal.descriptionHash) {
      console.error('Proposal missing required fields:', {
        hasTargets: !!proposal.targets,
        hasValues: !!proposal.values,
        hasCalldatas: !!proposal.calldatas,
        hasDescriptionHash: !!proposal.descriptionHash,
        proposal
      });
      setError('Proposal data incomplete. Please refresh the page.');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      // Convert values from string[] to bigint[] if needed
      const values = proposal.values.map((v: string | bigint) => 
        typeof v === 'string' ? BigInt(v) : v
      );
      
      // Ensure descriptionHash is the correct format
      const descriptionHash = proposal.descriptionHash as `0x${string}`;
      
      console.log('Queueing proposal:', { 
        proposalId: proposal.id, 
        address, 
        isConnected,
        targets: proposal.targets,
        values: values,
        calldatas: proposal.calldatas,
        descriptionHash: descriptionHash
      });
      
      setQueueingProposalId(proposal.id);
      
      // queue function requires: targets, values, calldatas, descriptionHash
      writeQueue({
        address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
        abi: DAOGovernor,
        functionName: 'queue',
        args: [
          proposal.targets as Address[],
          values as bigint[],
          proposal.calldatas as `0x${string}`[],
          descriptionHash
        ],
      });
      
      console.log('writeQueue called - MetaMask should pop up now');
    } catch (err: any) {
      console.error('Error queueing proposal:', err);
      setError(err.message || 'Failed to queue proposal. Please try again.');
      setQueueingProposalId(null);
    }
  }, [address, isConnected, writeQueue, setError, setSuccess, setQueueingProposalId]);

  const handleExecute = useCallback(async (proposal: any) => {
    if (!address || !isConnected) {
      setError('Please connect your wallet to execute the proposal');
      return;
    }

    if (!writeExecute) {
      console.error('writeExecute is not available');
      setError('Transaction function not available. Please refresh the page.');
      return;
    }

    // Check if proposal has required fields
    if (!proposal.targets || !proposal.values || !proposal.calldatas || !proposal.descriptionHash) {
      console.error('Proposal missing required fields:', {
        hasTargets: !!proposal.targets,
        hasValues: !!proposal.values,
        hasCalldatas: !!proposal.calldatas,
        hasDescriptionHash: !!proposal.descriptionHash,
        proposal
      });
      setError('Proposal data incomplete. Please refresh the page.');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      // First, verify the proposal is actually ready to execute
      if (publicClient) {
        try {
          const currentState = await publicClient.readContract({
            address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
            abi: DAOGovernor,
            functionName: 'state',
            args: [BigInt(proposal.id)],
          });
          
          const stateNumber = Number(currentState);
          if (stateNumber !== 5) { // 5 = Queued
            setError(`Proposal is not ready to execute. Current state: ${stateNumber} (expected: 5 - Queued). Please wait for the timelock delay to pass.`);
            return;
          }

          // Check if the proposal ETA has passed
          const proposalEta = await publicClient.readContract({
            address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
            abi: DAOGovernor,
            functionName: 'proposalEta',
            args: [BigInt(proposal.id)],
          });

          if (proposalEta && typeof proposalEta === 'bigint' && proposalEta > 0n) {
            const currentBlock = await publicClient.getBlock();
            const currentTimestamp = BigInt(currentBlock.timestamp);
            
            if (typeof proposalEta === 'bigint' && proposalEta > currentTimestamp) {
              const secondsRemaining = Number(proposalEta - currentTimestamp);
              const minutesRemaining = Math.floor(secondsRemaining / 60);
              setError(`Proposal is queued but the timelock delay hasn't passed yet. Please wait ${minutesRemaining > 0 ? `${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} and ${secondsRemaining % 60} second${secondsRemaining % 60 !== 1 ? 's' : ''}` : `${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''}`} before executing.`);
              return;
            }
          }
        } catch (stateError: any) {
          console.error('Error checking proposal state:', stateError);
          // Continue anyway - the execution will fail with a better error
        }
      }

      // Convert values from string[] to bigint[] if needed
      const values = proposal.values.map((v: string | bigint) => 
        typeof v === 'string' ? BigInt(v) : v
      );
      
      // Ensure descriptionHash is the correct format
      const descriptionHash = proposal.descriptionHash as `0x${string}`;
      
      console.log('Executing proposal:', { 
        proposalId: proposal.id, 
        address, 
        isConnected,
        targets: proposal.targets,
        values: values,
        calldatas: proposal.calldatas,
        descriptionHash: descriptionHash
      });
      
      setExecutingProposalId(proposal.id);
      
      // execute function requires: targets, values, calldatas, descriptionHash
      writeExecute({
        address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
        abi: DAOGovernor,
        functionName: 'execute',
        args: [
          proposal.targets as Address[],
          values as bigint[],
          proposal.calldatas as `0x${string}`[],
          descriptionHash
        ],
      });
      
      console.log('writeExecute called - MetaMask should pop up now');
    } catch (err: any) {
      console.error('Error executing proposal:', err);
      setError(formatViemError(err));
      setExecutingProposalId(null);
    }
  }, [address, isConnected, writeExecute, publicClient, setError, setSuccess, setExecutingProposalId]);

  return (
    <div className="space-y-8 w-full min-w-0 overflow-hidden">
      <ProposalStateRefresher
        latestProposals={latestProposals}
        proposalsQueryKey={proposalsQueryKey}
        queryClient={queryClient}
        refetchLatestProposals={refetchLatestProposals}
      />
      {/* Balance Check - Show if connected but low balance */}
      {isConnected && <BalanceCheck />}

      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Governance</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Create proposals and vote on <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> decisions</p>
        </div>
      </div>

      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <p className="text-teal-600 dark:text-teal-400">
            Connect your Wallet to interact with the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span>. If you haven't set up a wallet yet, visit the <Link href="/getting-started" className="underline text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200">getting started guide</Link>.
          </p>
        </div>
      )}

      {/* Governance Parameters */}
      {/* Only render when all parameters are loaded to prevent transitions */}
      {isLoadingGovernanceParams ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Governance Parameters</h2>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Loading governance parameters...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Governance Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full min-w-0">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Proposal Threshold</p>
                <div className="relative group">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
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
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {proposalThreshold !== undefined && proposalThreshold !== null
                  ? proposalThreshold.toString()
                  : '0'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Voting Delay</p>
                <div className="relative group">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Voting Delay</p>
                    <p className="text-gray-300">
                      The number of blocks that must pass after a proposal is created before voting can begin. This gives members time to review proposals before voting starts.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {votingDelay !== undefined && votingDelay !== null
                  ? `${Number(votingDelay)} blocks`
                  : '0 blocks'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Voting Period</p>
                <div className="relative group">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Voting Period</p>
                    <p className="text-gray-300">
                      The number of blocks during which members can cast their votes on a proposal. After this period ends, the proposal is finalized based on the vote results.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {votingPeriod !== undefined && votingPeriod !== null
                  ? `${Number(votingPeriod)} blocks`
                  : '0 blocks'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Timelock Delay</p>
                <div className="relative group">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Timelock Delay</p>
                    <p className="text-gray-300">
                      The minimum time (in seconds) that must pass after a proposal is queued before it can be executed. This review/opposition window allows the community to detect and cancel malicious proposals before they take effect.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {timelockDelaySeconds !== undefined && timelockDelaySeconds !== null
                  ? `${Number(timelockDelaySeconds)} seconds${Number(timelockDelaySeconds) >= 12 ? ` (~${Math.round(Number(timelockDelaySeconds) / 12)} blocks)` : ''}`
                  : '0 seconds'}
              </p>
            </div>
          </div>

        {/* Voting Rules */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <button
            onClick={() => setIsVotingRulesExpanded(!isVotingRulesExpanded)}
            className="flex items-center gap-2 w-full text-left mb-3 hover:opacity-80 transition-opacity"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voting Rules</h3>
            {isVotingRulesExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          {isVotingRulesExpanded && (
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">•</span>
              <div className="flex items-start gap-2 flex-1">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Vote Types:</span> Members can vote <span className="font-medium">For</span>, <span className="font-medium">Against</span>, or <span className="font-medium">Abstain</span>
                </div>
                <div className="relative group flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help mt-0.5" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Vote Types</p>
                    <p className="text-gray-300">
                      <strong>For:</strong> You support the proposal. <strong>Against:</strong> You oppose the proposal. <strong>Abstain:</strong> You choose not to take a position, but your vote still counts toward quorum.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">•</span>
              <div className="flex items-start gap-2 flex-1">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Voting Power:</span> Each membership NFT grants 1 vote. Votes must be delegated to activate voting power.
                </div>
                <div className="relative group flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help mt-0.5" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Voting Power</p>
                    <p className="text-gray-300">
                      Each membership NFT grants 1 vote, but you must delegate your votes (to yourself or another address) before you can vote on proposals. Delegation activates your voting power.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">•</span>
              <div className="flex items-start gap-2 flex-1">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Quorum:</span> {quorumNumerator ? `${Number(quorumNumerator)}%` : '...'} of total membership supply (calculated at proposal snapshot). Quorum includes <span className="font-medium">For</span> and <span className="font-medium">Abstain</span> votes.
                </div>
                <div className="relative group flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help mt-0.5" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Quorum</p>
                    <p className="text-gray-300">
                      The minimum number of votes required for a proposal to be valid. Quorum is calculated as a percentage of total membership supply at the proposal snapshot. Both "For" and "Abstain" votes count toward quorum.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">•</span>
              <div className="flex items-start gap-2 flex-1">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Proposal Success:</span> A proposal succeeds when <span className="font-medium">quorum is reached</span> AND <span className="font-medium">For votes exceed Against votes</span>.
                </div>
                <div className="relative group flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help mt-0.5" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Proposal Success</p>
                    <p className="text-gray-300">
                      A proposal succeeds only if both conditions are met: (1) enough members vote to reach quorum, and (2) "For" votes exceed "Against" votes. If either condition fails, the proposal is defeated.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">•</span>
              <div className="flex items-start gap-2 flex-1">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Snapshot:</span> Voting power is determined at the proposal snapshot block (when voting starts), not at the time of voting.
                </div>
                <div className="relative group flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help mt-0.5" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Snapshot</p>
                    <p className="text-gray-300">
                      The snapshot is the block number when voting starts. Your voting power is calculated based on your membership NFT ownership and delegation status at that specific block, not when you actually cast your vote. This prevents manipulation by buying/selling NFTs during voting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">•</span>
              <div>
                <span className="font-medium text-gray-900 dark:text-white">One Vote Per Proposal:</span> Each address can vote only once per proposal. Votes cannot be changed after casting.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">•</span>
              <div className="flex items-start gap-2 flex-1">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Proposal States:</span> Proposals move through different states during their lifecycle.
                </div>
                <div className="relative group flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help mt-0.5" />
                  <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Proposal State Codes</p>
                    <div className="text-gray-300 space-y-0.5 font-mono text-xs">
                      <div>0 = Pending</div>
                      <div>1 = Active</div>
                      <div>2 = Canceled</div>
                      <div>3 = Defeated</div>
                      <div>4 = Succeeded</div>
                      <div>5 = Queued</div>
                      <div>6 = Expired</div>
                      <div>7 = Executed</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Create Proposal Button and Current Block */}
      <div className="flex items-center justify-between gap-4">
        {isConnected && isCorrectNetwork && (
          <button
            onClick={() => {
              if (!isPending && !isConfirming) {
                setShowCreateForm(!showCreateForm);
              }
            }}
            disabled={isPending || isConfirming}
            className="px-4 py-2 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showCreateForm ? 'Cancel' : 'Create Proposal'}
          </button>
        )}
        <CurrentBlockBanner />
      </div>

      {/* Create Proposal Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create New Proposal</h2>
          
          {/* Show membership requirement message if not a member */}
          {isConnected && isCorrectNetwork && isMember === false && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="space-y-3">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                  You need to be a member to create a proposal. Please become a member first.
                </p>
                <a
                  href="/membership?expand=membership"
                  onClick={handleBecomeMember}
                  className="inline-block px-4 py-2 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors text-sm font-medium cursor-pointer"
                >
                  Become a Member
                </a>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              {error === 'MEMBERSHIP_REQUIRED' ? (
                <div className="space-y-3">
                  <p className="text-red-800 dark:text-red-200 text-sm font-medium">
                    Transaction failed. You need to be a member to create a proposal.
                  </p>
                  <a
                    href="/membership?expand=membership"
                    onClick={handleBecomeMember}
                    className="inline-block px-4 py-2 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors text-sm font-medium cursor-pointer"
                  >
                    Become a Member
                  </a>
                </div>
              ) : (
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              )}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmitProposal} className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Proposal Description *
                </label>
                <div className="relative group">
                  <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Proposal Description</p>
                    <p className="text-gray-300">
                      A clear description of what the proposal aims to achieve. This is required and will be visible to all members when voting.
                    </p>
                  </div>
                </div>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isMember === false || (isMember === undefined && isLoadingMembership)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                rows={4}
                placeholder="Describe your proposal..."
                required
              />
            </div>
            <div className="mb-4">
              <label className={`flex items-center gap-2 ${isMember === false || (isMember === undefined && isLoadingMembership) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={withOnChainExecution}
                  onChange={(e) => setWithOnChainExecution(e.target.checked)}
                  disabled={isMember === false || (isMember === undefined && isLoadingMembership)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  With on-chain execution
                </span>
                <div className="relative group">
                  <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">On-chain Execution</p>
                    <p className="text-gray-300">
                      Check this box if your proposal requires executing actions on smart contracts (e.g., treasury payouts, parameter changes). Uncheck for description-only proposals (signaling proposals).
                    </p>
                  </div>
                </div>
              </label>
            </div>
            {withOnChainExecution && (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Target Contracts (comma-separated addresses) *
                    </label>
                <div className="relative group">
                  <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Target Contracts</p>
                    <p className="text-gray-300">
                      The smart contract addresses that the proposal will interact with. Leave empty for description-only proposals (e.g., signaling proposals). If provided, you must also provide matching calldatas.
                    </p>
                  </div>
                </div>
              </div>
              <input
                type="text"
                value={targets}
                onChange={(e) => setTargets(e.target.value)}
                disabled={isMember === false || (isMember === undefined && isLoadingMembership)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                placeholder="0x..., 0x..."
                required={withOnChainExecution}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                You must also provide matching calldatas below.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Values (comma-separated)
                  </label>
                  <div className="relative group">
                    <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                      <p className="mb-2 font-semibold">Values</p>
                      <p className="text-gray-300">
                        Amount of ETH to send with each call. Pick the unit (wei or ETH) for the values you enter.
                        Use one value for all targets, or a comma-separated list matching each target.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setValuesUnit('wei');
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      valuesUnit === 'wei'
                        ? 'bg-blue-700 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    wei
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setValuesUnit('eth');
                    }}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      valuesUnit === 'eth'
                        ? 'bg-blue-700 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    ETH
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={valuesInput}
                onChange={(e) => setValuesInput(e.target.value)}
                disabled={isMember === false || (isMember === undefined && isLoadingMembership)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                placeholder={valuesUnit === 'wei' ? '0 (wei)' : '0.01 (ETH)'}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Unit: {valuesUnit}. Default is 0. A single value applies to all targets.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Calldata (comma-separated hex-encoded) *
                </label>
                <div className="relative group">
                  <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                    <p className="mb-2 font-semibold">Calldata</p>
                    <p className="text-gray-300">
                      The encoded function calls (in hex format) that will be executed on each target contract if the proposal passes. Each calldata corresponds to one target address. Must match the number of targets provided.
                    </p>
                  </div>
                </div>
              </div>
              <input
                type="text"
                value={calldatas}
                onChange={(e) => setCalldatas(e.target.value)}
                disabled={isMember === false || (isMember === undefined && isLoadingMembership)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
                placeholder="0x..., 0x... (must match number of targets)"
                required={withOnChainExecution}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Number of calldatas must match number of targets.
              </p>
            </div>
            </>
            )}
            <button
              type="submit"
              disabled={isPending || isConfirming || justSubmitted || isMember === false || (isMember === undefined && isLoadingMembership)}
              className="w-full px-4 py-3 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming || justSubmitted ? 'Submitting...' : isMember === false ? 'Membership Required' : (isMember === undefined && isLoadingMembership) ? 'Checking membership...' : 'Submit Proposal'}
            </button>
            {hash && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Transaction: <a href={`https://eth-sepolia.blockscout.com/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{hash.substring(0, 10)}...</a>
              </p>
            )}
          </form>
        </div>
      )}

      {/* Proposals List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full min-w-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Proposals</h2>
        {((isLoadingProposals && visibleProposals.length === 0) || (isLoadingOlder && visibleProposals.length === 0) || (hasAutoSearched && oldestLoadedBlock !== null && visibleProposals.length === 0 && !isLoadingOlder && publicClient)) ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>{searchProgress || 'Loading proposals...'}</p>
          </div>
        ) : (!isLoadingProposals && (!hasAutoSearched || (hasAutoSearched && oldestLoadedBlock === null)) && visibleProposals.length === 0) ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No proposals yet.</p>
            <p className="text-sm mt-2">Be the first to create a proposal!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {isLoadingOlder && searchProgress && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                <p className="text-sm">{searchProgress}</p>
              </div>
            )}
            {visibleProposals.map((proposal) => {
              const isExpanded = expandedProposal === proposal.id;
              const canVote = proposal.state === 'Active' && isConnected;
              const isQueued = proposal.state === 'Queued' || queuedProposalIds.has(proposal.id);
              const isLocallyExecuted = executedProposalIds.has(proposal.id);
              const queuedProposalETA = queuedProposalETAs.get(proposal.id);
              const isQueueingForProposal = queueingProposalId === proposal.id;
              const isExecutingForProposal = executingProposalId === proposal.id;
              const queueHashForProposal = queueHash && isQueueingForProposal ? queueHash : undefined;
              const executeHashForProposal = executeHash && isExecutingForProposal ? executeHash : undefined;

              return (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  isExpanded={isExpanded}
                  canVote={canVote}
                  isQueued={isQueued}
                  isLocallyExecuted={isLocallyExecuted}
                  queuedProposalETA={queuedProposalETA}
                  timelockDelaySeconds={timelockDelaySeconds}
                  isConnected={isConnected}
                  onQueue={handleQueue}
                  onExecute={handleExecute}
                  isQueueing={isQueueing || isQueueConfirming}
                  isQueueingForProposal={isQueueingForProposal}
                  queueHash={queueHashForProposal}
                  isExecuting={isExecuting || isExecuteConfirming}
                  isExecutingForProposal={isExecutingForProposal}
                  executeHash={executeHashForProposal}
                  setExpandedProposal={setExpandedProposal}
                  voteEventBatch={voteEventBatch}
                />
              );
            })}
            {canLoadMoreProposals && (
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMoreProposals}
                  disabled={isLoadingOlder}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isLoadingOlder ? 'Loading more...' : `Load ${PROPOSAL_PAGE_SIZE} more`}
                </button>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Showing {Math.min(visibleProposals.length, proposalCountNum)} of {proposalCountNum} proposals
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalStateRefresher({
  latestProposals,
  proposalsQueryKey,
  queryClient,
  refetchLatestProposals,
}: {
  latestProposals: any[] | undefined;
  proposalsQueryKey: readonly [string, Address];
  queryClient: ReturnType<typeof useQueryClient>;
  refetchLatestProposals: () => Promise<any>;
}) {
  const currentBlockNumber = useCurrentBlockNumber();
  const proposalBlockCountersRef = useRef<Map<string, {
    voteStartBlocksAgo: number | null;
    voteEndBlocksAgo: number | null;
    voteEndBlocksRemaining: number | null;
  }>>(new Map());

  useEffect(() => {
    const proposalsFromCache = queryClient.getQueryData(proposalsQueryKey) as any[] | undefined;
    const proposalsToCheck = proposalsFromCache ?? latestProposals;

    console.log('🔍 Counter-based check running:', {
      currentBlock: currentBlockNumber?.toString(),
      proposalsCount: proposalsToCheck?.length || 0,
      source: proposalsFromCache ? 'cache' : 'state',
    });

    if (!currentBlockNumber || !proposalsToCheck || proposalsToCheck.length === 0) {
      console.log('⚠️ Counter check skipped: missing data');
      return;
    }

    const proposalsNeedingRefresh: string[] = [];

    proposalsToCheck.forEach((p: any) => {
      // Skip proposals that are already in final states
      const isTerminalState =
        p.state === 'Defeated' ||
        p.state === 'Executed' ||
        p.state === 'Canceled' ||
        p.state === 'Expired' ||
        p.state === 'Queued';
      const isFinalAfterVote = isTerminalState || p.state === 'Succeeded';
      
      // Log proposal details for debugging
      if (p.voteEnd && currentBlockNumber >= BigInt(p.voteEnd)) {
        console.log(`🔍 Checking proposal ${p.id}: state=${p.state}, voteEnd=${p.voteEnd}, currentBlock=${currentBlockNumber}, isFinalState=${isFinalAfterVote}`);
      }
      
      if (isTerminalState) {
        // Remove from tracking if final
        proposalBlockCountersRef.current.delete(p.id);
        return;
      }

      // Calculate current block counters
      let voteStartBlocksAgo: number | null = null;
      let voteEndBlocksAgo: number | null = null;
      let voteEndBlocksRemaining: number | null = null;

      if (p.voteStart && currentBlockNumber >= BigInt(p.voteStart)) {
        voteStartBlocksAgo = Number(currentBlockNumber - BigInt(p.voteStart));
      }

      if (p.voteEnd) {
        const voteEndBigInt = BigInt(p.voteEnd);
        if (currentBlockNumber >= voteEndBigInt) {
          // voteEnd has been reached or passed
          voteEndBlocksAgo = Number(currentBlockNumber - voteEndBigInt);
        } else {
          voteEndBlocksRemaining = Number(voteEndBigInt - currentBlockNumber);
        }
      }

      // Get previous counters
      const previousCounters = proposalBlockCountersRef.current.get(p.id);

      // ALWAYS check if state matches what it should be based on current block numbers
      // Don't wait for counters to change - check every time
      let stateIsStale = false;

      // If voteStart has passed, state should be Active or later (not Pending)
      if (p.voteStart && currentBlockNumber >= BigInt(p.voteStart)) {
        if (p.state === 'Pending') {
          console.log(`🚨 STATE STALE: Proposal ${p.id} shows voteStart passed (currentBlock ${currentBlockNumber} >= voteStart ${p.voteStart}) but state is still Pending`);
          stateIsStale = true;
        }
      }

      // If voteEnd has been reached or passed, state MUST be final
      if (p.voteEnd && currentBlockNumber >= BigInt(p.voteEnd)) {
        if (!isFinalAfterVote) {
          console.log(`🚨 STATE STALE: Proposal ${p.id} shows voteEnd passed (currentBlock ${currentBlockNumber} >= voteEnd ${p.voteEnd}, ${voteEndBlocksAgo} blocks ago) but state is not final (${p.state})`);
          stateIsStale = true;
        }
      }

      // Check if counters changed (for logging)
      const countersChanged = !previousCounters || 
        previousCounters.voteStartBlocksAgo !== voteStartBlocksAgo ||
        previousCounters.voteEndBlocksAgo !== voteEndBlocksAgo ||
        previousCounters.voteEndBlocksRemaining !== voteEndBlocksRemaining;

      if (countersChanged) {
        console.log(`🔄 Counter changed for proposal ${p.id}:`, {
          previous: previousCounters,
          current: { voteStartBlocksAgo, voteEndBlocksAgo, voteEndBlocksRemaining },
          state: p.state
        });
      }

      // Update counters
      proposalBlockCountersRef.current.set(p.id, {
        voteStartBlocksAgo,
        voteEndBlocksAgo,
        voteEndBlocksRemaining
      });

      // If state is stale (regardless of whether counters changed), mark for refresh
      if (stateIsStale) {
        proposalsNeedingRefresh.push(p.id);
      }
    });

    if (proposalsNeedingRefresh.length > 0) {
      console.log(`🚨 FORCING REFRESH: Found ${proposalsNeedingRefresh.length} proposal(s) with stale state`);
      proposalsNeedingRefresh.forEach((id) => {
        const p = proposalsToCheck.find((p: any) => p.id === id);
        console.log(`  - Proposal ${id}: state=${p?.state}, voteStart=${p?.voteStart}, voteEnd=${p?.voteEnd}`);
      });
      
      // CRITICAL: Clear all caches and force complete refetch
      queryClient.removeQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposalCount'] });
      
      // Use exact queryKey match
      const exactQueryKey = proposalsQueryKey;
      console.log('🔄 Refetching with queryKey:', exactQueryKey);
      
      queryClient.refetchQueries({ 
        queryKey: exactQueryKey,
        type: 'active'
      }).then(() => {
        console.log('✅ queryClient.refetchQueries completed, now calling refetchLatestProposals');
        return refetchLatestProposals();
      }).then((result) => {
        console.log('✅ Refreshed after counter check, new data:', result.data?.length, 'proposals');
        if (result.data) {
          proposalsNeedingRefresh.forEach((proposalId) => {
            const refreshed = result.data.find((rp: any) => rp.id === proposalId);
            const oldProposal = proposalsToCheck.find((p: any) => p.id === proposalId);
            if (refreshed) {
              console.log(`✅ Proposal ${proposalId} refreshed: ${oldProposal?.state} -> ${refreshed.state}`);
            } else {
              console.warn(`⚠️ Proposal ${proposalId} not found in refreshed data`);
            }
          });
        } else {
          console.warn('⚠️ Refetch returned no data');
        }
      }).catch((err) => {
        console.error('❌ Error during counter-based refresh:', err);
      });
    } else {
      console.log('ℹ️ No proposals need refresh - all states are correct');
    }
  }, [currentBlockNumber, latestProposals, proposalsQueryKey, queryClient, refetchLatestProposals]);

  return null;
}

const CurrentBlockBanner = memo(function CurrentBlockBanner() {
  const currentBlockNumber = useCurrentBlockNumber();

  if (currentBlockNumber === null) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      <div className="text-right">
        <div className="text-xs text-gray-500 dark:text-gray-400">Current Block</div>
        <div className="text-base font-mono font-semibold text-gray-900 dark:text-white">
          {currentBlockNumber.toLocaleString()}
        </div>
      </div>
    </div>
  );
});

const CurrentBlockInline = memo(function CurrentBlockInline() {
  const currentBlockNumber = useCurrentBlockNumber();

  if (currentBlockNumber === null) return null;

  return (
    <span>
      Current Block: <span className="font-mono font-semibold">{currentBlockNumber.toLocaleString()}</span>
    </span>
  );
});

const PendingStateNotice = memo(function PendingStateNotice({ proposal }: { proposal: any }) {
  const currentBlockNumber = useCurrentBlockNumber();

  if (proposal.state !== 'Pending' || currentBlockNumber === null) return null;

  return (
    <div className="mb-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
        ⏳ Waiting for voting to start
      </p>
      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
        Voting will begin at block {proposal.voteStart.toLocaleString()}. 
        {currentBlockNumber < BigInt(proposal.voteStart) && (
          <> Please be patient - the proposal will automatically become active when the activation block is reached.</>
        )}
      </p>
    </div>
  );
});

const ProposalCard = memo(function ProposalCard({
  proposal,
  isExpanded,
  canVote,
  isQueued,
  isLocallyExecuted,
  queuedProposalETA,
  timelockDelaySeconds,
  isConnected,
  onQueue,
  onExecute,
  isQueueing,
  isQueueingForProposal,
  queueHash,
  isExecuting,
  isExecutingForProposal,
  executeHash,
  setExpandedProposal,
  voteEventBatch,
}: {
  proposal: any;
  isExpanded: boolean;
  canVote: boolean;
  isQueued: boolean;
  isLocallyExecuted: boolean;
  queuedProposalETA?: number;
  timelockDelaySeconds: bigint | null | undefined;
  isConnected: boolean;
  onQueue: (proposal: any) => void;
  onExecute: (proposal: any) => void;
  isQueueing: boolean;
  isQueueingForProposal: boolean;
  queueHash?: `0x${string}`;
  isExecuting: boolean;
  isExecutingForProposal: boolean;
  executeHash?: `0x${string}`;
  setExpandedProposal: (value: string | null) => void;
  voteEventBatch: { nonce: number; proposalIds: string[] };
}) {
  const handleToggle = useCallback(() => {
    setExpandedProposal(isExpanded ? null : proposal.id);
  }, [setExpandedProposal, isExpanded, proposal.id]);

  const isFinalState =
    proposal.state === 'Defeated' ||
    proposal.state === 'Executed' ||
    proposal.state === 'Canceled' ||
    proposal.state === 'Expired';
  const shouldShowFullTimeline = isExpanded || (!isFinalState && proposal.state === 'Active');

  return (
    <div
      className="p-4 border border-gray-300 dark:border-gray-500 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
      onClick={handleToggle}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Proposal from block {proposal.blockNumber.toLocaleString()}
              </h3>
              <CopyableProposalId proposalId={proposal.id} />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <span>{isExpanded ? 'Collapse details' : 'Expand details'}</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                proposal.state === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                proposal.state === 'Succeeded' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                proposal.state === 'Defeated' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                proposal.state === 'Executed' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {proposal.state}
              </span>
              {/* Show quorum message beside Defeated status */}
              {proposal.state === 'Defeated' && proposal.voteAnalysis && (
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {proposal.voteAnalysis.reason}
                </span>
              )}
              <div className="relative group">
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Proposal State: {proposal.state}</p>
                  <p className="text-gray-300 mb-3">
                    {proposal.state === 'Pending' && 'Voting has not started yet. Waiting for the voting delay period to pass.'}
                    {proposal.state === 'Active' && 'Voting is currently open. Members can cast their votes now.'}
                    {proposal.state === 'Succeeded' && 'The proposal passed. It can now be queued to start the review/opposition window before execution.'}
                    {proposal.state === 'Defeated' && 'The proposal failed. Either quorum was not reached or "Against" votes exceeded "For" votes.'}
                    {proposal.state === 'Executed' && 'The proposal has been executed. All actions specified in the proposal have been carried out.'}
                    {proposal.state === 'Canceled' && 'The proposal was canceled before voting ended.'}
                    {proposal.state === 'Queued' && 'The proposal is in the review/opposition window. This delay allows members to detect and oppose malicious changes before execution.'}
                    {proposal.state === 'Expired' && 'The proposal expired before it could be executed.'}
                  </p>
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <p className="text-gray-400 mb-1 font-semibold">State Codes:</p>
                    <div className="text-gray-300 space-y-0.5 font-mono text-xs">
                      <div>0 = Pending {proposal.state === 'Pending' && "← this is what you're seeing"}</div>
                      <div>1 = Active {proposal.state === 'Active' && "← this is what you're seeing"}</div>
                      <div>2 = Canceled {proposal.state === 'Canceled' && "← this is what you're seeing"}</div>
                      <div>3 = Defeated {proposal.state === 'Defeated' && "← this is what you're seeing"}</div>
                      <div>4 = Succeeded {proposal.state === 'Succeeded' && "← this is what you're seeing"}</div>
                      <div>5 = Queued {proposal.state === 'Queued' && "← this is what you're seeing"}</div>
                      <div>6 = Expired {proposal.state === 'Expired' && "← this is what you're seeing"}</div>
                      <div>7 = Executed {proposal.state === 'Executed' && "← this is what you're seeing"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {isExpanded && <PendingStateNotice proposal={proposal} />}
          <div className="mt-1 mb-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
            <div className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-300 font-semibold mb-2">
              Proposal Description
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {proposal.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Proposer: <a href={`https://eth-sepolia.blockscout.com/address/${proposal.proposer}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-mono" onClick={(e) => e.stopPropagation()}>{formatAddress(proposal.proposer)}</a></span>
            <span>Vote Start: Block {proposal.voteStart.toLocaleString()}</span>
            <span>Vote End: Block {proposal.voteEnd.toLocaleString()}</span>
            {isExpanded && <CurrentBlockInline />}
            <a
              href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.GOVERNOR_PROXY}/logs?topic0=0xc4baf157fa0e6e50f69f54e4abeb1902a7c192153b11f6442c3ea6b2e6211b6a&topic1=${pad(toHex(BigInt(proposal.id)), { size: 32 }).slice(2)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View on Blockscout
            </a>
            {proposal.state === 'Active' && (
              <span className="text-green-600 dark:text-green-400">
                Voting period active
              </span>
            )}
            {proposal.state === 'Succeeded' && proposal.voteAnalysis && (
              <span className="text-blue-600 dark:text-blue-400">
                {proposal.voteAnalysis.reason}
              </span>
            )}
          </div>
        </div>
      </div>

      <VoteCountsWithDirectRead
        proposalId={proposal.id}
        initialVotes={proposal.votes}
        canVote={canVote}
        isActive={proposal.state === 'Active'}
        voteEventBatch={voteEventBatch}
        isExpanded={isExpanded}
      />

      {shouldShowFullTimeline ? (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
          <ProposalTimeline 
            proposal={proposal}
            timelockDelaySeconds={timelockDelaySeconds}
            queuedProposalETA={queuedProposalETA}
            onQueue={onQueue}
            isQueueing={isQueueing}
            isQueueingForProposal={isQueueingForProposal}
            isConnected={isConnected}
            queueHash={queueHash}
            onExecute={onExecute}
            isExecuting={isExecuting}
            isExecutingForProposal={isExecutingForProposal}
            executeHash={executeHash}
            isQueued={isQueued}
            variant="full"
            onToggle={handleToggle}
          />
        </div>
      ) : (
        <div className="mt-3">
          <ProposalTimeline 
            proposal={proposal}
            timelockDelaySeconds={timelockDelaySeconds}
            queuedProposalETA={queuedProposalETA}
            isQueued={isQueued}
            variant="compact"
            onToggle={handleToggle}
          />
        </div>
      )}



      {isExpanded && !canVote && proposal.state === 'Active' && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          Connect your wallet to vote on this proposal. Need help? <Link href="/getting-started" className="underline text-blue-600 dark:text-blue-400">See getting started guide</Link>.
        </div>
      )}

      {isExpanded && proposal.state !== 'Active' && proposal.state !== 'Succeeded' && proposal.state !== 'Queued' && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          This proposal is in "{proposal.state}" state.
        </div>
      )}

    </div>
  );
});

// Component to display vote counts with direct contract read for real-time updates
function VoteCountsWithDirectRead({
  proposalId,
  initialVotes,
  canVote,
  isActive,
  voteEventBatch,
  isExpanded,
}: {
  proposalId: string;
  initialVotes?: { forVotes: string; againstVotes: string; abstainVotes: string };
  canVote: boolean;
  isActive: boolean;
  voteEventBatch: { nonce: number; proposalIds: string[] };
  isExpanded: boolean;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [localVotingProposalId, setLocalVotingProposalId] = useState<string | null>(null);
  const [pendingVoteSupport, setPendingVoteSupport] = useState<number | null>(null);
  
  // Get vote choice from localStorage (set when user votes)
  const getStoredVoteChoice = (proposalId: string): number | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(`vote_${proposalId}`);
    return stored ? parseInt(stored, 10) : null;
  };
  
  const [userVoteChoice, setUserVoteChoice] = useState<number | null>(() => getStoredVoteChoice(proposalId));
  
  // Direct contract read for vote counts - refreshes independently
  const { data: directVoteCounts, refetch: refetchDirectVotes, error: voteCountsError } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'proposalVotes',
    args: [BigInt(proposalId)],
    query: { 
      enabled: true,
      refetchInterval: isActive ? 20000 : false, // Active proposals update less frequently; WS handles real-time updates
      refetchIntervalInBackground: false,
    },
  });

  // Check user's voting power at proposal snapshot
  const { data: proposalSnapshot } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'proposalSnapshot',
    args: [BigInt(proposalId)],
  });

  const {
    data: votingPower,
    refetch: refetchVotingPower,
    isLoading: isVotingPowerQueryLoading,
    error: votingPowerError,
  } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'getVotes',
    args: address && proposalSnapshot ? [address, proposalSnapshot] : undefined,
    query: { enabled: !!address && !!proposalSnapshot && (isExpanded || localVotingProposalId === proposalId) },
  });

  // Check if user has voted - check for all proposal states, not just when voting is shown
  const { data: hasVotedData, refetch: refetchHasVoted } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'hasVoted',
    args: address ? [BigInt(proposalId), address] : undefined,
    query: { enabled: !!address }, // Always check if address is available, regardless of proposal state
  });
  const hasVoted = hasVotedData as boolean | undefined;

  const { writeContract: writeVote, data: voteHash, isPending: isVoting } = useWriteContract();
  const { isLoading: isVoteConfirming, isSuccess: isVoteConfirmed, data: voteReceipt } = useWaitForTransactionReceipt({
    hash: voteHash,
  });

  // Use direct contract read if available, otherwise fall back to initial votes
  const voteCounts = directVoteCounts && Array.isArray(directVoteCounts)
    ? {
        forVotes: (directVoteCounts[1] as bigint)?.toString() || '0',
        againstVotes: (directVoteCounts[0] as bigint)?.toString() || '0',
        abstainVotes: (directVoteCounts[2] as bigint)?.toString() || '0',
      }
    : initialVotes || { forVotes: '0', againstVotes: '0', abstainVotes: '0' };

  // Determine if user can actually vote (has voting power at snapshot)
  const votingPowerKnown = votingPower !== undefined && votingPower !== null && typeof votingPower === 'bigint';
  const hasVotingPower = votingPowerKnown && votingPower > 0n;
  const canActuallyVote = canVote && hasVotingPower;
  const shouldFetchVotingPower = isExpanded || localVotingProposalId === proposalId;
  const isVotingPowerLoading =
    shouldFetchVotingPower &&
    (isVotingPowerQueryLoading ||
      (votingPower === undefined && !!address && proposalSnapshot !== undefined && !votingPowerError));

  // Log vote counts and voting power for debugging
  useEffect(() => {
    if (directVoteCounts && Array.isArray(directVoteCounts)) {
      console.log(`Direct vote counts for proposal ${proposalId}:`, {
        againstVotes: (directVoteCounts[0] as bigint)?.toString(),
        forVotes: (directVoteCounts[1] as bigint)?.toString(),
        abstainVotes: (directVoteCounts[2] as bigint)?.toString(),
      });
    }
    if (voteCountsError) {
      console.error(`Error reading vote counts for proposal ${proposalId}:`, voteCountsError);
    }
    if (votingPower !== undefined) {
      console.log(`Your voting power at proposal snapshot: ${votingPower?.toString() || '0'}`);
      if (votingPower === 0n && address) {
        console.warn('⚠️ You have 0 voting power at the proposal snapshot. This means you either don\'t have a membership NFT, or you minted it after this proposal was created.');
      }
    }
  }, [directVoteCounts, proposalId, voteCountsError, votingPower, address]);

  // Handle vote confirmation and extract vote choice from VoteCast event
  useEffect(() => {
    if (isVoteConfirmed && localVotingProposalId === proposalId && voteReceipt && publicClient) {
      console.log('Vote confirmed, extracting vote choice from events...');
      
      // Try to extract vote choice from VoteCast event
      try {
        const voteCastEvent = voteReceipt.logs.find((log: any) => {
          try {
            const decoded = decodeEventLog({
              abi: DAOGovernor,
              data: log.data,
              topics: log.topics,
            });
            return decoded.eventName === 'VoteCast' && decoded.args && typeof decoded.args === 'object' && 'voter' in decoded.args && (decoded.args as any).voter?.toLowerCase() === address?.toLowerCase();
          } catch {
            return false;
          }
        });

        if (voteCastEvent) {
          const decoded = decodeEventLog({
            abi: DAOGovernor,
            data: voteCastEvent.data,
            topics: voteCastEvent.topics,
          });
          if (decoded.eventName === 'VoteCast' && decoded.args && typeof decoded.args === 'object' && 'support' in decoded.args) {
            const support = Number((decoded.args as any).support);
            setUserVoteChoice(support);
            // Store in localStorage so it persists
            if (typeof window !== 'undefined') {
              localStorage.setItem(`vote_${proposalId}`, support.toString());
            }
            console.log('Extracted vote choice from event:', support);
          }
        }
      } catch (err) {
        console.error('Error extracting vote choice from event:', err);
      }
      
      refetchDirectVotes();
      refetchHasVoted();
      setTimeout(() => {
        refetchDirectVotes();
        refetchHasVoted();
      }, 3000);
      setTimeout(() => {
        refetchDirectVotes();
        refetchHasVoted();
      }, 8000);
    }
  }, [isVoteConfirmed, localVotingProposalId, proposalId, refetchDirectVotes, refetchHasVoted, voteReceipt, publicClient, address]);

  useEffect(() => {
    if (!voteEventBatch.proposalIds.includes(proposalId)) return;
    refetchDirectVotes();
    refetchHasVoted();
  }, [voteEventBatch, proposalId, refetchDirectVotes, refetchHasVoted]);

  useEffect(() => {
    if (address && proposalSnapshot !== undefined && (isExpanded || localVotingProposalId === proposalId)) {
      refetchVotingPower();
      refetchHasVoted();
    }
  }, [address, proposalSnapshot, refetchVotingPower, refetchHasVoted, isExpanded, localVotingProposalId, proposalId]);

  // Load vote choice from localStorage on mount or when proposalId changes
  useEffect(() => {
    if (userVoteChoice === null) {
      const stored = getStoredVoteChoice(proposalId);
      if (stored !== null) {
        setUserVoteChoice(stored);
      }
    }
  }, [proposalId]);

  const handleVote = useCallback(async (support: number) => {
    if (!address) return;
    
    setLocalVotingProposalId(proposalId);
    setUserVoteChoice(support); // Track vote choice immediately
    // Store in localStorage so it persists across page reloads
    if (typeof window !== 'undefined') {
      localStorage.setItem(`vote_${proposalId}`, support.toString());
    }
    try {
      console.log('Casting vote directly:', { proposalId, support, address });
      writeVote({
        address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
        abi: DAOGovernor,
        functionName: 'castVote',
        args: [BigInt(proposalId), support],
      });
    } catch (err: any) {
      console.error('Error casting vote:', err);
      setLocalVotingProposalId(null);
      setUserVoteChoice(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`vote_${proposalId}`);
      }
    }
  }, [address, proposalId, writeVote]);

  const handleVoteWithCheck = useCallback(async (support: number) => {
    if (!address) return;
    if (!votingPowerKnown) {
      setLocalVotingProposalId(proposalId);
      setPendingVoteSupport(support);
      refetchVotingPower();
      refetchHasVoted();
      return;
    }
    if (!hasVotingPower) return;
    handleVote(support);
  }, [address, votingPowerKnown, hasVotingPower, proposalId, refetchVotingPower, refetchHasVoted, handleVote]);

  useEffect(() => {
    if (pendingVoteSupport === null) return;
    if (!votingPowerKnown) return;
    if (votingPowerError) {
      setPendingVoteSupport(null);
      return;
    }
    if (isVoting || isVoteConfirming) return;
    if (hasVotingPower) {
      handleVote(pendingVoteSupport);
    }
    setPendingVoteSupport(null);
  }, [
    pendingVoteSupport,
    votingPowerKnown,
    votingPowerError,
    isVoting,
    isVoteConfirming,
    hasVotingPower,
    handleVote,
  ]);

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-600 dark:text-gray-300">
        <div className="flex gap-4">
          <span className="text-green-600 dark:text-green-400">✓ For: {Number(voteCounts.forVotes).toLocaleString()}</span>
          <span className="text-red-600 dark:text-red-400">✗ Against: {Number(voteCounts.againstVotes).toLocaleString()}</span>
          <span className="text-gray-600 dark:text-gray-400">⊘ Abstain: {Number(voteCounts.abstainVotes).toLocaleString()}</span>
        </div>
      </div>

      {/* Show vote choice if user has voted - display for all proposal states including executed */}
      {hasVoted && address && userVoteChoice !== null ? (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-green-600 dark:text-green-400">
            ✓ You voted{' '}
            {userVoteChoice === 1 ? (
              <span className="font-semibold text-green-700 dark:text-green-300">in favor</span>
            ) : userVoteChoice === 0 ? (
              <span className="font-semibold text-red-700 dark:text-red-300">against</span>
            ) : (
              <span className="font-semibold text-gray-700 dark:text-gray-300">to abstain</span>
            )}{' '}
            of this proposal
          </div>
        </div>
      ) : address ? (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            You have not voted on this proposal.
          </div>
        </div>
      ) : null}

      {/* Cast your vote section - only show for active proposals where user hasn't voted yet */}
      {canVote && !hasVoted && (
        <div>
          {!hasVotingPower && votingPower !== undefined && address ? (
            <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Cannot vote on this proposal:</strong> You don't have voting power at the snapshot block when this proposal was created. 
                {votingPower === 0n && ' This usually means you either don\'t have a membership NFT, or you minted your NFT after this proposal was created.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {shouldFetchVotingPower && isVotingPowerLoading ? (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    ⏳ Checking your voting power...
                  </p>
                </div>
              ) : shouldFetchVotingPower && votingPowerError ? (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs text-red-800 dark:text-red-200">
                    Unable to load voting power right now. Please refresh and try again.
                  </p>
                </div>
              ) : (
                <>
                  {/* Show processing indicator */}
                  {(isVoting || isVoteConfirming) && localVotingProposalId === proposalId && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        {isVoting ? '⏳ Submitting vote transaction...' : '⏳ Waiting for transaction confirmation...'}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVoteWithCheck(1)}
                      disabled={isVoting || isVoteConfirming || !!hasVoted || (votingPowerKnown && !hasVotingPower)}
                      className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {(isVoting || isVoteConfirming) && localVotingProposalId === proposalId ? 'Voting...' : 'Vote For'}
                    </button>
                    <button
                      onClick={() => handleVoteWithCheck(0)}
                      disabled={isVoting || isVoteConfirming || !!hasVoted || (votingPowerKnown && !hasVotingPower)}
                      className="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {(isVoting || isVoteConfirming) && localVotingProposalId === proposalId ? 'Voting...' : 'Vote Against'}
                    </button>
                    <button
                      onClick={() => handleVoteWithCheck(2)}
                      disabled={isVoting || isVoteConfirming || !!hasVoted || (votingPowerKnown && !hasVotingPower)}
                      className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {(isVoting || isVoteConfirming) && localVotingProposalId === proposalId ? 'Voting...' : 'Abstain'}
                    </button>
                  </div>
                  {voteHash && localVotingProposalId === proposalId && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Transaction: <a href={`https://eth-sepolia.blockscout.com/tx/${voteHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{voteHash.substring(0, 10)}...</a>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Component to display queued proposal status with countdown
function QueuedProposalStatus({ proposal, queuedProposalETA, onExecute, isExecuting, isConnected, executeHash }: { 
  proposal: any; 
  queuedProposalETA?: number;
  onExecute: (proposal: any) => void; 
  isExecuting: boolean; 
  isConnected: boolean;
  executeHash?: string;
}) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  
  // Don't show this component if proposal is already executed
  if (proposal.state === 'Executed' || proposal.state === 7) {
    return null;
  }

  useEffect(() => {
    // If no ETA is available, don't show ready state - wait for ETA to be fetched
    const etaSource = queuedProposalETA || proposal.proposalEta;
    if (!etaSource || etaSource === 0) {
      setIsReady(false);
      setTimeRemaining('Calculating...');
      return;
    }

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const eta = typeof etaSource === 'number' ? etaSource : Number(etaSource);
      const remaining = eta - now;

      console.log('Countdown check:', { 
        eta, 
        now, 
        remaining, 
        proposalId: proposal.id || 'unknown',
        isReady: remaining <= 0 
      });

      // Match Execute button timing: show ready once within the 10s buffer
      if (remaining <= 10) { // same buffer as Execute button (now >= eta - 10)
        setIsReady(true);
        setTimeRemaining('Ready to execute');
      } else {
        setIsReady(false);
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        
        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${seconds}s`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [proposal.proposalEta, queuedProposalETA]);

  // Don't show "Ready to Execute" box - message will appear next to Execute button in timeline instead
  if (isReady) {
    return null;
  }

  // If no valid ETA, don't show anything (shouldn't happen for Queued proposals)
  const finalEta = queuedProposalETA || proposal.proposalEta;
  if (!finalEta || finalEta === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <span className="text-2xl">⏳</span>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
            Review & Opposition Window
          </h4>
          <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-2">
            This proposal is in the review/opposition window before execution. This delay gives members time to
            detect and oppose malicious changes (for example by organizing a cancellation proposal) before anything
            takes effect.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-mono font-semibold text-yellow-900 dark:text-yellow-200">
              {timeRemaining}
            </span>
            <span className="text-xs text-yellow-700 dark:text-yellow-300">
              remaining
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component to display proposal timeline
function ProposalTimeline({ 
  proposal, 
  timelockDelaySeconds,
  queuedProposalETA,
  onQueue,
  isQueueing,
  isQueueingForProposal,
  isConnected,
  queueHash,
  onExecute,
  isExecuting,
  isExecutingForProposal,
  executeHash,
  isQueued,
  variant = 'full',
  onToggle
}: { 
  proposal: any; 
  timelockDelaySeconds: bigint | null | undefined;
  queuedProposalETA?: number;
  onQueue?: (proposal: any) => void;
  isQueueing?: boolean;
  isQueueingForProposal?: boolean;
  isConnected?: boolean;
  queueHash?: `0x${string}`;
  onExecute?: (proposal: any) => void;
  isExecuting?: boolean;
  isExecutingForProposal?: boolean;
  executeHash?: `0x${string}`;
  isQueued?: boolean;
  variant?: 'full' | 'compact';
  onToggle?: () => void;
}) {
  const currentBlockNumber = useCurrentBlockNumber();
  // Countdown state for queued proposals
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  
  // Update countdown when proposal is queued
  useEffect(() => {
    const queued = proposal.state === 'Queued' || Boolean(isQueued);
    const eta = queuedProposalETA || proposal.proposalEta;
    
    if (!queued || !eta || eta === 0) {
      setTimeRemaining('');
      setIsReady(false);
      return;
    }

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const etaTimestamp = typeof eta === 'number' ? eta : Number(eta);
      const remaining = etaTimestamp - now;

      if (remaining <= 10) {
        setIsReady(true);
        setTimeRemaining('Ready to execute');
      } else {
        setIsReady(false);
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        
        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${seconds}s`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [queuedProposalETA, proposal.proposalEta, proposal.state, isQueued, proposal.id]);
  const getTimelineSteps = () => {
    const steps: Array<{
      label: string;
      block: bigint | null;
      status: 'completed' | 'current' | 'upcoming';
      description: string;
      quorumMessage?: string;
    }> = [];

    // Step 1: Created
    steps.push({
      label: 'Proposal Created',
      block: proposal.blockNumber,
      status: 'completed',
      description: `Created at block ${proposal.blockNumber.toLocaleString()}`
    });

    // Step 2: Voting Starts (Pending → Active)
    steps.push({
      label: 'Voting Starts',
      block: proposal.voteStart,
      status: proposal.state === 'Pending' ? 'upcoming' : 'completed',
      description: `Voting begins at block ${proposal.voteStart.toLocaleString()}`
    });

    // Step 3: Voting Ends
    steps.push({
      label: 'Voting Ends',
      block: proposal.voteEnd,
      status: proposal.state === 'Active' ? 'current' : 
              ['Succeeded', 'Defeated', 'Queued', 'Executed', 'Canceled', 'Expired'].includes(proposal.state) ? 'completed' : 'upcoming',
      description: `Voting ends at block ${proposal.voteEnd.toLocaleString()}`
    });

    // Step 4: Result (Succeeded/Defeated) - Always show, status depends on current state
    const hasVotingEnded = ['Succeeded', 'Defeated', 'Queued', 'Executed', 'Canceled', 'Expired'].includes(proposal.state);
    const isDefeated = proposal.state === 'Defeated';
    steps.push({
      label: hasVotingEnded 
        ? (proposal.state === 'Succeeded' || proposal.state === 'Queued' || proposal.state === 'Executed' ? 'Proposal Passed' : 'Proposal Defeated')
        : 'Voting Results',
      block: proposal.voteEnd, // Right after voting ends
      status: hasVotingEnded ? 'completed' : 'upcoming',
      description: hasVotingEnded
        ? (proposal.state === 'Succeeded' || proposal.state === 'Queued' || proposal.state === 'Executed'
          ? 'Proposal received enough votes to pass'
          : 'Proposal did not receive enough votes')
        : 'Voting results will be determined after voting ends',
      quorumMessage: isDefeated && proposal.voteAnalysis ? proposal.voteAnalysis.reason : undefined
    });

    // Step 5: Start Review Window - Show for Active/Succeeded/Queued/Executed (only if proposal passed or might pass)
    const queued = proposal.state === 'Queued' || Boolean(isQueued);
    const canProceedToExecution = proposal.state === 'Succeeded' || proposal.state === 'Executed' || proposal.state === 'Active' || queued;
    if (canProceedToExecution) {
      if (queued || proposal.state === 'Executed') {
        steps.push({
          label: 'Review & Opposition Window',
          block: null, // ETA is timestamp-based
          status: queued && proposal.state !== 'Executed' ? 'current' : 'completed',
          description: queuedProposalETA || proposal.proposalEta
            ? `Execution earliest at ${new Date((queuedProposalETA || proposal.proposalEta) * 1000).toLocaleString()}`
            : 'Execution is delayed to allow review and opposition'
        });
      } else if (proposal.state === 'Succeeded') {
        steps.push({
          label: 'Start Review Window',
          block: null,
          status: 'upcoming',
          description: 'Proposal can be queued to start the review/opposition window'
        });
      } else if (proposal.state === 'Active') {
        steps.push({
          label: 'Start Review Window',
          block: null,
          status: 'upcoming',
          description: 'If proposal passes, it can be queued to open the review/opposition window'
        });
      }
    }

    // Step 6: Executed - Show for Active/Succeeded/Queued/Executed (only if proposal passed or might pass)
    if (canProceedToExecution) {
      if (proposal.state === 'Executed') {
        steps.push({
          label: 'Executed',
          block: null,
          status: 'completed',
          description: 'Proposal has been executed successfully'
        });
      } else if (queued) {
        // Show Execute step when queued (even if state hasn't updated yet)
        const eta = queuedProposalETA || proposal.proposalEta;
        steps.push({
          label: 'Execute',
          block: null,
          status: 'upcoming',
          description: eta 
            ? `Can be executed after ${new Date(eta * 1000).toLocaleString()}`
            : 'Can be executed after the review/opposition window ends'
        });
      } else {
        steps.push({
          label: 'Execute',
          block: null,
          status: 'upcoming',
          description: 'If proposal passes and is queued, it can be executed after the review/opposition window'
        });
      }
    }

    return steps;
  };

  const steps = getTimelineSteps();
  const currentBlock = currentBlockNumber || 0n;

  const getBlockInfo = (step: { block: bigint | null }) => {
    if (!step.block || currentBlock === 0n) return '';
    const stepBlock = BigInt(step.block);
    if (currentBlock >= stepBlock) {
      const blocksAgo = currentBlock - stepBlock;
      return `${blocksAgo.toLocaleString()} blocks ago`;
    }
    const blocksRemaining = stepBlock - currentBlock;
    return `${blocksRemaining.toLocaleString()} blocks remaining`;
  };

  if (variant === 'compact') {
    const currentStep = steps.find((step) => step.status === 'current')
      ?? steps.find((step) => step.status === 'upcoming')
      ?? steps[steps.length - 1];
    const currentIndex = currentStep ? steps.indexOf(currentStep) : -1;
    const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : undefined;
    const currentBlockInfo = currentStep ? getBlockInfo(currentStep) : '';
    const nextBlockInfo = nextStep ? getBlockInfo(nextStep) : '';

    return (
      <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
              Voting Timeline
            </span>
          </div>
          {currentStep && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {currentStep.label}
            </span>
          )}
        </div>
        {currentStep && (
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            {currentStep.description}
            {currentBlockInfo && <span className="ml-2">{currentBlockInfo}</span>}
          </div>
        )}
        {nextStep && (
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
            Next: {nextStep.label}
            {nextBlockInfo && <span className="ml-2">{nextBlockInfo}</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-4"
      >
        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span>Proposal Timeline</span>
      </button>
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isCurrent = step.status === 'current';
          const isCompleted = step.status === 'completed';
          const isUpcoming = step.status === 'upcoming';

          // Calculate blocks remaining/elapsed
          let blockInfo = '';
          if (step.block && currentBlock && currentBlock > 0n) {
            const stepBlock = BigInt(step.block);
            if (currentBlock >= stepBlock) {
              const blocksAgo = currentBlock - stepBlock;
              blockInfo = `${blocksAgo.toLocaleString()} blocks ago`;
            } else {
              const blocksRemaining = stepBlock - currentBlock;
              blockInfo = `${blocksRemaining.toLocaleString()} blocks remaining`;
            }
          }

          return (
            <div key={index} className="flex items-start gap-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                  isCompleted ? 'bg-green-500' :
                  isCurrent ? 'bg-blue-500 animate-pulse' :
                  'bg-gray-300 dark:bg-gray-600'
                }`} />
                {!isLast && (
                  <div className={`w-0.5 flex-1 mt-1 ${
                    isCompleted ? 'bg-green-500' :
                    'bg-gray-300 dark:bg-gray-600'
                  }`} style={{ minHeight: '24px' }} />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-sm font-medium ${
                    isCompleted ? 'text-green-700 dark:text-green-300' :
                    isCurrent ? 'text-blue-700 dark:text-blue-300' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                  {/* Show quorum message beside "Proposal Defeated" in timeline */}
                  {step.label === 'Proposal Defeated' && step.quorumMessage && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {step.quorumMessage}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                      Current
                    </span>
                  )}
                  {step.label === 'Proposal Passed' && proposal.state === 'Succeeded' && !isQueued && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-blue-800 dark:text-blue-300">
                        This proposal received enough votes to pass. Use the “Start Review Window” button to begin the review/opposition window before execution.
                      </span>
                    </div>
                  )}
                  {/* Start Review Window button - show next to the "Start Review Window" step when proposal is Succeeded and not already queued */}
                  {step.label === 'Start Review Window' && 
                   proposal.state === 'Succeeded' && 
                   onQueue && 
                   !isQueued && 
                   !isQueueingForProposal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Start Review Window button clicked, calling onQueue with proposal:', proposal);
                        if (onQueue) {
                          onQueue(proposal);
                        } else {
                          console.error('onQueue is not defined');
                        }
                      }}
                      disabled={isQueueing || !isConnected || isQueueingForProposal}
                      className="px-3 py-1 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                    >
                      {isQueueing && isQueueingForProposal ? 'Starting...' : 'Start Review Window'}
                    </button>
                  )}
                  {/* Show scheduled status with countdown when proposal is queued - appears beside "Start Review Window" label */}
                  {step.label === 'Start Review Window' && (proposal.state === 'Queued' || isQueued) && timeRemaining && !isReady && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className="text-2xl">⏳</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                            Review & Opposition Window
                          </h4>
                          <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-2">
                            This proposal is in the review/opposition window before execution. This delay gives members time to
                            detect and oppose malicious changes (for example by organizing a cancellation proposal) before anything
                            takes effect.
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm font-mono font-semibold text-yellow-900 dark:text-yellow-200">
                              {timeRemaining}
                            </span>
                            <span className="text-xs text-yellow-700 dark:text-yellow-300">
                              remaining
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Execute button - show next to the "Execute" step when proposal is Queued and ready */}
                  {step.label === 'Execute' && 
                   (proposal.state === 'Queued' || isQueued) && 
                   onExecute && 
                   (queuedProposalETA || proposal.proposalEta) && (
                    (() => {
                      const eta = queuedProposalETA || proposal.proposalEta;
                      if (!eta) return null;
                      
                      const now = Math.floor(Date.now() / 1000);
                      const etaTimestamp = typeof eta === 'number' ? eta : Number(eta);
                      const isReady = now >= etaTimestamp - 10; // 10 second buffer
                      
                      return isReady ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onExecute(proposal);
                            }}
                            disabled={isExecuting || !isConnected || isExecutingForProposal}
                            className="px-3 py-1 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                          >
                            {isExecuting && isExecutingForProposal ? 'Executing...' : 'Execute'}
                          </button>
                          <span className="text-xs text-green-700 dark:text-green-300 ml-2">
                            The review/opposition window has passed. Use the "Execute" button to finalise/execute this proposal.
                          </span>
                        </>
                      ) : null;
                    })()
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {step.description}
                </p>
                {blockInfo && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                    {blockInfo}
                  </p>
                )}
                {/* Show queue transaction hash if available */}
                {step.label === 'Start Review Window' && queueHash && isQueueingForProposal && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Transaction: <a href={`https://eth-sepolia.blockscout.com/tx/${queueHash}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{queueHash.substring(0, 10)}...</a>
                  </p>
                )}
                {/* Show execute transaction hash if available */}
                {step.label === 'Execute' && executeHash && isExecutingForProposal && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Transaction: <a href={`https://eth-sepolia.blockscout.com/tx/${executeHash}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{executeHash.substring(0, 10)}...</a>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Component to display copyable proposal ID
function CopyableProposalId({ proposalId }: { proposalId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card expansion when clicking copy
    try {
      await navigator.clipboard.writeText(proposalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [proposalId]);

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
        (ID: ...{proposalId.slice(-8)})
      </span>
      <button
        onClick={handleCopy}
        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-1.5 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-blue-300 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600"
        title={copied ? 'Copied!' : 'Copy full proposal ID'}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
