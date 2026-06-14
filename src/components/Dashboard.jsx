import { useMemo, useState } from 'react'
import { usePortfolio } from '../hooks/usePortfolio'
import { useStockPrices } from '../hooks/useStockPrices'
import PriceChart from './PriceChart'
import PortfolioChart from './PortfolioChart'
import AiPanel from './AiPanel'

const USD_THB = 36.2

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function Dashboard({ onAddTrade }) {
  const portfolio = usePortfolio()
  const tickers = portfolio.holdings.map(h => h.ticker)
  const { prices, loading, lastUpdated, refetch } = useStockPrices(tickers)
  const [range, setRange] = useState('3m')

  const currentPrices = useMemo(() => {
    const map = {}
    portfolio.holdings.forEach(h => {
      map[h.ticker] = prices[h.ticker]?.price ?? h.avgCost
    })
    return map
  }, [prices, portfolio.holdings])

  const summaryData = portfolio.summary(currentPrices)
  const { totalInvested, totalMarketValue, realizedPnl, unrealizedPnl } = summaryData
  const { syncing, syncStatus } = portfolio
  const totalPnlPct = totalInvested > 0 ? (unrealizedPnl / totalInvested * 100) : 0

  const holdingsWithPrice = portfolio.holdings.map(h => ({
    ...h,
    current: currentPrices[h.ticker] ?? h.avgCost,
    pnlPct: ((currentPrices[h.ticker] ?? h.avgCost) - h.avgCost) / h.avgCost * 100,
    marketValue: (currentPrices[h.ticker] ?? h.avgCost) * h.qty,
  }))

  if (portfolio.holdings.length === 0 && !syncing) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <h2>ยังไม่มีหุ้นในพอร์ต</h2>
        <p>เริ่มต้นด้วยการบันทึกการซื้อครั้งแรก</p>
        <button className="btn-primary" onClick={onAddTrade}>+ บันทึกการซื้อ</button>
      </div>
    )
  }

  if (syncing && portfolio.holdings.length === 0) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <p style={{ marginTop: 12, color: '#6B7280' }}>กำลังโหลดข้อมูลจาก Google Sheets...</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">ภาพรวมพอร์ต</h1>
          <p className="page-sub">
            {syncing
              ? '☁️ กำลังซิงค์ Google Sheets...'
              : syncStatus === 'ok'
              ? `✅ ซิงค์แล้ว · ${loading ? 'กำลังอัปเดตราคา...' : lastUpdated ? `ราคา ${lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : ''}`
              : syncStatus === 'error'
              ? '⚠️ ซิงค์ไม่สำเร็จ ข้อมูลบันทึก local'
              : loading ? '⏳ กำลังอัปเดตราคา...' : ''}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={refetch} title="รีเฟรชราคา">↻ รีเฟรช</button>
          <button className="btn-primary" onClick={onAddTrade}>+ ซื้อ / ขาย</button>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">เงินที่ลงทุนไป</div>
          <div className="metric-value">${fmt(totalInvested)}</div>
          <div className="metric-sub neutral">฿{fmt(totalInvested * USD_THB, 0)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">มูลค่าตลาดตอนนี้</div>
          <div className="metric-value">${fmt(totalMarketValue)}</div>
          <div className="metric-sub neutral">฿{fmt(totalMarketValue * USD_THB, 0)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">กำไร/ขาดทุน (ยังถือ)</div>
          <div className={`metric-value ${unrealizedPnl >= 0 ? 'pos' : 'neg'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}{fmt(totalPnlPct, 1)}%
          </div>
          <div className={`metric-sub ${unrealizedPnl >= 0 ? 'pos' : 'neg'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}${fmt(unrealizedPnl)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">กำไรที่ขายปิดแล้ว</div>
          <div className={`metric-value ${realizedPnl >= 0 ? 'pos' : 'neg'}`}>
            {realizedPnl >= 0 ? '+' : ''}${fmt(realizedPnl)}
          </div>
          <div className="metric-sub neutral">Realized P&L</div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="section-card">
        <h2 className="section-title">หุ้นที่ถืออยู่</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>หุ้น</th>
                <th className="num">เงินที่ใส่ไป</th>
                <th className="num">ราคาทุนเฉลี่ย</th>
                <th className="num">ราคาปัจจุบัน</th>
                <th className="num">จำนวน</th>
                <th className="num">มูลค่าตลาด</th>
                <th className="num">กำไร/ขาดทุน</th>
              </tr>
            </thead>
            <tbody>
              {holdingsWithPrice.map(h => (
                <tr key={h.ticker}>
                  <td>
                    <div className="ticker-cell">
                      <span className="color-dot" style={{ background: h.color }} />
                      <div>
                        <div className="ticker">{h.ticker}</div>
                        <div className="ticker-name">{prices[h.ticker]?.longName ?? h.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    <div>${fmt(h.totalInvested)}</div>
                    <div className="sub-text">฿{fmt(h.totalInvestedThb, 0)}</div>
                  </td>
                  <td className="num">${fmt(h.avgCost)}</td>
                  <td className="num">
                    <span className={loading ? 'loading-price' : ''}>${fmt(h.current)}</span>
                  </td>
                  <td className="num">{h.qty}</td>
                  <td className="num">${fmt(h.marketValue)}</td>
                  <td className="num">
                    <span className={`badge ${h.pnlPct >= 0 ? 'badge-pos' : 'badge-neg'}`}>
                      {h.pnlPct >= 0 ? '+' : ''}{fmt(h.pnlPct, 1)}%
                    </span>
                    <div className={`sub-text ${h.pnlPct >= 0 ? 'pos' : 'neg'}`}>
                      {h.pnlPct >= 0 ? '+' : ''}${fmt((h.current - h.avgCost) * h.qty)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="two-col">
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">มูลค่าพอร์ตเรา</h2>
            <div className="range-tabs">
              {['1m','3m','6m'].map(r => (
                <button key={r} className={`range-tab ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                  {r === '1m' ? '1 เดือน' : r === '3m' ? '3 เดือน' : '6 เดือน'}
                </button>
              ))}
            </div>
          </div>
          <PortfolioChart holdings={holdingsWithPrice} transactions={portfolio.transactions} range={range} />
        </div>

        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">ราคาหุ้นแต่ละตัว</h2>
            <div className="range-tabs">
              {['1m','3m','6m'].map(r => (
                <button key={r} className={`range-tab ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                  {r === '1m' ? '1M' : r === '3m' ? '3M' : '6M'}
                </button>
              ))}
            </div>
          </div>
          <PriceChart holdings={holdingsWithPrice} prices={prices} range={range} />
        </div>
      </div>

      {/* AI Panel */}
      <AiPanel holdings={holdingsWithPrice} range={range} />
    </div>
  )
}
