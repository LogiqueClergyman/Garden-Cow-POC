import { useState, useCallback, useRef } from 'react'
import type { SwapPhase, SwapState, UnifiedAsset } from '../types/common'
import type { GardenQuoteItem } from '../types/garden'
import * as gardenApi from '../api/garden'
import * as cowswapApi from '../api/cowswap'
import { switchChain, sendTransaction, signTypedData, waitForTx } from '../utils/evm'
import { wrapEth, approveWethForCowswap, getWethAllowance } from '../utils/weth'
import { parseGardenChain } from '../constants/chains'
import { WETH_SEPOLIA, SEPOLIA_CHAIN_ID } from '../constants/addresses'

const GARDEN_POLL_INTERVAL = 10_000
const COWSWAP_POLL_INTERVAL = 5_000
const GAS_RESERVE_WEI = BigInt('5000000000000000') // 0.005 ETH for gas

interface CowswapContinuation {
  gardenQuote: GardenQuoteItem
  evmAddress: string
  destToken: string
}

export function useSwapOrchestrator() {
  const [state, setState] = useState<SwapState>({ phase: 'idle' })
  const abortRef = useRef(false)
  // Stores cowswap flow context so sendBtcDeposit can continue the flow
  const cowswapContRef = useRef<CowswapContinuation | null>(null)

  const setPhase = (phase: SwapPhase, extra?: Partial<SwapState>) => {
    setState(prev => ({ ...prev, phase, ...extra }))
  }

  const setError = (error: string) => {
    setState(prev => ({ ...prev, phase: 'error', error }))
  }

  const reset = useCallback(() => {
    abortRef.current = true
    cowswapContRef.current = null
    setState({ phase: 'idle' })
    setTimeout(() => { abortRef.current = false }, 100)
  }, [])

  // Poll Garden order until destination is redeemed
  const pollGardenOrder = useCallback(async (orderId: string): Promise<string | null> => {
    while (!abortRef.current) {
      try {
        const order = await gardenApi.getOrder(orderId)
        const dst = order.destination_swap
        if (dst?.redeem_tx_hash) return dst.redeem_tx_hash

        const src = order.source_swap
        if (src?.initiate_tx_hash) {
          setState(prev => ({ ...prev, gardenTxHash: src.initiate_tx_hash }))
        }
      } catch {
        // Network hiccup, keep polling
      }
      await new Promise(r => setTimeout(r, GARDEN_POLL_INTERVAL))
    }
    return null
  }, [])

  // Poll CowSwap order until fulfilled
  const pollCowSwapOrder = useCallback(async (uid: string): Promise<boolean> => {
    while (!abortRef.current) {
      try {
        const order = await cowswapApi.getCowOrder(uid)
        if (order.status === 'fulfilled') return true
        if (order.status === 'cancelled' || order.status === 'expired') {
          setError(`CowSwap order ${order.status}`)
          return false
        }
      } catch {
        // Network hiccup, keep polling
      }
      await new Promise(r => setTimeout(r, COWSWAP_POLL_INTERVAL))
    }
    return false
  }, [])

  // Complete the CowSwap leg (WETH wrap → approve → sign → submit → poll)
  const completeCowswapLeg = useCallback(async (
    gardenQuote: GardenQuoteItem,
    evmAddress: string,
    destToken: string,
  ) => {
    // Switch to Sepolia
    try {
      await switchChain(SEPOLIA_CHAIN_ID)
    } catch (err) {
      setError(`Chain switch to Sepolia failed: ${(err as Error).message}`)
      return
    }

    // Wrap ETH → WETH
    setPhase('wrapping-weth')
    const wrapAmount = BigInt(gardenQuote.destination.amount)
    const safeWrapAmount = wrapAmount > GAS_RESERVE_WEI ? wrapAmount - GAS_RESERVE_WEI : wrapAmount

    try {
      await wrapEth(safeWrapAmount)
    } catch (err) {
      setError(`WETH wrap failed: ${(err as Error).message}`)
      return
    }

    setState(prev => ({ ...prev, receivedAmount: safeWrapAmount.toString() }))

    // Approve WETH for CowSwap VaultRelayer
    setPhase('approving-cowswap')
    try {
      const allowance = await getWethAllowance(evmAddress)
      if (allowance < safeWrapAmount) {
        const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
        await approveWethForCowswap(maxApproval)
      }
    } catch (err) {
      setError(`WETH approval failed: ${(err as Error).message}`)
      return
    }

    // Get fresh CowSwap quote
    setPhase('cowswap-signing')
    let cowQuote: cowswapApi.CowQuoteResponse
    try {
      cowQuote = await cowswapApi.getCowQuote(
        WETH_SEPOLIA,
        destToken,
        safeWrapAmount.toString(),
        evmAddress
      )
    } catch (err) {
      setError(`CowSwap quote failed: ${(err as Error).message}`)
      return
    }

    // Sign via EIP-712
    let signature: string
    try {
      const typedData = cowswapApi.buildCowOrderTypedData(cowQuote.quote)
      signature = await signTypedData(typedData)
    } catch (err) {
      setError(`Order signing failed: ${(err as Error).message}`)
      return
    }

    // Submit to CowSwap
    let cowOrderUid: string
    try {
      cowOrderUid = await cowswapApi.submitCowOrder(cowQuote, signature, evmAddress)
    } catch (err) {
      setError(`CowSwap order submission failed: ${(err as Error).message}`)
      return
    }

    setState(prev => ({
      ...prev,
      cowswapOrderId: cowOrderUid,
      cowswapExplorerUrl: cowswapApi.getCowExplorerUrl(cowOrderUid),
    }))

    // Poll CowSwap
    setPhase('cowswap-pending')
    const filled = await pollCowSwapOrder(cowOrderUid)
    if (filled && !abortRef.current) {
      setPhase('complete')
    }
  }, [pollCowSwapOrder])

  // Execute a Garden-only swap
  const executeGardenOnly = useCallback(async (
    source: UnifiedAsset,
    dest: UnifiedAsset,
    gardenQuote: GardenQuoteItem,
    evmAddress: string | null,
    btcAddress: string | null,
  ) => {
    abortRef.current = false
    cowswapContRef.current = null
    const srcParsed = parseGardenChain(source.chain)
    const dstParsed = parseGardenChain(dest.chain)

    const sourceOwner = srcParsed.type === 'bitcoin' ? btcAddress : evmAddress
    const destOwner = dstParsed.type === 'bitcoin' ? btcAddress : evmAddress

    if (!sourceOwner || !destOwner) {
      setError('Connect required wallet(s) first')
      return
    }

    setPhase('awaiting-approval')
    let orderResult
    try {
      orderResult = await gardenApi.createOrder({
        source: {
          asset: source.gardenAsset!.id,
          owner: sourceOwner,
          amount: gardenQuote.source.amount,
        },
        destination: {
          asset: dest.gardenAsset!.id,
          owner: destOwner,
          amount: gardenQuote.destination.amount,
        },
      })
    } catch (err) {
      setError(`Order creation failed: ${(err as Error).message}`)
      return
    }

    setState(prev => ({ ...prev, gardenOrderId: orderResult.order_id }))

    if (srcParsed.type === 'bitcoin') {
      // Show deposit info; sendBtcDeposit() continues the flow
      setPhase('awaiting-btc-deposit', {
        btcDepositAddress: orderResult.to,
        btcDepositAmount: orderResult.amount,
      })
      return
    }

    if (srcParsed.type !== 'evm') return

    // EVM source: approval + initiate
    try {
      await switchChain(srcParsed.chainId)
    } catch (err) {
      setError(`Chain switch failed: ${(err as Error).message}`)
      return
    }

    if (orderResult.approval_transaction) {
      setPhase('awaiting-approval')
      try {
        const approveTx = await sendTransaction(orderResult.approval_transaction)
        await waitForTx(approveTx)
      } catch (err) {
        setError(`Approval failed: ${(err as Error).message}`)
        return
      }
    }

    if (orderResult.initiate_transaction) {
      setPhase('awaiting-initiate')
      try {
        const initTx = await sendTransaction(orderResult.initiate_transaction)
        await waitForTx(initTx)
        setState(prev => ({ ...prev, gardenTxHash: initTx }))
      } catch (err) {
        setError(`Initiate failed: ${(err as Error).message}`)
        return
      }
    }

    setPhase('garden-pending')
    const redeemTx = await pollGardenOrder(orderResult.order_id)
    if (redeemTx && !abortRef.current) {
      setPhase('complete', { gardenTxHash: redeemTx })
    }
  }, [pollGardenOrder])

  // Execute a Garden → wrap WETH → CowSwap flow
  const executeGardenThenCowswap = useCallback(async (
    source: UnifiedAsset,
    gardenQuote: GardenQuoteItem,
    evmAddress: string,
    btcAddress: string | null,
    destToken: string,
  ) => {
    abortRef.current = false
    const srcParsed = parseGardenChain(source.chain)

    const sourceOwner = srcParsed.type === 'bitcoin' ? btcAddress : evmAddress
    if (!sourceOwner) {
      setError('Connect required wallet(s) first')
      return
    }

    // Store cowswap context for potential BTC continuation
    cowswapContRef.current = { gardenQuote, evmAddress, destToken }

    setPhase('awaiting-approval')
    let orderResult
    try {
      orderResult = await gardenApi.createOrder({
        source: {
          asset: source.gardenAsset!.id,
          owner: sourceOwner,
          amount: gardenQuote.source.amount,
        },
        destination: {
          asset: 'ethereum_sepolia:eth',
          owner: evmAddress,
          amount: gardenQuote.destination.amount,
        },
      })
    } catch (err) {
      setError(`Order creation failed: ${(err as Error).message}`)
      return
    }

    setState(prev => ({ ...prev, gardenOrderId: orderResult.order_id }))

    if (srcParsed.type === 'bitcoin') {
      // Show deposit info; sendBtcDeposit() continues the flow
      setPhase('awaiting-btc-deposit', {
        btcDepositAddress: orderResult.to,
        btcDepositAmount: orderResult.amount,
      })
      return
    }

    if (srcParsed.type !== 'evm') return

    // EVM source: approval + initiate
    try {
      await switchChain(srcParsed.chainId)
    } catch (err) {
      setError(`Chain switch failed: ${(err as Error).message}`)
      return
    }

    if (orderResult.approval_transaction) {
      setPhase('awaiting-approval')
      try {
        const approveTx = await sendTransaction(orderResult.approval_transaction)
        await waitForTx(approveTx)
      } catch (err) {
        setError(`Approval failed: ${(err as Error).message}`)
        return
      }
    }

    if (orderResult.initiate_transaction) {
      setPhase('awaiting-initiate')
      try {
        const initTx = await sendTransaction(orderResult.initiate_transaction)
        await waitForTx(initTx)
        setState(prev => ({ ...prev, gardenTxHash: initTx }))
      } catch (err) {
        setError(`Initiate failed: ${(err as Error).message}`)
        return
      }
    }

    // Wait for Garden to deliver ETH on Sepolia
    setPhase('garden-pending')
    const redeemTx = await pollGardenOrder(orderResult.order_id)
    if (!redeemTx || abortRef.current) return

    // Continue with CowSwap leg
    await completeCowswapLeg(gardenQuote, evmAddress, destToken)
  }, [pollGardenOrder, completeCowswapLeg])

  // Send BTC deposit (called by user after seeing deposit address)
  const sendBtcDeposit = useCallback(async () => {
    if (!state.btcDepositAddress || !state.btcDepositAmount) return
    if (!window.unisat) {
      setError('UniSat wallet not found')
      return
    }

    try {
      const txid = await window.unisat.sendBitcoin(
        state.btcDepositAddress,
        parseInt(state.btcDepositAmount, 10)
      )
      setState(prev => ({ ...prev, gardenTxHash: txid }))
    } catch (err) {
      setError(`BTC send failed: ${(err as Error).message}`)
      return
    }

    // Poll Garden for completion
    setPhase('garden-pending')
    const orderId = state.gardenOrderId
    if (!orderId) return

    const redeemTx = await pollGardenOrder(orderId)
    if (!redeemTx || abortRef.current) return

    // Check if this is a cowswap continuation
    const cont = cowswapContRef.current
    if (cont) {
      await completeCowswapLeg(cont.gardenQuote, cont.evmAddress, cont.destToken)
    } else {
      setPhase('complete', { gardenTxHash: redeemTx })
    }
  }, [state.btcDepositAddress, state.btcDepositAmount, state.gardenOrderId, pollGardenOrder, completeCowswapLeg])

  return {
    state,
    executeGardenOnly,
    executeGardenThenCowswap,
    sendBtcDeposit,
    reset,
  }
}
