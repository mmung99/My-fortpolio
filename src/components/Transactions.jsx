import { useState, useEffect, useCallback } from 'react'
import { usePortfolio } from '../hooks/usePortfolio'

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const today = () => new Date().toISOString().split('T')[0]
const USD_THB = 36.2

async function fetchTickerInfo(ticker) {
  try {
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
    )}`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const json = await res.json()
    const data = JSON.parse(json.contents)
    const result = data?.chart?.result?.[0]
    if (!result) return null
    const closes = result.indicators?.quote?.[0]?.close ?? []
    const price = closes[closes.length - 1] ?? result.meta?.regularMarketPrice
    return {
      price: parseFloat(price?.toFixed(2)),
      name: result.meta?.longName ?? result.meta?.shortName ?? ticker,
      currency: result.meta?.currency ?? 'USD',
    }
  } catch {
    return null
  }
}

export default function Transactions({ onBack }) {
  const { holdings, transactions, buyStock, sellStock, deleteTransaction, exportCSV } = usePortfolio()

  const [form, setForm] = useState({
    type: 'buy', ticker: '', name: '', qty: '', price: '', thbAmount: '', date: today(), note: '',
  })
  const [tickerInfo, setTickerInfo] = useState(null)
  const [fetchingTicker, setFetchingTicker] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (form.ticker.length < 1) { setTickerInfo(null); return }
    const t = setTimeout(async () => {
      setFetchingTicker(true)
      const info = await fetchTickerInfo(form.ticker)
      setTickerInfo(info)
      if (info) setForm(f => ({ ...f, name: info.name, price: info.price?.toString() ?? f.price }))
      setFetchingTicker(false)
    }, 600)
    return () => clearTimeout(t)
  }, [form.ticker])

  const calcQtyFromThb = useCallback(() => {
    const price = parseFloat(form.price)
    const thb = parseFloat(form.thbAmount)
    if (!price || !thb) return
    set('qty', (Math.floor(thb / USD_THB / price * 100) / 100).toString())
  }, [form.price, form.thbAmount])

  const calcThbFromQty = useCallback(() => {
    const price = parseFloat(form.price)
    const qty = parseFloat(form.qty)
    if (!price || !qty) return
    set('thbAmount', (qty * price * USD_THB).toFixed(0))
  }, [form.price, form.qty])

  const previewUSD = form.qty && form.price ? parseFloat(form.qty) * parseFloat(form.price) : null
  const previewTHB = previewUSD ? previewUSD * USD_THB : null
  const sellHolding = form.type === 'sell' ? holdings.find(h => h.ticker === form.ticker.toUpperCase()) : null
  const previewPnl = sellHolding && form.price ? (parseFloat(form.price) - sellHolding.avgCost) * (parseFloat(form.qty) || 0) : null

  const handleSubmit = () => {
    setError('')
    if (!form.ticker || !form.qty || !form.price) { setError('กรุณากรอก Ticker, จำนวน และราคา'); return }
    if (form.type === 'buy') {
      buyStock(form.ticker, form.name || form.ticker, form.qty, form.price, form.thbAmount || null, form.date, form.note)
    } else {
      const holding = holdings.find(h => h.ticker === form.ticker.toUpperCase())
      if (!holding) { setError(
