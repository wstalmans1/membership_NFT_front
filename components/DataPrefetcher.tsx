'use client';

import { useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CONTRACTS } from '@/config/contracts';
import { TreasuryExecutor } from '@/abis/TreasuryExecutor';
import { DAOGovernor } from '@/abis/DAOGovernor';
import { Address, decodeEventLog } from 'viem';

const CHUNK_SIZE = 800n;
const DEPLOYMENT_BLOCK = 9944847n;
const FIRST_PROPOSAL_BLOCK = 9983760n; // Block number of the first proposal ever created in the QAWL DAO
const MAX_PREFETCH_PAYOUTS = 100;
const MAX_PREFETCH_PROPOSALS = 200;

export function DataPrefetcher() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  // Log when publicClient becomes available
  useEffect(() => {
    if (publicClient) {
      console.log('[DataPrefetcher] PublicClient available, queries should start automatically');
    } else {
      console.log('[DataPrefetcher] Waiting for publicClient...');
    }
  }, [publicClient]);

  // Start loading payouts immediately in the background
  const { data: payoutsData, isLoading: isLoadingPayouts } = useQuery({
    queryKey: ['latestPayouts', CONTRACTS.SEPOLIA.TREASURY_PROXY],
    queryFn: async () => {
      if (!publicClient) {
        console.log('[DataPrefetcher] No publicClient, skipping payouts fetch');
        return [];
      }
      
      console.log('[DataPrefetcher] Starting payouts fetch...');
      
      try {
        const payoutEvent = TreasuryExecutor.find((item: any) => 
          item.type === 'event' && item.name === 'PayoutExecuted'
        );
        
        if (!payoutEvent) return [];

        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > CHUNK_SIZE 
          ? (currentBlock - CHUNK_SIZE > DEPLOYMENT_BLOCK 
              ? currentBlock - CHUNK_SIZE 
              : DEPLOYMENT_BLOCK)
          : DEPLOYMENT_BLOCK;

        let logs: any[] = [];
        let retries = 3;
        
        while (retries > 0) {
          try {
            logs = await publicClient.getLogs({
              address: CONTRACTS.SEPOLIA.TREASURY_PROXY as Address,
              event: payoutEvent as any,
              fromBlock: fromBlock,
              toBlock: currentBlock,
            });
            break;
          } catch (error: any) {
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            }
          }
        }

        if (logs.length === 0) return [];

        const payouts = await Promise.all(
          logs.map(async (log) => {
            try {
              const decoded = decodeEventLog({
                abi: TreasuryExecutor,
                data: log.data,
                topics: log.topics,
              });
              
              const args = decoded.args as any;
              if (!args) return null;
              
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              
              return {
                recipient: args.to as Address,
                amount: args.amount as bigint,
                blockNumber: log.blockNumber,
                timestamp: Number(block.timestamp),
                transactionHash: log.transactionHash,
              };
            } catch (err) {
              return null;
            }
          })
        );

        const result = payouts
          .filter((p): p is NonNullable<typeof payouts[0]> => p !== null)
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, MAX_PREFETCH_PAYOUTS);
        console.log(`[DataPrefetcher] Payouts loaded: ${result.length} payouts`);
        return result;
      } catch (error) {
        console.error('[DataPrefetcher] Error loading payouts:', error);
        return [];
      }
    },
    enabled: !!publicClient, // Start loading as soon as publicClient is available
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: 'always', // Always fetch on mount to ensure data loads
    refetchOnWindowFocus: false,
  });

  // Start loading proposals immediately in the background
  const { data: proposalsData, isLoading: isLoadingProposals } = useQuery({
    queryKey: ['latestProposals', CONTRACTS.SEPOLIA.GOVERNOR_PROXY],
    queryFn: async () => {
      if (!publicClient) {
        console.log('[DataPrefetcher] No publicClient, skipping proposals fetch');
        return [];
      }
      
      console.log('[DataPrefetcher] Starting proposals fetch...');
      
      try {
        const proposalCreatedEvent = DAOGovernor.find((item: any) => 
          item.type === 'event' && item.name === 'ProposalCreated'
        );
        
        if (!proposalCreatedEvent) return [];

        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > CHUNK_SIZE 
          ? (currentBlock - CHUNK_SIZE > FIRST_PROPOSAL_BLOCK 
              ? currentBlock - CHUNK_SIZE 
              : FIRST_PROPOSAL_BLOCK)
          : FIRST_PROPOSAL_BLOCK;

        let logs: any[] = [];
        let retries = 3;
        
        while (retries > 0) {
          try {
            logs = await publicClient.getLogs({
              address: CONTRACTS.SEPOLIA.GOVERNOR_PROXY,
              event: proposalCreatedEvent as any,
              fromBlock: fromBlock,
              toBlock: currentBlock,
            });
            break;
          } catch (error: any) {
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
            }
          }
        }

        if (logs.length === 0) return [];

        const proposals = await Promise.all(
          logs.map(async (log) => {
            try {
              const decoded = decodeEventLog({
                abi: DAOGovernor,
                data: log.data,
                topics: log.topics,
              });
              
              const args = decoded.args as any;
              if (!args) return null;
              
              return {
                id: args.proposalId.toString(),
                proposer: args.proposer as Address,
                targets: args.targets as Address[],
                values: args.values as bigint[],
                calldatas: args.calldatas as string[],
                description: args.description as string,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
              };
            } catch (err) {
              return null;
            }
          })
        );

        const result = proposals
          .filter((p): p is NonNullable<typeof proposals[0]> => p !== null)
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, MAX_PREFETCH_PROPOSALS);
        console.log(`[DataPrefetcher] Proposals loaded: ${result.length} proposals`);
        return result;
      } catch (error) {
        console.error('[DataPrefetcher] Error loading proposals:', error);
        return [];
      }
    },
    enabled: !!publicClient, // Start loading as soon as publicClient is available
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: 'always', // Always fetch on mount to ensure data loads
    refetchOnWindowFocus: false,
  });

  // Log loading status
  useEffect(() => {
    if (publicClient) {
      console.log('[DataPrefetcher] Status:', {
        isLoadingPayouts,
        isLoadingProposals,
        payoutsCount: payoutsData?.length || 0,
        proposalsCount: proposalsData?.length || 0,
      });
    }
  }, [publicClient, isLoadingPayouts, isLoadingProposals, payoutsData, proposalsData]);

  return null; // This component doesn't render anything
}
