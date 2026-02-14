import { useState } from 'react'
import './App.css'
import { CycleComparisonChart, BearBoxChart, BullBoxChart } from '../components'

function App() {
  const [selectedChart, setSelectedChart] = useState('comparison')
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState('bear') // 'bear' | 'bull' | null

  // 메뉴 데이터
  const menuData = {
    comparison: { 
      title: '사이클 비교', 
      icon: '📈',
      type: 'comparison' 
    },
    bear: {
      title: '하락장 (0~420일)',
      icon: '🐻',
      cycles: [
        { id: 'bear1', label: 'Cycle 1 (2013.12)', cycleNumber: 1 },
        { id: 'bear2', label: 'Cycle 2 (2017.12)', cycleNumber: 2 },
        { id: 'bear3', label: 'Cycle 3 (2021.11)', cycleNumber: 3 },
        { id: 'bear4', label: 'Cycle 4 (2025.01)', cycleNumber: 4, current: true },
      ]
    },
    bull: {
      title: '상승장 (420일~)',
      icon: '🐂',
      cycles: [
        { id: 'bull1', label: 'Cycle 1 (2013.12)', cycleNumber: 1 },
        { id: 'bull2', label: 'Cycle 2 (2017.12)', cycleNumber: 2 },
        { id: 'bull3', label: 'Cycle 3 (2021.11)', cycleNumber: 3 },
      ]
    }
  }

  // 현재 선택된 차트 정보 가져오기
  const getSelectedChartInfo = () => {
    if (selectedChart === 'comparison') {
      return { type: 'comparison', title: '사이클 비교' }
    }
    
    for (const section of ['bear', 'bull']) {
      const found = menuData[section].cycles.find(c => c.id === selectedChart)
      if (found) {
        return { 
          type: section, 
          cycleNumber: found.cycleNumber, 
          title: `${menuData[section].icon} ${found.label}` 
        }
      }
    }
    return { type: 'comparison', title: '사이클 비교' }
  }

  const handleMenuClick = (chartId) => {
    setSelectedChart(chartId)
    setMenuOpen(false)
  }

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  // 차트 렌더링
  const renderChart = () => {
    const info = getSelectedChartInfo()
    
    switch (info.type) {
      case 'comparison':
        return <CycleComparisonChart />
      case 'bear':
        return <BearBoxChart cycleNumber={info.cycleNumber} />
      case 'bull':
        return <BullBoxChart cycleNumber={info.cycleNumber} />
      default:
        return <CycleComparisonChart />
    }
  }

  return (
    <div className="app-container">
      {/* 최소화된 헤더 */}
      <header className="app-header">
        <button 
          className="header-btn menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴"
        >
          ☰
        </button>
        
        <button 
          className="header-btn settings-btn"
          onClick={() => setSettingsOpen(!settingsOpen)}
          aria-label="설정"
        >
          ⚙️
        </button>
      </header>

      {/* 사이드 메뉴 */}
      <div className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">📊</span>
          <span className="sidebar-title">Bitcoin Cycle</span>
        </div>
        
        <nav className="sidebar-nav">
          {/* 사이클 비교 */}
          <button
            className={`nav-item ${selectedChart === 'comparison' ? 'active' : ''}`}
            onClick={() => handleMenuClick('comparison')}
          >
            <span className="nav-icon">{menuData.comparison.icon}</span>
            <span className="nav-text">{menuData.comparison.title}</span>
          </button>

          {/* 하락장 섹션 */}
          <div className="nav-section">
            <button 
              className="nav-section-header"
              onClick={() => toggleSection('bear')}
            >
              <span className="nav-icon">{menuData.bear.icon}</span>
              <span className="nav-text">{menuData.bear.title}</span>
              <span className={`nav-arrow ${expandedSection === 'bear' ? 'expanded' : ''}`}>▾</span>
            </button>
            
            <div className={`nav-section-items ${expandedSection === 'bear' ? 'expanded' : ''}`}>
              {menuData.bear.cycles.map(cycle => (
                <button
                  key={cycle.id}
                  className={`nav-subitem ${selectedChart === cycle.id ? 'active' : ''}`}
                  onClick={() => handleMenuClick(cycle.id)}
                >
                  <span className="nav-text">
                    {cycle.label}
                    {cycle.current && <span className="current-badge">⭐</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 상승장 섹션 */}
          <div className="nav-section">
            <button 
              className="nav-section-header"
              onClick={() => toggleSection('bull')}
            >
              <span className="nav-icon">{menuData.bull.icon}</span>
              <span className="nav-text">{menuData.bull.title}</span>
              <span className={`nav-arrow ${expandedSection === 'bull' ? 'expanded' : ''}`}>▾</span>
            </button>
            
            <div className={`nav-section-items ${expandedSection === 'bull' ? 'expanded' : ''}`}>
              {menuData.bull.cycles.map(cycle => (
                <button
                  key={cycle.id}
                  className={`nav-subitem ${selectedChart === cycle.id ? 'active' : ''}`}
                  onClick={() => handleMenuClick(cycle.id)}
                >
                  <span className="nav-text">{cycle.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* 오버레이 */}
      {(menuOpen || settingsOpen) && (
        <div 
          className="overlay" 
          onClick={() => {
            setMenuOpen(false)
            setSettingsOpen(false)
          }}
        />
      )}

      {/* 설정 패널 */}
      <div className={`settings-panel ${settingsOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <span>⚙️ 차트 설정</span>
          <button className="settings-close" onClick={() => setSettingsOpen(false)}>✕</button>
        </div>
        <div className="settings-content">
          <div className="settings-group">
            <label className="settings-label">X축 (Day)</label>
            <div className="settings-inputs">
              <input type="number" className="settings-input" placeholder="Min" defaultValue="0" />
              <span className="settings-separator">~</span>
              <input type="number" className="settings-input" placeholder="Max" defaultValue="420" />
            </div>
          </div>
          <div className="settings-group">
            <label className="settings-label">Y축 (%)</label>
            <div className="settings-inputs">
              <input type="number" className="settings-input" placeholder="Min" defaultValue="0" />
              <span className="settings-separator">~</span>
              <input type="number" className="settings-input" placeholder="Max" defaultValue="100" />
            </div>
          </div>
          <div className="settings-buttons">
            <button className="settings-apply">적용</button>
            <button className="settings-reset">초기화</button>
          </div>
        </div>
      </div>

      {/* 차트 영역 (풀스크린) */}
      <main className="chart-fullscreen">
        {renderChart()}
      </main>
    </div>
  )
}

export default App
