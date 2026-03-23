import { useState, useEffect, useRef } from 'react'
import { getQuote } from '../api/garden'
import type { GardenQuoteItem } from '../types/garden'

export function useGardenQuote(
  fromAsset: string | null,
  toAsset: string | null,
  fromAmount: string | null
) {
  const [quote, setQuote] = useState<GardenQuoteItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setQuote(null)
    setError(null)

    if (!fromAsset || !toAsset || !fromAmount || fromAmount === '0') {
      setLoading(false)
      return
    }

    setLoading(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      try {
        const quotes = await getQuote(fromAsset, toAsset, fromAmount)
        if (quotes.length > 0) {
          setQuote(quotes[0])
          setError(null)
        } else {
          setError('No quote available')
        }
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
  }, [fromAsset, toAsset, fromAmount])

  return { quote, loading, error }
}
