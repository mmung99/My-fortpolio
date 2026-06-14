import { useState, useCallback, useEffect, useRef } from 'react'
import { loadFromSheets, saveToSheets } from '../utils/sheets'

const STORAGE_KEY = 'portfolio_v1'

const DEFAULT_STATE = {
  holdings: [],
  transactions: [],
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

function saveLocal(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const COLORS = ['#2563EB','#16A34A','#7C3AED','#DC2626','#D97706','#0891B2','#9D174D','#065F46']

export function usePortfolio() {
  const [state, setState] = useState(loadLocal)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null) // 'ok' | 'error' | null
  const saveTimer = useRef(null)

  // Load from Google Sheets on first mount
  useEffect(() => {
    async function init() {
      setSyncing(true)
      const sheetsData = await loadFromSheets()
      if (sheetsData && (sheetsData.holdings.length > 0 || sheetsData.transactions.length > 0)) {
        setState(sheetsData)
        saveLocal(sheetsData)
        setSyncStatus('ok')
      }
      setSyncing(false)
    }
    init()
  }, [])

  // Auto-save to Sheets (debounced 2s after any change)
  const scheduleSave = useCallback((nextState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncing(true)
      try {
        await saveToSheets(nextState)
        setSyncStatus('ok')
      } catch {
        setSyncStatus('error')
      }
      setSyncing(false)
    }, 2000)
  }, [])

  const commit = useCallback((next) => {
    setState(next)
    saveLocal(next)
    scheduleSave(next)
  }, [scheduleSave])

  const buyStock = useCallback((ticker, name, qty, price, thbAmount, date, note) => {
    setState(prev => {
      const txn = {
        id: Date.now(),
        date,
        ticker: ticker.toUpperCase(),
        type: 'buy',
        qty: Number(qty),
        price: Number(price),
        thbAmount: thbAmount ? Number(thbAmount) : null,
        note,
        realizedPnl: null,
      }

      const holdings = [...prev.holdings]
      const idx = holdings.findIndex(h => h.ticker === ticker.toUpperCase())

      if (idx === -1) {
        const colorIdx = holdings.length % COLORS.length
        holdings.push({
          ticker: ticker.toUpperCase(),
          name: name || ticker.toUpperCase(),
          avgCost: Number(price),
          qty: Number(qty),
          totalInvested: Number(qty) * Number(price),
          totalInvestedThb: thbAmount ? Number(thbAmount) : 0,
          color: COLORS[colorIdx],
        })
      } else {
        const h = { ...holdings[idx] }
        const newTotal = h.totalInvested + Number(qty) * Number(price)
        h.qty = h.qty + Number(qty)
        h.avgCost = newTotal / h.qty
        h.totalInvested = newTotal
        h.totalInvestedThb += thbAmount ? Number(thbAmount) : 0
        holdings[idx] = h
      }

      const next = { holdings, transactions: [txn, ...prev.transactions] }
      saveLocal(next)
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const sellStock = useCallback((ticker, qty, price, date, note) => {
    setState(prev => {
      const holdings = [...prev.holdings]
      const idx = holdings.findIndex(h => h.ticker === ticker.toUpperCase())
      if (idx === -1) return prev

      const h = { ...holdings[idx] }
      const sellQty = Math.min(Number(qty), h.qty)
      const realizedPnl = (Number(price) - h.avgCost) * sellQty

      const txn = {
        id: Date.now(),
        date,
        ticker: ticker.toUpperCase(),
        type: 'sell',
        qty: sellQty,
        price: Number(price),
        thbAmount: null,
        note,
        realizedPnl,
      }

      h.qty -= sellQty
      h.totalInvested -= h.avgCost * sellQty
      if (h.totalInvestedThb > 0) h.totalInvestedThb -= (h.totalInvestedThb / (h.qty + sellQty)) * sellQty

      if (h.qty <= 0) {
        holdings.splice(idx, 1)
      } else {
        holdings[idx] = h
      }

      const next = { holdings, transactions: [txn, ...prev.transactions] }
      saveLocal(next)
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const deleteTransaction = useCallback((id) => {
    setState(prev => {
      const next = { ...prev, transactions: prev.transactions.filter(t => t.id !== id) }
      saveLocal(next)
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const exportCSV = useCallback(() => {
    const { transactions } = state
    const rows = [
      ['วันที่','หุ้น','ประเภท','จำนวน','ราคา/หุ้น ($)','เงิน (บาท)','กำไร/ขาดทุน ($)','หมายเหตุ'],
      ...transactions.map(t => [
        t.date, t.ticker, t.type === 'buy' ? 'ซื้อ' : 'ขาย',
        t.qty, t.price, t.thbAmount ?? '',
        t.realizedPnl != null ? t.realizedPnl.toFixed(2) : '',
        t.note ?? ''
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'portfolio.csv'; a.click()
    URL.revokeObjectURL(url)
  }, [state])

  const summary = useCallback((prices = {}) => {
    const { holdings, transactions } = state
    let totalInvested = 0, totalMarketValue = 0
    holdings.forEach(h => {
      totalInvested += h.totalInvested
      const cur = prices[h.ticker] ?? h.avgCost
      totalMarketValue += cur * h.qty
    })
    const realizedPnl = transactions.reduce((s, t) => s + (t.realizedPnl ?? 0), 0)
    const unrealizedPnl = totalMarketValue - totalInvested
    return { totalInvested, totalMarketValue, realizedPnl, unrealizedPnl }
  }, [state])

  return { ...state, buyStock, sellStock, deleteTransaction, exportCSV, summary, syncing, syncStatus }
}
