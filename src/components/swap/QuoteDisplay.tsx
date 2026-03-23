import type { GardenQuoteItem } from '../../types/garden'
import type { CowQuoteResponse } from '../../api/cowswap'
import { toHumanReadable, formatDuration, formatUsd } from '../../utils/format'
import { Spinner } from '../ui/Spinner'

interface QuoteDisplayProps {
  gardenQuote: GardenQuoteItem | null
  cowQuote: CowQuoteResponse | null
  isCowswapRoute: boolean
  loading: boolean
  error: string | null
  destDecimals: number
  destSymbol: string
}

export function QuoteDisplay({
  gardenQuote,
  cowQuote,
  isCowswapRoute,
  loading,
  error,
  destDecimals,
  destSymbol,
}: QuoteDisplayProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
        <Spinner size={14} />
        <span>Fetching quote...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-danger text-sm py-3 px-1">{error}</div>
    )
  }

  if (!gardenQuote) return null

  return (
    <div className="bg-surface-0/50 rounded-xl p-3 space-y-2 text-sm">
      {/* Route visualization */}
      <div className="flex items-center gap-2 text-xs text-gray-500 pb-2 border-b border-surface-3">
        <span className="font-medium text-gray-400">Route:</span>
        <span className="bg-surface-2 px-2 py-0.5 rounded-full">
          {gardenQuote.source.asset.split(':')[1].toUpperCase()}
        </span>
        <Arrow />
        <span className="bg-surface-2 px-2 py-0.5 rounded-full">
          {isCowswapRoute ? 'ETH' : gardenQuote.destination.asset.split(':')[1].toUpperCase()}
        </span>
        {isCowswapRoute && (
          <>
            <Arrow />
            <span className="bg-surface-2 px-2 py-0.5 rounded-full">WETH</span>
            <Arrow />
            <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
              {destSymbol}
            </span>
          </>
        )}
      </div>

      {/* Garden leg */}
      <div className="flex justify-between items-center">
        <span className="text-gray-500">Garden swap</span>
        <span className="text-gray-300">
          {gardenQuote.source.display} {gardenQuote.source.asset.split(':')[1].toUpperCase()}
          {' → '}
          {gardenQuote.destination.display} {isCowswapRoute ? 'ETH' : gardenQuote.destination.asset.split(':')[1].toUpperCase()}
        </span>
      </div>

      {/* CowSwap leg */}
      {isCowswapRoute && cowQuote && (
        <div className="flex justify-between items-center">
          <span className="text-gray-500">CowSwap swap</span>
          <span className="text-gray-300">
            WETH → {toHumanReadable(cowQuote.quote.buyAmount, destDecimals)} {destSymbol}
          </span>
        </div>
      )}

      {/* Fees */}
      <div className="flex justify-between items-center">
        <span className="text-gray-500">Garden fee</span>
        <span className="text-gray-400">{gardenQuote.fee} (smallest unit)</span>
      </div>

      {/* Estimated time */}
      <div className="flex justify-between items-center">
        <span className="text-gray-500">Est. time</span>
        <span className="text-gray-400">
          {formatDuration(gardenQuote.estimated_time)}
          {isCowswapRoute && ' + CowSwap fill'}
        </span>
      </div>

      {/* Total output */}
      <div className="flex justify-between items-center pt-2 border-t border-surface-3">
        <span className="text-gray-400 font-medium">You receive</span>
        <span className="text-white font-semibold">
          {isCowswapRoute && cowQuote
            ? `~${toHumanReadable(cowQuote.quote.buyAmount, destDecimals)} ${destSymbol}`
            : `${gardenQuote.destination.display} ${gardenQuote.destination.asset.split(':')[1].toUpperCase()}`
          }
        </span>
      </div>
      {!isCowswapRoute && gardenQuote.destination.value && (
        <div className="text-right text-xs text-gray-500">
          {formatUsd(parseFloat(gardenQuote.destination.value))}
        </div>
      )}
    </div>
  )
}

function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-600">
      <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
