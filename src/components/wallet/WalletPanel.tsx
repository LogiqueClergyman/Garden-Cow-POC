import { shortenAddress } from '../../utils/format'

interface WalletPanelProps {
  evmAddress: string | null
  evmChainId: number | null
  btcAddress: string | null
  isMetaMaskConnected: boolean
  isUniSatConnected: boolean
  onConnectMetaMask: () => void
  onConnectUniSat: () => void
  onDisconnectMetaMask: () => void
  onDisconnectUniSat: () => void
}

export function WalletPanel({
  evmAddress,
  btcAddress,
  isMetaMaskConnected,
  isUniSatConnected,
  onConnectMetaMask,
  onConnectUniSat,
  onDisconnectMetaMask,
  onDisconnectUniSat,
}: WalletPanelProps) {
  return (
    <div className="flex items-center gap-2">
      {/* MetaMask */}
      {isMetaMaskConnected && evmAddress ? (
        <button
          onClick={onDisconnectMetaMask}
          className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 border border-surface-3
                     rounded-xl px-3 py-2 transition-all text-sm"
        >
          <img
            src="https://raw.githubusercontent.com/nickytonline/images/refs/heads/main/metamask.svg"
            alt="MetaMask"
            className="w-5 h-5"
          />
          <span className="text-gray-200 font-medium">{shortenAddress(evmAddress)}</span>
        </button>
      ) : (
        <button
          onClick={onConnectMetaMask}
          className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/30
                     rounded-xl px-3 py-2 transition-all text-sm"
        >
          <img
            src="https://raw.githubusercontent.com/nickytonline/images/refs/heads/main/metamask.svg"
            alt="MetaMask"
            className="w-5 h-5"
          />
          <span className="text-accent-light font-medium">MetaMask</span>
        </button>
      )}

      {/* UniSat */}
      {isUniSatConnected && btcAddress ? (
        <button
          onClick={onDisconnectUniSat}
          className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 border border-surface-3
                     rounded-xl px-3 py-2 transition-all text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#F7931A" />
            <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">B</text>
          </svg>
          <span className="text-gray-200 font-medium">{shortenAddress(btcAddress, 6)}</span>
        </button>
      ) : (
        <button
          onClick={onConnectUniSat}
          className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30
                     rounded-xl px-3 py-2 transition-all text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#F7931A" />
            <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">B</text>
          </svg>
          <span className="text-orange-300 font-medium">UniSat</span>
        </button>
      )}
    </div>
  )
}
