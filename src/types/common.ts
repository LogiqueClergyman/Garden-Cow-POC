import type { GardenAsset } from './garden'

export type SwapRouteType = 'garden-only' | 'garden-then-cowswap'

export interface CowToken {
  address: string
  decimals: number
  symbol: string
  name: string
  icon: string
}

export interface UnifiedAsset {
  id: string
  symbol: string
  name: string
  chain: string
  chainName: string
  chainId: number | null
  icon: string
  decimals: number
  minAmount: string
  maxAmount: string
  price: number
  isCowswapOnly?: boolean
  tokenAddress?: string
  gardenAsset?: GardenAsset
  cowToken?: CowToken
}

export type SwapPhase =
  | 'idle'
  | 'quoting'
  | 'awaiting-approval'
  | 'awaiting-initiate'
  | 'awaiting-btc-deposit'
  | 'garden-pending'
  | 'wrapping-weth'
  | 'approving-cowswap'
  | 'cowswap-signing'
  | 'cowswap-pending'
  | 'complete'
  | 'error'

export interface SwapState {
  phase: SwapPhase
  gardenOrderId?: string
  cowswapOrderId?: string
  error?: string
  btcDepositAddress?: string
  btcDepositAmount?: string
  gardenTxHash?: string
  cowswapExplorerUrl?: string
  receivedAmount?: string
}

export interface WalletState {
  evmAddress: string | null
  evmChainId: number | null
  btcAddress: string | null
  isMetaMaskConnected: boolean
  isUniSatConnected: boolean
}
