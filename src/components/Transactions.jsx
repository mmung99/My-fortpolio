import { useState, useEffect, useCallback } from 'react'
import { usePortfolio } from '../hooks/usePortfolio'

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const today = () => new Date().toISOString().split('T')[0]
const USD_THB = 36.2

// Fetch real-time price + company name from Yahoo Finance
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
    type: 'buy',
    ticker: '',
    name: '',
    qty: '',
    price: '',
    thbAmount: '',
    date: today(),
    note: '',
  })

  const [tickerInfo, setTickerInfo] = useState(null) // { price, name, currency }
  const [fetchingTicker, setFetchingTicker] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-fetch when ticker changes (debounced)
  useEffect(() => {
    if (form.ticker.length < 1) { setTickerInfo(null); return }
    const t = setTimeout(async () => {
      setFetchingTicker(true)
      const info = await fetchTickerInfo(form.ticker)
      setTickerInfo(info)
      if (info) {
        setForm(f => ({
          ...f,
          name: info.name,
          price: info.price?.toString() ?? f.price,
        }))
      }
      setFetchingTicker(false)
    }, 600)
    return () => clearTimeout(t)
  }, [form.ticker])

  // Calculate qty from thbAmount
  const calcQtyFromThb = useCallback(() => {
    const price = parseFloat(form.price)
    const thb = parseFloat(form.thbAmount)
    if (!price || !thb) return
    const usd = thb / USD_THB
    const qty = Math.floor(usd / price * 100) / 100
    set('qty', qty.toString())
  }, [form.price, form.thbAmount])

  // Calculate thbAmount from qty
  const calcThbFromQty = useCallback(() => {
    const price = parseFloat(form.price)
    const qty = parseFloat(form.qty)
    if (!price || !qty) return
    const thb = qty * price * USD_THB
    set('thbAmount', thb.toFixed(0))
  }, [form.price, form.qty])

  // Preview calculations
  const previewUSD = form.qty && form.price ? parseFloat(form.qty) * parseFloat(form.price) : null
  const previewTHB = previewUSD ? previewUSD * USD_THB : null

  // Realized P&L preview for sell
  const sellHolding = form.type === 'sell' ? holdings.find(h => h.ticker === form.ticker.toUpperCase()) : null
  const previewPnl = sellHolding && form.price
    ? (parseFloat(form.price) - sellHolding.avgCost) * (parseFloat(form.qty) || 0)
    : null

  const handleSubmit = () => {
    setError('')
    if (!form.ticker || !form.qty || !form.price) {
      setError('กรุณากรอก Ticker, จำนวน และราคา')
      return
    }
    if (form.type === 'buy') {
      buyStock(form.ticker, form.name || form.ticker, form.qty, form.price, form.thbAmount || null, form.date, form.note)
    } else {
      const holding = holdings.find(h => h.ticker === form.ticker.toUpperCase())
      if (!holding) { setError(`ไม่พบ ${form.ticker.toUpperCase()} ในพอร์ต`); return }
      if (Number(form.qty) > holding.qty) { setError(`มีแค่ ${holding.qty} หุ้นใน ${form.ticker.toUpperCase()}`); return }
      sellStock(form.ticker, form.qty, form.price, form.date, form.note)
    }
    setSubmitted(true)
    setForm({ type: form.type, ticker: '', name: '', qty: '', price: '', thbAmount: '', date: today(), note: '' })
    setTickerInfo(null)
    setTimeout(() => setSubmitted(false), 3000)
  }

  const totalRealizedPnl = transactions.reduce((s, t) => s + (t.realizedPnl ?? 0), 0)

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">บันทึกซื้อ / ขาย</h1>
          <p className="page-sub">{transactions.length} รายการ · กำไรปิดรวม {totalRealizedPnl >= 0 ? '+' : ''}${fmt(totalRealizedPnl)}</p>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={exportCSV}>⬇ Export CSV</button>
          {onBack && <button className="btn-ghost" onClick={onBack}>← ภาพรวม</button>}
        </div>
      </div>

      {/* Form */}
      <div className="section-card">
        <h2 className="section-title">บันทึกรายการใหม่</h2>

        <div className="type-toggle">
          <button className={`toggle-btn ${form.type === 'buy' ? 'buy-active' : ''}`} onClick={() => set('type', 'buy')}>ซื้อ</button>
          <button className={`toggle-btn ${form.type === 'sell' ? 'sell-active' : ''}`} onClick={() => set('type', 'sell')}>ขาย</button>
        </div>

        <div className="form-grid">
          {/* Ticker with live lookup */}
          <div className="form-group">
            <label className="form-label">Ticker * {fetchingTicker && <span style={{color:'#9CA3AF'}}>กำลังค้นหา...</span>}</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="AAPL, NVDA, TSLA..."
                value={form.ticker}
                onChange={e => set('ticker', e.target.value.toUpperCase())}
                list="ticker-list"
              />
              <datalist id="ticker-list">
                {holdings.map(h => <option key={h.ticker} value={h.ticker}>{h.name}</option>)}
              </datalist>
            </div>
            {tickerInfo && (
              <div style={{ fontSize: 11, marginTop: 4, color: '#16A34A' }}>
                ✅ {tickerInfo.name} · ราคาตอนนี้ ${fmt(tickerInfo.price)}
              </div>
            )}
            {!fetchingTicker && form.ticker.length > 1 && !tickerInfo && (
              <div style={{ fontSize: 11, marginTop: 4, color: '#D97706' }}>⚠️ ไม่พบ ticker นี้</div>
            )}
          </div>

          {/* Company name (auto-filled) */}
          <div className="form-group">
            <label className="form-label">ชื่อบริษัท</label>
            <input className="form-input" placeholder="ดึงอัตโนมัติเมื่อกรอก Ticker" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          {/* Price (auto-filled) */}
          <div className="form-group">
            <label className="form-label">ราคา/หุ้น ($) *</label>
            <input
              className="form-input"
              type="number"
              placeholder="ดึงอัตโนมัติ"
              value={form.price}
              onChange={e => set('price', e.target.value)}
            />
          </div>

          {/* THB Amount with auto-calc */}
          {form.type === 'buy' && (
            <div className="form-group">
              <label className="form-label">เงินที่ใส่ (฿)</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="form-input"
                  type="number"
                  placeholder="เช่น 15000"
                  value={form.thbAmount}
                  onChange={e => set('thbAmount', e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn-ghost" style={{ fontSize: 11, padding: '0 10px', whiteSpace: 'nowrap' }} onClick={calcQtyFromThb} title="คำนวณจำนวนหุ้นจากเงินบาท">
                  → หุ้น
                </button>
              </div>
            </div>
          )}

          {/* Qty with auto-calc */}
          <div className="form-group">
            <label className="form-label">จำนวนหุ้น *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="form-input"
                type="number"
                placeholder="10"
                value={form.qty}
                onChange={e => set('qty', e.target.value)}
                style={{ flex: 1 }}
              />
              {form.type === 'buy' && (
                <button className="btn-ghost" style={{ fontSize: 11, padding: '0 10px', whiteSpace: 'nowrap' }} onClick={calcThbFromQty} title="คำนวณเงินบาทจากจำนวนหุ้น">
                  → ฿
                </button>
              )}
            </div>
            {sellHolding && (
              <div style={{ fontSize: 11, marginTop: 4, color: '#6B7280' }}>ถืออยู่ {sellHolding.qty} หุ้น · ทุน ${fmt(sellHolding.avgCost)}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">วันที่</label>
            <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>

          <div className="form-group form-group-full">
            <label className="form-label">หมายเหตุ</label>
            <input className="form-input" placeholder="เช่น DCA รอบที่ 2, TP บางส่วน" value={form.note} onChange={e => set('note', e.target.value)} />
          </div>
        </div>

        {/* Preview */}
        {previewUSD && (
          <div className="preview-bar">
            <span>รวม: <strong>${fmt(previewUSD)}</strong></span>
            <span style={{ color: '#6B7280' }}>≈ ฿{fmt(previewTHB, 0)}</span>
            {previewPnl != null && (
              <span className={previewPnl >= 0 ? 'pos' : 'neg'}>
                กำไร/ขาดทุน: {previewPnl >= 0 ? '+' : ''}${fmt(previewPnl)}
              </span>
            )}
            {tickerInfo && form.qty && (
              <span style={{ color: '#6B7280' }}>
                ราคาปัจจุบัน ${fmt(tickerInfo.price)} · {parseFloat(form.qty)} หุ้น
              </span>
            )}
          </div>
        )}

        {error && <div className="form-error">⚠️ {error}</div>}
        {submitted && <div className="form-success">✅ บันทึกสำเร็จ ซิงค์ไป Google Sheets แล้ว</div>}

        <div style={{ marginTop: 16 }}>
          <button className={`btn-submit ${form.type === 'sell' ? 'btn-sell' : ''}`} onClick={handleSubmit}>
            {form.type === 'buy' ? '+ บันทึกการซื้อ' : '− บันทึกการขาย'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="tx-summary">
        <div className="tx-stat">
          <span className="tx-stat-val">{transactions.filter(t => t.type === 'buy').length}</span>
          <span className="tx-stat-label">รายการซื้อ</span>
        </div>
        <div className="tx-stat">
          <span className="tx-stat-val">{transactions.filter(t => t.type === 'sell').length}</span>
          <span className="tx-stat-label">รายการขาย</span>
        </div>
        <div className="tx-stat">
          <span className={`tx-stat-val ${totalRealizedPnl >= 0 ? 'pos' : 'neg'}`}>
            {totalRealizedPnl >= 0 ? '+' : ''}${fmt(totalRealizedPnl)}
          </span>
          <span className="tx-stat-label">กำไรปิดรวม</span>
        </div>
      </div>

      {/* Transaction Log */}
      <div className="section-card">
        <h2 className="section-title">ประวัติทั้งหมด</h2>
        {transactions.length === 0 ? (
          <div className="ai-empty">ยังไม่มีรายการ</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>หุ้น</th>
                  <th>ประเภท</th>
                  <th className="num">จำนวน</th>
                  <th className="num">ราคา/หุ้น</th>
                  <th className="num">มูลค่ารวม</th>
                  <th className="num">เงิน (฿)</th>
                  <th className="num">กำไร/ขาดทุน</th>
                  <th>หมายเหตุ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td><span className="ticker">{t.ticker}</span></td>
                    <td><span className={`badge ${t.type === 'buy' ? 'badge-pos' : 'badge-neg'}`}>{t.type === 'buy' ? 'ซื้อ' : 'ขาย'}</span></td>
                    <td className="num">{t.qty}</td>
                    <td className="num">${fmt(t.price)}</td>
                    <td className="num">${fmt(t.qty * t.price)}</td>
                    <td className="num">{t.thbAmount ? '฿' + fmt(t.thbAmount, 0) : '—'}</td>
                    <td className="num">
                      {t.realizedPnl != null
                        ? <span className={t.realizedPnl >= 0 ? 'pos' : 'neg'}>{t.realizedPnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(t.realizedPnl))}</span>
                        : '—'}
                    </td>
                    <td style={{ color: '#9CA3AF', fontSize: 12 }}>{t.note || '—'}</td>
                    <td>
                      <button className="del-btn" onClick={() => { if (confirm('ลบรายการนี้?')) deleteTransaction(t.id) }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}