import { useState, useEffect, useRef } from 'react'
import { getCowQuote, type CowQuoteResponse } from '../api/cowswap'

export function useCowSwapQuote(
  sellToken: string | null,
  buyToken: string | null,
  sellAmount: string | null,
  from: string | null
) {
  const [quote, setQuote] = useState<CowQuoteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setQuote(null)
    setError(null)

    if (!sellToken || !buyToken || !sellAmount || sellAmount === '0' || !from) {
      setLoading(false)
      return
    }

    setLoading(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const q = await getCowQuote(sellToken, buyToken, sellAmount, from)
        setQuote(q)
        setError(null)
      } catch (err) {
        setError((err as Error).message)
        setQuote(null)
      } finally {
        setLoading(false)
      }
    }, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [sellToken, buyToken, sellAmount, from])

  return { quote, loading, error }
}
