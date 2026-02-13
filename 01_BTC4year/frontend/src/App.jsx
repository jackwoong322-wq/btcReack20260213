import { useState } from 'react'
import './App.css'

function App() {
  const [selectedChart, setSelectedChart] = useState('main')
  const [menuOpen, setMenuOpen] = useState(false)

  const charts = [
    { id: 'main', title: 'BTC 4년 사이클 비교', icon: '📈', filename: '02_4years_1day_ApexCharts_supabase.html' },
    { id: 'box1', title: 'Cycle1 2013.12', icon: '🔵', filename: '03_boxRanges_cycle_bear1.html' },
    { id: 'box2', title: 'Cycle2 2017.12', icon: '🟢', filename: '03_boxRanges_cycle_bear2.html' },
    { id: 'box3', title: 'Cycle3 2021.11', icon: '🔴', filename: '03_boxRanges_cycle_bear3.html' },
    { id: 'box4', title: 'Cycle4 2025.01', icon: '🟡', filename: '03_boxRanges_cycle_bear4.html' }
  ]

  const selectedChartData = charts.find(c => c.id === selectedChart)

  const handleMenuClick = (chartId) => {
    setSelectedChart(chartId)
    setMenuOpen(false) // 메뉴 선택 시 자동으로 닫힘
  }

  return (
    <div className="app-container">
      {/* 햄버거 버튼 */}
      <button 
        className="hamburger-btn"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      {/* 메뉴 패널 */}
      <div className={`menu-panel ${menuOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <span className="menu-logo">📊</span>
          <span className="menu-title">Bitcoin 분석 차트</span>
        </div>
        
        <nav className="menu-list">
          {charts.map(chart => (
            <button
              key={chart.id}
              className={`menu-item ${selectedChart === chart.id ? 'active' : ''}`}
              onClick={() => handleMenuClick(chart.id)}
            >
              <span className="menu-icon">{chart.icon}</span>
              <span className="menu-text">{chart.title}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 오버레이 */}
      {menuOpen && (
        <div 
          className="overlay" 
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 차트 영역 (전체 화면) */}
      <main className="chart-fullscreen">
        <iframe
          src={`public/charts/${selectedChartData?.filename}`}
          title={selectedChartData?.title}
          className="chart-frame"
        />
      </main>
    </div>
  )
}

export default App
