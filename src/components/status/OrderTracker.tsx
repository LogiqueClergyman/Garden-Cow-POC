import type { SwapState } from '../../types/common'
import { Spinner } from '../ui/Spinner'
import { shortenAddress } from '../../utils/format'
import { getExplorerTxUrl } from '../../constants/chains'

interface OrderTrackerProps {
  state: SwapState
  isCowswapRoute: boolean
  sourceChain: string
  onSendBtc?: () => void
  onReset: () => void
}

type StepStatus = 'pending' | 'active' | 'done' | 'error'

interface Step {
  label: string
  status: StepStatus
  detail?: string
  link?: string
}

export function OrderTracker({ state, isCowswapRoute, sourceChain, onSendBtc, onReset }: OrderTrackerProps) {
  const steps = buildSteps(state, isCowswapRoute, sourceChain)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Order Progress</h3>
        {(state.phase === 'complete' || state.phase === 'error') && (
          <button
            onClick={onReset}
            className="text-xs text-accent-light hover:text-accent transition-colors"
          >
            New Swap
          </button>
        )}
      </div>

      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          {/* Step indicator */}
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
              ${step.status === 'done' ? 'bg-success/20 text-success' : ''}
              ${step.status === 'active' ? 'bg-accent/20 text-accent-light' : ''}
              ${step.status === 'pending' ? 'bg-surface-3 text-gray-600' : ''}
              ${step.status === 'error' ? 'bg-danger/20 text-danger' : ''}
            `}>
              {step.status === 'done' && <CheckIcon />}
              {step.status === 'active' && <Spinner size={14} />}
              {step.status === 'pending' && <span className="text-xs">{i + 1}</span>}
              {step.status === 'error' && <XIcon />}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-px h-6 ${step.status === 'done' ? 'bg-success/30' : 'bg-surface-3'}`} />
            )}
          </div>

          {/* Step content */}
          <div className="pt-1 pb-3 min-w-0 flex-1">
            <div className={`text-sm font-medium
              ${step.status === 'done' ? 'text-gray-300' : ''}
              ${step.status === 'active' ? 'text-white' : ''}
              ${step.status === 'pending' ? 'text-gray-600' : ''}
              ${step.status === 'error' ? 'text-danger' : ''}
            `}>
              {step.label}
            </div>
            {step.detail && (
              <div className="text-xs text-gray-500 mt-0.5">{step.detail}</div>
            )}
            {step.link && (
              <a
                href={step.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-light hover:underline mt-0.5 inline-block"
              >
                View on explorer
              </a>
            )}
          </div>
        </div>
      ))}

      {/* BTC deposit action */}
      {state.phase === 'awaiting-btc-deposit' && state.btcDepositAddress && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 mt-2">
          <div className="text-sm text-orange-300 font-medium mb-2">Send BTC to complete</div>
          <div className="bg-surface-0 rounded-lg p-3 space-y-2">
            <div>
              <span className="text-xs text-gray-500">Address</span>
              <div className="text-xs text-white font-mono break-all">{state.btcDepositAddress}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Amount</span>
              <div className="text-sm text-white font-semibold">{state.btcDepositAmount} sats</div>
            </div>
          </div>
          {onSendBtc && (
            <button
              onClick={onSendBtc}
              className="btn-primary w-full mt-3 text-sm py-2"
            >
              Send with UniSat
            </button>
          )}
        </div>
      )}

      {/* CowSwap explorer link */}
      {state.cowswapExplorerUrl && (
        <a
          href={state.cowswapExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-purple-400 hover:underline mt-1"
        >
          View on CoW Explorer
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 1H9V7M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}

      {/* Error */}
      {state.phase === 'error' && state.error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 mt-2">
          <div className="text-sm text-danger">{state.error}</div>
        </div>
      )}

      {/* Complete */}
      {state.phase === 'complete' && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4 mt-2 text-center">
          <div className="text-success font-semibold">Swap Complete!</div>
          <div className="text-xs text-gray-400 mt-1">Your tokens have been delivered.</div>
        </div>
      )}
    </div>
  )
}

function buildSteps(state: SwapState, isCowswapRoute: boolean, sourceChain: string): Step[] {
  const isBtc = sourceChain === 'bitcoin'
  const steps: Step[] = []

  // Step 1: Initiate / Deposit
  const step1Label = isBtc ? 'Send BTC deposit' : 'Approve & initiate'
  const step1Status = getStepStatus(state.phase, [
    'awaiting-approval', 'awaiting-initiate', 'awaiting-btc-deposit',
  ], ['garden-pending', 'wrapping-weth', 'approving-cowswap', 'cowswap-signing', 'cowswap-pending', 'complete'])
  steps.push({
    label: step1Label,
    status: step1Status,
    link: state.gardenTxHash ? getExplorerTxUrl(sourceChain, state.gardenTxHash) : undefined,
  })

  // Step 2: Garden processing
  const step2Status = getStepStatus(state.phase, ['garden-pending'], [
    'wrapping-weth', 'approving-cowswap', 'cowswap-signing', 'cowswap-pending', 'complete',
  ])
  steps.push({
    label: 'Garden processing',
    status: step2Status,
    detail: step2Status === 'active' ? 'Waiting for confirmations...' : undefined,
  })

  if (isCowswapRoute) {
    // Step 3: Wrap ETH -> WETH
    const step3Status = getStepStatus(state.phase, ['wrapping-weth'], [
      'approving-cowswap', 'cowswap-signing', 'cowswap-pending', 'complete',
    ])
    steps.push({ label: 'Wrap ETH to WETH', status: step3Status })

    // Step 4: Approve WETH
    const step4Status = getStepStatus(state.phase, ['approving-cowswap'], [
      'cowswap-signing', 'cowswap-pending', 'complete',
    ])
    steps.push({ label: 'Approve WETH for CowSwap', status: step4Status })

    // Step 5: CowSwap
    const step5Status = getStepStatus(state.phase, ['cowswap-signing', 'cowswap-pending'], ['complete'])
    steps.push({
      label: 'CowSwap order',
      status: step5Status,
      detail: state.phase === 'cowswap-pending' ? 'Waiting for solver to fill...' : undefined,
    })
  }

  // Final step: Complete
  steps.push({
    label: 'Complete',
    status: state.phase === 'complete' ? 'done' : 'pending',
  })

  // Override error
  if (state.phase === 'error') {
    const lastActive = steps.findIndex(s => s.status === 'active')
    if (lastActive >= 0) steps[lastActive].status = 'error'
    else {
      // Mark last non-done step as error
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].status !== 'done') {
          steps[i].status = 'error'
          break
        }
      }
    }
  }

  return steps
}

function getStepStatus(
  current: string,
  activePhases: string[],
  donePhases: string[]
): StepStatus {
  if (donePhases.includes(current)) return 'done'
  if (activePhases.includes(current)) return 'active'
  return 'pending'
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
