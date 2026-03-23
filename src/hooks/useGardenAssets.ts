import { useState, useEffect } from 'react'
import { getAssets } from '../api/garden'
import type { GardenAsset } from '../types/garden'
import type { UnifiedAsset, CowToken } from '../types/common'
import { parseGardenChain, EVM_CHAINS } from '../constants/chains'
import { COW_TOKEN_SEPOLIA, WETH_SEPOLIA, SEPOLIA_CHAIN_ID } from '../constants/addresses'
import { parseTokenSymbol, parseTokenName } from '../utils/format'

const COW_TOKEN: CowToken = {
  address: COW_TOKEN_SEPOLIA,
  decimals: 18,
  symbol: 'COW',
  name: 'CoW Protocol Token',
  icon: 'https://raw.githubusercontent.com/cowprotocol/token-lists/main/src/public/images/1/0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB/logo.png',
}

function gardenToUnified(asset: GardenAsset): UnifiedAsset | null {
  const parsed = parseGardenChain(asset.chain)

  if (parsed.type === 'bitcoin') {
    return {
      id: asset.id,
      symbol: parseTokenSymbol(asset.name),
      name: parseTokenName(asset.name),
      chain: asset.chain,
      chainName: 'Bitcoin Testnet',
      chainId: null,
      icon: asset.icon,
      decimals: asset.decimals,
      minAmount: asset.min_amount,
      maxAmount: asset.max_amount,
      price: asset.price,
      tokenAddress: undefined,
      gardenAsset: asset,
    }
  }

  if (parsed.type === 'evm') {
    const chainMeta = EVM_CHAINS[parsed.chainId]
    if (!chainMeta) return null

    return {
      id: asset.id,
      symbol: parseTokenSymbol(asset.name),
      name: parseTokenName(asset.name),
      chain: asset.chain,
      chainName: chainMeta.shortName,
      chainId: parsed.chainId,
      icon: asset.icon,
      decimals: asset.decimals,
      minAmount: asset.min_amount,
      maxAmount: asset.max_amount,
      price: asset.price,
      tokenAddress: asset.token?.address ?? undefined,
      gardenAsset: asset,
    }
  }

  return null
}

export function useGardenAssets() {
  const [assets, setAssets] = useState<UnifiedAsset[]>([])
  const [sourceAssets, setSourceAssets] = useState<UnifiedAsset[]>([])
  const [destAssets, setDestAssets] = useState<UnifiedAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const raw = await getAssets()
        if (cancelled) return

        const unified = raw
          .map(gardenToUnified)
          .filter((a): a is UnifiedAsset => a !== null)

        const cowAsset: UnifiedAsset = {
          id: 'cowswap:cow',
          symbol: 'COW',
          name: 'CoW Protocol Token',
          chain: `evm:${SEPOLIA_CHAIN_ID}`,
          chainName: 'Sepolia',
          chainId: SEPOLIA_CHAIN_ID,
          icon: COW_TOKEN.icon,
          decimals: 18,
          minAmount: '0',
          maxAmount: '0',
          price: 0,
          isCowswapOnly: true,
          tokenAddress: COW_TOKEN_SEPOLIA,
          cowToken: COW_TOKEN,
        }

        const wethAsset: UnifiedAsset = {
          id: 'cowswap:weth',
          symbol: 'WETH',
          name: 'Wrapped Ether',
          chain: `evm:${SEPOLIA_CHAIN_ID}`,
          chainName: 'Sepolia',
          chainId: SEPOLIA_CHAIN_ID,
          icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
          decimals: 18,
          minAmount: '0',
          maxAmount: '0',
          price: 0,
          isCowswapOnly: true,
          tokenAddress: WETH_SEPOLIA,
        }

        const all = [...unified, cowAsset, wethAsset]
        setAssets(all)
        setSourceAssets(unified)
        setDestAssets(all)
        setError(null)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { assets, sourceAssets, destAssets, loading, error }
}
