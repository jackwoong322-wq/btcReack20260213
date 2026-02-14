import { useState, useEffect, useRef, useMemo } from 'react'
import Chart from 'react-apexcharts'
import { useCycleComparisonData } from '../hooks/useChartData'
import { COLORS } from '../utils/chartData'
import '../styles/Chart.css'

export default function CycleComparisonChart() {
  const { series, loading, error, maxDays } = useCycleComparisonData()
  const chartRef = useRef(null)
  
  // 축 범위 상태
  const [axisRange, setAxisRange] = useState({ xMin: 0, xMax: 0, yMin: 0, yMax: 100 })
  const [showAxisControls, setShowAxisControls] = useState(false)
  const [hiddenSeries, setHiddenSeries] = useState(new Set())

  // 초기 축 범위 설정
  useEffect(() => {
    if (maxDays > 0) {
      setAxisRange(prev => ({ ...prev, xMax: maxDays }))
    }
  }, [maxDays])

  // 시리즈 토글
  const toggleSeries = (seriesName) => {
    setHiddenSeries(prev => {
      const next = new Set(prev)
      if (next.has(seriesName)) {
        next.delete(seriesName)
      } else {
        next.add(seriesName)
      }
      return next
    })
  }

  // Y축 어노테이션 (각 사이클 최저점)
  const yAxisAnnotations = useMemo(() => {
    const annotations = [
      {
        y: 100,
        borderColor: '#64748B',
        borderWidth: 2,
        strokeDashArray: 6,
        label: {
          borderColor: 'transparent',
          style: { color: '#94A3B8', background: 'transparent', fontSize: '11px', fontWeight: '500' },
          text: 'Peak (100%)',
          position: 'right',
        },
      },
      { y: 50, borderColor: 'rgba(148, 163, 184, 0.3)', borderWidth: 1, strokeDashArray: 3 },
      { y: 25, borderColor: 'rgba(148, 163, 184, 0.3)', borderWidth: 1, strokeDashArray: 3 },
    ]

    series.forEach((s, idx) => {
      annotations.push({
        y: s.minRate,
        borderColor: COLORS[idx % COLORS.length],
        borderWidth: 1.5,
        strokeDashArray: 4,
        label: {
          borderColor: 'transparent',
          style: {
            color: COLORS[idx % COLORS.length],
            background: 'transparent',
            fontSize: '10px',
            fontWeight: '500',
          },
          text: `Cycle ${idx + 1} Min (${s.minRate}%)`,
          position: 'right',
          offsetX: -5,
        },
      })
    })

    return annotations
  }, [series])

  // 차트 옵션
  const chartOptions = useMemo(() => ({
    chart: {
      type: 'line',
      height: '100%',
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: { enabled: true, delay: 150 },
      },
      toolbar: { show: false },
      zoom: { enabled: true, type: 'xy', autoScaleYaxis: true },
      dropShadow: {
        enabled: true,
        color: '#000',
        top: 3,
        left: 0,
        blur: 4,
        opacity: 0.1,
      },
    },
    colors: COLORS.slice(0, series.length),
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2.5, lineCap: 'round' },
    grid: {
      show: true,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      strokeDashArray: 4,
      position: 'back',
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: true } },
    },
    markers: { size: 0, hover: { size: 6, sizeOffset: 3 } },
    xaxis: {
      type: 'numeric',
      min: axisRange.xMin,
      max: axisRange.xMax || maxDays || 1500,
      tickAmount: 14,
      title: {
        text: 'Days Since Peak',
        style: { fontSize: '13px', fontWeight: 600, color: '#94A3B8' },
      },
      labels: { style: { colors: '#94A3B8', fontSize: '11px' } },
      axisBorder: { show: true, color: 'rgba(255, 255, 255, 0.1)' },
      axisTicks: { show: true, color: 'rgba(255, 255, 255, 0.1)' },
      crosshairs: {
        show: true,
        stroke: { color: '#F59E0B', width: 1, dashArray: 3 },
      },
    },
    yaxis: {
      min: axisRange.yMin,
      max: axisRange.yMax,
      tickAmount: 10,
      title: {
        text: 'Price Rate (%) vs. Cycle Peak',
        style: { fontSize: '13px', fontWeight: 600, color: '#94A3B8' },
      },
      labels: {
        style: { colors: '#94A3B8', fontSize: '11px' },
        formatter: (val) => `${val.toFixed(0)}%`,
      },
    },
    tooltip: {
      enabled: true,
      shared: true,
      intersect: false,
      theme: 'dark',
      style: { fontSize: '12px' },
      x: { show: true, formatter: (val) => `Day ${val}` },
      y: { formatter: (val) => `${val.toFixed(2)}%` },
    },
    legend: { show: false },
    annotations: { yaxis: yAxisAnnotations },
  }), [series.length, axisRange, yAxisAnnotations])

  // 필터링된 시리즈
  const filteredSeries = useMemo(() => {
    return series
      .filter(s => !hiddenSeries.has(s.name))
      .map(s => ({ name: s.name, data: s.data }))
  }, [series, hiddenSeries])

  // 축 범위 초기화
  const resetAxisRange = () => {
    setAxisRange({ xMin: 0, xMax: maxDays, yMin: 0, yMax: 100 })
  }

  if (loading) {
    return (
      <div className="chart-page">
        <div className="chart-container">
          <div className="chart-wrapper">
            <div className="loading-container">데이터 로딩 중...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="chart-page">
        <div className="chart-container">
          <div className="chart-wrapper">
            <div className="error-container">오류: {error}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chart-page">
      <div className="chart-container">
        <div className="chart-wrapper">
          {/* 헤더 */}
          <div className="chart-header">
            <div>
              <h2 className="chart-title">Bitcoin Cycles Comparison</h2>
            </div>
            
            {/* 스탯 카드 */}
            <div className="stats">
              {series.map((s, idx) => (
                <div
                  key={s.name}
                  className={`stat-card ${s.colorName} ${hiddenSeries.has(s.name) ? 'inactive' : ''}`}
                  onClick={() => toggleSeries(s.name)}
                >
                  <span className={`stat-label ${s.colorName}`}>
                    C{idx + 1}:{s.startDate}
                  </span>
                  <span className="stat-value">
                    <span>{s.minRate.toFixed(1)}%</span>
                    <span>{s.dayCount}d</span>
                  </span>
                </div>
              ))}
            </div>

            {/* 툴바 */}
            <div className="toolbar">
              <button className="toolbar-btn" title="확대">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
                </svg>
              </button>
              <button className="toolbar-btn" title="축소">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35M8 11h6" />
                </svg>
              </button>
              <div className="toolbar-divider" />
              <button
                className={`toolbar-btn ${showAxisControls ? 'active' : ''}`}
                title="축 설정"
                onClick={() => setShowAxisControls(!showAxisControls)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
              </button>
              <button className="toolbar-btn" title="초기화" onClick={resetAxisRange}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
          </div>

          {/* 축 컨트롤 */}
          <div className={`axis-controls ${showAxisControls ? '' : 'hidden'}`}>
            <div className="axis-group">
              <span className="axis-group-label">X축 (Day)</span>
              <div className="axis-inputs">
                <input
                  type="number"
                  className="axis-input"
                  value={axisRange.xMin}
                  onChange={(e) => setAxisRange(prev => ({ ...prev, xMin: Number(e.target.value) }))}
                />
                <span className="axis-separator">~</span>
                <input
                  type="number"
                  className="axis-input"
                  value={axisRange.xMax}
                  onChange={(e) => setAxisRange(prev => ({ ...prev, xMax: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="axis-group">
              <span className="axis-group-label">Y축 (%)</span>
              <div className="axis-inputs">
                <input
                  type="number"
                  className="axis-input"
                  value={axisRange.yMin}
                  onChange={(e) => setAxisRange(prev => ({ ...prev, yMin: Number(e.target.value) }))}
                />
                <span className="axis-separator">~</span>
                <input
                  type="number"
                  className="axis-input"
                  value={axisRange.yMax}
                  onChange={(e) => setAxisRange(prev => ({ ...prev, yMax: Number(e.target.value) }))}
                />
              </div>
            </div>
            <button className="apply-btn">적용</button>
            <button className="reset-btn" onClick={resetAxisRange}>초기화</button>
          </div>

          {/* 차트 */}
          <div className="chart-area">
            <Chart
              ref={chartRef}
              options={chartOptions}
              series={filteredSeries}
              type="line"
              height="100%"
            />
          </div>

          {/* 푸터 */}
          <div className="chart-footer">
            Data source: Supabase BTC/USDT OHLCV
          </div>
        </div>
      </div>
    </div>
  )
}
