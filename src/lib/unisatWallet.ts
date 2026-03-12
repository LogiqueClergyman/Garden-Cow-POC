/**
 * Unisat Bitcoin Wallet integration helper.
 *
 * Wraps the `window.unisat` injected provider exposed by the Unisat browser
 * extension.  Only used for:
 *   1. Connecting and retrieving the user's Bitcoin address (taproot / native segwit).
 *   2. Sending BTC to Garden's HTLC address to initiate the cross-chain swap.
 *
 * All EVM interactions (EIP-712 signing, CoW approvals, etc.) remain on MetaMask.
 */

declare global {
  interface Window {
    unisat?: {
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      sendBitcoin: (
        toAddress: string,
        satoshis: number,
        options?: { feeRate?: number }
      ) => Promise<string>;
      getBalance: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>;
      getNetwork: () => Promise<string>;
      switchNetwork: (network: "livenet" | "testnet") => Promise<void>;
      signMessage: (msg: string, type?: "ecdsa" | "bip322-simple") => Promise<string>;
    };
  }
}

// ─── Detection ────────────────────────────────────────────────────────────────

export function isUnisatInstalled(): boolean {
  return typeof window !== "undefined" && typeof window.unisat !== "undefined";
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Prompts the user to connect Unisat Wallet and returns their Bitcoin address.
 * Throws if Unisat is not installed.
 */
export async function connectUnisatWallet(): Promise<string> {
  if (!isUnisatInstalled()) {
    throw new Error(
      "Unisat Wallet not found. Please install the Unisat browser extension."
    );
  }
  const accounts = await window.unisat!.requestAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error("No Bitcoin accounts found in Unisat Wallet.");
  }
  return accounts[0];
}

/**
 * Returns the currently connected Bitcoin address without triggering a popup,
 * or null if not connected.
 */
export async function getConnectedUnisatAccount(): Promise<string | null> {
  if (!isUnisatInstalled()) return null;
  try {
    const accounts = await window.unisat!.getAccounts();
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Bitcoin Transaction ──────────────────────────────────────────────────────

/**
 * Sends `satoshis` BTC from the connected Unisat account to `toAddress`.
 * Returns the Bitcoin transaction ID on success.
 *
 * @param toAddress  The Garden HTLC P2SH/P2WSH/P2TR address to send BTC to.
 * @param satoshis   Amount in satoshis (integer).
 * @param feeRate    Optional: fee rate in sat/vbyte. Defaults to Unisat's recommendation.
 */
export async function sendBitcoinViaUnisat(
  toAddress: string,
  satoshis: number,
  feeRate?: number
): Promise<string> {
  if (!isUnisatInstalled()) {
    throw new Error("Unisat Wallet not found.");
  }
  const txid = await window.unisat!.sendBitcoin(
    toAddress,
    satoshis,
    feeRate !== undefined ? { feeRate } : undefined
  );
  return txid;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Shortens a Bitcoin address for display: first 8 chars + … + last 6 chars. */
export function shortenBtcAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}
