import { WalletPanel } from './components/wallet/WalletPanel'
import { SwapCard } from './components/swap/SwapCard'
import { useMetaMask } from './hooks/useMetaMask'
import { useUniSat } from './hooks/useUniSat'

export default function App() {
  const metamask = useMetaMask()
  const unisat = useUniSat()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-surface-3/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 9L9 2L16 9L9 16Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="9" cy="9" r="2" fill="white" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Garden <span className="text-gray-500 font-normal">×</span> CowSwap
              </h1>
              <p className="text-[10px] text-gray-600 -mt-0.5">Cross-chain bridge & swap</p>
            </div>
          </div>
          <WalletPanel
            evmAddress={metamask.address}
            evmChainId={metamask.chainId}
            btcAddress={unisat.address}
            isMetaMaskConnected={metamask.isConnected}
            isUniSatConnected={unisat.isConnected}
            onConnectMetaMask={metamask.connect}
            onConnectUniSat={unisat.connect}
            onDisconnectMetaMask={metamask.disconnect}
            onDisconnectUniSat={unisat.disconnect}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center pt-12 pb-20 px-4">
        <SwapCard
          evmAddress={metamask.address}
          btcAddress={unisat.address}
          evmChainId={metamask.chainId}
          isMetaMaskConnected={metamask.isConnected}
          isUniSatConnected={unisat.isConnected}
          onConnectMetaMask={metamask.connect}
          onConnectUniSat={unisat.connect}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-3/50 py-4">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-gray-600">
          <span>Testnet only</span>
          <div className="flex items-center gap-4">
            <a
              href="https://docs.garden.finance"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors"
            >
              Garden Docs
            </a>
            <a
              href="https://docs.cow.fi"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors"
            >
              CowSwap Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
