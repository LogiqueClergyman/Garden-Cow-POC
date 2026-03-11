import { TradingSdk, SupportedChainId, OrderKind, TradeParameters, OrderBookApi } from '@cowprotocol/cow-sdk';
import { ViemAdapter } from '@cowprotocol/sdk-viem-adapter';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { sepolia } from 'viem/chains';

// Common testnet tokens on Sepolia that have liquidity against WETH on CoW Protocol
export interface CowToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  icon: string;
}

export const COW_TESTNET_TOKENS: CowToken[] = [
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    decimals: 18,
    icon: "https://garden.imgix.net/token-images/weth.svg" // Fallback icon
  },
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

let globalSdk: TradingSdk | null = null;
let globalOrderBook: OrderBookApi | null = null;

/**
 * Initializes and returns a singleton TradingSdk and OrderBookApi equipped with the current user's wallet.
 */
export async function getCowSdk(): Promise<{ sdk: TradingSdk, orderBook: OrderBookApi }> {
  if (!window.ethereum) throw new Error("MetaMask not found.");

  // Request account access if not already granted
  const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found. Please connect wallet.");
  }
  const account = accounts[0] as `0x${string}`;

  // Create Viem clients for MetaMask
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(window.ethereum as any),
  });

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum as any),
    account,
  });

  // Initialize ViemAdapter
  const adapter = new ViemAdapter({
    provider: publicClient,
    walletClient: walletClient,
  } as any);

  // Initialize SDK
  globalSdk = new TradingSdk({
    chainId: SupportedChainId.SEPOLIA,
    appCode: 'garden-dapp', // our app identifier
  }, {}, adapter);

  globalOrderBook = new OrderBookApi({ chainId: SupportedChainId.SEPOLIA });

  return { sdk: globalSdk, orderBook: globalOrderBook };
}

/**
 * Fetches a quote from CoW Protocol.
 */
export async function fetchCowQuote(
  sellToken: string,
  buyToken: string,
  amountInWei: string,
  sellTokenDecimals: number,
  buyTokenDecimals: number
) {
  const { sdk } = await getCowSdk();
  
  const parameters: TradeParameters = {
    kind: OrderKind.SELL,
    sellToken,
    sellTokenDecimals,
    buyToken,
    buyTokenDecimals,
    amount: amountInWei,
  };

  const { quoteResults, postSwapOrderFromQuote } = await sdk.getQuote(parameters);
  return { quoteResults, postSwapOrderFromQuote };
}

/**
 * Get the status of an order given its orderId.
 */
export async function getCowOrderStatus(orderId: string) {
  const { orderBook } = await getCowSdk();
  return await orderBook.getOrder(orderId);
}
