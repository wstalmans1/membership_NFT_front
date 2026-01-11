'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTS } from '@/config/contracts';
import { Constitution } from '@/abis/Constitution';
import { TreasuryExecutor } from '@/abis/TreasuryExecutor';
import { formatEther, parseEther, formatAddress } from '@/lib/utils';
import { encodeFunctionData, Address, decodeEventLog } from 'viem';
import { HelpCircle, ExternalLink } from 'lucide-react';
import { BalanceCheck } from './BalanceCheck';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function TreasuryPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  
  // State for pagination and backward search (similar to governance proposals)
  const [allPayouts, setAllPayouts] = useState<any[]>([]);
  const [oldestLoadedBlock, setOldestLoadedBlock] = useState<bigint | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [searchProgress, setSearchProgress] = useState<string | null>(null);
  const [noMorePayouts, setNoMorePayouts] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);
  const [currentBlockNumber, setCurrentBlockNumber] = useState<bigint | null>(null);

  // Get treasury balance
  const { data: treasuryBalance } = useBalance({
    address: CONTRACTS.SEPOLIA.TREASURY_PROXY,
  });

  // Get spend caps
  const { data: perTxCap } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'perTxSpendCapWei',
  });

  const { data: epochCap } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'epochSpendCapWei',
  });

  const { data: epochDuration } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'epochDuration',
  });

  // Check if recipient is allowed
  const { data: isRecipientAllowed } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'isRecipientAllowed',
    args: recipient ? [recipient as Address] : undefined,
    query: { enabled: !!recipient && recipient.length === 42 && recipient.startsWith('0x') },
  });


  // Query recent payouts from PayoutExecuted events
  // Using chunked queries similar to governance proposals to avoid RPC limits
  const publicClient = usePublicClient();
  const CHUNK_SIZE = 800n; // Same as governance page to stay under RPC limits
  const DEPLOYMENT_BLOCK = 9944847n; // From CONTRACT_ADDRESSES.md
  
  const { data: latestPayouts = [], refetch: refetchLatestPayouts, isLoading: isLoadingPayouts } = useQuery({
    queryKey: ['latestPayouts', CONTRACTS.SEPOLIA.TREASURY_PROXY],
    queryFn: async () => {
      if (!publicClient) return [];
      
      try {
        // Find the PayoutExecuted event in the ABI
        const payoutEvent = TreasuryExecutor.find((item: any) => 
          item.type === 'event' && item.name === 'PayoutExecuted'
        );
        
        if (!payoutEvent) {
          console.error('PayoutExecuted event not found in ABI!');
          return [];
        }

        const currentBlock = await publicClient.getBlockNumber();
        
        // Query only the latest chunk to avoid RPC limits
        // Start from deployment block or currentBlock - CHUNK_SIZE, whichever is more recent
        const fromBlock = currentBlock > CHUNK_SIZE 
          ? (currentBlock - CHUNK_SIZE > DEPLOYMENT_BLOCK 
              ? currentBlock - CHUNK_SIZE 
              : DEPLOYMENT_BLOCK)
          : DEPLOYMENT_BLOCK;
        
        console.log('Fetching recent payouts from block', fromBlock.toString(), 'to', currentBlock.toString(), `(${Number(currentBlock - fromBlock)} blocks)`);
        
        // Fetch logs with retry logic (similar to governance proposals)
        let logs: any[] = [];
        let retries = 3;
        let lastError: any = null;
        
        while (retries > 0) {
          try {
            logs = await publicClient.getLogs({
              address: CONTRACTS.SEPOLIA.TREASURY_PROXY as Address,
              event: payoutEvent as any,
              fromBlock: fromBlock,
              toBlock: currentBlock,
            });
            break; // Success, exit retry loop
          } catch (error: any) {
            lastError = error;
            retries--;
            if (retries > 0) {
              // Wait before retrying (exponential backoff)
              const delay = (4 - retries) * 1000; // 1s, 2s, 3s
              console.warn(`RPC request failed, retrying in ${delay}ms... (${retries} retries left)`, {
                message: error?.message,
                code: error?.code,
                name: error?.name,
              });
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (logs.length === 0 && lastError) {
          console.warn('Failed to fetch payout logs after retries:', {
            message: lastError?.message,
            code: lastError?.code,
            name: lastError?.name,
            stack: lastError?.stack,
          });
          // Return empty array instead of throwing - UI will show "No payout history available"
          return [];
        }

        console.log(`Found ${logs.length} payout event(s) in latest ${CHUNK_SIZE.toString()} blocks`);

        // Decode events and sort by block number (newest first)
        const payouts = await Promise.all(
          logs.map(async (log) => {
            try {
              const decoded = decodeEventLog({
                abi: TreasuryExecutor,
                data: log.data,
                topics: log.topics,
              });
              
              const args = decoded.args as any;
              if (!args) {
                throw new Error('Decoded event has no args');
              }
              
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              
              return {
                recipient: args.to as Address,
                amount: args.amount as bigint,
                blockNumber: log.blockNumber,
                timestamp: Number(block.timestamp),
                transactionHash: log.transactionHash,
              };
            } catch (err) {
              console.warn('Failed to decode payout event:', err, log);
              return null;
            }
          })
        );

        // Filter out nulls and sort by block number (newest first)
        return payouts
          .filter((p): p is NonNullable<typeof payouts[0]> => p !== null)
          .sort((a, b) => Number(b.blockNumber - a.blockNumber));
      } catch (err: any) {
        console.error('Error fetching recent payouts:', err);
        console.error('Error details:', {
          message: err?.message,
          code: err?.code,
          name: err?.name,
          stack: err?.stack,
        });
        // Return empty array on error to prevent UI crash
        return [];
      }
    },
    enabled: !!publicClient, // Run even when not connected (for viewing historical payouts)
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get current block number for auto-search
  useEffect(() => {
    if (!publicClient) return;
    
    const fetchBlockNumber = async () => {
      try {
        const block = await publicClient.getBlock({ blockTag: 'latest' });
        setCurrentBlockNumber(block.number);
      } catch (error) {
        console.error('Error fetching current block number:', error);
      }
    };
    
    fetchBlockNumber();
    // Refresh block number periodically
    const interval = setInterval(fetchBlockNumber, 30000);
    return () => clearInterval(interval);
  }, [publicClient]);

  // Merge latest payouts with accumulated older payouts, removing duplicates
  useEffect(() => {
    if (latestPayouts.length > 0) {
      setAllPayouts((prev) => {
        // Create a map of existing payouts by transaction hash for quick lookup
        const existingMap = new Map(prev.map(p => [p.transactionHash, p]));
        
        // Add/update latest payouts (they take precedence)
        latestPayouts.forEach(payout => {
          existingMap.set(payout.transactionHash, payout);
        });
        
        // Convert back to array and sort by block number (newest first)
        return Array.from(existingMap.values()).sort((a, b) => Number(b.blockNumber - a.blockNumber));
      });
      
      // Set oldest loaded block on initial load
      if (oldestLoadedBlock === null && latestPayouts.length > 0) {
        const oldestBlock = Math.min(...latestPayouts.map(p => Number(p.blockNumber)));
        setOldestLoadedBlock(BigInt(oldestBlock));
      }
    } else if (latestPayouts.length === 0 && !isLoadingPayouts && !hasAutoSearched && currentBlockNumber && oldestLoadedBlock === null) {
      // No payouts found in initial query - automatically search backwards
      console.log('No payouts found in initial query, automatically searching backwards...');
      const initialOldestBlock = currentBlockNumber > CHUNK_SIZE 
        ? (currentBlockNumber - CHUNK_SIZE > DEPLOYMENT_BLOCK 
            ? currentBlockNumber - CHUNK_SIZE 
            : DEPLOYMENT_BLOCK)
        : DEPLOYMENT_BLOCK;
      
      setOldestLoadedBlock(initialOldestBlock);
      setHasAutoSearched(true);
    }
  }, [latestPayouts, oldestLoadedBlock, isLoadingPayouts, hasAutoSearched, currentBlockNumber]);

  // Auto-trigger backward search when oldestLoadedBlock is set but no payouts found yet
  useEffect(() => {
    if (oldestLoadedBlock && oldestLoadedBlock > DEPLOYMENT_BLOCK && hasAutoSearched && allPayouts.length === 0 && !isLoadingOlder && publicClient) {
      // Small delay to ensure state is settled, then trigger the existing loadOlderPayouts function
      const timer = setTimeout(() => {
        loadOlderPayouts();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldestLoadedBlock, hasAutoSearched, allPayouts.length, isLoadingOlder, publicClient]);

  // Function to load older payouts (auto-continue until payouts found)
  const loadOlderPayouts = async () => {
    if (!publicClient || !oldestLoadedBlock || oldestLoadedBlock === 0n || isLoadingOlder) return;
    
    setIsLoadingOlder(true);
    setSearchProgress(null);
    
    try {
      // Check if we've reached the deployment block
      if (oldestLoadedBlock <= DEPLOYMENT_BLOCK) {
        setNoMorePayouts(true);
        setSearchProgress('No more payouts available. Reached the deployment block.');
        setTimeout(() => {
          setSearchProgress(null);
        }, 3000);
        setIsLoadingOlder(false);
        return;
      }
      
      const payoutEvent = TreasuryExecutor.find((item: any) => 
        item.type === 'event' && item.name === 'PayoutExecuted'
      );
      if (!payoutEvent) {
        console.error('PayoutExecuted event not found in ABI!');
        setIsLoadingOlder(false);
        return;
      }
      
      let currentOldestBlock = oldestLoadedBlock;
      let totalBlocksChecked = 0n;
      let allFoundPayouts: any[] = [];
      const MAX_CHUNKS_TO_SEARCH = 10; // Limit to prevent infinite loops
      const MIN_PAYOUTS_TO_LOAD = 2; // Load at least 2 payouts before stopping (since user said there are 2)
      let chunksSearched = 0;
      
      // Keep searching chunks until we find at least MIN_PAYOUTS_TO_LOAD payouts or hit limits
      while (chunksSearched < MAX_CHUNKS_TO_SEARCH && currentOldestBlock > DEPLOYMENT_BLOCK && allFoundPayouts.length < MIN_PAYOUTS_TO_LOAD) {
        const newFromBlock = currentOldestBlock > CHUNK_SIZE 
          ? (currentOldestBlock - CHUNK_SIZE > DEPLOYMENT_BLOCK 
              ? currentOldestBlock - CHUNK_SIZE 
              : DEPLOYMENT_BLOCK)
          : DEPLOYMENT_BLOCK;
        const newToBlock = currentOldestBlock - 1n;
        const blocksInChunk = newToBlock - newFromBlock + 1n;
        totalBlocksChecked += blocksInChunk;
        
        // Update search progress
        const payoutsFoundSoFar = allFoundPayouts.length;
        const remainingNeeded = Math.max(0, MIN_PAYOUTS_TO_LOAD - payoutsFoundSoFar);
        setSearchProgress(
          payoutsFoundSoFar > 0
            ? `Found ${payoutsFoundSoFar} payout(s), searching for ${remainingNeeded} more... (checked ${totalBlocksChecked.toLocaleString()} blocks)`
            : `Searching for payouts... (checked ${totalBlocksChecked.toLocaleString()} blocks so far)`
        );
        
        console.log(`Loading older payouts: blocks ${newFromBlock.toString()}-${newToBlock.toString()}`);
        
        try {
          // Fetch logs with retry logic
          let logs: any[] = [];
          let retries = 3;
          let lastError: any = null;
          
          while (retries > 0) {
            try {
              logs = await publicClient.getLogs({
                address: CONTRACTS.SEPOLIA.TREASURY_PROXY as Address,
                event: payoutEvent as any,
                fromBlock: newFromBlock,
                toBlock: newToBlock,
              });
              break; // Success, exit retry loop
            } catch (error: any) {
              lastError = error;
              retries--;
              if (retries > 0) {
                // Wait before retrying (exponential backoff)
                const delay = (4 - retries) * 1000; // 1s, 2s, 3s
                console.warn(`RPC request failed for chunk ${chunksSearched + 1}, retrying in ${delay}ms... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }
          
          if (logs.length === 0 && lastError) {
            console.warn(`Failed to fetch logs for chunk ${chunksSearched + 1} after retries:`, lastError);
            // Continue to next chunk on error
            currentOldestBlock = newFromBlock;
            chunksSearched++;
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          }
          
          console.log(`Found ${logs.length} payout logs in chunk ${chunksSearched + 1}`);
          
          // If we found payouts, process them
          if (logs.length > 0) {
            // Process logs
            const payoutPromises = logs.map(async (log: any) => {
              try {
                const decoded = decodeEventLog({
                  abi: TreasuryExecutor,
                  data: log.data,
                  topics: log.topics,
                });
                
                const args = decoded.args as any;
                if (!args) {
                  throw new Error('Decoded event has no args');
                }
                
                const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                
                return {
                  recipient: args.to as Address,
                  amount: args.amount as bigint,
                  blockNumber: log.blockNumber,
                  timestamp: Number(block.timestamp),
                  transactionHash: log.transactionHash,
                };
              } catch (err) {
                console.error('Error decoding older payout event:', err);
                return null;
              }
            });

            const chunkPayouts = (await Promise.all(payoutPromises)).filter((p): p is NonNullable<typeof p> => p !== null);
            allFoundPayouts.push(...chunkPayouts);
            
            // Update current oldest block to continue searching backwards
            currentOldestBlock = newFromBlock;
            chunksSearched++;
            
            // If we've found enough payouts, stop searching
            if (allFoundPayouts.length >= MIN_PAYOUTS_TO_LOAD) {
              break;
            }
            
            // Add a small delay between chunks to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            // No payouts in this chunk, continue searching
            currentOldestBlock = newFromBlock;
            chunksSearched++;
            
            // Add a small delay between chunks to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (chunkError: any) {
          console.error(`Error fetching chunk ${chunksSearched + 1}:`, chunkError);
          // Continue to next chunk on error
          currentOldestBlock = newFromBlock;
          chunksSearched++;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Merge found payouts with existing payouts
      if (allFoundPayouts.length > 0) {
        setAllPayouts((prev) => {
          const existingMap = new Map(prev.map(p => [p.transactionHash, p]));
          allFoundPayouts.forEach(payout => {
            existingMap.set(payout.transactionHash, payout);
          });
          return Array.from(existingMap.values()).sort((a, b) => Number(b.blockNumber - a.blockNumber));
        });
        
        // Update oldest loaded block to the oldest block we searched
        const oldestFoundBlock = Math.min(...allFoundPayouts.map(p => Number(p.blockNumber)));
        setOldestLoadedBlock(BigInt(oldestFoundBlock));
        
        setSearchProgress(`Found ${allFoundPayouts.length} payout(s) after checking ${totalBlocksChecked.toLocaleString()} blocks`);
      } else {
        // No payouts found after searching multiple chunks
        if (currentOldestBlock <= DEPLOYMENT_BLOCK) {
          setNoMorePayouts(true);
          setSearchProgress(`No more payouts found. Reached the deployment block.`);
        } else {
          setSearchProgress(`No payouts found in ${totalBlocksChecked.toLocaleString()} blocks. Try loading more.`);
        }
        // Still update oldest loaded block so we don't search the same range again
        setOldestLoadedBlock(currentOldestBlock > DEPLOYMENT_BLOCK ? currentOldestBlock : DEPLOYMENT_BLOCK);
      }
      
      // Clear search progress after a delay
      setTimeout(() => {
        setSearchProgress(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error loading older payouts:', error);
      setSearchProgress(`Error: ${error.message || 'Failed to load payouts'}`);
      setTimeout(() => {
        setSearchProgress(null);
      }, 3000);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Use merged payouts for display
  const payouts = allPayouts;

  const handleCreateProposal = () => {
    if (!recipient || !amount) {
      alert('Please fill in both recipient address and amount');
      return;
    }

    // Validate recipient address
    if (recipient.length !== 42 || !recipient.startsWith('0x')) {
      alert('Please enter a valid Ethereum address');
      return;
    }

    // Validate amount
    let amountWei: bigint;
    try {
      amountWei = parseEther(amount);
    } catch (error) {
      alert('Please enter a valid amount');
      return;
    }

    // Check per-transaction cap
    if (perTxCap && amountWei > BigInt(perTxCap.toString())) {
      alert(`Amount exceeds per-transaction cap of ${formatEther(BigInt(perTxCap.toString()))} Sepolia ETH`);
      return;
    }

    // Generate calldata for executePayout(recipient, amount, '0x')
    const calldata = encodeFunctionData({
      abi: TreasuryExecutor,
      functionName: 'executePayout',
      args: [recipient as Address, amountWei, '0x' as `0x${string}`],
    });

    // Store proposal data in localStorage for GovernancePage to pick up
    // Ensure amount is preserved as string to avoid any precision issues
    const amountString = String(amount).trim();
    const proposalDescription = `Treasury Payout Proposal\n\nRecipient: ${recipient}\nAmount: ${amountString} Sepolia ETH\n\nThis proposal will execute a payout from the QAWL DAO treasury to the specified recipient address.`;
    
    const proposalData = {
      targets: CONTRACTS.SEPOLIA.TREASURY_PROXY,
      calldatas: calldata,
      description: proposalDescription,
    };

    console.log('Storing treasury payout proposal:', {
      recipient,
      amount: amountString,
      description: proposalDescription,
    });

    localStorage.setItem('treasuryPayoutProposal', JSON.stringify(proposalData));

    // Navigate to governance page
    router.push('/governance');
  };

  return (
    <div className="space-y-8 w-full min-w-0 overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Treasury</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">View <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> treasury balance and spending parameters. Payouts are executed through governance proposals.</p>
      </div>

      {/* Balance Check - Show if connected but low balance */}
      {isConnected && <BalanceCheck />}

      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <p className="text-teal-600 dark:text-teal-400">
            Connect your Wallet to interact with the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span>. If you haven't set up a wallet yet, visit the <Link href="/getting-started" className="underline text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200">getting started guide</Link>.
          </p>
        </div>
      )}

      {/* Treasury Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full min-w-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Treasury Balance</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Treasury Balance</p>
                <p className="text-gray-300">
                  The total amount of Sepolia ETH held by the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> treasury. Funds come from membership donations and can be spent through governance proposals.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {treasuryBalance ? formatEther(BigInt(treasuryBalance.value.toString())) : '...'} Sepolia ETH
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Per-Transaction Cap</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Per-Transaction Cap</p>
                <p className="text-gray-300">
                  The maximum amount of Sepolia ETH that can be spent in a single treasury transaction. This prevents large unauthorized withdrawals.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {perTxCap ? formatEther(BigInt(perTxCap.toString())) : '...'} Sepolia ETH
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Epoch Cap</h3>
            <div className="relative group">
              <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Epoch Cap</p>
                <p className="text-gray-300">
                  The maximum total amount of Sepolia ETH that can be spent from the treasury within a single epoch (time period). This provides additional protection against rapid depletion of funds.
                </p>
              </div>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {epochCap ? formatEther(BigInt(epochCap.toString())) : '...'} Sepolia ETH
          </p>
          {epochDuration ? (
            <p className="text-xs text-gray-500 mt-1">
              Duration: {Number(epochDuration)} seconds
            </p>
          ) : null}
        </div>
      </div>

      {/* How to Execute Payouts */}
      {isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
              How to Execute Treasury Payouts
            </h3>
              <p className="text-blue-800 dark:text-blue-300 mb-2">
                Treasury payouts are executed through governance proposals. To create a payout-proposal, fill in the fields below and click on the button "Create Governance Proposal".
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                <span className="font-medium">Note:</span> The recipient address must be on the{' '}
                <Link href="/constitution" className="underline hover:text-blue-900 dark:hover:text-blue-200">
                  allowed recipients list
                </Link>
                {' '}managed in the Constitution. Only addresses on this list can receive funds from the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> treasury.
              </p>
              
              <div className="space-y-4 mt-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-200">
                      Recipient Address
                    </label>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                        <p className="mb-2 font-semibold">Recipient Address</p>
                        <p className="text-gray-300">
                          The Ethereum address that will receive the payment. This address must be on the allowed recipients list (managed through governance).
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-2 border border-blue-200 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  />
                  {recipient && (
                    <p className={`mt-1 text-xs ${isRecipientAllowed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isRecipientAllowed === undefined && recipient.length === 42 && recipient.startsWith('0x') 
                        ? 'Checking recipient status...' 
                        : isRecipientAllowed 
                        ? '✓ Recipient is allowed' 
                        : '✗ Recipient is not allowed'}
                    </p>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-200">
                      Amount (Sepolia ETH)
                    </label>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 cursor-help" />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 border border-gray-700">
                        <p className="mb-2 font-semibold">Amount</p>
                        <p className="text-gray-300">
                          The amount of Sepolia ETH to send to the recipient. Must not exceed the per-transaction cap.
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-2 border border-blue-200 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {amount && perTxCap && (() => {
                    try {
                      const amountWei = parseEther(amount);
                      return amountWei > BigInt(perTxCap.toString());
                    } catch {
                      return false;
                    }
                  })() ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Amount exceeds per-transaction cap of {formatEther(BigInt(perTxCap.toString()))} Sepolia ETH
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={handleCreateProposal}
                  disabled={!recipient || !amount || isRecipientAllowed === false || (isRecipientAllowed === undefined && recipient.length === 42 && recipient.startsWith('0x'))}
                  className="w-full px-4 py-3 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Create Governance Proposal
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Payout History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full min-w-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Payouts</h2>
        {(isLoadingPayouts || (isLoadingOlder && payouts.length === 0) || (hasAutoSearched && oldestLoadedBlock !== null && payouts.length === 0 && !isLoadingOlder && publicClient)) ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>{searchProgress || 'Loading payout history...'}</p>
          </div>
        ) : (!isLoadingPayouts && (!hasAutoSearched || (hasAutoSearched && oldestLoadedBlock === null)) && payouts.length === 0) ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No payout history available.</p>
            <p className="text-sm mt-2">Payouts will appear here after execution.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payouts.map((payout, index) => (
              <div
                key={`${payout.transactionHash}-${index}`}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      {formatEther(payout.amount)} ETH
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">→</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-white break-all">
                      {payout.recipient}
                    </code>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>
                      Block: {payout.blockNumber.toString()}
                    </span>
                    <span>
                      {new Date(payout.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
                <a
                  href={`https://eth-sepolia.blockscout.com/tx/${payout.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  title="View transaction on Blockscout"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
            
            {oldestLoadedBlock !== null && oldestLoadedBlock > 0n && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
                <button
                  onClick={loadOlderPayouts}
                  disabled={isLoadingOlder || noMorePayouts}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isLoadingOlder ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      {searchProgress || 'Loading older payouts...'}
                    </>
                  ) : noMorePayouts ? (
                    'No more older payouts'
                  ) : (
                    'Load older payouts'
                  )}
                </button>
                {oldestLoadedBlock > 0n && !searchProgress && !noMorePayouts && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Currently showing payouts from block {oldestLoadedBlock.toLocaleString()} onwards
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

