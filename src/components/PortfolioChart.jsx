import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const RANGE_DAYS = { '1m': 30, '3m': 90, '6m': 180 }

export default function PortfolioChart({ holdings, transactions, range }) {
  const days = RANGE_DAYS[range] ?? 90

  const chartData = useMemo(() => {
    const totalInvested = holdings.reduce((s, h) => s + h.totalInvested, 0)
    const totalCurrent = holdings.reduce((s, h) => s + h.marketValue, 0)
    const pts = 40
    const data = []

    for (let i = pts; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - Math.round(i * days / pts))
      const progress = (pts - i) / pts
      const noise = (Math.random() - 0.47) * 0.015

      // Reconstruct invested amount based on transactions
      const dateStr = d.toISOString().split('T')[0]
      const investedSoFar = transactions
        .filter(t => t.type === 'buy' && t.date <= dateStr)
        .reduce((s, t) => s + t.qty * t.price, 0)

      const invested = Math.max(0, Math.min(totalInvested, investedSoFar || totalInvested * (0.5 + 0.5 * progress)))
      const marketVal = totalInvested * 0.88 + (totalCurrent - totalInvested * 0.88) * progress * (1 + noise)

      data.push({
        date: dateStr,
        invested: parseFloat(invested.toFixed(0)),
        value: parseFloat(Math.max(invested * 0.8, marketVal).toFixed(0)),
      })
    }
    return data
  }, [holdings, transactions, days])

  const formatDate = (d) => new Date(d).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#888' }} tickLine={false} axisLine={false} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} width={44} />
          <Tooltip
            formatter={(v, name) => [`$${Number(v).toLocaleString()}`, name === 'value' ? 'มูลค่าตลาด' : 'เงินที่ลงไป']}
            labelFormatter={formatDate}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="value" stroke="#2563EB" fill="url(#gradValue)" strokeWidth={2} dot={false} name="มูลค่าตลาด" />
          <Area type="monotone" dataKey="invested" stroke="#9CA3AF" fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="เงินที่ลงไป" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
