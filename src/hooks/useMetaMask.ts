import { useState, useEffect, useCallback } from 'react'

export interface MetaMaskState {
  address: string | null
  chainId: number | null
  isConnected: boolean
}

export function useMetaMask() {
  const [state, setState] = useState<MetaMaskState>({
    address: null,
    chainId: null,
    isConnected: false,
  })

  const updateState = useCallback(async () => {
    if (!window.ethereum?.isMetaMask) return
    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_accounts',
      })) as string[]
      const chainIdHex = (await window.ethereum.request({
        method: 'eth_chainId',
      })) as string
      const chainId = parseInt(chainIdHex, 16)
      if (accounts.length > 0) {
        setState({ address: accounts[0], chainId, isConnected: true })
      } else {
        setState({ address: null, chainId, isConnected: false })
      }
    } catch {
      setState({ address: null, chainId: null, isConnected: false })
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum?.isMetaMask) {
      window.open('https://metamask.io/download/', '_blank')
      return
    }
    const accounts = (await window.ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[]
    if (accounts.length > 0) {
      const chainIdHex = (await window.ethereum.request({
        method: 'eth_chainId',
      })) as string
      setState({
        address: accounts[0],
        chainId: parseInt(chainIdHex, 16),
        isConnected: true,
      })
    }
  }, [])

  const disconnect = useCallback(() => {
    setState({ address: null, chainId: null, isConnected: false })
  }, [])

  useEffect(() => {
    updateState()
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (accs.length === 0) {
        setState({ address: null, chainId: null, isConnected: false })
      } else {
        setState(prev => ({ ...prev, address: accs[0], isConnected: true }))
      }
    }

    const handleChainChanged = (chainId: unknown) => {
      const id = parseInt(chainId as string, 16)
      setState(prev => ({ ...prev, chainId: id }))
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener('chainChanged', handleChainChanged)
    }
  }, [updateState])

  return { ...state, connect, disconnect }
}
