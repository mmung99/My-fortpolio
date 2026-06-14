import { useState } from 'react'

const PERIOD_LABELS = { '1m': '1 เดือน', '3m': '3 เดือน', '6m': '6 เดือน' }

export default function AiPanel({ holdings, range }) {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('analysis') // analysis | dca

  async function runAnalysis(type) {
    setLoading(true)
    setAnalysis('')
    setMode(type)

    const holdingSummary = holdings.map(h => {
      const pnl = ((h.current - h.avgCost) / h.avgCost * 100).toFixed(1)
      return `${h.ticker}: ราคาทุน $${h.avgCost.toFixed(2)}, ราคาปัจจุบัน $${h.current.toFixed(2)}, กำไร/ขาดทุน ${pnl}%, ถือ ${h.qty} หุ้น, เงินลงทุน $${h.totalInvested.toFixed(0)}`
    }).join('\n')

    const period = PERIOD_LABELS[range] ?? range

    const prompt = type === 'dca'
      ? `ผมใช้กลยุทธ์ DCA แบบ Balance — ตัวไหนลงเยอะซื้อเยอะหน่อย\n\nพอร์ตปัจจุบัน:\n${holdingSummary}\n\nช่วยแนะนำ:\n1. ถ้ามีเงิน $500 จะแบ่ง DCA อย่างไรในแต่ละตัว (บอกเป็น % และ $)\n2. ลำดับความสำคัญที่ควรซื้อเพิ่มพร้อมเหตุผล\n3. จังหวะที่ควรรอก่อนซื้อ (แนวรับ, indicator)\n4. ตัวไหนที่ thesis เปลี่ยนไปและควรระวัง\nตอบเป็นภาษาไทย กระชับ ตรงประเด็น`
      : `วิเคราะห์พอร์ตหุ้นสหรัฐช่วง ${period} ที่ผ่านมา:\n\n${holdingSummary}\n\nขอวิเคราะห์:\n1. ทำไมแต่ละตัวถึงขึ้น/ลงในช่วงนี้ (อ้างปัจจัยจริง เช่น earnings, macro, sector rotation)\n2. Fear & Greed Index ตอนนี้อยู่ระดับไหน และหมายความว่าอะไรกับพอร์ตนี้\n3. Thesis ของแต่ละตัวยังครบสมบูรณ์ไหม มีข่าวใหญ่อะไรที่กระทบ\n4. Indicator อื่นๆ ที่น่าสนใจ เช่น RSI, Valuation vs peers\n5. สรุปข้อควรระวังและโอกาสที่เห็น\nตอบเป็นภาษาไทย ใช้ emoji หัวข้อ กระชับ อ่านง่าย`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content
        ?.filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n') ?? 'ไม่สามารถวิเคราะห์ได้'
      setAnalysis(text)
    } catch (e) {
      setAnalysis('❌ เกิดข้อผิดพลาด: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div className="section-card ai-card">
      <div className="section-header">
        <h2 className="section-title">🤖 AI วิเคราะห์พอร์ต</h2>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => runAnalysis('analysis')} disabled={loading || !holdings.length}>
            {loading && mode === 'analysis' ? '⏳ กำลังวิเคราะห์...' : '📊 วิเคราะห์เชิงลึก'}
          </button>
          <button className="btn-primary" onClick={() => runAnalysis('dca')} disabled={loading || !holdings.length}>
            {loading && mode === 'dca' ? '⏳ กำลังคำนวณ...' : '💰 แนะนำ DCA'}
          </button>
        </div>
      </div>

      {!analysis && !loading && (
        <div className="ai-empty">
          <p>กดปุ่ม "วิเคราะห์เชิงลึก" เพื่อให้ AI อธิบายว่าทำไมหุ้นแต่ละตัวถึงขึ้น/ลง, ตรวจ thesis, และแนะนำ DCA</p>
          <p style={{ marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>ใช้ข้อมูลย้อนหลัง {PERIOD_LABELS[range]} และข่าวล่าสุดจากการ search จริง</p>
        </div>
      )}

      {loading && (
        <div className="ai-loading">
          <div className="spinner" />
          <span>กำลัง search ข่าวและวิเคราะห์...</span>
        </div>
      )}

      {analysis && !loading && (
        <div className="ai-result">
          {analysis.split('\n').map((line, i) => (
            <p key={i} style={{ marginBottom: line === '' ? 8 : 2 }}>{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}
