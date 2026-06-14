import { useState } from 'react'
import { usePortfolio } from '../hooks/usePortfolio'

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

const today = () => new Date().toISOString().split('T')[0]

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
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

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
    setForm({ type: 'buy', ticker: '', name: '', qty: '', price: '', thbAmount: '', date: today(), note: '' })
    setTimeout(() => setSubmitted(false), 3000)
  }

  const totalRealizedPnl = transactions.reduce((s, t) => s + (t.realizedPnl ?? 0), 0)
  const sellCount = transactions.filter(t => t.type === 'sell').length
  const buyCount = transactions.filter(t => t.type === 'buy').length

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">บันทึกซื้อ / ขาย</h1>
          <p className="page-sub">{transactions.length} รายการทั้งหมด · กำไรปิดรวม {totalRealizedPnl >= 0 ? '+' : ''}${fmt(totalRealizedPnl)}</p>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={exportCSV}>⬇ Export CSV</button>
          {onBack && <button className="btn-ghost" onClick={onBack}>← ภาพรวม</button>}
        </div>
      </div>

      {/* Form */}
      <div className="section-card">
        <h2 className="section-title">บันทึกรายการใหม่</h2>

        {/* Type toggle */}
        <div className="type-toggle">
          <button className={`toggle-btn ${form.type === 'buy' ? 'buy-active' : ''}`} onClick={() => set('type', 'buy')}>ซื้อ</button>
          <button className={`toggle-btn ${form.type === 'sell' ? 'sell-active' : ''}`} onClick={() => set('type', 'sell')}>ขาย</button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Ticker *</label>
            <input
              className="form-input"
              placeholder="AAPL"
              value={form.ticker}
              onChange={e => set('ticker', e.target.value.toUpperCase())}
              list="ticker-list"
            />
            <datalist id="ticker-list">
              {holdings.map(h => <option key={h.ticker} value={h.ticker}>{h.name}</option>)}
            </datalist>
          </div>

          {form.type === 'buy' && (
            <div className="form-group">
              <label className="form-label">ชื่อบริษัท</label>
              <input className="form-input" placeholder="Apple Inc." value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">จำนวนหุ้น *</label>
            <input className="form-input" type="number" placeholder="10" value={form.qty} onChange={e => set('qty', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">ราคา/หุ้น ($) *</label>
            <input className="form-input" type="number" placeholder="185.50" value={form.price} onChange={e => set('price', e.target.value)} />
          </div>

          {form.type === 'buy' && (
            <div className="form-group">
              <label className="form-label">เงินที่ใส่ (฿)</label>
              <input className="form-input" type="number" placeholder="เช่น 15000" value={form.thbAmount} onChange={e => set('thbAmount', e.target.value)} />
            </div>
          )}

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
        {form.qty && form.price && (
          <div className="preview-bar">
            <span>รวม: <strong>${fmt(Number(form.qty) * Number(form.price))}</strong></span>
            {form.type === 'sell' && holdings.find(h => h.ticker === form.ticker) && (() => {
              const h = holdings.find(h => h.ticker === form.ticker)
              const pnl = (Number(form.price) - h.avgCost) * Number(form.qty)
              return <span className={pnl >= 0 ? 'pos' : 'neg'}>กำไร/ขาดทุน: {pnl >= 0 ? '+' : ''}${fmt(pnl)}</span>
            })()}
          </div>
        )}

        {error && <div className="form-error">⚠️ {error}</div>}
        {submitted && <div className="form-success">✅ บันทึกสำเร็จ</div>}

        <div style={{ marginTop: 16 }}>
          <button className={`btn-submit ${form.type === 'sell' ? 'btn-sell' : ''}`} onClick={handleSubmit}>
            {form.type === 'buy' ? '+ บันทึกการซื้อ' : '− บันทึกการขาย'}
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="tx-summary">
        <div className="tx-stat"><span className="tx-stat-val">{buyCount}</span><span className="tx-stat-label">รายการซื้อ</span></div>
        <div className="tx-stat"><span className="tx-stat-val">{sellCount}</span><span className="tx-stat-label">รายการขาย</span></div>
        <div className="tx-stat">
          <span className={`tx-stat-val ${totalRealizedPnl >= 0 ? 'pos' : 'neg'}`}>{totalRealizedPnl >= 0 ? '+' : ''}${fmt(totalRealizedPnl)}</span>
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
                        ? <span className={t.realizedPnl >= 0 ? 'pos' : 'neg'}>{t.realizedPnl >= 0 ? '+' : ''}${fmt(t.realizedPnl)}</span>
                        : '—'}
                    </td>
                    <td style={{ color: '#9CA3AF', fontSize: 12 }}>{t.note || '—'}</td>
                    <td>
                      <button className="del-btn" onClick={() => { if (confirm('ลบรายการนี้?')) deleteTransaction(t.id) }} title="ลบ">✕</button>
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
