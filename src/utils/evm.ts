import { ethers } from 'ethers'
import { EVM_CHAINS } from '../constants/chains'

export function getProvider(): ethers.BrowserProvider {
  if (!window.ethereum) throw new Error('MetaMask not found')
  return new ethers.BrowserProvider(window.ethereum)
}

export async function getSigner(): Promise<ethers.JsonRpcSigner> {
  const provider = getProvider()
  return provider.getSigner()
}

export async function getCurrentChainId(): Promise<number> {
  const chainIdHex = (await window.ethereum!.request({
    method: 'eth_chainId',
  })) as string
  return parseInt(chainIdHex, 16)
}

export async function switchChain(chainId: number): Promise<void> {
  const meta = EVM_CHAINS[chainId]
  if (!meta) throw new Error(`Unknown chain ${chainId}`)

  try {
    await window.ethereum!.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: meta.chainIdHex }],
    })
  } catch (err: unknown) {
    const error = err as { code?: number }
    if (error.code === 4902) {
      await window.ethereum!.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: meta.chainIdHex,
            chainName: meta.name,
            rpcUrls: [meta.rpcUrl],
            blockExplorerUrls: [meta.explorerUrl],
            nativeCurrency: meta.nativeCurrency,
          },
        ],
      })
    } else {
      throw err
    }
  }
}

/**
 * Compute 2x gas overrides ensuring maxFeePerGas >= maxPriorityFeePerGas.
 * Testnet baseFees can be extremely low (single-digit wei), so we floor
 * the priority fee at 1.5 gwei and guarantee maxFee always exceeds it.
 */
export async function getGasOverrides(): Promise<{
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}> {
  const provider = getProvider()
  const block = await provider.getBlock('latest')
  const baseFee = block?.baseFeePerGas ?? ethers.parseUnits('1', 'gwei')
  const priorityFee = ethers.parseUnits('1.5', 'gwei')
  const doubleBase = baseFee * 2n
  // maxFee must always be >= priorityFee
  const maxFee = doubleBase > priorityFee ? doubleBase + priorityFee : priorityFee * 2n
  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: priorityFee }
}

export async function sendTransaction(tx: {
  to: string
  data: string
  value: string
  gas_limit: string
  chain_id: number
}): Promise<string> {
  const { maxFeePerGas, maxPriorityFeePerGas } = await getGasOverrides()

  const provider = getProvider()
  const signer = await provider.getSigner()
  const from = await signer.getAddress()

  const txHash = (await window.ethereum!.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gas: tx.gas_limit,
        maxFeePerGas: '0x' + maxFeePerGas.toString(16),
        maxPriorityFeePerGas: '0x' + maxPriorityFeePerGas.toString(16),
      },
    ],
  })) as string

  return txHash
}

export async function waitForTx(txHash: string): Promise<ethers.TransactionReceipt | null> {
  const provider = getProvider()
  return provider.waitForTransaction(txHash)
}

export async function signTypedData(
  typedData: Record<string, unknown>
): Promise<string> {
  const provider = getProvider()
  const signer = await provider.getSigner()
  const address = await signer.getAddress()

  const signature = (await window.ethereum!.request({
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(typedData)],
  })) as string

  return signature
}
