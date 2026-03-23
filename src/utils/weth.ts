import { ethers } from 'ethers'
import { WETH_SEPOLIA, WETH_ABI, COWSWAP_VAULT_RELAYER } from '../constants/addresses'
import { getProvider, getGasOverrides } from './evm'

export async function wrapEth(amountWei: bigint): Promise<string> {
  const provider = getProvider()
  const signer = await provider.getSigner()
  const address = await signer.getAddress()

  // Check the user actually has enough ETH
  const balance = await provider.getBalance(address)
  if (balance < amountWei) {
    throw new Error(
      `Insufficient ETH balance. Have ${ethers.formatEther(balance)} ETH, ` +
      `need ${ethers.formatEther(amountWei)} ETH to wrap.`
    )
  }

  const { maxFeePerGas, maxPriorityFeePerGas } = await getGasOverrides()
  const weth = new ethers.Contract(WETH_SEPOLIA, WETH_ABI, signer)

  const tx = await weth.deposit({
    value: amountWei,
    maxFeePerGas,
    maxPriorityFeePerGas,
  })
  const receipt = await tx.wait()
  return receipt.hash
}

export async function approveWethForCowswap(amount: bigint): Promise<string> {
  const provider = getProvider()
  const signer = await provider.getSigner()
  const { maxFeePerGas, maxPriorityFeePerGas } = await getGasOverrides()
  const weth = new ethers.Contract(WETH_SEPOLIA, WETH_ABI, signer)

  const tx = await weth.approve(COWSWAP_VAULT_RELAYER, amount, {
    maxFeePerGas,
    maxPriorityFeePerGas,
  })
  const receipt = await tx.wait()
  return receipt.hash
}

export async function getWethAllowance(owner: string): Promise<bigint> {
  const provider = getProvider()
  const weth = new ethers.Contract(WETH_SEPOLIA, WETH_ABI, provider)
  return weth.allowance(owner, COWSWAP_VAULT_RELAYER)
}

export async function getWethBalance(owner: string): Promise<bigint> {
  const provider = getProvider()
  const weth = new ethers.Contract(WETH_SEPOLIA, WETH_ABI, provider)
  return weth.balanceOf(owner)
}
