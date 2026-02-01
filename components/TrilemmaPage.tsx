'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function TrilemmaPage() {
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 w-full min-w-0 overflow-hidden">
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Blockchain Nation Trilemma</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This page explains, in simple language, why designing a global blockchain nation usually forces tradeoffs
          between sovereignty, scalability, and onboarding experience.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">The Three Goals</h2>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li><span className="font-semibold text-gray-900 dark:text-white">On-chain sovereignty:</span> rules and execution happen automatically on the blockchain.</li>
              <li><span className="font-semibold text-gray-900 dark:text-white">Scalability:</span> the system can grow to massive numbers of members.</li>
              <li><span className="font-semibold text-gray-900 dark:text-white">Easy onboarding:</span> joining and participating works without complex wallets or seed phrases.</li>
            </ul>
          </section>

          <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Why it becomes a trilemma</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              You can optimize for two goals, but the third usually suffers. Fully on-chain systems maximize sovereignty,
              yet cost and complexity make onboarding harder. Off-chain systems scale easily and are friendly to newcomers,
              but lose some automatic on-chain enforcement.
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Think of it as a slider</h2>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white">1) Fully On‑Chain Nation (current model)</p>
                <p><span className="font-semibold">Membership:</span> ERC‑721 on L1/L2 · <span className="font-semibold">Voting:</span> On‑chain Governor · <span className="font-semibold">Execution:</span> On‑chain Timelock</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">Trilemma evaluation</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Blockchain nation:</span> 95% · <span className="font-semibold">Members:</span> 100k–2M · <span className="font-semibold">Wallet reliance:</span> High
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 text-gray-600 dark:text-gray-400">
                  <ul className="space-y-1">
                    <li>✅ Maximum sovereignty</li>
                    <li>✅ Fully autonomous</li>
                    <li>✅ Fully verifiable on‑chain</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>❌ Expensive</li>
                    <li>❌ Scalability limits (state growth)</li>
                    <li>❌ Hard onboarding (wallets, gas)</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white">2) On‑Chain Membership + Off‑Chain Voting (Snapshot)</p>
                <p><span className="font-semibold">Membership:</span> ERC‑721 on‑chain · <span className="font-semibold">Voting:</span> Snapshot signatures · <span className="font-semibold">Execution:</span> On‑chain via executor (multisig/bot)</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">Trilemma evaluation</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Blockchain nation:</span> 60% · <span className="font-semibold">Members:</span> 1M–50M · <span className="font-semibold">Wallet reliance:</span> Medium
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 text-gray-600 dark:text-gray-400">
                  <ul className="space-y-1">
                    <li>✅ Keeps on‑chain identity</li>
                    <li>✅ Voting free + scalable</li>
                    <li>✅ Still verifiable</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>❌ Execution is no longer automatic</li>
                    <li>❌ Still stuck with on‑chain membership state growth</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white">3) On‑Chain Membership + Smart‑Account UX</p>
                <p><span className="font-semibold">Membership:</span> ERC‑721 on‑chain · <span className="font-semibold">Voting:</span> On‑chain or off‑chain · <span className="font-semibold">Execution:</span> On‑chain · <span className="font-semibold">Onboarding:</span> Email/social → smart account</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">Trilemma evaluation</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Blockchain nation:</span> 85% · <span className="font-semibold">Members:</span> 1M–20M · <span className="font-semibold">Wallet reliance:</span> Low
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 text-gray-600 dark:text-gray-400">
                  <ul className="space-y-1">
                    <li>✅ UX dramatically improved</li>
                    <li>✅ Still “on‑chain nation”</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>❌ Doesn’t fix state growth</li>
                    <li>❌ Costs remain (someone pays gas)</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white">4) Off‑Chain Membership + On‑Chain Proofs</p>
                <p><span className="font-semibold">Membership:</span> Off‑chain list (Merkle/ZK) · <span className="font-semibold">Voting:</span> Off‑chain signatures · <span className="font-semibold">Execution:</span> On‑chain via executor · <span className="font-semibold">Onboarding:</span> Email/social</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">Trilemma evaluation</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Blockchain nation:</span> 35% · <span className="font-semibold">Members:</span> 100M–1B+ · <span className="font-semibold">Wallet reliance:</span> Low
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 text-gray-600 dark:text-gray-400">
                  <ul className="space-y-1">
                    <li>✅ Massive scalability</li>
                    <li>✅ Cheap onboarding</li>
                    <li>✅ Cryptographic legitimacy</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>❌ Less autonomous</li>
                    <li>❌ Requires off‑chain coordination/executor</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white">5) Hybrid: Two‑Tier Nation</p>
                <p><span className="font-semibold">Tier 1:</span> On‑chain NFT “citizens” · <span className="font-semibold">Tier 2:</span> Off‑chain members (proof‑based) · <span className="font-semibold">Voting:</span> Weighted or separate chambers · <span className="font-semibold">Execution:</span> On‑chain</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">Trilemma evaluation</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Blockchain nation:</span> 70% · <span className="font-semibold">Members:</span> 10M–500M · <span className="font-semibold">Wallet reliance:</span> Medium
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 text-gray-600 dark:text-gray-400">
                  <ul className="space-y-1">
                    <li>✅ Core sovereignty stays on‑chain</li>
                    <li>✅ Scale through off‑chain tier</li>
                    <li>✅ Path to billions</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>❌ More complex governance</li>
                    <li>❌ Legitimacy debates between tiers</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <p className="font-semibold text-gray-900 dark:text-white">6) Fully Off‑Chain Nation</p>
                <p><span className="font-semibold">Membership:</span> Off‑chain · <span className="font-semibold">Voting:</span> Off‑chain · <span className="font-semibold">Execution:</span> Off‑chain or multisig</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-500">Trilemma evaluation</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Blockchain nation:</span> 20% · <span className="font-semibold">Members:</span> 1B+ · <span className="font-semibold">Wallet reliance:</span> Low
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 text-gray-600 dark:text-gray-400">
                  <ul className="space-y-1">
                    <li>✅ Scales to billions</li>
                    <li>✅ Easy onboarding</li>
                  </ul>
                  <ul className="space-y-1">
                    <li>❌ Minimal blockchain sovereignty</li>
                    <li>❌ Can drift toward centralized governance</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">How to choose</h2>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li><span className="font-semibold text-gray-900 dark:text-white">Sovereignty + legitimacy:</span> stay closer to #1–#3</li>
              <li><span className="font-semibold text-gray-900 dark:text-white">Scale + UX + reach:</span> move toward #4–#6</li>
              <li><span className="font-semibold text-gray-900 dark:text-white">Balance:</span> #5 Hybrid is usually the most realistic long‑term</li>
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Visual map</p>
            <button
              type="button"
              onClick={() => setIsDiagramOpen(true)}
              className="relative w-full aspect-[9/8] bg-gray-900 rounded-md border border-gray-700 overflow-hidden group"
              aria-label="Open trilemma diagram"
            >
              <Image
                src="/trilemma-diagram.svg"
                alt="Blockchain nation trilemma diagram"
                fill
                className="object-contain"
                priority
              />
              <span className="absolute bottom-2 right-2 text-[11px] px-2 py-1 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                Click to enlarge
              </span>
            </button>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              Diagram values are directional, meant for discussion rather than precise measurement.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30 text-sm text-gray-700 dark:text-gray-300">
            <p className="font-semibold text-gray-900 dark:text-white mb-2">Where QAWL is today</p>
            <p>
              We currently lean toward sovereignty by keeping membership and governance on-chain. This maximizes
              autonomy but keeps onboarding and large-scale growth more demanding. The trilemma helps explain why.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
            <p className="font-semibold text-gray-900 dark:text-white mb-2">Related reading</p>
            <ul className="space-y-1">
              <li><Link href="/dao-architecture" className="text-blue-600 dark:text-blue-400 hover:underline">DAO Architecture</Link></li>
              <li><Link href="/philosophy" className="text-blue-600 dark:text-blue-400 hover:underline">Design Philosophy</Link></li>
              <li><Link href="/getting-started" className="text-blue-600 dark:text-blue-400 hover:underline">Getting Started Guide</Link></li>
            </ul>
          </div>
        </aside>
      </div>

      {isDiagramOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Trilemma diagram"
          onClick={() => setIsDiagramOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsDiagramOpen(false)}
              className="absolute top-3 right-3 z-10 text-xs px-2 py-1 rounded bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-600"
              aria-label="Close diagram"
            >
              Close
            </button>
            <div className="relative w-full aspect-[9/8]">
              <Image
                src="/trilemma-diagram.svg"
                alt="Blockchain nation trilemma diagram"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
