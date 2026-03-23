/// <reference types="vite/client" />

interface Window {
  ethereum?: {
    isMetaMask?: boolean
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    on: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  }
  unisat?: {
    requestAccounts: () => Promise<string[]>
    getAccounts: () => Promise<string[]>
    getBalance: () => Promise<{ confirmed: number; unconfirmed: number; total: number }>
    getNetwork: () => Promise<string>
    switchNetwork: (network: string) => Promise<void>
    sendBitcoin: (to: string, amount: number, options?: { feeRate?: number }) => Promise<string>
    on: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  }
}
