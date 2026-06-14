import { useState } from 'react'
import Dashboard from './components/Dashboard'
import Transactions from './components/Transactions'
import './App.css'

export default function App() {
  const [view, setView] = useState('dashboard')

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <span className="nav-icon">📈</span>
          <span className="nav-title">พอร์ตลงทุน</span>
        </div>
        <div className="nav-links">
          <button className={`nav-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>ภาพรวม</button>
          <button className={`nav-btn ${view === 'transactions' ? 'active' : ''}`} onClick={() => setView('transactions')}>บันทึกซื้อ/ขาย</button>
        </div>
      </nav>
      <main className="main">
        {view === 'dashboard' && <Dashboard onAddTrade={() => setView('transactions')} />}
        {view === 'transactions' && <Transactions onBack={() => setView('dashboard')} />}
      </main>
    </div>
  )
}
