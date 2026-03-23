import { GARDEN_BASE_URL, GARDEN_APP_ID } from '../constants/api'
import type {
  GardenAsset,
  GardenQuoteItem,
  GardenOrderResult,
  GardenOrderStatus,
  GardenApiResponse,
} from '../types/garden'

const headers = {
  'garden-app-id': GARDEN_APP_ID,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

async function gardenFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GARDEN_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  })
  const json: GardenApiResponse<T> = await res.json()
  if (json.status === 'Error' || !json.result) {
    throw new Error(json.error || 'Garden API error')
  }
  return json.result
}

export async function getAssets(): Promise<GardenAsset[]> {
  return gardenFetch<GardenAsset[]>('/assets')
}

export async function getQuote(
  from: string,
  to: string,
  fromAmount: string
): Promise<GardenQuoteItem[]> {
  const params = new URLSearchParams({ from, to, from_amount: fromAmount })
  return gardenFetch<GardenQuoteItem[]>(`/quote?${params}`)
}

export async function createOrder(body: {
  source: { asset: string; owner: string; amount: string }
  destination: { asset: string; owner: string; amount: string }
}): Promise<GardenOrderResult> {
  return gardenFetch<GardenOrderResult>('/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getOrder(orderId: string): Promise<GardenOrderStatus> {
  return gardenFetch<GardenOrderStatus>(`/orders/${orderId}`)
}

export async function initiateOrder(
  orderId: string,
  signature: string
): Promise<unknown> {
  return gardenFetch(`/orders/${orderId}?action=initiate`, {
    method: 'PATCH',
    body: JSON.stringify({ signature }),
  })
}
