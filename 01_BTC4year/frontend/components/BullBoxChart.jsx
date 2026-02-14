import { useState, useRef, useMemo, useCallback } from 'react'
import Chart from 'react-apexcharts'
import { useBullBoxData } from '../hooks/useChartData'
import '../styles/Chart.css'

export default function BullBoxChart({ cycleNumber = 3 }) {
  const { lineData, boxes, loading, error, cycleInfo, config } = useBullBoxData(cycleNumber)
  const chartRef = useRef(null)
  const [chartInstance, setChartInstance] = useState(null)

  // 박스 사각형 그리기
  const drawBoxRects = useCallback((chartContext) => {
    if (!chartContext || !boxes.length) return

    const chartEl = chartContext.el
    const gridRect = chartEl?.querySelector('.apexcharts-grid')
    if (!gridRect) return

    // 기존 박스 제거
    chartEl.querySelectorAll('.box-rect-group').forEach(el => el.remove())

    // 새 그룹 생성
    const rectGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    rectGroup.setAttribute('class', 'box-rect-group')

    const w = chartContext.w
    const xMin = w.config.xaxis.min ?? config.MIN_DAYS_FROM_PEAK
    const xMax = w.config.xaxis.max ?? cycleInfo.maxDays
    const yMin = w.config.yaxis[0].min ?? 0
    const yMax = w.config.yaxis[0].max ?? 100

    const gridBBox = gridRect.getBBox()
    const { x: gridX, y: gridY, width: gridWidth, height: gridHeight } = gridBBox

    boxes.forEach(box => {
      const x1 = gridX + ((box.Start_Day - xMin) / (xMax - xMin)) * gridWidth
      const x2 = gridX + ((box.End_Day - xMin) / (xMax - xMin)) * gridWidth
      // Bull: Start_Rate가 고점, Low_Rate가 저점
      const yTop = gridY + ((yMax - box.Start_Rate) / (yMax - yMin)) * gridHeight
      const yBottom = gridY + ((yMax - box.Low_Rate) / (yMax - yMin)) * gridHeight

      const rectWidth = Math.abs(x2 - x1)
      const rectHeight = Math.abs(yBottom - yTop)
      const rectX = Math.min(x1, x2)
      const rectY = Math.min(yTop, yBottom)

      if (rectWidth > 0 && rectHeight > 0) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', rectX)
        rect.setAttribute('y', rectY)
        rect.setAttribute('width', rectWidth)
        rect.setAttribute('height', rectHeight)
        rect.setAttribute('fill', box.color)
        rect.setAttribute('fill-opacity', '0.15')
        rect.setAttribute('stroke', box.color)
        rect.setAttribute('stroke-width', '1.5')
        rect.setAttribute('stroke-opacity', '0.8')
        rectGroup.appendChild(rect)
      }
    })

    if (gridRect.parentNode) {
      gridRect.parentNode.insertBefore(rectGroup, gridRect)
    }
  }, [boxes, config.MIN_DAYS_FROM_PEAK, cycleInfo.maxDays])

 // 포인트 어노테이션 (저점/고점 마커)
  const pointAnnotations = useMemo(() => {
    const annotations = []
    const highColor = '#F87171'
    const lowColor = '#34D399'

    boxes.forEach((box, idx) => {
      const prevLow = idx > 0 ? boxes[idx - 1].Low_Rate : box.Start_Rate
      const riseFromPrevLow = ((box.Start_Rate - prevLow) / prevLow * 100).toFixed(0)
      const dropFromHigh = ((box.Low_Rate - box.Start_Rate) / box.Start_Rate * 100).toFixed(0)

      // 고점 마커
      annotations.push({
        x: box.Start_Day,
        y: box.Start_Rate,
        marker: { size: 5, fillColor: highColor, strokeColor: '#fff', strokeWidth: 1, shape: 'triangle' },
        label: {
          borderColor: 'transparent',
          style: { 
            color: '#991B1B', 
            background: '#FECACA', 
            fontSize: '10px', 
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            padding: { left: 4, right: 4, top: 2, bottom: 2 } 
          },
          text: `H${box.Box_ID} ${box.Start_Rate}% (+${riseFromPrevLow}%)`,
          offsetY: -8,
        },
      })

      // 저점 마커
      annotations.push({
        x: box.Low_Day,
        y: box.Low_Rate,
        marker: { size: 5, fillColor: lowColor, strokeColor: '#fff', strokeWidth: 1 },
        label: {
          borderColor: lowColor,
          style: { 
            color: '#fff', 
            background: lowColor, 
            fontSize: '10px', 
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            padding: { left: 4, right: 4, top: 2, bottom: 2 } 
          },
          text: `L${box.Box_ID} ${box.Low_Rate}% (${dropFromHigh}%)`,
          offsetY: 20,
          position: 'bottom',
        },
      })
    })

    return annotations
  }, [boxes])

  // 차트 옵션
  const chartOptions = useMemo(() => ({
    chart: {
      type: 'line',
      height: '100%',
      fontFamily: "'JetBrains Mono', monospace",
      background: 'transparent',
      toolbar: { show: true },
      zoom: { enabled: true, type: 'xy' },
      events: {
        mounted: (chartContext) => {
          setChartInstance(chartContext)
          setTimeout(() => drawBoxRects(chartContext), 100)
        },
        updated: (chartContext) => {
          setTimeout(() => drawBoxRects(chartContext), 50)
        },
        zoomed: (chartContext) => {
          setTimeout(() => drawBoxRects(chartContext), 50)
        },
        animationEnd: (chartContext) => {
          drawBoxRects(chartContext)
        },
      },
    },
    colors: ['#3B82F6'],
    stroke: { curve: 'smooth', width: 2 },
    grid: { borderColor: 'rgba(255,255,255,0.08)', strokeDashArray: 4 },
    xaxis: {
      type: 'numeric',
      min: config.MIN_DAYS_FROM_PEAK,
      max: cycleInfo.maxDays || 1500,
      tickAmount: 14,
      title: { text: 'Days Since Peak', style: { color: '#94A3B8' } },
      labels: { style: { colors: '#94A3B8' } },
    },
    yaxis: {
      min: 0,
      max: Math.max(100, ...boxes.map(b => b.Start_Rate), ...lineData.map(d => d.y)) + 10,
      tickAmount: 10,
      title: { text: 'Rate (% of Peak)', style: { color: '#94A3B8' } },
      labels: {
        style: { colors: '#94A3B8' },
        formatter: (v) => `${v.toFixed(0)}%`,
      },
    },
    tooltip: {
      theme: 'dark',
      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
        const data = w.config.series[seriesIndex].data[dataPointIndex]
        if (!data) return ''

        const day = data.x
        const rate = data.y
        const dateStr = data.timestamp
        const boxDay = data.box_day
        const boxDuration = data.box_duration
        const boxHigh = data.box_high
        const boxLow = data.box_low
        const prevLow = data.prev_low

        const header = `Cycle ${cycleNumber} : ${dateStr} (${rate.toFixed(2)}%)`
        let line2 = ''

        if (boxDuration !== null && boxHigh !== null && boxLow !== null && boxDay !== null) {
          const distToHigh = Math.abs(rate - boxHigh)
          const distToLow = Math.abs(rate - boxLow)

          if (distToHigh <= distToLow) {
            const pctFromHigh = ((rate - boxHigh) / boxHigh * 100).toFixed(0)
            const sign = pctFromHigh >= 0 ? '+' : ''
            line2 = `${day}d 박스(${boxDay}/${boxDuration}d) 고점대비:${sign}${pctFromHigh}%`
          } else {
            const pctFromLow = ((rate - boxLow) / boxLow * 100).toFixed(0)
            const sign = pctFromLow >= 0 ? '+' : ''
            line2 = `${day}d 박스(${boxDay}/${boxDuration}d) 저점대비:${sign}${pctFromLow}%`
          }
        } else {
          const pctFromPrevLow = ((rate - prevLow) / prevLow * 100).toFixed(0)
          const sign = pctFromPrevLow >= 0 ? '+' : ''
          line2 = `${day}d 전저점대비:${sign}${pctFromPrevLow}%`
        }

        return `
          <div class="apexcharts-tooltip-title" style="font-family:JetBrains Mono,monospace;font-size:12px;">● ${header}</div>
          <div class="apexcharts-tooltip-series-group apexcharts-active" style="display:flex;padding:6px 10px;">
            <div class="apexcharts-tooltip-text" style="font-family:JetBrains Mono,monospace;font-size:12px;">
              <span class="apexcharts-tooltip-text-y-value">${line2}</span>
            </div>
          </div>
        `
      },
    },
    annotations: { points: pointAnnotations },
    legend: { show: false },
  }), [cycleNumber, config.MIN_DAYS_FROM_PEAK, cycleInfo.maxDays, boxes, lineData, pointAnnotations, drawBoxRects])

  // 시리즈 데이터
  const seriesData = useMemo(() => [{
    name: `Cycle ${cycleNumber}`,
    data: lineData,
  }], [cycleNumber, lineData])

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
              <h2 className="chart-title">
                Cycle {cycleNumber} Bull ({cycleInfo.startDate}~{cycleInfo.endDate}) - Correction Box Range Analysis
              </h2>
              <p className="chart-subtitle">
                Drop ≥{config.DROP_THRESHOLD}%, Breakup &lt;{config.BREAK_THRESHOLD}%
              </p>
            </div>
          </div>

          {/* 차트 */}
          <div className="chart-area">
            <Chart
              ref={chartRef}
              options={chartOptions}
              series={seriesData}
              type="line"
              height="100%"
            />
          </div>

          {/* 푸터 */}
          <div className="chart-footer">
            Data source: Supabase BTC/USDT OHLCV (Day {config.MIN_DAYS_FROM_PEAK}~{cycleInfo.maxDays})
          </div>
        </div>
      </div>
    </div>
  )
}
