import { ethers } from 'ethers'
import { SEPOLIA_CHAIN_ID, COWSWAP_SETTLEMENT } from '../constants/addresses'

const BASE_URL = 'https://api.cow.fi/sepolia/api/v1'

export interface CowQuoteRequest {
  sellToken: string
  buyToken: string
  from: string
  receiver: string
  sellAmountBeforeFee: string
  kind: 'sell' | 'buy'
  appData?: string
  appDataHash?: string
}

export interface CowQuoteResponse {
  quote: {
    sellToken: string
    buyToken: string
    sellAmount: string
    buyAmount: string
    feeAmount: string
    kind: string
    validTo: number
    appData: string
    partiallyFillable: boolean
    receiver: string
    sellTokenBalance: string
    buyTokenBalance: string
  }
  from: string
  expiration: string
  id: number
  verified: boolean
}

export interface CowOrderCreation {
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  feeAmount: string
  kind: string
  validTo: number
  appData: string
  partiallyFillable: boolean
  receiver: string
  sellTokenBalance: string
  buyTokenBalance: string
  signature: string
  signingScheme: string
  from: string
  quoteId: number
}

export interface CowOrder {
  uid: string
  status: 'presignaturePending' | 'open' | 'fulfilled' | 'cancelled' | 'expired'
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  executedSellAmount: string
  executedBuyAmount: string
  kind: string
  validTo: number
  creationDate: string
}

const APP_DATA_JSON = JSON.stringify({
  version: '1.1.0',
  appCode: 'garden-cowswap-bridge',
  metadata: {},
})

// CowSwap expects the keccak256 hash of the appData JSON as appDataHash (bytes32).
// The raw JSON goes in appData, the hash goes in appDataHash for the quote request,
// and only the hash is used in the EIP-712 typed data and order submission.
const APP_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes(APP_DATA_JSON))

let appDataRegistered = false

/** Register the appData JSON with CowSwap so the hash is recognized when placing orders. */
async function ensureAppDataRegistered(): Promise<void> {
  if (appDataRegistered) return
  await fetch(`${BASE_URL}/app_data/${APP_DATA_HASH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullAppData: APP_DATA_JSON }),
  })
  appDataRegistered = true
}

export async function getCowQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  from: string
): Promise<CowQuoteResponse> {
  const body: CowQuoteRequest = {
    sellToken,
    buyToken,
    from,
    receiver: from,
    sellAmountBeforeFee: sellAmount,
    kind: 'sell',
    appData: APP_DATA_JSON,
    appDataHash: APP_DATA_HASH,
  }
  const res = await fetch(`${BASE_URL}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ description: res.statusText }))
    throw new Error(err.description || err.errorType || 'CowSwap quote failed')
  }
  return res.json()
}

export function buildCowOrderTypedData(quote: CowQuoteResponse['quote']): {
  domain: Record<string, unknown>
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, unknown>
} {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Order: [
        { name: 'sellToken', type: 'address' },
        { name: 'buyToken', type: 'address' },
        { name: 'receiver', type: 'address' },
        { name: 'sellAmount', type: 'uint256' },
        { name: 'buyAmount', type: 'uint256' },
        { name: 'validTo', type: 'uint32' },
        { name: 'appData', type: 'bytes32' },
        { name: 'feeAmount', type: 'uint256' },
        { name: 'kind', type: 'string' },
        { name: 'partiallyFillable', type: 'bool' },
        { name: 'sellTokenBalance', type: 'string' },
        { name: 'buyTokenBalance', type: 'string' },
      ],
    },
    primaryType: 'Order',
    domain: {
      name: 'Gnosis Protocol',
      version: 'v2',
      chainId: SEPOLIA_CHAIN_ID,
      verifyingContract: COWSWAP_SETTLEMENT,
    },
    message: {
      sellToken: quote.sellToken,
      buyToken: quote.buyToken,
      receiver: quote.receiver,
      sellAmount: quote.sellAmount,
      buyAmount: quote.buyAmount,
      validTo: quote.validTo,
      appData: APP_DATA_HASH,
      feeAmount: '0',
      kind: quote.kind,
      partiallyFillable: quote.partiallyFillable,
      sellTokenBalance: quote.sellTokenBalance,
      buyTokenBalance: quote.buyTokenBalance,
    },
  }
}

export async function submitCowOrder(
  quote: CowQuoteResponse,
  signature: string,
  from: string
): Promise<string> {
  await ensureAppDataRegistered()
  const q = quote.quote
  const order: CowOrderCreation = {
    sellToken: q.sellToken,
    buyToken: q.buyToken,
    sellAmount: q.sellAmount,
    buyAmount: q.buyAmount,
    validTo: q.validTo,
    feeAmount: '0',
    kind: q.kind,
    partiallyFillable: q.partiallyFillable,
    receiver: q.receiver,
    sellTokenBalance: q.sellTokenBalance,
    buyTokenBalance: q.buyTokenBalance,
    appData: APP_DATA_HASH,
    signature,
    signingScheme: 'eip712',
    from,
    quoteId: quote.id,
  }
  const res = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ description: res.statusText }))
    throw new Error(err.description || err.errorType || 'CowSwap order failed')
  }
  const uid = await res.json()
  return uid as string
}

export async function getCowOrder(uid: string): Promise<CowOrder> {
  const res = await fetch(`${BASE_URL}/orders/${uid}`)
  if (!res.ok) throw new Error('Failed to fetch CowSwap order')
  return res.json()
}

export function getCowExplorerUrl(uid: string): string {
  return `https://explorer.cow.fi/sepolia/orders/${uid}`
}
