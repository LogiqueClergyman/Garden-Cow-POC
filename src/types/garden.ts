export interface GardenAsset {
  id: string
  name: string
  chain: string
  icon: string
  htlc: { address: string; schema: string } | null
  token: { address: string; schema: string } | null
  decimals: number
  min_amount: string
  max_amount: string
  price: number
}

export interface GardenQuoteItem {
  source: {
    asset: string
    amount: string
    display: string
    value: string
  }
  destination: {
    asset: string
    amount: string
    display: string
    value: string
  }
  solver_id: string
  estimated_time: number
  slippage: number
  fee: number
  fixed_fee: string
}

export interface GardenEvmTx {
  chain_id: number
  data: string
  gas_limit: string
  to: string
  value: string
}

export interface GardenTypedData {
  domain: Record<string, unknown>
  message: Record<string, unknown>
  primaryType: string
  types: Record<string, Array<{ name: string; type: string }>>
}

export interface GardenOrderResult {
  order_id: string
  // BTC source
  to?: string
  amount?: string
  // EVM source
  approval_transaction?: GardenEvmTx
  initiate_transaction?: GardenEvmTx
  typed_data?: GardenTypedData
}

export interface GardenSwapLeg {
  created_at: string
  swap_id: string
  chain: string
  asset: string
  initiator: string
  redeemer: string
  delegate?: string
  timelock: number
  filled_amount: string
  asset_price: number
  amount: string
  secret_hash: string
  secret: string
  instant_refund_tx?: string
  initiate_tx_hash: string
  redeem_tx_hash: string
  refund_tx_hash: string
  initiate_block_number: string
  redeem_block_number: string
  refund_block_number: string
  required_confirmations: number
  current_confirmations: number
  initiate_timestamp: string | null
  redeem_timestamp: string | null
  refund_timestamp: string | null
}

export interface GardenOrderStatus {
  created_at: string
  order_id: string
  source_swap: GardenSwapLeg
  destination_swap: GardenSwapLeg
  nonce: string
  version: string
  solver_id: string
  integrator: string
  affiliate_fees: unknown[]
}

export interface GardenApiResponse<T> {
  status: 'Ok' | 'Error'
  result?: T
  error?: string
}
