export const SEPOLIA_CHAIN_ID = 11155111

export const WETH_SEPOLIA = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
export const COW_TOKEN_SEPOLIA = '0x0625aFB445C3B6B7B929342a04A22599fd5dBB59'
export const COWSWAP_VAULT_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110'
export const COWSWAP_SETTLEMENT = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41'

export const WETH_ABI = [
  'function deposit() payable',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
] as const

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const
