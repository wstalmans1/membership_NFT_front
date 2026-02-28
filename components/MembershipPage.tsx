'use client';

import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { usePrivy } from '@privy-io/react-auth';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { useWallets } from '@privy-io/react-auth';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useChainId } from 'wagmi';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { sepolia } from 'wagmi/chains';
import { useQueryClient } from '@tanstack/react-query';
import { formatEther } from '@/lib/utils';
import { CONTRACTS } from '@/config/contracts';
import { MembershipNFT } from '@/abis/MembershipNFT';
import { Constitution } from '@/abis/Constitution';
import { MintMembershipForm } from './MintMembershipForm';
import { UpdateMembershipForm } from './UpdateMembershipForm';
import { NFTMetadata, deleteMetadata, getMetadata } from '@/lib/metadata';
import { NFTDisplay } from './NFTDisplay';
import { HelpCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { BalanceCheck } from './BalanceCheck';
import Link from 'next/link';
import { useFeatures } from '@/hooks/useFeatures';

export function MembershipPage() {
  const features = useFeatures();
  const { authenticated } = usePrivy();
  const { address, isConnected: isLoggedIn } = useWalletAddress();
  const { client: smartWalletClient } = useSmartWallets();
  const { wallets } = useWallets();
  const hasEmbeddedWallet = wallets.some(w => w.walletClientType === 'privy');
  const chainId = useChainId();
  const queryClient = useQueryClient();

  const isCorrectNetwork = chainId === sepolia.id;

  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [nftRefreshKey, setNftRefreshKey] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBurnCleaningUp, setIsBurnCleaningUp] = useState(false);
  const [delegationReturnedNotification, setDelegationReturnedNotification] = useState<string | null>(null);
  const [currentMetadata, setCurrentMetadata] = useState<NFTMetadata | null>(null);
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [hasUserToggledPrivacy, setHasUserToggledPrivacy] = useState(false);
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Delegation state
  const [delegationMode, setDelegationMode] = useState<'self' | 'other'>('self');
  const [delegateToAddress, setDelegateToAddress] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);
  const [showDelegationForm, setShowDelegationForm] = useState(false);
  const [delegationSuccess, setDelegationSuccess] = useState(false);

  // Get membership balance
  const { data: balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Get token ID
  const { data: tokenId, isLoading: isLoadingTokenId, error: tokenIdError, refetch: refetchTokenId } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'tokenOfOwner',
    args: address && balance && Number(balance) > 0 ? [address] : undefined,
    query: { enabled: !!address && !!balance && Number(balance) > 0 },
  });

  const isMember = address && balance !== undefined
    ? Boolean(Number(balance) > 0)
    : undefined;

  // Get min donation
  const { data: minDonation } = useReadContract({
    address: CONTRACTS.SEPOLIA.CONSTITUTION_PROXY,
    abi: Constitution,
    functionName: 'minDonationWei',
    query: { enabled: true },
  });

  // Delegation contract calls
  const { writeContract: writeDelegate, data: delegateHash, isPending: isDelegatePending } = useWriteContract();
  const { isLoading: isDelegateConfirming, isSuccess: isDelegateSuccess } = useWaitForTransactionReceipt({ hash: delegateHash });

  // Burn contract calls
  const { writeContract: writeBurn, data: burnHash, isPending: isBurnPending } = useWriteContract();
  const { isLoading: isBurnConfirming, isSuccess: isBurnSuccess } = useWaitForTransactionReceipt({ hash: burnHash });

  // Current delegation + voting power
  const { data: currentDelegate, refetch: refetchDelegate } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'delegates',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isMember === true },
  });

  const { data: votingPower, refetch: refetchVotingPower } = useReadContract({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isMember === true },
  });

  // Auto-expand/collapse privacy notice based on member status
  useEffect(() => {
    if (!hasUserToggledPrivacy && isMember !== undefined) {
      setIsPrivacyExpanded(!isMember);
    }
  }, [isMember, hasUserToggledPrivacy]);

  // Log tokenId fetch for debugging
  useEffect(() => {
    if (address && balance && Number(balance) > 0) {
      console.log('🔍 TokenId fetch status:', { address, balance: balance.toString(), tokenId: tokenId?.toString(), isLoadingTokenId, error: tokenIdError?.message });
    }
  }, [address, balance, tokenId, isLoadingTokenId, tokenIdError]);

  // Handle delegation success
  useEffect(() => {
    if (isDelegateSuccess) {
      setIsDelegating(false);
      setShowDelegationForm(false);
      setDelegateToAddress('');
      setDelegationSuccess(true);
      refetchDelegate();
      refetchVotingPower();
      setTimeout(() => { setDelegationSuccess(false); setError(null); }, 5000);
    }
  }, [isDelegateSuccess, refetchDelegate, refetchVotingPower]);

  // Watch for DelegationReturned events
  useWatchContractEvent({
    address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
    abi: MembershipNFT,
    eventName: 'DelegationReturned',
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (log.args?.delegator && log.args.delegator.toLowerCase() === address?.toLowerCase()) {
          setDelegationReturnedNotification(
            `Your voting power has been returned because ${log.args.previousDelegate?.substring(0, 6)}...${log.args.previousDelegate?.substring(38)} burned their NFT. Your votes are now delegated to yourself.`
          );
          setTimeout(() => setDelegationReturnedNotification(null), 10000);
          refetchDelegate();
          refetchVotingPower();
        }
      });
    },
  });

  // Handle burn success (MetaMask / external wallet path)
  useEffect(() => {
    if (isBurnSuccess && burnHash) {
      setIsBurnCleaningUp(true);
      if (tokenId && address) {
        deleteMetadata(Number(tokenId), address).catch(err => console.error('Failed to delete metadata after burn:', err));
      }
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setTimeout(() => window.location.reload(), 2000);
    }
  }, [isBurnSuccess, burnHash, tokenId, address]);

  // Handle mint success
  const handleMintSuccess = () => {
    setShowForm(false);
    setError(null);
    queryClient.invalidateQueries();
    setTimeout(async () => {
      await refetchBalance();
      await refetchTokenId();
    }, 2000);
  };

  // ── Delegation overlay phase tracker ─────────────────────────────────────
  // isDelegating stays true for the full smart-wallet call (approval + on-chain
  // confirmation). Auto-advance the message after 7 s so it no longer tells
  // the user to "confirm in Privy" once they already have.
  const isDelegationBusy = isDelegating || isDelegatePending || isDelegateConfirming;
  const [delegationOverlayApproved, setDelegationOverlayApproved] = useState(false);
  useEffect(() => {
    if (!isDelegationBusy) { setDelegationOverlayApproved(false); return; }
    setDelegationOverlayApproved(false);
    const t = setTimeout(() => setDelegationOverlayApproved(true), 7000);
    return () => clearTimeout(t);
  }, [isDelegationBusy]);

  // ── Burn overlay ─────────────────────────────────────────────────────────
  const isBurnBusy = isDeleting || isBurnPending || isBurnConfirming || isBurnCleaningUp;
  const [burnOverlayApproved, setBurnOverlayApproved] = useState(false);
  useEffect(() => {
    if (!isBurnBusy) { setBurnOverlayApproved(false); return; }
    setBurnOverlayApproved(false);
    const t = setTimeout(() => setBurnOverlayApproved(true), 7000);
    return () => clearTimeout(t);
  }, [isBurnBusy]);

  type BurnStep = { label: string; detail: string };
  const burnSteps: BurnStep[] = hasEmbeddedWallet
    ? [
        { label: 'Submitting burn transaction', detail: burnOverlayApproved ? 'Transaction submitted — waiting for blockchain confirmation…' : 'Confirm the transaction in the Privy popup' },
        { label: 'Removing membership record',  detail: 'Cleaning up your membership data' },
      ]
    : [
        { label: 'Approve in wallet',       detail: 'Confirm the transaction in your wallet (MetaMask)' },
        { label: 'Confirming on blockchain', detail: 'Your NFT is being permanently burned' },
        { label: 'Removing membership record', detail: 'Cleaning up your membership data' },
      ];

  const burnActiveStep = hasEmbeddedWallet
    ? isBurnCleaningUp ? 1 : 0
    : isBurnCleaningUp ? 2 : isBurnConfirming ? 1 : 0;

  return (
    <>
    {/* Full-screen overlay during burn */}
    {isBurnBusy && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mx-4 w-full max-w-sm border border-red-200 dark:border-red-800">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full border-4 border-red-200 dark:border-red-900 border-t-red-600 dark:border-t-red-400 animate-spin" />
          </div>
          <h2 className="text-center text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Burning your membership NFT…
          </h2>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
            {burnSteps[burnActiveStep].detail}
          </p>
          <ol className="space-y-3">
            {burnSteps.map((step, i) => {
              const done   = i < burnActiveStep;
              const active = i === burnActiveStep;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${done   ? 'bg-green-500 text-white'
                    : active ? 'bg-red-600 text-white animate-pulse'
                             : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span className={`text-sm transition-colors
                    ${done   ? 'text-green-600 dark:text-green-400 line-through'
                    : active ? 'text-gray-900 dark:text-white font-medium'
                             : 'text-gray-400 dark:text-gray-500'}`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Please do not close this tab
          </p>
        </div>
      </div>
    )}
    {/* Delegation overlay */}
    {(isDelegating || isDelegatePending || isDelegateConfirming) && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mx-4 w-full max-w-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          </div>
          <h2 className="text-center text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Updating your delegation…
          </h2>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
            {hasEmbeddedWallet
              ? delegationOverlayApproved
                ? 'Transaction submitted — waiting for blockchain confirmation…'
                : 'Confirm the transaction in the Privy popup'
              : isDelegateConfirming
                ? 'Transaction submitted — waiting for confirmation'
                : 'Confirm the transaction in your wallet (MetaMask)'}
          </p>
          {!hasEmbeddedWallet && (
            <ol className="space-y-3">
              {[
                { label: 'Approve in wallet',        done: isDelegateConfirming },
                { label: 'Confirming on blockchain', done: false },
              ].map((step, i) => {
                const active = i === 0 ? !isDelegateConfirming : isDelegateConfirming;
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                      ${step.done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}
                    >
                      {step.done ? '✓' : i + 1}
                    </span>
                    <span className={`text-sm transition-colors
                      ${step.done ? 'text-green-600 dark:text-green-400 line-through' : active ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Please do not close this tab
          </p>
        </div>
      </div>
    )}
    <div className="space-y-8 w-full min-w-0 overflow-hidden">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Membership</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Mint and manage your membership NFT</p>
      </div>

      {isLoggedIn && <BalanceCheck />}

      {!isLoggedIn && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <p className="text-teal-600 dark:text-teal-400">
            Login to interact with the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span>.
            {features.showMorePages && (
              <> If you haven&apos;t set up a wallet yet, visit the{' '}
                <Link href="/getting-started" className="underline text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200">getting started guide</Link>.
              </>
            )}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        {(!isLoggedIn || !address) ? null : balance === undefined || isMember === undefined ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Loading membership status...</p>
              </div>
            ) : isMember === true ? (
              tokenId ? (
                <div className="space-y-4">
                  {/* Data Privacy */}
                  {(() => {
                    const privacyExpanded = hasUserToggledPrivacy ? isPrivacyExpanded : (isMember !== undefined ? !isMember : false);
                    return (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <button
                          onClick={() => { setHasUserToggledPrivacy(true); setIsPrivacyExpanded(!privacyExpanded); }}
                          className="w-full flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                        >
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Your Data Privacy</h3>
                            {privacyExpanded
                              ? <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                              : <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />}
                          </div>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${privacyExpanded ? 'max-h-[1000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
                          <div className="ml-11 space-y-2">
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                              <strong>Public visibility:</strong> All information on your membership card (name, photo, date of birth, citizenship, issued date) is publicly visible. It is shown on the Community page alongside other members.
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                              <strong>Your control:</strong> You have full agency to edit or delete your name, date of birth, and photo at any time through this page. Changes take effect immediately.
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                              Your name, photo, date of birth, and citizenship are stored off-chain in a database hosted by{' '}
                              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 dark:hover:text-blue-300">Supabase</a>
                              , together with your wallet address and token ID (so the card can be linked to your membership). Supabase can access all of this. Your wallet address, token ID, and governance records are also stored permanently on-chain and cannot be changed.
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                              <strong>Blockchain vs. database:</strong> Someone viewing only the blockchain cannot link your wallet address to your personal information—that link exists only in the off-chain database.
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                              <strong>Email login:</strong> If you log in via email, your login identity is held by Privy (our authentication provider), who can link it to your wallet address. Privy operates under its own{' '}
                              <a href="https://privy.io/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 dark:hover:text-blue-300">privacy policy</a>.
                              Users who log in with MetaMask are not affected.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* NFT Display with Update/Delete */}
                  <div className="flex flex-col md:flex-row gap-4 md:items-start">
                    <div className="flex-1 min-w-0">
                      <NFTDisplay key={nftRefreshKey} tokenId={Number(tokenId)} ownerAddress={address!} onCardRef={setCardEl} />
                    </div>
                    {!showUpdateForm && !showDeleteConfirm && (
                      <div className="flex flex-col gap-2 md:pt-0 pt-2">
                        <button
                          onClick={async () => {
                            try {
                              const metadata = await getMetadata(Number(tokenId));
                              if (metadata) { setCurrentMetadata(metadata); setShowUpdateForm(true); }
                              else setError('Could not load current metadata');
                            } catch (err: any) { setError(err.message || 'Failed to load metadata'); }
                          }}
                          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 whitespace-nowrap"
                        >
                          Update
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 whitespace-nowrap"
                        >
                          Delete
                        </button>
                        <button
                          onClick={async () => {
                            if (!cardEl) return;
                            setIsDownloading(true);
                            try {
                              const canvas = await html2canvas(cardEl, {
                                scale: 2,
                                useCORS: true,
                                backgroundColor: null,
                                logging: false,
                              });
                              const link = document.createElement('a');
                              link.download = `qawl-membership-${tokenId}.png`;
                              link.href = canvas.toDataURL('image/png');
                              link.click();
                            } catch (err: any) {
                              setError(err.message || 'Failed to download membership card');
                            } finally {
                              setIsDownloading(false);
                            }
                          }}
                          disabled={!cardEl || isDownloading}
                          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDownloading ? 'Preparing…' : 'Download'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Update Form */}
                  {showUpdateForm && currentMetadata && (
                    <div className="mt-4 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Update Membership Information</h3>
                      <UpdateMembershipForm
                        tokenId={Number(tokenId)}
                        ownerAddress={address!}
                        currentMetadata={currentMetadata}
                        onSuccess={(updatedMetadata) => {
                          setCurrentMetadata(updatedMetadata);
                          setShowUpdateForm(false);
                          setNftRefreshKey(k => k + 1);
                        }}
                        onError={(err) => setError(err)}
                        onCancel={() => { setShowUpdateForm(false); setCurrentMetadata(null); }}
                      />
                    </div>
                  )}

                  {/* Voting Power & Delegation */}
                  {features.showVotingPower && <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Voting Power Status</h3>
                      <div className="relative group" tabIndex={0} data-tooltip-anchor>
                        <HelpCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
                        <div data-tooltip className="absolute bottom-full mb-2 left-0 w-[80vw] sm:w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                          <p className="mb-2 font-semibold">Voting Power</p>
                          <p className="text-gray-300">Each membership NFT grants 1 vote, automatically delegated to yourself when you mint. You can change delegation to vote directly or delegate to another address.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Voting Power:</span>
                          <div className="relative group" tabIndex={0} data-tooltip-anchor>
                            <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                            <div data-tooltip className="absolute bottom-full mb-2 left-0 w-[80vw] sm:w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                              <p className="mb-2 font-semibold">Voting Power</p>
                              <p className="text-gray-300">Each <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> member has 1 vote, which can be delegated to yourself or to another address.</p>
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const vp = votingPower ? (typeof votingPower === 'bigint' ? votingPower : BigInt(votingPower.toString())) : 0n;
                          return (
                            <span className={`text-sm font-semibold ${vp > 0n ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                              1 vote
                            </span>
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Delegated to:</span>
                          <div className="relative group" tabIndex={0} data-tooltip-anchor>
                            <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                            <div data-tooltip className="absolute bottom-full mb-2 left-0 w-[80vw] sm:w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                              <p className="mb-2 font-semibold">Delegation</p>
                              <p className="text-gray-300">Determines who can use your voting power. Delegate to yourself to vote directly, or to another address to let them vote on your behalf.</p>
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-mono text-gray-900 dark:text-white break-all">
                          {currentDelegate && typeof currentDelegate === 'string' && currentDelegate !== '0x0000000000000000000000000000000000000000'
                            ? (currentDelegate.toLowerCase() === address?.toLowerCase()
                              ? 'Yourself'
                              : `${currentDelegate.substring(0, 6)}...${currentDelegate.substring(38)}`)
                            : 'Not delegated'}
                        </span>
                      </div>

                      {(() => {
                        return (
                          <>
                            {delegationSuccess && (
                              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                                <p className="text-xs text-green-800 dark:text-green-200">✅ Delegation updated successfully!</p>
                              </div>
                            )}

                            {!showDelegationForm ? (
                              <button
                                onClick={() => {
                                  setShowDelegationForm(true);
                                  const selfDelegated = currentDelegate && typeof currentDelegate === 'string' && currentDelegate.toLowerCase() === address?.toLowerCase();
                                  setDelegationMode(selfDelegated ? 'other' : 'self');
                                  setDelegateToAddress('');
                                }}
                                className="w-full mt-3 px-4 py-2 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors text-sm font-medium"
                              >
                                Change Delegation
                              </button>
                            ) : (
                              <div className="mt-3 p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Change Delegation</h4>
                                <div className="space-y-3">
                                  {(() => {
                                    const selfDelegated = currentDelegate && typeof currentDelegate === 'string' && currentDelegate.toLowerCase() === address?.toLowerCase();
                                    if (selfDelegated) {
                                      return (
                                        <div>
                                          <label htmlFor="delegateToAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Delegate to Address
                                            <div className="relative group inline-block ml-2" tabIndex={0} data-tooltip-anchor>
                                              <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                                              <div data-tooltip className="absolute bottom-full mb-2 left-0 w-[80vw] sm:w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                                                <p className="mb-2 font-semibold">Delegate to Another Address</p>
                                                <p className="text-gray-300">Allow another address to vote on your behalf.</p>
                                              </div>
                                            </div>
                                          </label>
                                          <input
                                            id="delegateToAddress"
                                            type="text"
                                            value={delegateToAddress}
                                            onChange={(e) => setDelegateToAddress(e.target.value)}
                                            placeholder="0x..."
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                                          />
                                          {delegateToAddress && delegateToAddress.length !== 42 && !delegateToAddress.startsWith('0x') && (
                                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Please enter a valid Ethereum address (0x followed by 40 characters)</p>
                                          )}
                                        </div>
                                      );
                                    }
                                    return (
                                      <>
                                        <div>
                                          <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="radio" name="delegation" checked={delegationMode === 'self'} onChange={() => { setDelegationMode('self'); setDelegateToAddress(''); }} className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm text-gray-700 dark:text-gray-300">Delegate to myself</span>
                                              <div className="relative group" tabIndex={0} data-tooltip-anchor>
                                                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                                                <div data-tooltip className="absolute bottom-full mb-2 left-0 w-[80vw] sm:w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                                                  <p className="mb-2 font-semibold">Delegate to Myself</p>
                                                  <p className="text-gray-300">This allows you to vote directly on proposals.</p>
                                                </div>
                                              </div>
                                            </div>
                                          </label>
                                        </div>
                                        <div>
                                          <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="radio" name="delegation" checked={delegationMode === 'other'} onChange={() => setDelegationMode('other')} className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm text-gray-700 dark:text-gray-300">Delegate to another address</span>
                                              <div className="relative group" tabIndex={0} data-tooltip-anchor>
                                                <HelpCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-help" />
                                                <div data-tooltip className="absolute bottom-full mb-2 left-0 w-[80vw] sm:w-64 max-w-[calc(100vw-2rem)] p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10 border border-gray-700">
                                                  <p className="mb-2 font-semibold">Delegate to Another Address</p>
                                                  <p className="text-gray-300">Allow another address to vote on your behalf.</p>
                                                </div>
                                              </div>
                                            </div>
                                          </label>
                                        </div>
                                        {delegationMode === 'other' && (
                                          <div>
                                            <label htmlFor="delegateToAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Delegate Address</label>
                                            <input
                                              id="delegateToAddress"
                                              type="text"
                                              value={delegateToAddress}
                                              onChange={(e) => setDelegateToAddress(e.target.value)}
                                              placeholder="0x..."
                                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                                            />
                                            {delegateToAddress && delegateToAddress.length !== 42 && !delegateToAddress.startsWith('0x') && (
                                              <p className="mt-1 text-xs text-red-600 dark:text-red-400">Please enter a valid Ethereum address</p>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}

                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      onClick={() => { setShowDelegationForm(false); setDelegationMode('self'); setDelegateToAddress(''); }}
                                      className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!address) return;
                                        const selfDelegated = currentDelegate && typeof currentDelegate === 'string' && currentDelegate.toLowerCase() === address?.toLowerCase();
                                        const target = selfDelegated ? delegateToAddress : (delegationMode === 'self' ? address : delegateToAddress);
                                        if (!target || (!selfDelegated && delegationMode === 'other' && !/^0x[a-fA-F0-9]{40}$/.test(target)) || (selfDelegated && !/^0x[a-fA-F0-9]{40}$/.test(target))) {
                                          setError('Please enter a valid Ethereum address');
                                          return;
                                        }
                                        setIsDelegating(true);
                                        setError(null);
                                        try {
                                          if (hasEmbeddedWallet && smartWalletClient) {
                                            await smartWalletClient.writeContract({
                                              address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
                                              abi: MembershipNFT,
                                              functionName: 'delegate',
                                              args: [target as `0x${string}`],
                                              chain: sepolia,
                                              account: smartWalletClient.account as any,
                                            });
                                            // Smart wallet: writeContract resolves after confirmation — update UI directly
                                            setIsDelegating(false);
                                            setShowDelegationForm(false);
                                            setDelegateToAddress('');
                                            setDelegationSuccess(true);
                                            refetchDelegate();
                                            refetchVotingPower();
                                            setTimeout(() => { setDelegationSuccess(false); setError(null); }, 5000);
                                          } else {
                                            writeDelegate({ address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY, abi: MembershipNFT, functionName: 'delegate', args: [target as `0x${string}`] });
                                          }
                                        } catch (err: any) {
                                          setError(err.message || 'Failed to delegate');
                                          setIsDelegating(false);
                                        }
                                      }}
                                      disabled={(() => {
                                        const selfDelegated = currentDelegate && typeof currentDelegate === 'string' && currentDelegate.toLowerCase() === address?.toLowerCase();
                                        if (selfDelegated) return isDelegatePending || isDelegateConfirming || isDelegating || !delegateToAddress || delegateToAddress.length !== 42 || !delegateToAddress.startsWith('0x');
                                        return isDelegatePending || isDelegateConfirming || isDelegating || (delegationMode === 'other' && (!delegateToAddress || delegateToAddress.length !== 42 || !delegateToAddress.startsWith('0x')));
                                      })()}
                                      className="flex-1 px-4 py-2 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                    >
                                      {isDelegatePending || isDelegateConfirming || isDelegating ? 'Processing...' : 'Update Delegation'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>}

                  {features.showVotingPower && delegationReturnedNotification && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-green-900 dark:text-green-200 mb-1">Voting Power Returned</h3>
                          <p className="text-sm text-green-800 dark:text-green-300">{delegationReturnedNotification}</p>
                        </div>
                        <button onClick={() => setDelegationReturnedNotification(null)} className="ml-4 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200">✕</button>
                      </div>
                    </div>
                  )}

                  {/* Delete Confirmation */}
                  {showDeleteConfirm && (
                    <div className="mt-4 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Burn Membership NFT?</h3>
                      <p className="text-red-800 dark:text-red-300 mb-4"><strong>Warning:</strong> This will permanently burn your membership NFT and remove your voting power. This action cannot be undone.</p>
                      <ul className="text-red-800 dark:text-red-300 mb-4 space-y-2 text-sm list-disc list-inside">
                        <li>Your NFT will be permanently destroyed</li>
                        <li>Your voting power will be removed</li>
                        <li>If others delegated to you, their voting power will be automatically returned to them</li>
                        <li>Your membership metadata will be deleted</li>
                        <li>You will be able to mint again after burning</li>
                      </ul>
                      <div className="flex gap-3">
                        <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting || isBurnPending || isBurnConfirming} className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium">Cancel</button>
                        <button
                          onClick={async () => {
                            if (!address || !tokenId) { setError('Missing address or token ID'); return; }
                            setIsDeleting(true);
                            setError(null);
                            try {
                              if (hasEmbeddedWallet && smartWalletClient) {
                                await smartWalletClient.writeContract({
                                  address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY,
                                  abi: MembershipNFT,
                                  functionName: 'burn',
                                  chain: sepolia,
                                  account: smartWalletClient.account as any,
                                });
                                // Transaction confirmed — move to cleanup step then reload
                                setIsBurnCleaningUp(true);
                                await deleteMetadata(Number(tokenId), address).catch(err =>
                                  console.error('Failed to delete metadata after burn:', err)
                                );
                                setShowDeleteConfirm(false);
                                // Keep overlay visible (isDeleting stays true) until page reloads
                                setTimeout(() => window.location.reload(), 2000);
                              } else {
                                writeBurn({ address: CONTRACTS.SEPOLIA.MEMBERSHIP_PROXY, abi: MembershipNFT, functionName: 'burn' });
                              }
                            } catch (err: any) {
                              setError(err.message || 'Failed to initiate burn transaction');
                              setIsDeleting(false);
                            }
                          }}
                          disabled={isDeleting || isBurnPending || isBurnConfirming}
                          className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {isBurnPending ? 'Waiting for MetaMask...' : isBurnConfirming ? 'Burning NFT...' : isDeleting ? 'Processing...' : 'Burn NFT Permanently'}
                        </button>
                      </div>
                      {(isBurnPending || isBurnConfirming) && <p className="mt-3 text-xs text-red-700 dark:text-red-400">Transaction in progress. Please wait...</p>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Loading membership details...</p>
                </div>
              )
            ) : isMember === false && isCorrectNetwork ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-gray-700 dark:text-gray-300">
                    Join the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> by minting a membership NFT.
                    {!hasEmbeddedWallet && (
                      <> Minimum donation: <strong className="text-gray-900 dark:text-white">{minDonation ? formatEther(BigInt(minDonation.toString())) : '...'} Sepolia ETH</strong></>
                    )}
                  </p>
                </div>

                {/* Data Privacy Notice */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <span className="text-lg">🔒</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">Data Privacy Notice</h3>
                      <div className="space-y-2 text-xs text-blue-800 dark:text-blue-300 mb-3">
                        <p>Before minting your membership NFT, please understand:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Personal Information (Off-Chain):</strong> Your name, photo, date of birth, and citizenship information will be stored in an off-chain database hosted by <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 dark:hover:text-blue-300">Supabase</a>, a third-party provider who can access the personal information stored there, including the link between your personal data, your wallet address, and your token ID</li>
                          <li><strong>On-Chain Data (Permanent):</strong> Only your wallet address, token ID, and governance records are stored permanently on the blockchain and cannot be changed</li>
                          <li><strong>What You Can Edit/Delete:</strong> You can edit or delete your name, photo and date of birth at any time through this page</li>
                          <li><strong>What You Cannot Edit/Delete:</strong> Your wallet address, token ID, issued date, and governance records are permanent and cannot be modified</li>
                          <li><strong>Blockchain privacy:</strong> Someone viewing only the blockchain cannot link your wallet address to your personal information—this link exists only in the off-chain database</li>
                          <li><strong>Email / Google login:</strong> If you log in via email or Google, your login identity is held by Privy (our authentication provider), who can link it to your wallet address. Privy operates under its own <a href="https://privy.io/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600 dark:hover:text-blue-300">privacy policy</a>. Users who log in directly with MetaMask are not affected by this.</li>
                        </ul>
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={privacyNoticeAccepted} onChange={(e) => setPrivacyNoticeAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" />
                        <span className="text-sm text-blue-900 dark:text-blue-200">I understand how my data will be stored and used</span>
                      </label>
                    </div>
                  </div>
                </div>

                {!showForm && (
                  <button onClick={() => setShowForm(true)} disabled={!privacyNoticeAccepted} className="w-full px-4 py-3 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-800 dark:disabled:hover:bg-blue-700">
                    Mint Membership
                  </button>
                )}

                {showForm && (
                  <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mint Membership NFT</h3>
                    <MintMembershipForm
                      onSuccess={handleMintSuccess}
                      onError={setError}
                      onCancel={() => { setShowForm(false); setError(null); setPrivacyNoticeAccepted(false); }}
                    />
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
                  </div>
                )}
              </div>
            ) : null}
      </div>
    </div>
    </>
  );
}
