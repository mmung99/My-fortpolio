import { useState, useEffect, useCallback } from 'react'

// Uses allorigins.win as a CORS proxy to Yahoo Finance
const PROXY = 'https://query1.finance.yahoo.com/v8/finance/chart/'

export function useStockPrices(tickers = []) {
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)

  const fetchPrices = useCallback(async () => {
    if (!tickers.length) return
    setLoading(true)
    setError(null)
    const results = {}
    await Promise.allSettled(
      tickers.map(async (ticker) => {
        try {
          // Use allorigins as CORS proxy
          const url = `https://api.allorigins.win/get?url=${encodeURIComponent(
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=6mo`
          )}`
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
          const json = await res.json()
          const data = JSON.parse(json.contents)
          const result = data?.chart?.result?.[0]
          if (result) {
            const closes = result.indicators?.quote?.[0]?.close ?? []
            const timestamps = result.timestamp ?? []
            const currentPrice = closes[closes.length - 1]
            results[ticker] = {
              price: currentPrice,
              history: timestamps.map((ts, i) => ({
                date: new Date(ts * 1000).toISOString().split('T')[0],
                close: closes[i],
              })).filter(d => d.close != null),
              currency: result.meta?.currency ?? 'USD',
              longName: result.meta?.longName ?? ticker,
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch ${ticker}:`, e.message)
        }
      })
    )
    setPrices(prev => ({ ...prev, ...results }))
    setLastUpdated(new Date())
    setLoading(false)
  }, [tickers.join(',')])

  useEffect(() => {
    fetchPrices()
    // Refresh every 5 minutes while tab is open
    const interval = setInterval(fetchPrices, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPrices])

  return { prices, loading, lastUpdated, error, refetch: fetchPrices }
}
