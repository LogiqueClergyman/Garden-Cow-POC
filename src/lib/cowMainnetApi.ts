/**
 * CoW Protocol MAINNET API client.
 *
 * Mainnet equivalent of cowApi.ts.
 * - Chain: Ethereum Mainnet (chainId 1)
 * - Pivot / sell token: USDC (6 decimals)
 * - Destination tokens: major Ethereum ERC-20s with deep CoW liquidity
 */

import { TradingSdk, SupportedChainId, OrderKind, TradeParameters, OrderBookApi } from "@cowprotocol/cow-sdk";
import { ViemAdapter } from "@cowprotocol/sdk-viem-adapter";
import { createPublicClient, createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";

// ─── Token List ───────────────────────────────────────────────────────────────

export interface CowMainnetToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  icon: string;
}

/**
 * WETH on Ethereum Sepolia — used as the pivot asset out of Garden.
 * Garden outputs ETH, we wrap it to WETH, and CoW receives WETH as sellToken.
 */
export const WETH_TESTNET: CowMainnetToken = {
  symbol: "WETH",
  name: "Wrapped Ether",
  address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
  decimals: 18,
  icon: "https://garden.imgix.net/token-images/weth.svg",
};

/**
 * Curated destination tokens for the CoW Protocol leg on testnet.
 */
export const COW_MAINNET_DEST_TOKENS: CowMainnetToken[] = [
  {
    symbol: "COW",
    name: "CoW Protocol",
    address: "0x0625aFB445C3B6B7B929342a04A22599fd5dBB59",
    decimals: 18,
    icon: "https://raw.githubusercontent.com/cowprotocol/token-lists/main/src/public/images/0x34ecef7ea4561b86e06ddddba0bdf242ddf5cc38.png"
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xbe72E441BF55620febc26715db68d3494213D8Cb",
    decimals: 18,
    icon: "https://garden.imgix.net/token-images/usdc.svg"
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
    icon: "https://garden.imgix.net/token-images/uni.svg"
  }
];


// ─── SDK Singleton ────────────────────────────────────────────────────────────

let globalSdk: TradingSdk | null = null;
let globalOrderBook: OrderBookApi | null = null;

/**
 * Initialises and returns a singleton TradingSdk + OrderBookApi for
 * Ethereum mainnet, wired to the current MetaMask account.
 */
export async function getCowMainnetSdk(): Promise<{ sdk: TradingSdk; orderBook: OrderBookApi }> {
  if (!window.ethereum) throw new Error("MetaMask not found.");

  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No MetaMask accounts found. Please connect wallet.");
  }
  const account = accounts[0] as `0x${string}`;
  console.log("[CoW Mainnet] Initialising SDK for account:", account);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(window.ethereum as any),
  });

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum as any),
    account,
  });

  const adapter = new ViemAdapter({
    provider: publicClient,
    walletClient,
  } as any);

  globalSdk = new TradingSdk(
    { chainId: SupportedChainId.SEPOLIA, appCode: "garden-dapp" },
    {},
    adapter
  );

  globalOrderBook = new OrderBookApi({ chainId: SupportedChainId.SEPOLIA });
  console.log("[CoW Mainnet] SDK initialised — chainId: SEPOLIA (11155111)");

  return { sdk: globalSdk, orderBook: globalOrderBook };
}

/**
 * Fetches a quote from CoW Protocol on mainnet.
 * sellToken should be USDC_MAINNET.address; buyToken is the chosen destination.
 */
export async function fetchCowMainnetQuote(
  sellToken: string,
  buyToken: string,
  amountInAtoms: string,    // USDC amount in atomic units (6-decimal)
  sellTokenDecimals: number,
  buyTokenDecimals: number
) {
  const humanSellAmount = (Number(amountInAtoms) / Math.pow(10, sellTokenDecimals)).toFixed(sellTokenDecimals);

  console.group("[CoW Mainnet] fetchCowMainnetQuote");
  console.log("  sellToken   :", sellToken);
  console.log("  buyToken    :", buyToken);
  console.log("  amount atoms:", amountInAtoms);
  console.log(`  amount human: ${humanSellAmount} (${sellTokenDecimals} decimals)`);
  console.log("  buyDecimals :", buyTokenDecimals);
  console.groupEnd();

  // Warn if amount is likely too small for CoW (< $5 USDC)
  if (sellTokenDecimals === 6 && Number(amountInAtoms) < 5_000_000) {
    console.warn(
      `[CoW Mainnet] ⚠️ Sell amount is ${humanSellAmount} USDC — CoW may reject amounts below ~$5. ` +
      `Try a larger source amount.`
    );
  }

  const { sdk } = await getCowMainnetSdk();

  const parameters: TradeParameters = {
    kind: OrderKind.SELL,
    sellToken,
    sellTokenDecimals,
    buyToken,
    buyTokenDecimals,
    amount: amountInAtoms,
  };

  console.log("[CoW Mainnet] Calling sdk.getQuote with parameters:", parameters);

  try {
    const { quoteResults, postSwapOrderFromQuote } = await sdk.getQuote(parameters);
    console.log("[CoW Mainnet] ✅ Quote success:", {
      sellAmount: quoteResults?.quoteResponse?.quote?.sellAmount,
      buyAmount: quoteResults?.quoteResponse?.quote?.buyAmount,
      feeAmount: quoteResults?.quoteResponse?.quote?.feeAmount,
      validTo: quoteResults?.quoteResponse?.quote?.validTo,
    });
    return { quoteResults, postSwapOrderFromQuote };
  } catch (err: unknown) {
    // CoW returns structured errors — surface them clearly
    const raw = err as any;
    const errorType: string = raw?.body?.errorType ?? raw?.errorType ?? "Unknown";
    const description: string = raw?.body?.description ?? raw?.description ?? String(err);

    console.error("[CoW Mainnet] ❌ Quote failed:", { errorType, description, raw });

    if (errorType === "NoLiquidity") {
      throw new Error(
        `CoW Protocol: No liquidity found for this pair (${errorType}). ` +
        `Try a different destination token or increase the source amount ` +
        `— small amounts (< $10 USDC) are often below CoW's minimum order size.`
      );
    }

    throw new Error(`CoW Protocol quote error [${errorType}]: ${description}`);
  }
}

/**
 * Returns the current status of a CoW order on mainnet.
 */
export async function getCowMainnetOrderStatus(orderId: string) {
  console.log("[CoW Mainnet] Polling order status for:", orderId);
  const { orderBook } = await getCowMainnetSdk();
  const status = await orderBook.getOrder(orderId);
  console.log("[CoW Mainnet] Order status:", status.status, orderId);
  return status;
}
