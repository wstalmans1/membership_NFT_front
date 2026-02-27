'use client';

import { notFound } from 'next/navigation';
import { features } from '@/config/features';
import dynamic from 'next/dynamic';
import { ExtendedOnly } from '@/components/ExtendedOnly';
import { Download, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

const Navbar = dynamic(() => import('@/components/Navbar').then(mod => ({ default: mod.Navbar })), {
  ssr: false,
  loading: () => <div className="h-16 bg-gray-900" />,
});

const SEPOLIA_FAUCETS = [
  { name: 'Alchemy Sepolia Faucet', url: 'https://sepoliafaucet.com/', description: 'Simple and fast, requires Alchemy account' },
  { name: 'Infura Sepolia Faucet', url: 'https://www.infura.io/faucet/sepolia', description: 'Requires Infura account, reliable' },
  { name: 'QuickNode Sepolia Faucet', url: 'https://faucet.quicknode.com/ethereum/sepolia', description: 'Multiple options, may require social login' },
  { name: 'PoW Faucet', url: 'https://sepolia-faucet.pk910.de/', description: 'Proof of Work faucet, no account needed' },
];

const Footer = dynamic(() => import('@/components/Footer').then(mod => ({ default: mod.Footer })), {
  ssr: false,
});

export default function GettingStarted() {
  if (!features.showMorePages) notFound();
  return (
    <ExtendedOnly>
    <div className="min-h-screen bg-gray-900 flex flex-col" suppressHydrationWarning>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full min-w-0 overflow-hidden" suppressHydrationWarning>
        <div className="space-y-8 w-full min-w-0 overflow-hidden">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Getting Started Guide</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Two ways to join the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span>: email (easiest) or wallet (MetaMask, Brave)
            </p>
          </div>

          {/* Option A: Email (simplest) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-green-600 dark:bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                A
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Option A: Login with Email (Easiest)</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              No wallet or crypto required. Gas fees are sponsored.
            </p>
            <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>1. Click <strong>Login</strong> in the top right corner</li>
              <li>2. Choose <strong>Email</strong> and enter your email address</li>
              <li>3. Enter the one-time code we send you</li>
              <li>4. Go to Membership and mint your membership NFT — no Sepolia ETH needed</li>
            </ol>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
              A smart wallet is created for you behind the scenes. You can connect MetaMask or Brave later if you prefer.
            </p>
          </div>

          {/* Option B: Wallet */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-800 dark:bg-blue-700 text-white rounded-full flex items-center justify-center font-bold">
                B
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Option B: Login with a Crypto Wallet</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Use MetaMask or Brave Wallet. You will need Sepolia test ETH for gas (free from faucets).
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">1. Install a Wallet</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🦊</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">MetaMask</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Most popular</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">Download at <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">metamask.io</a>. Create or import a wallet. Save your recovery phrase securely.</p>
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium" suppressHydrationWarning>
                  <Download className="w-4 h-4" /> Install MetaMask <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🦁</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Brave Wallet</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Built into Brave</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">Get Brave at <a href="https://brave.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">brave.com</a>. Open the wallet icon in the toolbar and follow setup.</p>
                <a href="https://brave.com/wallet/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium" suppressHydrationWarning>
                  <Download className="w-4 h-4" /> Get Brave <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">2. Connect Your Wallet</h3>
            <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>1. Click <strong>Login</strong> in the top right corner</li>
              <li>2. Choose <strong>Wallet</strong> (MetaMask or Brave)</li>
              <li>3. Approve the connection in your wallet popup</li>
              <li>4. Your address will appear in the top right when connected</li>
            </ol>
          </div>

          {/* Step 3: Switch to Sepolia (Wallet users only) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-800 dark:bg-blue-700 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Switch to Sepolia Network</h2>
              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">Wallet users only</span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> runs on Sepolia testnet. If you use a wallet (Option B), switch it to Sepolia:
            </p>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    Why Sepolia?
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Sepolia is a test network where transactions are free (you use test ETH, not real ETH). 
                    This allows you to test the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span> without spending real money.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Option 1: Automatic Switch</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  If you see a "Switch to Sepolia" button in the top navigation bar, click it. Your wallet will prompt you to approve the network switch.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Option 2: Manual Switch (MetaMask)</h3>
                <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-4">
                  <li>1. Click the network dropdown at the top of MetaMask (usually shows "Ethereum Mainnet")</li>
                  <li>2. Click "Add Network" or "Show Test Networks"</li>
                  <li>3. Search for "Sepolia" and select it</li>
                  <li>4. If Sepolia isn't listed, add it manually with these details:
                    <ul className="ml-4 mt-2 space-y-1 text-xs">
                      <li>• Network Name: Sepolia</li>
                      <li>• RPC URL: https://rpc.sepolia.org</li>
                      <li>• Chain ID: 11155111</li>
                      <li>• Currency Symbol: ETH</li>
                      <li>• Block Explorer: https://sepolia.etherscan.io</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Option 3: Manual Switch (Brave Wallet)</h3>
                <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-4">
                  <li>1. Click the wallet icon in Brave's toolbar</li>
                  <li>2. Click the network dropdown</li>
                  <li>3. Select "Sepolia" from the list, or add it manually with the same details as above</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Step 4: Get Sepolia ETH (Wallet users only) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-800 dark:bg-blue-700 text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Get Sepolia ETH from a Faucet</h2>
              <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">Wallet users only</span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Wallet users need Sepolia ETH (test ETH, not real) to pay for transactions. Email users (Option A) do not—gas is sponsored. Get free Sepolia ETH from these faucets:
            </p>

            <div className="space-y-3 mb-4">
              {SEPOLIA_FAUCETS.map((faucet) => (
                <div key={faucet.name} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{faucet.name}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{faucet.description}</p>
                    </div>
                    <a
                      href={faucet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 px-4 py-2 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors text-sm font-medium inline-flex items-center gap-2"
                      suppressHydrationWarning
                    >
                      Visit Faucet
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">How to Use a Faucet:</h3>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 ml-4">
                <li>1. Make sure your wallet is connected and on Sepolia network</li>
                <li>2. Copy your wallet address (click the address in the top right, then click "Copy Address")</li>
                <li>3. Visit one of the faucets above</li>
                <li>4. Paste your wallet address into the faucet</li>
                <li>5. Complete any required verification (CAPTCHA, social login, account creation, etc.)</li>
                <li>6. Submit the request</li>
                <li>7. Wait a few minutes for the Sepolia ETH to arrive in your wallet</li>
                <li>8. Check your balance - you should see Sepolia ETH appear</li>
              </ol>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                <strong>Note:</strong> Different faucets have different limits and requirements. If one doesn't work, try another. 
                Some faucets require you to wait 24 hours between requests.
              </p>
            </div>
          </div>

          {/* Step 5: Ready to Go */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-green-600 dark:bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">You're Ready!</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              <strong>Email users:</strong> After Option A you can mint immediately. <strong>Wallet users:</strong> Complete steps 3 and 4 (Sepolia + faucet), then you can:
            </p>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>• Mint your membership NFT</li>
              <li>• Vote on governance proposals</li>
              <li>• Create new proposals</li>
              <li>• View treasury information</li>
            </ul>
            <div className="mt-4">
              <a
                href="/"
                className="inline-block px-6 py-3 bg-blue-800 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-900 dark:hover:bg-blue-800 transition-colors font-medium"
                suppressHydrationWarning
              >
                Go to Dashboard →
              </a>
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Email or wallet—which should I choose?</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Email (Option A):</strong> Fastest way to get started. No wallet, no Sepolia ETH, no faucet. Best if you are new to crypto. — <strong>Wallet (Option B):</strong> Use your own MetaMask or Brave wallet. You control the keys and need Sepolia ETH for gas. Best if you already have a wallet.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Is this safe?</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Yes! You're using test ETH on a test network. No real money is involved. However, always be careful 
                  with your wallet's recovery phrase - never share it with anyone.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Do I need real ETH?</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  No! If you use email login (Option A), you do not need any ETH—gas is sponsored. If you use a wallet (Option B), 
                  you need free Sepolia test ETH from faucets; no real money required.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">What if a faucet doesn't work?</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Try a different faucet. Some have daily limits, require accounts, or may be temporarily unavailable. 
                  The PoW faucet is usually the most reliable if others don't work.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Can I use my mainnet wallet?</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Yes! The same wallet can be used on multiple networks. Just make sure you're on Sepolia network 
                  when interacting with the <span className="font-bold">QAWL</span> <span className="text-sm font-normal">DAO</span>. Your mainnet funds are safe and separate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
    </ExtendedOnly>
  );
}

