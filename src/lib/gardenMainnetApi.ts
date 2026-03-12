/**
 * Garden Finance MAINNET API client.
 * 
 * Same interface as gardenApi.ts but targets the production endpoint.
 * Separate file to avoid any risk of changing the existing testnet widget.
 */

const API_BASE = "https://testnet.api.garden.finance";
const GARDEN_APP_ID = "f242ea49332293424c96c562a6ef575a819908c878134dcb4fce424dc84ec796";

const headers = {
  "garden-app-id": GARDEN_APP_ID,
  "Content-Type": "application/json",
  accept: "application/json",
};

// ─── Types (identical to gardenApi.ts) ───────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  chain: string;
  icon: string;
  decimals: number;
  min_amount: string;
  max_amount: string;
  price: number;
  htlc: { address: string; schema: string } | null;
  token: { address: string; schema: string } | null;
}

export interface Chain {
  chain: string;
  name: string;
  id: string;
  icon: string;
  explorer_url: string;
  assets: Asset[];
}

export interface QuoteResult {
  source: { asset: string; amount: string; display: string; value: string };
  destination: { asset: string; amount: string; display: string; value: string };
  solver_id: string;
  estimated_time: number;
  slippage: number;
  fee: number;
  fixed_fee: string;
}

export interface OrderResult {
  order_id: string;
  /** Present for EVM source assets that need an ERC-20 allowance first. */
  approval_transaction?: {
    chain_id: number;
    data: string;
    gas_limit: string;
    to: string;
    value: string;
  };
  /**
   * For Bitcoin source orders — the HTLC address the user must send BTC to.
   * Garden may return this under different field names depending on the API version.
   * `to` is the P2SH/P2WSH address, `value` is satoshis as a string.
   */
  initiate_transaction?: {
    chain_id?: number;
    data?: string;
    gas_limit?: string;
    to: string;
    value: string;
  };
  // Alternative field names observed in some Garden API versions
  to?: string;                     // V2 API direct BTC HTLC address
  amount?: string;                 // V2 API direct BTC amount (satoshis)
  htlc_address?: string;           // direct BTC HTLC address
  source_htlc?: { address: string; amount: string };
  initiate_tx?: { to: string; value: string; data?: string };
  typed_data?: unknown;
}

export interface SwapStatus {
  swap_id: string;
  chain: string;
  asset: string;
  amount: string;
  initiate_tx_hash: string;
  redeem_tx_hash: string;
  refund_tx_hash: string;
  current_confirmations: number;
  required_confirmations: number;
  initiate_timestamp: string | null;
  redeem_timestamp: string | null;
  // BTC HTLC address returned under the source_swap for Bitcoin orders
  htlc_address?: string;
}

export interface Order {
  order_id: string;
  created_at: string;
  source_swap: SwapStatus;
  destination_swap: SwapStatus;
  nonce: string;
  integrator: string;
  version: string;
  solver_id: string;
  status?: { status: string };
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function fetchChains(): Promise<Chain[]> {
  const res = await fetch(`${API_BASE}/v2/chains`, { headers });
  const data = await res.json();
  if (data.status !== "Ok") throw new Error("Failed to fetch mainnet chains");
  return data.result as Chain[];
}

export async function fetchQuote(
  from: string,
  to: string,
  fromAmount: string
): Promise<QuoteResult[]> {
  const url = `${API_BASE}/v2/quote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&from_amount=${fromAmount}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (data.status !== "Ok") throw new Error(data.error || "Failed to fetch mainnet quote");
  return data.result as QuoteResult[];
}

export async function createOrder(
  sourceAsset: string,
  sourceOwner: string,
  sourceAmount: string,
  destAsset: string,
  destOwner: string,
  destAmount: string
): Promise<OrderResult> {
  const res = await fetch(`${API_BASE}/v2/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: { asset: sourceAsset, owner: sourceOwner, amount: sourceAmount },
      destination: { asset: destAsset, owner: destOwner, amount: destAmount },
    }),
  });
  const data = await res.json();
  if (data.status !== "Ok") {
    throw new Error(
      data.error ?? data.message ?? `Mainnet order creation failed (HTTP ${res.status})`
    );
  }
  // Log the full raw result so we can see the exact shape in DevTools
  console.log("[Garden Mainnet] createOrder raw result:", JSON.stringify(data.result, null, 2));
  return data.result as OrderResult;
}

export async function initiateOrder(
  orderId: string,
  signature: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/v2/orders/${orderId}?action=initiate`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ signature }),
  });
  const data = await res.json();
  if (data.status !== "Ok") {
    throw new Error(
      data.error ?? data.message ?? `Mainnet order initiation failed (HTTP ${res.status})`
    );
  }
}

export async function getOrderStatus(orderId: string): Promise<Order> {
  const res = await fetch(`${API_BASE}/v2/orders/${orderId}`, { headers });
  const data = await res.json();
  if (data.status !== "Ok") throw new Error(data.error || "Failed to get mainnet order status");
  return data.result as Order;
}
