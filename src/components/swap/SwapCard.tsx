import { useState, useMemo } from 'react'
import type { UnifiedAsset } from '../../types/common'
import type { GardenQuoteItem } from '../../types/garden'
import { AssetSelector } from './AssetSelector'
import { AmountInput } from './AmountInput'
import { QuoteDisplay } from './QuoteDisplay'
import { OrderTracker } from '../status/OrderTracker'
import { Spinner } from '../ui/Spinner'
import { useGardenAssets } from '../../hooks/useGardenAssets'
import { useGardenQuote } from '../../hooks/useGardenQuote'
import { useCowSwapQuote } from '../../hooks/useCowSwapQuote'
import { useSwapOrchestrator } from '../../hooks/useSwapOrchestrator'
import { toRawAmount, toHumanReadable } from '../../utils/format'
import { parseGardenChain } from '../../constants/chains'
import { WETH_SEPOLIA, COW_TOKEN_SEPOLIA } from '../../constants/addresses'

interface SwapCardProps {
  evmAddress: string | null
  btcAddress: string | null
  evmChainId: number | null
  isMetaMaskConnected: boolean
  isUniSatConnected: boolean
  onConnectMetaMask: () => void
  onConnectUniSat: () => void
}

export function SwapCard({
  evmAddress,
  btcAddress,
  evmChainId,
  isMetaMaskConnected,
  isUniSatConnected,
  onConnectMetaMask,
  onConnectUniSat,
}: SwapCardProps) {
  const { sourceAssets, destAssets, loading: assetsLoading } = useGardenAssets()

  const [source, setSource] = useState<UnifiedAsset | null>(null)
  const [dest, setDest] = useState<UnifiedAsset | null>(null)
  const [amount, setAmount] = useState('')

  const { state: swapState, executeGardenOnly, executeGardenThenCowswap, sendBtcDeposit, reset } = useSwapOrchestrator()

  // Determine route type
  const isCowswapRoute = dest?.isCowswapOnly === true

  // For cowswap route, the Garden leg goes to ethereum_sepolia:eth
  const gardenDestAssetId = useMemo(() => {
    if (!dest) return null
    if (isCowswapRoute) return 'ethereum_sepolia:eth'
    return dest.gardenAsset?.id ?? null
  }, [dest, isCowswapRoute])

  // Raw amount for Garden quote
  const rawAmount = useMemo(() => {
    if (!source || !amount || amount === '0' || amount === '') return null
    try {
      return toRawAmount(amount, source.decimals)
    } catch {
      return null
    }
  }, [source, amount])

  // USD value of input
  const inputUsdValue = useMemo(() => {
    if (!source || !amount || !parseFloat(amount)) return 0
    return parseFloat(amount) * source.price
  }, [source, amount])

  // Garden quote
  const {
    quote: gardenQuote,
    loading: gardenQuoteLoading,
    error: gardenQuoteError,
  } = useGardenQuote(
    source?.gardenAsset?.id ?? null,
    gardenDestAssetId,
    rawAmount
  )

  // CowSwap quote (only if cowswap route and we have a garden quote)
  const cowSellAmount = useMemo(() => {
    if (!isCowswapRoute || !gardenQuote) return null
    // Garden delivers ETH (18 decimals). We subtract gas reserve.
    const ethAmount = BigInt(gardenQuote.destination.amount)
    const gasReserve = BigInt('5000000000000000') // 0.005 ETH
    const wethAmount = ethAmount > gasReserve ? ethAmount - gasReserve : ethAmount
    return wethAmount.toString()
  }, [isCowswapRoute, gardenQuote])

  const cowBuyToken = dest?.tokenAddress ?? COW_TOKEN_SEPOLIA

  const {
    quote: cowQuote,
    loading: cowQuoteLoading,
    error: cowQuoteError,
  } = useCowSwapQuote(
    isCowswapRoute ? WETH_SEPOLIA : null,
    isCowswapRoute ? cowBuyToken : null,
    cowSellAmount,
    evmAddress
  )

  const quoteLoading = gardenQuoteLoading || cowQuoteLoading
  const quoteError = gardenQuoteError || cowQuoteError

  // Determine if wallets needed are connected
  const needsBtcWallet = source ? parseGardenChain(source.chain).type === 'bitcoin' : false
  const handleSwap = async (quote: GardenQuoteItem) => {
    if (!source || !dest) return

    if (isCowswapRoute) {
      if (!evmAddress) return
      await executeGardenThenCowswap(
        source,
        quote,
        evmAddress,
        btcAddress,
        cowBuyToken,
      )
    } else {
      await executeGardenOnly(
        source,
        dest,
        quote,
        evmAddress,
        btcAddress,
      )
    }
  }

  const handleReset = () => {
    reset()
    setAmount('')
  }

  // Determine button state
  const buttonConfig: { label: string; disabled: boolean; action: () => void } = (() => {
    if (swapState.phase !== 'idle' && swapState.phase !== 'error') {
      return { label: 'Swapping...', disabled: true, action: () => {} }
    }
    if (!source || !dest) {
      return { label: 'Select tokens', disabled: true, action: () => {} }
    }
    if (!amount || parseFloat(amount) === 0) {
      return { label: 'Enter amount', disabled: true, action: () => {} }
    }
    if (needsBtcWallet && !isUniSatConnected) {
      return { label: 'Connect UniSat', disabled: false, action: onConnectUniSat }
    }
    if (!isMetaMaskConnected) {
      return { label: 'Connect MetaMask', disabled: false, action: onConnectMetaMask }
    }
    if (quoteLoading) {
      return { label: 'Fetching quote...', disabled: true, action: () => {} }
    }
    if (quoteError || !gardenQuote) {
      return { label: quoteError || 'No quote available', disabled: true, action: () => {} }
    }
    return {
      label: 'Swap',
      disabled: false,
      action: () => handleSwap(gardenQuote),
    }
  })()
  const isSwapping = swapState.phase !== 'idle' && swapState.phase !== 'error'

  // Output display
  const outputDisplay = useMemo(() => {
    if (!gardenQuote) return ''
    if (isCowswapRoute && cowQuote) {
      return toHumanReadable(cowQuote.quote.buyAmount, dest?.decimals ?? 18)
    }
    return gardenQuote.destination.display
  }, [gardenQuote, cowQuote, isCowswapRoute, dest])

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="glass-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Swap</h2>
          {source && dest && (
            <span className="text-xs text-gray-500 bg-surface-2 px-2 py-1 rounded-full">
              {isCowswapRoute ? 'Garden + CowSwap' : 'Garden'}
            </span>
          )}
        </div>

        {assetsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={24} />
            <span className="ml-3 text-gray-500">Loading assets...</span>
          </div>
        ) : (
          <>
            {/* Source */}
            <div className="bg-surface-0/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <AmountInput
                    value={amount}
                    onChange={setAmount}
                    usdValue={inputUsdValue}
                    disabled={isSwapping}
                  />
                </div>
                <div className="w-48 shrink-0">
                  <AssetSelector
                    assets={sourceAssets}
                    selected={source}
                    onSelect={(a) => { setSource(a); setAmount('') }}
                    label="From"
                  />
                </div>
              </div>
            </div>

            {/* Direction arrow */}
            <div className="flex justify-center -my-1 relative z-10">
              <div className="w-9 h-9 bg-surface-2 border border-surface-3 rounded-xl flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                  <path d="M8 3V13M8 13L4 9M8 13L12 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Destination */}
            <div className="bg-surface-0/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <AmountInput
                    value={outputDisplay}
                    onChange={() => {}}
                    disabled
                    placeholder="0.0"
                  />
                </div>
                <div className="w-48 shrink-0">
                  <AssetSelector
                    assets={destAssets}
                    selected={dest}
                    onSelect={setDest}
                    label="To"
                  />
                </div>
              </div>
            </div>

            {/* Quote display */}
            {source && dest && amount && parseFloat(amount) > 0 && (
              <QuoteDisplay
                gardenQuote={gardenQuote}
                cowQuote={cowQuote}
                isCowswapRoute={isCowswapRoute}
                loading={quoteLoading}
                error={quoteError}
                destDecimals={dest.decimals}
                destSymbol={dest.symbol}
              />
            )}

            {/* Swap button */}
            <button
              onClick={buttonConfig.action}
              disabled={buttonConfig.disabled}
              className="btn-primary w-full flex items-center justify-center gap-2 text-base"
            >
              {(quoteLoading || isSwapping) && <Spinner size={16} />}
              {buttonConfig.label}
            </button>
          </>
        )}
      </div>

      {/* Order tracker */}
      {swapState.phase !== 'idle' && (
        <div className="glass-card p-5 mt-3">
          <OrderTracker
            state={swapState}
            isCowswapRoute={isCowswapRoute}
            sourceChain={source?.chain ?? ''}
            onSendBtc={sendBtcDeposit}
            onReset={handleReset}
          />
        </div>
      )}
    </div>
  )
}
