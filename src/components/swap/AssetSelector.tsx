import { useState, useRef, useEffect } from 'react'
import type { UnifiedAsset } from '../../types/common'
import { ChainBadge } from '../ui/ChainBadge'
import { EVM_CHAINS, parseGardenChain } from '../../constants/chains'

interface AssetSelectorProps {
  assets: UnifiedAsset[]
  selected: UnifiedAsset | null
  onSelect: (asset: UnifiedAsset) => void
  label: string
}

export function AssetSelector({ assets, selected, onSelect, label }: AssetSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = assets.filter(a => {
    const q = search.toLowerCase()
    return (
      a.symbol.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.chainName.toLowerCase().includes(q)
    )
  })

  // Group by chain
  const grouped = filtered.reduce<Record<string, UnifiedAsset[]>>((acc, a) => {
    const key = a.chainName
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  function getChainIcon(chainName: string): string | undefined {
    const asset = filtered.find(a => a.chainName === chainName)
    if (!asset) return undefined
    const parsed = parseGardenChain(asset.chain)
    if (parsed.type === 'evm') return EVM_CHAINS[parsed.chainId]?.icon
    if (parsed.type === 'bitcoin') return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png'
    return undefined
  }

  return (
    <div ref={ref} className="relative">
      <label className="text-xs text-gray-500 font-medium mb-1 block">{label}</label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 bg-surface-2 hover:bg-surface-3 border border-surface-3
                   rounded-xl px-4 py-3 transition-all text-left"
      >
        {selected ? (
          <>
            <img
              src={selected.icon}
              alt={selected.symbol}
              className="w-7 h-7 rounded-full bg-surface-3"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23333"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14">?</text></svg>'
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-sm">{selected.symbol}</div>
              <div className="text-xs text-gray-500 truncate">{selected.name}</div>
            </div>
            <ChainBadge chainName={selected.chainName} small />
            <ChevronDown />
          </>
        ) : (
          <>
            <div className="w-7 h-7 rounded-full bg-surface-3" />
            <span className="text-gray-500 text-sm flex-1">Select token</span>
            <ChevronDown />
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl
                        overflow-hidden max-h-80 flex flex-col">
          <div className="p-3 border-b border-surface-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tokens..."
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm
                         text-white placeholder-gray-500 outline-none focus:border-accent/50"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {Object.entries(grouped).map(([chain, chainAssets]) => (
              <div key={chain}>
                <div className="px-4 py-2 flex items-center gap-2 bg-surface-0/50 sticky top-0">
                  {getChainIcon(chain) && (
                    <img src={getChainIcon(chain)} alt="" className="w-4 h-4 rounded-full" />
                  )}
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    {chain}
                  </span>
                </div>
                {chainAssets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => { onSelect(asset); setOpen(false); setSearch('') }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors
                      ${selected?.id === asset.id ? 'bg-accent/10' : ''}`}
                  >
                    <img
                      src={asset.icon}
                      alt={asset.symbol}
                      className="w-6 h-6 rounded-full bg-surface-3"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23333"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14">?</text></svg>'
                      }}
                    />
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium text-white">{asset.symbol}</div>
                      <div className="text-xs text-gray-500 truncate">{asset.name}</div>
                    </div>
                    {asset.isCowswapOnly && (
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full">
                        CowSwap
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">No tokens found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-500 shrink-0">
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
