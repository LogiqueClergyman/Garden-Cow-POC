declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

// RPC and metadata for Garden Finance testnet chains.
// Used when MetaMask doesn't have the chain yet (error 4902).
const CHAIN_CONFIGS: Record<
  number,
  {
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  }
> = {
  11155111: {
    chainName: "Ethereum Sepolia",
    rpcUrls: ["https://rpc.sepolia.org", "https://ethereum-sepolia-rpc.publicnode.com"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
  84532: {
    chainName: "Base Sepolia",
    rpcUrls: ["https://sepolia.base.org"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  421614: {
    chainName: "Arbitrum Sepolia",
    rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.arbiscan.io"],
  },
  97: {
    chainName: "BNB Chain Testnet",
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  },
  10143: {
    chainName: "Monad Testnet",
    rpcUrls: ["https://testnet-rpc.monad.xyz"],
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    blockExplorerUrls: ["https://testnet.monadexplorer.com"],
  },
  5115: {
    chainName: "Citrea Testnet",
    rpcUrls: ["https://rpc.testnet.citrea.xyz"],
    nativeCurrency: { name: "cBTC", symbol: "cBTC", decimals: 18 },
    blockExplorerUrls: ["https://explorer.testnet.citrea.xyz"],
  },
  8150: {
    chainName: "Alpen Testnet",
    rpcUrls: ["https://rpc.pectra-testnet.alpenlabs.io"],
    nativeCurrency: { name: "sBTC", symbol: "sBTC", decimals: 18 },
    blockExplorerUrls: ["https://explorer.pectra-testnet.alpenlabs.io"],
  },
  998: {
    chainName: "HyperEVM Testnet",
    rpcUrls: ["https://api.hyperliquid-testnet.xyz/evm"],
    nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
    blockExplorerUrls: ["https://testnet.purrsec.com"],
  },
};

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask not found. Please install MetaMask.");
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No accounts found.");
  return accounts[0];
}

export async function getConnectedAccount(): Promise<string | null> {
  if (!window.ethereum) return null;
  try {
    const accounts = (await window.ethereum.request({
      method: "eth_accounts",
    })) as string[];
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

export async function signTypedData(
  address: string,
  typedData: unknown
): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask not found.");
  const signature = await window.ethereum.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(typedData)],
  });
  return signature as string;
}

export async function switchNetwork(chainId: number): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask not found.");
  const hexChainId = "0x" + chainId.toString(16);

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (err: unknown) {
    // Error 4902 = chain not added to MetaMask yet — add it automatically.
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      const config = CHAIN_CONFIGS[chainId];
      if (!config) {
        throw new Error(
          `Chain ${chainId} is not in MetaMask and no config is available to add it. ` +
          `Please add it manually in MetaMask settings (chainId: ${chainId}).`
        );
      }
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId,
            chainName: config.chainName,
            rpcUrls: config.rpcUrls,
            nativeCurrency: config.nativeCurrency,
            blockExplorerUrls: config.blockExplorerUrls,
          },
        ],
      });
      // After adding, switch to it.
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } else {
      throw err;
    }
  }
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
