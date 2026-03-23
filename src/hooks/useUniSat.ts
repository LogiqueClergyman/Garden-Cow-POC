import { useState, useEffect, useCallback } from 'react'

export interface UniSatState {
  address: string | null
  isConnected: boolean
  balance: { confirmed: number; unconfirmed: number; total: number } | null
}

export function useUniSat() {
  const [state, setState] = useState<UniSatState>({
    address: null,
    isConnected: false,
    balance: null,
  })

  const updateState = useCallback(async () => {
    if (!window.unisat) return
    try {
      const accounts = await window.unisat.getAccounts()
      if (accounts.length > 0) {
        const balance = await window.unisat.getBalance()
        setState({ address: accounts[0], isConnected: true, balance })
      }
    } catch {
      // Not connected yet
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.unisat) {
      window.open('https://unisat.io/', '_blank')
      return
    }
    try {
      await window.unisat.switchNetwork('testnet')
    } catch {
      // Might already be on testnet
    }
    const accounts = await window.unisat.requestAccounts()
    if (accounts.length > 0) {
      const balance = await window.unisat.getBalance()
      setState({ address: accounts[0], isConnected: true, balance })
    }
  }, [])

  const disconnect = useCallback(() => {
    setState({ address: null, isConnected: false, balance: null })
  }, [])

  const refreshBalance = useCallback(async () => {
    if (!window.unisat || !state.isConnected) return
    const balance = await window.unisat.getBalance()
    setState(prev => ({ ...prev, balance }))
  }, [state.isConnected])

  useEffect(() => {
    updateState()
    if (!window.unisat) return

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (accs.length === 0) {
        setState({ address: null, isConnected: false, balance: null })
      } else {
        setState(prev => ({ ...prev, address: accs[0], isConnected: true }))
      }
    }

    window.unisat.on('accountsChanged', handleAccountsChanged)
    return () => {
      window.unisat?.removeListener('accountsChanged', handleAccountsChanged)
    }
  }, [updateState])

  return { ...state, connect, disconnect, refreshBalance }
}
