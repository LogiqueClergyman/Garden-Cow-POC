export interface ChainMeta {
  name: string
  shortName: string
  chainIdHex: string
  chainIdNum: number
  rpcUrl: string
  explorerUrl: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
  icon: string
}

export const EVM_CHAINS: Record<number, ChainMeta> = {
  11155111: {
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
    chainIdHex: '0xaa36a7',
    chainIdNum: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  },
  84532: {
    name: 'Base Sepolia',
    shortName: 'Base',
    chainIdHex: '0x14a34',
    chainIdNum: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
  },
  421614: {
    name: 'Arbitrum Sepolia',
    shortName: 'Arbitrum',
    chainIdHex: '0x66eee',
    chainIdNum: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
  },
  10143: {
    name: 'Monad Testnet',
    shortName: 'Monad',
    chainIdHex: '0x279f',
    chainIdNum: 10143,
    rpcUrl: 'https://testnet.monad.xyz/v1',
    explorerUrl: 'https://testnet.monadexplorer.com',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  },
  97: {
    name: 'BSC Testnet',
    shortName: 'BSC',
    chainIdHex: '0x61',
    chainIdNum: 97,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
  },
  998: {
    name: 'Hyperliquid Testnet',
    shortName: 'Hyperliquid',
    chainIdHex: '0x3e6',
    chainIdNum: 998,
    rpcUrl: 'https://api.hyperliquid-testnet.xyz/evm',
    explorerUrl: 'https://testnet.hyperliquid.xyz',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  },
  5115: {
    name: 'Citrea Testnet',
    shortName: 'Citrea',
    chainIdHex: '0x13fb',
    chainIdNum: 5115,
    rpcUrl: 'https://rpc.testnet.citrea.xyz',
    explorerUrl: 'https://explorer.testnet.citrea.xyz',
    nativeCurrency: { name: 'cBTC', symbol: 'cBTC', decimals: 18 },
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
  },
  8150: {
    name: 'Mezo Testnet',
    shortName: 'Mezo',
    chainIdHex: '0x1fd6',
    chainIdNum: 8150,
    rpcUrl: 'https://rpc.test.mezo.org',
    explorerUrl: 'https://explorer.test.mezo.org',
    nativeCurrency: { name: 'BTC', symbol: 'BTC', decimals: 18 },
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
  },
}

export const BITCOIN_EXPLORER_URL = 'https://mempool.space/testnet'

export function parseGardenChain(chain: string): { type: 'evm'; chainId: number } | { type: 'bitcoin' } | { type: 'other'; raw: string } {
  if (chain === 'bitcoin') return { type: 'bitcoin' }
  if (chain.startsWith('evm:')) {
    const chainId = parseInt(chain.split(':')[1], 10)
    return { type: 'evm', chainId }
  }
  return { type: 'other', raw: chain }
}

export function getEvmChainMeta(chainId: number): ChainMeta | undefined {
  return EVM_CHAINS[chainId]
}

export function getExplorerTxUrl(chain: string, txHash: string): string {
  const parsed = parseGardenChain(chain)
  if (parsed.type === 'bitcoin') {
    const cleanHash = txHash.includes(':') ? txHash.split(':')[0] : txHash
    return `${BITCOIN_EXPLORER_URL}/tx/${cleanHash}`
  }
  if (parsed.type === 'evm') {
    const meta = EVM_CHAINS[parsed.chainId]
    if (meta) return `${meta.explorerUrl}/tx/${txHash}`
  }
  return '#'
}
