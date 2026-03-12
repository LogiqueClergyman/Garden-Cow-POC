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
import { mainnet } from "viem/chains";

// ─── Token List ───────────────────────────────────────────────────────────────

export interface CowMainnetToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  icon: string;
}

/**
 * USDC on Ethereum mainnet — used as the pivot asset out of Garden.
 * Garden outputs USDC; CoW receives USDC as sellToken.
 */
export const USDC_MAINNET: CowMainnetToken = {
  symbol: "USDC",
  name: "USD Coin",
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  decimals: 6,
  icon: "https://garden.imgix.net/token-images/usdc.svg",
};

/**
 * Curated destination tokens for the CoW Protocol leg.
 *
 * Selection criteria:
 *   1. NOT natively supported by Garden Finance on mainnet
 *      (Garden supports: BTC, WBTC, WETH/ETH, USDC, USDT, cbBTC)
 *   2. Actively traded through CoW Protocol solvers — verified to have
 *      liquidity via CoW's price estimators (Uniswap v2/v3, Balancer, etc.)
 *
 * All addresses are Ethereum Mainnet (chainId 1).
 */
export const COW_MAINNET_DEST_TOKENS: CowMainnetToken[] = [
  {
    // CoW Protocol's own governance token — deepest native liquidity on CoW
    symbol: "COW",
    name: "CoW Protocol",
    address: "0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB",
    decimals: 18,
    icon: "https://raw.githubusercontent.com/cowprotocol/token-lists/main/src/public/images/0x34ecef7ea4561b86e06ddddba0bdf242ddf5cc38.png",
  },
  {
    // GNO — Gnosis DAO token, long-time CoW partner with active pairs
    symbol: "GNO",
    name: "Gnosis",
    address: "0x6810e776880C02933D47DB1b9fc05908e5386b96",
    decimals: 18,
    icon: "https://assets.coingecko.com/coins/images/662/small/logo_square_simple_300px.png",
  },
  {
    // AAVE — deep liquidity across all DEX aggregators including CoW
    symbol: "AAVE",
    name: "Aave",
    address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    decimals: 18,
    icon: "https://garden.imgix.net/token-images/aave.svg",
  },
  {
    // CRV — Curve DAO token, heavily traded via CoW solvers
    symbol: "CRV",
    name: "Curve DAO Token",
    address: "0xD533a949740bb3306d119CC777fa900bA034cd52",
    decimals: 18,
    icon: "https://assets.coingecko.com/coins/images/12124/small/Curve.png",
  },
  {
    // LDO — Lido, large governance token with active CoW/DEX routing
    symbol: "LDO",
    name: "Lido DAO Token",
    address: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
    decimals: 18,
    icon: "https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png",
  },
  {
    // ENS — Ethereum Name Service, used by ENS DAO on CoW for large trades
    symbol: "ENS",
    name: "Ethereum Name Service",
    address: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
    decimals: 18,
    icon: "https://assets.coingecko.com/coins/images/19785/small/acatxTm8_400x400.jpg",
  },
  {
    // MKR — Maker governance, one of the oldest & most liquid DeFi tokens
    symbol: "MKR",
    name: "Maker",
    address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
    decimals: 18,
    icon: "https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png",
  },
  {
    // COMP — Compound governance token with established CoW routing
    symbol: "COMP",
    name: "Compound",
    address: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    decimals: 18,
    icon: "https://assets.coingecko.com/coins/images/10775/small/COMP.png",
  },
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
    chain: mainnet,
    transport: custom(window.ethereum as any),
  });

  const walletClient = createWalletClient({
    chain: mainnet,
    transport: custom(window.ethereum as any),
    account,
  });

  const adapter = new ViemAdapter({
    provider: publicClient,
    walletClient,
  } as any);

  globalSdk = new TradingSdk(
    { chainId: SupportedChainId.MAINNET, appCode: "garden-dapp" },
    {},
    adapter
  );

  globalOrderBook = new OrderBookApi({ chainId: SupportedChainId.MAINNET });
  console.log("[CoW Mainnet] SDK initialised — chainId: MAINNET (1)");

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
