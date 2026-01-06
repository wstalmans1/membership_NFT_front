'use client';

import { useState } from 'react';
import { Download, ExternalLink, CheckCircle } from 'lucide-react';

export function WalletInstallGuide() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Get Started: Install a Wallet
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            To interact with the DAO, you need a crypto wallet. We recommend MetaMask or Brave Wallet.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
        >
          Dismiss
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MetaMask */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <span className="text-xl">🦊</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">MetaMask</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Most popular wallet</p>
            </div>
          </div>
          <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li className="flex items-start gap-2">
              <span className="font-semibold">1.</span>
              <span>Click the button below to visit MetaMask</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">2.</span>
              <span>Click "Download" and choose your browser</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">3.</span>
              <span>Follow the setup instructions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">4.</span>
              <span>Create or import a wallet</span>
            </li>
          </ol>
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Install MetaMask
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Brave Wallet */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <span className="text-xl">🦁</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Brave Wallet</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Built into Brave browser</p>
            </div>
          </div>
          <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 mb-4">
            <li className="flex items-start gap-2">
              <span className="font-semibold">1.</span>
              <span>Download Brave browser if you don't have it</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">2.</span>
              <span>Open Brave and click the wallet icon in the toolbar</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">3.</span>
              <span>Follow the setup instructions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">4.</span>
              <span>Create or import a wallet</span>
            </li>
          </ol>
          <a
            href="https://brave.com/wallet/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Get Brave Browser
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

