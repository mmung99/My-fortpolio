import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const RANGE_DAYS = { '1m': 30, '3m': 90, '6m': 180 }

export default function PriceChart({ holdings, prices, range }) {
  const days = RANGE_DAYS[range] ?? 90

  const chartData = useMemo(() => {
    // Use real history if available for first holding, else generate
    const allDates = new Set()
    holdings.forEach(h => {
      const hist = prices[h.ticker]?.history ?? []
      hist.forEach(d => allDates.add(d.date))
    })

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    let dates = [...allDates].filter(d => new Date(d) >= cutoff).sort()

    // If no real data, generate mock
    if (dates.length === 0) {
      const pts = 40
      for (let i = pts; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - Math.round(i * days / pts))
        dates.push(d.toISOString().split('T')[0])
      }
      dates = [...new Set(dates)].sort()
    }

    return dates.map(date => {
      const point = { date }
      holdings.forEach(h => {
        const hist = prices[h.ticker]?.history ?? []
        const found = hist.find(d => d.date === date)
        // If no exact match, use last known price
        if (found) {
          point[h.ticker] = found.close
        } else if (hist.length > 0) {
          const before = hist.filter(d => d.date <= date)
          point[h.ticker] = before.length ? before[before.length - 1].close : h.avgCost
        } else {
          // Mock: random walk from avgCost
          point[h.ticker] = h.avgCost * (0.9 + Math.random() * 0.2)
        }
      })
      return point
    })
  }, [holdings, prices, days])

  const formatDate = (d) => {
    const date = new Date(d)
    return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
  }

  if (holdings.length === 0) return <div className="chart-empty">ยังไม่มีหุ้น</div>

  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: '#888' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#888' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => '$' + v.toFixed(0)}
            width={50}
          />
          <Tooltip
            formatter={(v, name) => [`$${v?.toFixed(2)}`, name]}
            labelFormatter={formatDate}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {holdings.map(h => (
            <Line
              key={h.ticker}
              type="monotone"
              dataKey={h.ticker}
              stroke={h.color}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
