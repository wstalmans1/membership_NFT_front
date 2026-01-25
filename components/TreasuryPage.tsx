'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAccount, useBalance, useReadContract, usePublicClient, useChainId } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { useQuery } from '@tanstack/react-query';
import { CONTRACTS } from '@/config/contracts';
import { Constitution } from '@/abis/Constitution';
import { TreasuryExecutor } from '@/abis/TreasuryExecutor';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { formatEther, parseEther, formatAddress } from '@/lib/utils';
import { encodeFunctionData, Address, decodeEventLog } from 'viem';
import { HelpCircle, ExternalLink, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { BalanceCheck } from './BalanceCheck';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDataContext } from '@/contexts/DataContext';

export function TreasuryPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const router = useRouter();
  const publicClient = usePublicClient();
  const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const PAYOUT_PAGE_SIZE = 10;
  
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
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  
  // Use context for persistent state across page navigation
  const {
    allPayouts,
    setAllPayouts,
    oldestLoadedPayoutBlock: oldestLoadedBlock,
    setOldestLoadedPayoutBlock: setOldestLoadedBlock,
    noMorePayouts,
    setNoMorePayouts,
    hasAutoSearchedPayouts: hasAutoSearched,
    setHasAutoSearchedPayouts: setHasAutoSearched,
    loadedPayoutCount,
    setLoadedPayoutCount,
  } = useDataContext();
  
  // Local state for UI-only concerns
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [searchProgress, setSearchProgress] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState(false);
  const [isPayoutSectionExpanded, setIsPayoutSectionExpanded] = useState(false);

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

  // Check if recipient is allowed
  const { data: isRecipientAllowed } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'isRecipientAllowed',
    args: recipient ? [recipient as Address] : undefined,
    query: { enabled: !!recipient && recipient.length === 42 && recipient.startsWith('0x') && isMember === true },
  });


  // Get transfer count using new on-chain enumerability
  const { data: transferCount } = useReadContract({
    address: CONTRACTS.SEPOLIA.TREASURY_PROXY,
    abi: TreasuryExecutor,
    functionName: 'transferCount',
  });

  // Ensure transferCount is a number
  const transferCountNum = typeof transferCount === 'bigint' ? Number(transferCount) : (typeof transferCount === 'number' ? transferCount : 0);

  // Get recent transfers using new on-chain enumerability (last 50)
  const RECENT_COUNT = 50;
  const { data: recentTransfersData, refetch: refetchLatestPayouts, isLoading: isLoadingPayouts } = useReadContract({
    address: CONTRACTS.SEPOLIA.TREASURY_PROXY,
    abi: TreasuryExecutor,
    functionName: 'getRecentTransfers',
    args: [BigInt(RECENT_COUNT)],
    query: {
      enabled: transferCountNum > 0,
      staleTime: 30_000, // Cache for 30 seconds
    },
  });

  useEffect(() => {
    if (transferCountNum > 0 && loadedPayoutCount === 0) {
      setLoadedPayoutCount(Math.min(PAYOUT_PAGE_SIZE, transferCountNum, RECENT_COUNT));
    }
  }, [transferCountNum, loadedPayoutCount, setLoadedPayoutCount, PAYOUT_PAGE_SIZE, RECENT_COUNT]);

  const effectiveLoadedPayoutCount = useMemo(() => {
    if (transferCountNum === 0) return 0;
    const baseCount = loadedPayoutCount > 0 ? loadedPayoutCount : PAYOUT_PAGE_SIZE;
    return Math.min(baseCount, transferCountNum, RECENT_COUNT);
  }, [loadedPayoutCount, transferCountNum, PAYOUT_PAGE_SIZE, RECENT_COUNT]);

  const payoutEvent = useMemo(
    () => TreasuryExecutor.find((item: any) => item.type === 'event' && item.name === 'PayoutExecuted'),
    []
  );

  const payoutRange = useMemo(() => {
    const transfers = Array.isArray(recentTransfersData)
      ? (recentTransfersData as Array<{ blockNumber: bigint }>)
      : [];
    if (transfers.length === 0) return null;
    let minBlock = transfers[0].blockNumber;
    let maxBlock = transfers[0].blockNumber;
    transfers.forEach((transfer) => {
      const blockNumber = transfer.blockNumber;
      if (blockNumber < minBlock) minBlock = blockNumber;
      if (blockNumber > maxBlock) maxBlock = blockNumber;
    });
    return {
      minBlock,
      maxBlock,
      key: `${minBlock.toString()}-${maxBlock.toString()}-${transfers.length}`,
    };
  }, [recentTransfersData]);

  const { data: payoutLogs } = useQuery({
    queryKey: ['payoutLogs', CONTRACTS.SEPOLIA.TREASURY_PROXY, payoutRange?.key],
    enabled: !!publicClient && !!payoutEvent && !!payoutRange,
    staleTime: 30_000,
    queryFn: async () => {
      if (!publicClient || !payoutEvent || !payoutRange) return [];
      try {
        return await publicClient.getLogs({
          address: CONTRACTS.SEPOLIA.TREASURY_PROXY,
          event: payoutEvent as any,
          fromBlock: payoutRange.minBlock,
          toBlock: payoutRange.maxBlock,
        });
      } catch (error) {
        console.error('Failed to fetch payout logs:', error);
        return [];
      }
    },
  });

  const payoutTxByKey = useMemo(() => {
    if (!Array.isArray(payoutLogs)) return new Map<string, `0x${string}`>();
    const map = new Map<string, `0x${string}`>();
    payoutLogs.forEach((log: any) => {
      try {
        const decoded = decodeEventLog({
          abi: TreasuryExecutor,
          data: log.data,
          topics: log.topics,
        });
        const args = decoded.args as any;
        if (!args) return;
        const key = `${log.blockNumber?.toString?.() ?? ''}-${String(args.to).toLowerCase()}-${args.amount?.toString?.() ?? ''}-${String(args.data).toLowerCase()}`;
        if (log.transactionHash) {
          map.set(key, log.transactionHash as `0x${string}`);
        }
      } catch (err) {
        // ignore decode errors
      }
    });
    return map;
  }, [payoutLogs]);

  // Transform transfers data to match existing format - memoized to prevent infinite loops
  const latestPayouts = useMemo(() => {
    return (Array.isArray(recentTransfersData) ? recentTransfersData : []).map((transfer: any) => ({
      recipient: transfer.to as Address,
      amount: transfer.amount as bigint,
      blockNumber: transfer.blockNumber as bigint,
      timestamp: Number(transfer.timestamp),
      transactionHash: payoutTxByKey.get(
        `${transfer.blockNumber?.toString?.() ?? ''}-${String(transfer.to).toLowerCase()}-${transfer.amount?.toString?.() ?? ''}-${String(transfer.data).toLowerCase()}`
      ) || (ZERO_HASH as `0x${string}`),
    })).sort((a: any, b: any) => Number(b.blockNumber - a.blockNumber));
  }, [recentTransfersData, payoutTxByKey, ZERO_HASH]);

  // Legacy constants for backward compatibility (no longer used)
  const CHUNK_SIZE = 800n;
  const DEPLOYMENT_BLOCK = 9944847n;

  // Removed unused block polling to avoid unnecessary memory/CPU usage

  // Track previous payouts to prevent unnecessary updates
  const prevPayoutsRef = useRef<any[]>([]);
  
  // Update payouts directly from the new on-chain query (no backward search needed)
  useEffect(() => {
    // Only update if the data actually changed (compare length and first/last block numbers)
    const prevLength = prevPayoutsRef.current.length;
    const currentLength = latestPayouts.length;
    const prevFirstBlock = prevPayoutsRef.current[0]?.blockNumber;
    const currentFirstBlock = latestPayouts[0]?.blockNumber;
    const prevFirstHash = prevPayoutsRef.current[0]?.transactionHash;
    const currentFirstHash = latestPayouts[0]?.transactionHash;
    const prevLastHash = prevPayoutsRef.current[prevLength - 1]?.transactionHash;
    const currentLastHash = latestPayouts[currentLength - 1]?.transactionHash;
    
    const payoutsChanged = 
      prevLength !== currentLength || 
      (currentLength > 0 && prevFirstBlock !== currentFirstBlock) ||
      (currentLength > 0 && prevFirstHash !== currentFirstHash) ||
      (currentLength > 0 && prevLastHash !== currentLastHash);
    
    if (payoutsChanged) {
      if (latestPayouts.length > 0) {
        setAllPayouts(latestPayouts);
      } else {
        setAllPayouts([]);
      }
      prevPayoutsRef.current = latestPayouts;
    }
  }, [latestPayouts, setAllPayouts]);

  const handleLoadMorePayouts = () => {
    if (isLoadingOlder || transferCountNum === 0) return;
    setIsLoadingOlder(true);
    setLoadedPayoutCount((prev) => Math.min((prev || PAYOUT_PAGE_SIZE) + PAYOUT_PAGE_SIZE, transferCountNum, RECENT_COUNT));
  };

  useEffect(() => {
    if (!isLoadingOlder) return;
    if (allPayouts.length >= effectiveLoadedPayoutCount) {
      setIsLoadingOlder(false);
    }
  }, [isLoadingOlder, allPayouts.length, effectiveLoadedPayoutCount]);

  // Use payouts directly from the new on-chain query
  const payouts = allPayouts;

  const visiblePayouts = useMemo(() => {
    if (effectiveLoadedPayoutCount <= 0) return [];
    return payouts.slice(0, Math.min(effectiveLoadedPayoutCount, payouts.length));
  }, [payouts, effectiveLoadedPayoutCount]);

  const canLoadMorePayouts = effectiveLoadedPayoutCount < Math.min(transferCountNum, RECENT_COUNT);

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
    <div className="space-y-6 w-full min-w-0 overflow-hidden">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Treasury</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">View <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> treasury balance and spending parameters. Payouts are executed through governance proposals.</p>
      </div>

      {/* Balance Check - Show if connected but low balance */}
      {isConnected && <BalanceCheck />}

      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-teal-600 dark:text-teal-400">
            Connect your Wallet to interact with the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span>. If you haven't set up a wallet yet, visit the <Link href="/getting-started" className="underline text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200">getting started guide</Link>.
          </p>
        </div>
      )}

      {/* Treasury Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 w-full min-w-0">
        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-gray-600 dark:text-gray-400">Treasury Balance</p>
            <div className="relative group" tabIndex={0}>
                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                <div className="absolute bottom-full mb-2 right-0 md:left-0 md:right-auto w-[80vw] sm:w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                  <p className="mb-2 font-semibold">Treasury Balance</p>
                  <p className="text-gray-300">
                    The total amount of Sepolia ETH held by the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> treasury. Funds come from membership donations and can be spent through governance proposals.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {treasuryBalance ? formatEther(BigInt(treasuryBalance.value.toString())) : '...'} Sepolia ETH
            </p>
        </div>
        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-gray-600 dark:text-gray-400">Per-Transaction Cap</p>
            <div className="relative group" tabIndex={0}>
              <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute bottom-full mb-2 right-0 md:left-0 md:right-auto w-[80vw] sm:w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Per-Transaction Cap</p>
                <p className="text-gray-300">
                  The maximum amount of Sepolia ETH that can be spent in a single treasury transaction. This prevents large unauthorized withdrawals.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {perTxCap ? formatEther(BigInt(perTxCap.toString())) : '...'} Sepolia ETH
          </p>
        </div>
        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-gray-600 dark:text-gray-400">Epoch Cap</p>
            <div className="relative group" tabIndex={0}>
              <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
              <div className="absolute bottom-full mb-2 right-0 md:left-0 md:right-auto w-[80vw] sm:w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                <p className="mb-2 font-semibold">Epoch Cap</p>
                <p className="text-gray-300">
                  The maximum total amount of Sepolia ETH that can be spent from the treasury within a single epoch (time period). This provides additional protection against rapid depletion of funds.
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {epochCap ? formatEther(BigInt(epochCap.toString())) : '...'} Sepolia ETH
            </p>
            {epochDuration ? (
              <p className="text-[11px] text-gray-500 mt-0.5">
                Duration: {Number(epochDuration)} seconds
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Execute Treasury Payouts - Collapsible */}
      {isConnected && isCorrectNetwork && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div>
            <button
              onClick={() => setIsPayoutSectionExpanded(!isPayoutSectionExpanded)}
              className="w-full flex items-center gap-2 text-left"
            >
              {isPayoutSectionExpanded ? (
                <ChevronUp className="w-5 h-5 text-blue-900 dark:text-blue-200" />
              ) : (
                <ChevronDown className="w-5 h-5 text-blue-900 dark:text-blue-200" />
              )}
              <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200">
                Execute Treasury Payouts
              </h3>
            </button>
            
            {isPayoutSectionExpanded && (
              <>
                {/* Show membership requirement message if not a member */}
                {isMember === false && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="space-y-3">
                      <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                        You need to be a member to create treasury payout proposals. Please become a member first.
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
                
                <p className="text-blue-800 dark:text-blue-300 mb-2 mt-4">
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
                      <div className="relative group" tabIndex={0}>
                        <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 cursor-help" />
                        <div className="absolute bottom-full mb-2 right-0 md:left-0 md:right-auto w-[80vw] sm:w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
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
                      disabled={isMember === false || (isMember === undefined && isLoadingMembership)}
                      className="w-full px-4 py-2 border border-blue-200 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
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
                      <div className="relative group" tabIndex={0}>
                        <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 cursor-help" />
                        <div className="absolute bottom-full mb-2 right-0 md:left-0 md:right-auto w-[80vw] sm:w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
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
                      disabled={isMember === false || (isMember === undefined && isLoadingMembership)}
                      className="w-full px-4 py-2 border border-blue-200 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800"
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
                    disabled={isMember === false || (isMember === undefined && isLoadingMembership) || !recipient || !amount || isRecipientAllowed === false || (isRecipientAllowed === undefined && recipient.length === 42 && recipient.startsWith('0x'))}
                    className="w-full px-4 py-3 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isMember === false ? 'Membership Required' : (isMember === undefined && isLoadingMembership) ? 'Checking membership...' : 'Create Governance Proposal'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payout History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 w-full min-w-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Payouts</h2>
        {(isLoadingPayouts || (isLoadingOlder && visiblePayouts.length === 0) || (hasAutoSearched && oldestLoadedBlock !== null && visiblePayouts.length === 0 && !isLoadingOlder && publicClient)) ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>{searchProgress || 'Loading payout history...'}</p>
          </div>
        ) : (!isLoadingPayouts && (!hasAutoSearched || (hasAutoSearched && oldestLoadedBlock === null)) && visiblePayouts.length === 0) ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>No payout history available.</p>
            <p className="text-sm mt-2">Payouts will appear here after execution.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visiblePayouts.map((payout, index) => (
              <div
                key={`${payout.blockNumber.toString()}-${payout.recipient}-${payout.amount.toString()}-${index}`}
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
                  href={
                    payout.transactionHash && payout.transactionHash !== ZERO_HASH
                      ? `https://eth-sepolia.blockscout.com/tx/${payout.transactionHash}`
                      : `https://eth-sepolia.blockscout.com/block/${payout.blockNumber.toString()}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  title={
                    payout.transactionHash && payout.transactionHash !== ZERO_HASH
                      ? 'View transaction on Blockscout'
                      : 'View block on Blockscout (tx pending)'
                  }
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
            
            {rateLimitError && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <span className="font-semibold">Rate limit reached:</span> Too many requests were made. Please wait a moment before loading older payouts manually.
                </p>
              </div>
            )}
            
            {canLoadMorePayouts && (
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMorePayouts}
                  disabled={isLoadingOlder}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isLoadingOlder ? 'Loading more...' : `Load ${PAYOUT_PAGE_SIZE} more`}
                </button>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Showing {Math.min(visiblePayouts.length, Math.min(transferCountNum, RECENT_COUNT))} of {Math.min(transferCountNum, RECENT_COUNT)} payouts
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
