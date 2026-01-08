'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CONTRACTS } from '@/config/contracts';
import { DAOGovernor } from '@/abis/DAOGovernor';
import { formatAddress } from '@/lib/utils';
import { Address, encodeFunctionData, parseEther, keccak256, toBytes, stringToBytes, pad, toHex, encodePacked } from 'viem';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { BalanceCheck } from './BalanceCheck';
import { OnboardingChecklist } from './OnboardingChecklist';
import Link from 'next/link';

export function GovernancePage() {
  const { address, isConnected } = useAccount();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [description, setDescription] = useState('');
  const [targets, setTargets] = useState('');
  const [calldatas, setCalldatas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);
  const [isVotingRulesExpanded, setIsVotingRulesExpanded] = useState(false);
  const [queuedProposalIds, setQueuedProposalIds] = useState<Set<string>>(new Set());
  const [queuedProposalETAs, setQueuedProposalETAs] = useState<Map<string, number>>(new Map());

  const { writeContract, data: hash, isPending, isError } = useWriteContract();
  const { writeContract: writeVote, data: voteHash, isPending: isVoting, isError: isVoteError } = useWriteContract();
  const { writeContract: writeQueue, data: queueHash, isPending: isQueueing } = useWriteContract();
  const { writeContract: writeExecute, data: executeHash, isPending: isExecuting } = useWriteContract();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
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

  // Fetch proposals from ProposalCreated events
  const { data: proposals = [], refetch: refetchProposals, isLoading: isLoadingProposals } = useQuery({
    queryKey: ['proposals', CONTRACTS.SEPOLIA.GOVERNOR_PROXY],
    queryFn: async () => {
      if (!publicClient) return [];

      try {
        // Get current block number
        const currentBlockNumber = await publicClient.getBlockNumber();
        
        // RPC providers typically limit to 1000 blocks, so we'll fetch in chunks if needed
        // For now, just fetch the last 1000 blocks to stay within limits
        const maxBlocksToFetch = 1000n;
        const fromBlock = currentBlockNumber > maxBlocksToFetch 
          ? currentBlockNumber - maxBlocksToFetch 
          : 0n;

        console.log('Fetching proposals from block', fromBlock.toString(), 'to', currentBlockNumber.toString(), `(${Number(currentBlockNumber - fromBlock)} blocks)`);

        // Get ProposalCreated events - use ABI directly for automatic decoding
        const logs = await publicClient.getLogs({
          address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
          event: {
            type: 'event',
            name: 'ProposalCreated',
            inputs: DAOGovernor.find((item: any) => item.type === 'event' && item.name === 'ProposalCreated')?.inputs || [],
          } as any,
          fromBlock,
          toBlock: currentBlockNumber,
        });

        console.log('Found proposal logs:', logs.length);
        if (logs.length > 0) {
          console.log('Sample log structure:', {
            address: logs[0].address,
            topics: logs[0].topics,
            blockNumber: logs[0].blockNumber?.toString(),
          });
        }

        // Process logs - they should already be decoded
        const proposalPromises = logs.map(async (log: any) => {
          try {
            // Check if log has args (decoded) or needs decoding
            let proposalId: bigint;
            let proposer: Address;
            let description: string;
            let targets: Address[];
            let values: bigint[];
            let calldatas: `0x${string}`[];
            let voteStart: bigint;
            let voteEnd: bigint;

            if (log.args) {
              // Already decoded
              proposalId = log.args.proposalId as bigint;
              proposer = log.args.proposer as Address;
              description = log.args.description as string;
              targets = log.args.targets as Address[];
              values = log.args.values as bigint[] || [];
              calldatas = log.args.calldatas as `0x${string}`[] || [];
              voteStart = log.args.voteStart as bigint;
              voteEnd = log.args.voteEnd as bigint;
            } else {
              // Need to decode manually
              const { decodeEventLog } = await import('viem');
              const decoded = decodeEventLog({
                abi: DAOGovernor,
                data: log.data,
                topics: log.topics,
              });
              if (!decoded.args || !Array.isArray(decoded.args)) {
                console.error('Decoded log has no args or args is not an array:', decoded);
                return null;
              }
              const args = decoded.args as any;
              proposalId = args.proposalId as bigint;
              proposer = args.proposer as Address;
              description = args.description as string;
              targets = args.targets as Address[];
              values = args.values as bigint[] || [];
              calldatas = args.calldatas as `0x${string}`[] || [];
              voteStart = args.voteStart as bigint;
              voteEnd = args.voteEnd as bigint;
            }
            
            // Map state enum to string (define before use)
            const stateMap: Record<number, string> = {
              0: 'Pending',
              1: 'Active',
              2: 'Canceled',
              3: 'Defeated',
              4: 'Succeeded',
              5: 'Queued',
              6: 'Expired',
              7: 'Executed',
            };

            // User-friendly state labels
            const stateLabels: Record<number, string> = {
              0: '⏳ Waiting to Start',
              1: '🗳️ Voting Open',
              2: '❌ Canceled',
              3: '❌ Defeated',
              4: '✅ Proposal Passed',
              5: '⏳ Scheduled',
              6: '⏰ Expired',
              7: '✅ Executed',
            };

            // Fetch proposal state and vote counts
            const currentBlockForState = await publicClient.getBlockNumber();
            const [state, proposalVotesResult, proposalSnapshot, proposalDeadline] = await Promise.all([
              publicClient.readContract({
                address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
                abi: DAOGovernor,
                functionName: 'state',
                args: [proposalId],
              }),
              publicClient.readContract({
                address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
                abi: DAOGovernor,
                functionName: 'proposalVotes',
                args: [proposalId],
              }).catch(() => null), // If proposalVotes fails, continue without vote counts
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
            ]);

            // Fetch quorum for the proposal snapshot (if snapshot is available)
            let quorumResult: bigint | null = null;
            if (proposalSnapshot) {
              try {
                quorumResult = (await publicClient.readContract({
                  address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
                  abi: DAOGovernor,
                  functionName: 'quorum',
                  args: [proposalSnapshot],
                })) as bigint;
              } catch (err) {
                console.warn('Failed to fetch quorum:', err);
                quorumResult = null;
              }
            }

            // Debug logging for proposal state
            console.log('Proposal state debug:', {
              proposalId: proposalId.toString(),
              state: Number(state),
              stateName: stateMap[Number(state)] || 'Unknown',
              currentBlock: currentBlockForState.toString(),
              voteStart: Number(voteStart),
              voteEnd: Number(voteEnd),
              proposalSnapshot: proposalSnapshot ? Number(proposalSnapshot) : null,
              proposalDeadline: proposalDeadline ? Number(proposalDeadline) : null,
              blocksUntilStart: proposalSnapshot ? Number(proposalSnapshot) - Number(currentBlockForState) : null,
              blocksUntilEnd: proposalDeadline ? Number(proposalDeadline) - Number(currentBlockForState) : null,
            });

            // proposalVotes returns a tuple: [againstVotes, forVotes, abstainVotes]
            const proposalVotes = proposalVotesResult as [bigint, bigint, bigint] | null;
            const quorum = quorumResult as bigint | null;

            // Calculate vote analysis
            let voteAnalysis: { quorumReached: boolean; voteSucceeded: boolean; reason: string } | null = null;
            
            if (proposalVotes && quorum !== null) {
              const againstVotes = proposalVotes[0] || 0n;
              const forVotes = proposalVotes[1] || 0n;
              const abstainVotes = proposalVotes[2] || 0n;
              const totalVotes = forVotes + abstainVotes;
              const quorumReached = totalVotes >= quorum;
              const voteSucceeded = forVotes > againstVotes;
              
              // Determine reason for success/failure
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

            // Debug logging for vote counts and quorum calculation
            console.log(`Proposal ${proposalId.toString()} vote analysis:`, {
              proposalSnapshot: proposalSnapshot?.toString() || 'N/A',
              againstVotes: proposalVotes?.[0]?.toString() || '0',
              forVotes: proposalVotes?.[1]?.toString() || '0',
              abstainVotes: proposalVotes?.[2]?.toString() || '0',
              totalVotesForQuorum: proposalVotes ? (proposalVotes[1] || 0n) + (proposalVotes[2] || 0n) : 0n,
              quorum: quorum?.toString() || 'N/A',
              quorumReached: voteAnalysis?.quorumReached || false,
              voteSucceeded: voteAnalysis?.voteSucceeded || false,
              reason: voteAnalysis?.reason || 'N/A',
            });

            // Fetch proposal ETA if queued
            let proposalEta: bigint | null = null;
            if (Number(state) === 5) { // Queued state
              try {
                proposalEta = (await publicClient.readContract({
                  address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
                  abi: DAOGovernor,
                  functionName: 'proposalEta',
                  args: [proposalId],
                })) as bigint;
              } catch (err) {
                console.warn('Failed to fetch proposal ETA:', err);
              }
            }

            return {
              id: proposalId.toString(), // Use string to avoid BigInt precision issues
              proposalId: proposalId.toString(),
              proposer,
              description,
              targets,
              values: values.map(v => v.toString()),
              calldatas: calldatas as `0x${string}`[],
              voteStart: Number(voteStart),
              voteEnd: Number(voteEnd),
              state: stateMap[Number(state)] || 'Unknown',
              stateLabel: stateLabels[Number(state)] || 'Unknown',
              blockNumber: Number(log.blockNumber),
              proposalEta: proposalEta ? Number(proposalEta) : null,
              votes: proposalVotes ? {
                againstVotes: proposalVotes[0]?.toString() || '0',
                forVotes: proposalVotes[1]?.toString() || '0',
                abstainVotes: proposalVotes[2]?.toString() || '0',
              } : undefined,
              quorum: quorum?.toString() || undefined,
              voteAnalysis,
            };
          } catch (err) {
            console.error('Error decoding proposal event:', err, log);
            return null;
          }
        });

        const proposals = (await Promise.all(proposalPromises)).filter((p): p is NonNullable<typeof p> => p !== null);
        
        console.log('Decoded proposals:', proposals.length);
        
        // Sort by blockNumber (newest first) to ensure correct chronological order
        return proposals.sort((a, b) => b.blockNumber - a.blockNumber);
      } catch (error) {
        console.error('Error fetching proposals:', error);
        return [];
      }
    },
    enabled: !!publicClient,
    refetchInterval: 30000, // Refetch every 30 seconds
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

    try {
      // Parse targets (comma-separated addresses)
      let targetAddresses: Address[] = [];
      let values: bigint[] = [];
      let calldataArray: `0x${string}`[] = [];

      if (targets.trim()) {
        targetAddresses = targets
          .split(',')
          .map((addr) => addr.trim() as Address)
          .filter((addr) => addr.length === 42 && addr.startsWith('0x'));
        
        if (targetAddresses.length === 0) {
          setError('Invalid target addresses. Please provide valid Ethereum addresses separated by commas.');
          return;
        }

        // Parse calldatas (comma-separated hex strings)
        if (calldatas.trim()) {
          calldataArray = calldatas
            .split(',')
            .map((cd) => cd.trim() as `0x${string}`)
            .filter((cd) => cd.startsWith('0x'));
          
          if (calldataArray.length !== targetAddresses.length) {
            setError('Number of calldatas must match number of targets');
            return;
          }
        } else {
          // If no calldatas provided, use empty calldata for each target
          calldataArray = targetAddresses.map(() => '0x' as `0x${string}`);
        }

        // Values array (0 ETH for each target by default)
        values = targetAddresses.map(() => 0n);
      } else {
        // For proposals with only description (no actions), we need at least one dummy target
        // Use the Governor contract itself as a dummy target with empty calldata
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

  // Reset form and show success message, then refresh proposals
  useEffect(() => {
    if (isConfirmed) {
      setSuccess('Proposal submitted successfully! Refreshing proposals...');
      setDescription('');
      setTargets('');
      setCalldatas('');
      
      // Refetch proposals after a short delay to allow block to be mined
      setTimeout(() => {
        refetchProposals();
        setTimeout(() => {
          setShowCreateForm(false);
          setSuccess(null);
        }, 2000);
      }, 2000);
    }
  }, [isConfirmed, refetchProposals]);

  // Handle queue confirmation - calculate ETA when queue is confirmed
  useEffect(() => {
    if (isQueueConfirmed && queueHash && publicClient) {
      // Calculate ETA: current timestamp + timelock delay (3 blocks = ~36 seconds on Sepolia)
      const timelockDelaySeconds = 36; // 3 blocks * 12 seconds per block
      const eta = Math.floor(Date.now() / 1000) + timelockDelaySeconds;
      
      // Update ETA for all queued proposals (we'll refine this when we can identify the specific proposal)
      // For now, update the most recently queued proposal
      setQueuedProposalETAs(prev => {
        const newMap = new Map(prev);
        // Find the proposal that was queued (it should be in queuedProposalIds)
        queuedProposalIds.forEach(proposalId => {
          newMap.set(proposalId, eta);
        });
        return newMap;
      });
      
      setSuccess('Proposal scheduled successfully! It will be ready to execute after the safety delay period.');
      setTimeout(() => {
        refetchProposals();
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      }, 2000);
    }
  }, [isQueueConfirmed, queueHash, publicClient, queuedProposalIds, refetchProposals]);

  // Handle execute confirmation
  useEffect(() => {
    if (isExecuteConfirmed) {
      setSuccess('Proposal executed successfully! All changes have been applied.');
      setTimeout(() => {
        refetchProposals();
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      }, 2000);
    }
  }, [isExecuteConfirmed, refetchProposals]);

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
      queryClient.invalidateQueries({ queryKey: ['proposals', CONTRACTS.SEPOLIA.GOVERNOR_PROXY] });
      
      // Refetch immediately
      console.log('Refetching proposals immediately after vote confirmation...');
      refetchProposals().then((result) => {
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
        queryClient.invalidateQueries({ queryKey: ['proposals', CONTRACTS.SEPOLIA.GOVERNOR_PROXY] });
        refetchProposals().then((result) => {
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
        queryClient.invalidateQueries({ queryKey: ['proposals', CONTRACTS.SEPOLIA.GOVERNOR_PROXY] });
        refetchProposals().then((result) => {
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
  }, [isVoteConfirmed, votingProposalId, refetchProposals, refetchHasVoted, queryClient, voteReceipt]);

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

  const handleQueue = async (proposal: any) => {
    if (!address || !isConnected) {
      setError('Please connect your wallet to queue the proposal');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const targets = proposal.targets as Address[] || [];
      const values = proposal.values ? proposal.values.map((v: string) => BigInt(v)) : targets.map(() => 0n);
      const calldatas = proposal.calldatas as `0x${string}`[] || targets.map(() => '0x' as `0x${string}`);
      const descriptionHash = keccak256(toBytes(proposal.description));

      console.log('Queueing proposal:', { proposalId: proposal.id, targets, values, calldatas, descriptionHash });
      
      // Mark proposal as being queued immediately to prevent button reappearance
      setQueuedProposalIds(prev => new Set(prev).add(proposal.id));
      
      writeQueue({
        address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
        abi: DAOGovernor,
        functionName: 'queue',
        args: [targets, values, calldatas, descriptionHash],
      });
    } catch (err: any) {
      console.error('Error queueing proposal:', err);
      setError(err.message || 'Failed to queue proposal. Please try again.');
      // Remove from queued set if queueing failed
      setQueuedProposalIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(proposal.id);
        return newSet;
      });
    }
  };

  const handleExecute = async (proposal: any) => {
    if (!address || !isConnected) {
      setError('Please connect your wallet to execute the proposal');
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

          if (proposalEta && proposalEta > 0n) {
            const currentBlock = await publicClient.getBlock();
            const currentTimestamp = BigInt(currentBlock.timestamp);
            
            if (proposalEta > currentTimestamp) {
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

      const targets = proposal.targets as Address[] || [];
      const values = proposal.values ? proposal.values.map((v: string) => BigInt(v)) : targets.map(() => 0n);
      const calldatas = proposal.calldatas as `0x${string}`[] || targets.map(() => '0x' as `0x${string}`);
      const descriptionHash = keccak256(toBytes(proposal.description));

      console.log('Executing proposal:', { proposalId: proposal.id, targets, values, calldatas, descriptionHash });
      
      // Use a fixed gas limit instead of estimating (estimation fails when execution would revert)
      // The execution itself will provide a better error message if it fails
      const RPC_GAS_CAP = BigInt(16777216); // RPC node cap
      const SAFE_DEFAULT_GAS = BigInt(15000000); // 15M gas, safe default under cap
      
      // Skip gas estimation - it fails when execution would revert anyway
      // Use a safe default gas limit and let the execution fail with a clear error if needed
      writeExecute({
        address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
        abi: DAOGovernor,
        functionName: 'execute',
        args: [targets, values, calldatas, descriptionHash],
        gas: SAFE_DEFAULT_GAS,
      });
    } catch (err: any) {
      console.error('Error executing proposal:', err);
      setError(err.message || 'Failed to execute proposal. Please try again.');
    }
  };

  // Check if wallet extension is installed
  const hasWalletExtension = typeof window !== 'undefined' && !!(window as any).ethereum;

  return (
    <div className="space-y-8">
      {/* Onboarding Checklist - Show if wallet not fully set up */}
      {hasWalletExtension && <OnboardingChecklist />}

      {/* Balance Check - Show if connected but low balance */}
      {isConnected && <BalanceCheck />}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Governance</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Create proposals and vote on DAO decisions</p>
        </div>
        {isConnected && (
          <button
            onClick={() => {
              if (!isPending && !isConfirming) {
                setShowCreateForm(!showCreateForm);
              }
            }}
            disabled={isPending || isConfirming}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showCreateForm ? 'Cancel' : 'Create Proposal'}
          </button>
        )}
      </div>

      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-xl">🗳️</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
                Connect Your Wallet to Participate in Governance
              </h3>
              <p className="text-blue-800 dark:text-blue-300 mb-4">
                Connect your wallet to create proposals, vote on governance decisions, and help shape the future of the DAO. 
                You'll need a membership NFT to participate. Check the checklist above for setup instructions.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/getting-started"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Getting Started Guide →
                </Link>
                <Link
                  href="/membership"
                  className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-medium"
                >
                  Get Membership NFT →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Governance Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Governance Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                : 'Loading...'}
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
                : 'Loading...'}
            </p>
          </div>
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
                : 'Loading...'}
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

      {/* Create Proposal Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create New Proposal</h2>
          
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={4}
                placeholder="Describe your proposal..."
                required
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Target Contracts (optional, comma-separated addresses)
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                placeholder="0x..., 0x... (leave empty for description-only proposal)"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                If provided, you must also provide matching calldatas below.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Calldata (optional, comma-separated hex-encoded)
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="0x..., 0x... (must match number of targets)"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Number of calldatas must match number of targets.
              </p>
            </div>
            <button
              type="submit"
              disabled={isPending || isConfirming}
              className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? 'Submitting...' : 'Submit Proposal'}
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Proposals</h2>
          <button
            onClick={() => refetchProposals()}
            disabled={isLoadingProposals}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
          >
            {isLoadingProposals ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {isLoadingProposals ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>Loading proposals...</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No proposals yet.</p>
            <p className="text-sm mt-2">Be the first to create a proposal!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal, index) => {
              const isExpanded = expandedProposal === proposal.id;
              const isVoting = votingProposalId === proposal.id;
              const canVote = proposal.state === 'Active' && isConnected;
              const isQueued = proposal.state === 'Queued' || queuedProposalIds.has(proposal.id);
              const isBeingQueued = (isQueueing || isQueueConfirming) && queuedProposalIds.has(proposal.id);

              return (
                <div 
                  key={proposal.id} 
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
                  onClick={() => setExpandedProposal(isExpanded ? null : proposal.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Proposal #{proposals.length - index}</h3>
                        <CopyableProposalId proposalId={proposal.id} />
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            proposal.state === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                            proposal.state === 'Succeeded' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                            proposal.state === 'Defeated' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                            proposal.state === 'Executed' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {proposal.state}
                          </span>
                          <div className="relative group">
                            <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                              <p className="mb-2 font-semibold">Proposal State: {proposal.state}</p>
                              <p className="text-gray-300 mb-3">
                                {proposal.state === 'Pending' && 'Voting has not started yet. Waiting for the voting delay period to pass.'}
                                {proposal.state === 'Active' && 'Voting is currently open. Members can cast their votes now.'}
                                {proposal.state === 'Succeeded' && 'The proposal passed! Quorum was reached and "For" votes exceeded "Against" votes. It can now be queued for execution.'}
                                {proposal.state === 'Defeated' && 'The proposal failed. Either quorum was not reached or "Against" votes exceeded "For" votes.'}
                                {proposal.state === 'Executed' && 'The proposal has been executed. All actions specified in the proposal have been carried out.'}
                                {proposal.state === 'Canceled' && 'The proposal was canceled before voting ended.'}
                                {proposal.state === 'Queued' && 'The proposal is queued for execution after the timelock delay period.'}
                                {proposal.state === 'Expired' && 'The proposal expired before it could be executed.'}
                              </p>
                              <div className="border-t border-gray-700 pt-2 mt-2">
                                <p className="text-gray-400 mb-1 font-semibold">State Codes:</p>
                                <div className="text-gray-300 space-y-0.5 font-mono text-xs">
                                  <div>0 = Pending {proposal.state === 'Pending' && '← this is what you\'re seeing'}</div>
                                  <div>1 = Active {proposal.state === 'Active' && '← this is what you\'re seeing'}</div>
                                  <div>2 = Canceled {proposal.state === 'Canceled' && '← this is what you\'re seeing'}</div>
                                  <div>3 = Defeated {proposal.state === 'Defeated' && '← this is what you\'re seeing'}</div>
                                  <div>4 = Succeeded {proposal.state === 'Succeeded' && '← this is what you\'re seeing'}</div>
                                  <div>5 = Queued {proposal.state === 'Queued' && '← this is what you\'re seeing'}</div>
                                  <div>6 = Expired {proposal.state === 'Expired' && '← this is what you\'re seeing'}</div>
                                  <div>7 = Executed {proposal.state === 'Executed' && '← this is what you\'re seeing'}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-2">{proposal.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Proposer: <a href={`https://eth-sepolia.blockscout.com/address/${proposal.proposer}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-mono" onClick={(e) => e.stopPropagation()}>{formatAddress(proposal.proposer)}</a></span>
                        <span>Vote Start: Block {proposal.voteStart.toLocaleString()}</span>
                        <span>Vote End: Block {proposal.voteEnd.toLocaleString()}</span>
                        {proposal.state === 'Active' && (
                          <span className="text-green-600 dark:text-green-400">
                            Voting period active
                          </span>
                        )}
                        {proposal.state === 'Defeated' && proposal.voteAnalysis && (
                          <span className="text-red-600 dark:text-red-400">
                            {proposal.voteAnalysis.reason}
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

                  {/* Vote counts - Always visible with direct contract read */}
                  <VoteCountsWithDirectRead proposalId={proposal.id} initialVotes={proposal.votes} canVote={canVote} />

                  {/* Schedule Execution button for Succeeded proposals - Hide if queued or being queued */}
                  {proposal.state === 'Succeeded' && !isQueued && !isBeingQueued && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <span className="text-2xl">✅</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                              Proposal Passed!
                            </h4>
                            <p className="text-xs text-blue-800 dark:text-blue-300 mb-3">
                              This proposal received enough votes to pass. Schedule it for execution to apply the changes after a safety delay period. The delay allows the community to intervene and cancel the proposal if malicious on-chain actions are detected before they are executed.
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQueue(proposal);
                                }}
                                disabled={isQueueing || isQueueConfirming || !isConnected}
                                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                              >
                                {isQueueing || isQueueConfirming ? 'Scheduling...' : 'Schedule Execution'}
                              </button>
                              {queueHash && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  Transaction: <a href={`https://eth-sepolia.blockscout.com/tx/${queueHash}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{queueHash.substring(0, 10)}...</a>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show queued status immediately after queueing, before state updates */}
                  {isQueued && proposal.state !== 'Queued' && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                      <QueuedProposalStatus 
                        proposal={{
                          ...proposal,
                          state: 'Queued',
                          proposalEta: queuedProposalETAs.get(proposal.id) || (Math.floor(Date.now() / 1000) + 36)
                        }} 
                        onExecute={handleExecute} 
                        isExecuting={isExecuting || isExecuteConfirming} 
                        isConnected={isConnected} 
                        executeHash={executeHash} 
                      />
                    </div>
                  )}

                  {/* Execute button for Queued proposals - Always visible */}
                  {proposal.state === 'Queued' && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                      <QueuedProposalStatus proposal={proposal} onExecute={handleExecute} isExecuting={isExecuting || isExecuteConfirming} isConnected={isConnected} executeHash={executeHash} />
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

                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <a
                      href={`https://eth-sepolia.blockscout.com/address/${CONTRACTS.SEPOLIA.GOVERNOR_PROXY}/logs?topic0=0xc4baf157fa0e6e50f69f54e4abeb1902a7c192153b11f6442c3ea6b2e6211b6a&topic1=${pad(toHex(BigInt(proposal.id)), { size: 32 }).slice(2)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Blockscout →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Component to display vote counts with direct contract read for real-time updates
function VoteCountsWithDirectRead({ proposalId, initialVotes, canVote }: { proposalId: string; initialVotes?: { forVotes: string; againstVotes: string; abstainVotes: string }; canVote: boolean }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [showVoting, setShowVoting] = useState(false);
  const [localVotingProposalId, setLocalVotingProposalId] = useState<string | null>(null);
  
  // Direct contract read for vote counts - refreshes independently
  const { data: directVoteCounts, refetch: refetchDirectVotes, error: voteCountsError } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'proposalVotes',
    args: [BigInt(proposalId)],
    query: { 
      enabled: true,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  // Check user's voting power at proposal snapshot
  const { data: proposalSnapshot } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'proposalSnapshot',
    args: [BigInt(proposalId)],
  });

  const { data: votingPower } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'getVotes',
    args: address && proposalSnapshot ? [address, proposalSnapshot] : undefined,
    query: { enabled: !!address && !!proposalSnapshot },
  });

  // Check if user has voted
  const { data: hasVotedData, refetch: refetchHasVoted } = useReadContract({
    address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
    abi: DAOGovernor,
    functionName: 'hasVoted',
    args: address ? [BigInt(proposalId), address] : undefined,
    query: { enabled: !!address && showVoting },
  });
  const hasVoted = hasVotedData as boolean | undefined;

  const { writeContract: writeVote, data: voteHash, isPending: isVoting } = useWriteContract();
  const { isLoading: isVoteConfirming, isSuccess: isVoteConfirmed } = useWaitForTransactionReceipt({
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
  const hasVotingPower = votingPower !== undefined && votingPower > 0n;
  const canActuallyVote = canVote && hasVotingPower;

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

  // Handle vote confirmation
  useEffect(() => {
    if (isVoteConfirmed && localVotingProposalId === proposalId) {
      console.log('Vote confirmed, refetching direct vote counts...');
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
      // Keep showVoting true so the success message is displayed
      // setShowVoting(false);
      // Don't clear localVotingProposalId so the success message persists
      // setLocalVotingProposalId(null);
    }
  }, [isVoteConfirmed, localVotingProposalId, proposalId, refetchDirectVotes, refetchHasVoted]);

  const handleVote = async (support: number) => {
    if (!address) return;
    
    setLocalVotingProposalId(proposalId);
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
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-600 dark:text-gray-300">
        <div className="flex gap-4">
          <span className="text-green-600 dark:text-green-400">✓ For: {Number(voteCounts.forVotes).toLocaleString()}</span>
          <span className="text-red-600 dark:text-red-400">✗ Against: {Number(voteCounts.againstVotes).toLocaleString()}</span>
          <span className="text-gray-600 dark:text-gray-400">⊘ Abstain: {Number(voteCounts.abstainVotes).toLocaleString()}</span>
        </div>
      </div>

      {/* Cast your vote section */}
      {canVote && (
        <div>
          {!hasVotingPower && votingPower !== undefined && address ? (
            <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Cannot vote on this proposal:</strong> You don't have voting power at the snapshot block when this proposal was created. 
                {votingPower === 0n && ' This usually means you either don\'t have a membership NFT, or you minted your NFT after this proposal was created.'}
              </p>
            </div>
          ) : (showVoting && hasVoted) || (isVoteConfirmed && localVotingProposalId === proposalId) ? (
            <div className="text-sm text-green-600 dark:text-green-400 mb-2">
              ✓ You have already voted on this proposal
            </div>
          ) : showVoting ? (
            <div className="space-y-2">
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
                  onClick={() => handleVote(1)}
                  disabled={isVoting || isVoteConfirming || hasVoted === true || !hasVotingPower}
                  className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {(isVoting || isVoteConfirming) && localVotingProposalId === proposalId ? 'Voting...' : 'Vote For'}
                </button>
                <button
                  onClick={() => handleVote(0)}
                  disabled={isVoting || isVoteConfirming || hasVoted === true || !hasVotingPower}
                  className="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {(isVoting || isVoteConfirming) && localVotingProposalId === proposalId ? 'Voting...' : 'Vote Against'}
                </button>
                <button
                  onClick={() => handleVote(2)}
                  disabled={isVoting || isVoteConfirming || hasVoted === true || !hasVotingPower}
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
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowVoting(true);
              }}
              disabled={isVoting || isVoteConfirming || (votingPower !== undefined && !hasVotingPower)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cast your vote →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Component to display queued proposal status with countdown
function QueuedProposalStatus({ proposal, onExecute, isExecuting, isConnected, executeHash }: { 
  proposal: any; 
  onExecute: (proposal: any) => void; 
  isExecuting: boolean; 
  isConnected: boolean;
  executeHash?: string;
}) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!proposal.proposalEta) {
      setIsReady(true);
      setTimeRemaining('Ready to execute');
      return;
    }

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const eta = proposal.proposalEta;
      const remaining = eta - now;

      if (remaining <= 0) {
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
  }, [proposal.proposalEta]);

  if (isReady) {
    return (
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <span className="text-2xl">🚀</span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-green-900 dark:text-green-200 mb-1">
              Ready to Execute
            </h4>
            <p className="text-xs text-green-800 dark:text-green-300 mb-3">
              The safety delay period has passed. You can now execute this proposal to apply the changes.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExecute(proposal);
                }}
                disabled={isExecuting || !isConnected}
                className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isExecuting ? 'Executing...' : 'Execute Proposal'}
              </button>
              {executeHash && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Transaction: <a href={`https://eth-sepolia.blockscout.com/tx/${executeHash}`} target="_blank" rel="noopener noreferrer" className="hover:underline" onClick={(e) => e.stopPropagation()}>{executeHash.substring(0, 10)}...</a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <span className="text-2xl">⏳</span>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
            Scheduled for Execution
          </h4>
          <p className="text-xs text-yellow-800 dark:text-yellow-300 mb-2">
            This proposal is scheduled to execute after a safety delay period. This gives members time to review changes before they take effect.
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

// Component to display copyable proposal ID
function CopyableProposalId({ proposalId }: { proposalId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card expansion when clicking copy
    try {
      await navigator.clipboard.writeText(proposalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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

