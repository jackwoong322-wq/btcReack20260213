import { supabase } from '../lib/supabase'

// ==================== 설정 ====================
export const CYCLE_TABLE_NAME = 'bitcoin_cycle_data'

// Bear (하락장) 설정
export const BEAR_CONFIG = {
  RISE_THRESHOLD: 5.0,       // 박스 인식을 위한 최소 상승률 (%)
  BREAK_THRESHOLD: 2.0,      // 박스 이탈 기준 (%)
  MIN_DURATION_DAYS: 1,      // 최소 박스 기간 (일)
  MAX_DURATION_DAYS: 420,    // 최대 분석 기간 (일)
  MIN_DROP_FROM_PREV_HIGH: 3.0,  // 이전 고점 대비 최소 하락률 (%)
}

// Bull (상승장) 설정
export const BULL_CONFIG = {
  MIN_DAYS_FROM_PEAK: 420,   // 420일부터 상승장 분석
  DROP_THRESHOLD: 5.0,       // 하락률 5% 이상
  BREAK_THRESHOLD: 2.0,      // 고점에서 2% 이상 상승 시 박스 종료
  MIN_DURATION_DAYS: 1,
  LOOKBACK_DAYS: 10,         // N일 범위에서 최고점일 때만 고점으로 인정
}

// 차트 색상
export const COLORS = [
  '#3B82F6', '#10B981', '#EF4444', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
]

export const COLOR_NAMES = ['blue', 'green', 'red', 'orange', 'purple', 'pink', 'cyan', 'lime']

// ==================== 데이터 로딩 ====================

/**
 * Supabase에서 사이클 데이터 로드
 */
export async function fetchCycleData(maxDays = null, minDays = null) {
  console.log('=== fetchCycleData 호출 ===')
  console.log('파라미터 - maxDays:', maxDays, ', minDays:', minDays)
  
  let allData = []
  let offset = 0
  const batchSize = 1000
  
  while (true) {
    let query = supabase
      .from(CYCLE_TABLE_NAME)
      .select('cycle_number, days_since_peak, timestamp, close_rate, low_rate, high_rate')
      .order('days_since_peak', { ascending: true })
      .order('cycle_number', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (maxDays !== null) {
      query = query.lte('days_since_peak', maxDays)
    }
    if (minDays !== null) {
      query = query.gte('days_since_peak', minDays)
    }

    const { data, error } = await query

    if (error) {
      console.error('데이터 로드 오류:', error)
      return null
    }

    if (!data || data.length === 0) {
      break
    }

    allData = [...allData, ...data]
    
    if (data.length < batchSize) {
      break
    }
    
    offset += batchSize
  }

  console.log('응답 - 총 data 개수:', allData.length)
  console.log('응답 - days_since_peak 범위:', 
    allData.length ? `${Math.min(...allData.map(d => d.days_since_peak))} ~ ${Math.max(...allData.map(d => d.days_since_peak))}` : 'N/A'
  )

  return allData
}

/**
 * 데이터를 사이클별로 그룹화
 */
export function groupByCycle(data) {
  const cycles = {}
  
  data.forEach(row => {
    const cycleNum = row.cycle_number
    if (!cycles[cycleNum]) {
      cycles[cycleNum] = []
    }
    cycles[cycleNum].push({
      day: row.days_since_peak,
      timestamp: row.timestamp,
      closeRate: row.close_rate,
      lowRate: row.low_rate,
      highRate: row.high_rate,
    })
  })

  return cycles
}

// ==================== 사이클 비교 차트용 ====================

/**
 * 사이클 비교 차트용 시리즈 데이터 생성
 */
export function createCycleComparisonSeries(cycles) {
  const series = []

  Object.keys(cycles).sort((a, b) => Number(a) - Number(b)).forEach((cycleNum, idx) => {
    const cycleData = cycles[cycleNum]
    if (cycleData.length === 0) return

    const startDate = formatDate(cycleData[0].timestamp)
    const endDate = formatDate(cycleData[cycleData.length - 1].timestamp)
    const minRate = Math.min(...cycleData.map(d => d.closeRate))

    series.push({
      name: `Cycle ${cycleNum} : ${startDate}`,
      data: cycleData.map(d => ({ x: d.day, y: Math.round(d.closeRate * 100) / 100 })),
      startDate,
      endDate,
      dayCount: cycleData.length,
      minRate: Math.round(minRate * 100) / 100,
      color: COLORS[idx % COLORS.length],
      colorName: COLOR_NAMES[idx % COLOR_NAMES.length],
    })
  })

  return series
}

// ==================== Bear (하락장) 박스권 계산 ====================

/**
 * 5% 상승 전까지의 진짜 최저점 찾기
 */
function findTrueLowBeforeRise(cycleData, startIdx, config) {
  if (startIdx >= cycleData.length) return { low: null, idx: null }

  let minLow = cycleData[startIdx].lowRate
  let minLowIdx = startIdx

  for (let j = startIdx; j < cycleData.length; j++) {
    const currentLow = cycleData[j].lowRate
    const currentHigh = cycleData[j].highRate

    if (currentLow < minLow) {
      minLow = currentLow
      minLowIdx = j
    }

    if (j > minLowIdx && currentHigh - minLow >= config.RISE_THRESHOLD) {
      return { low: minLow, idx: minLowIdx }
    }
  }

  return { low: null, idx: null }
}

/**
 * 저점 이후 5% 상승하는 고점 찾기
 */
function findRisePeak(cycleData, startIdx, localLow, config) {
  let tempMax = localLow
  let tempMaxIdx = startIdx

  for (let j = startIdx + 1; j < cycleData.length; j++) {
    const currentHigh = cycleData[j].highRate
    if (currentHigh > tempMax) {
      tempMax = currentHigh
      tempMaxIdx = j
    }
    if (tempMax - localLow >= config.RISE_THRESHOLD) {
      return { achieved: true, max: tempMax, idx: tempMaxIdx }
    }
  }

  return { achieved: false, max: tempMax, idx: tempMaxIdx }
}

/**
 * Bear 박스 종료 지점 찾기
 */
function findBearBoxEnd(cycleData, localLowIdx, localLow, startSearchIdx, tempMax, tempMaxIdx, config) {
  const breakThreshold = localLow - (localLow * config.BREAK_THRESHOLD / 100)
  const maxSearchIdx = Math.min(cycleData.length, localLowIdx + config.MAX_DURATION_DAYS)

  let boxEndIdx = startSearchIdx
  let boxBroken = false
  let maxHigh = tempMax
  let maxIdx = tempMaxIdx

  for (let k = startSearchIdx + 1; k < maxSearchIdx; k++) {
    const checkLow = cycleData[k].lowRate
    const currentHigh = cycleData[k].highRate

    if (checkLow <= breakThreshold) {
      boxEndIdx = k
      boxBroken = true
      break
    }

    if (currentHigh > maxHigh) {
      maxHigh = currentHigh
      maxIdx = k
    }
    boxEndIdx = k
  }

  if (!boxBroken && boxEndIdx >= maxSearchIdx - 1) {
    boxBroken = true
  }

  return { boxEndIdx, boxBroken, maxHigh, maxIdx }
}

/**
 * Bear (하락장) 박스권 계산
 */
export function calculateBearBoxes(cycleData, cycleNum, config = BEAR_CONFIG) {
  // 420일까지만 사용
  const filteredData = cycleData.filter(d => d.day <= config.MAX_DURATION_DAYS)
  if (filteredData.length < 50) return []

  const boxes = []
  let boxId = 0
  let i = 1
  let prevBoxHigh = 100

  while (i < filteredData.length) {
    // 1. 진짜 최저점 찾기
    const { low: localLow, idx: localLowIdx } = findTrueLowBeforeRise(filteredData, i, config)
    if (localLow === null) break

    // 2. 이전 고점 대비 충분히 하락했는지 체크
    const dropFromPrevHigh = prevBoxHigh - localLow
    if (dropFromPrevHigh < config.MIN_DROP_FROM_PREV_HIGH) {
      i = localLowIdx + 1
      continue
    }

    // 3. 5% 상승 고점 찾기
    const { achieved, max: tempMax, idx: tempMaxIdx } = findRisePeak(filteredData, localLowIdx, localLow, config)
    if (!achieved) {
      i = localLowIdx + 1
      continue
    }

    // 4. 박스 종료 지점 찾기
    let { boxEndIdx, boxBroken, maxHigh, maxIdx } = findBearBoxEnd(
      filteredData, localLowIdx, localLow, tempMaxIdx, tempMax, tempMaxIdx, config
    )

    // 고점 인덱스 보정
    if (maxIdx > boxEndIdx) {
      const sliced = filteredData.slice(localLowIdx, boxEndIdx + 1)
      maxHigh = Math.max(...sliced.map(d => d.highRate))
      maxIdx = localLowIdx + sliced.findIndex(d => d.highRate === maxHigh)
    }

    // 5. 최소 기간 체크
    const boxDuration = filteredData[boxEndIdx].day - filteredData[localLowIdx].day
    if (boxDuration < config.MIN_DURATION_DAYS) {
      i = boxEndIdx + 1
      continue
    }

    // 6. 박스 저장
    boxId++
    boxes.push({
      Cycle: cycleNum,
      Box_ID: boxId,
      Start_Day: filteredData[localLowIdx].day,
      Start_Timestamp: filteredData[localLowIdx].timestamp,
      Start_Rate: Math.round(localLow * 100) / 100,
      Peak_Day: filteredData[maxIdx].day,
      Peak_Timestamp: filteredData[maxIdx].timestamp,
      Peak_Rate: Math.round(maxHigh * 100) / 100,
      End_Day: filteredData[boxEndIdx].day,
      End_Timestamp: filteredData[boxEndIdx].timestamp,
      End_Rate: Math.round(filteredData[boxEndIdx].lowRate * 100) / 100,
      Rise_Percent: Math.round((maxHigh - localLow) * 100) / 100,
      Duration_Days: boxDuration,
      Box_Broken: boxBroken,
      color: COLORS[(boxId - 1) % COLORS.length],
    })

    prevBoxHigh = maxHigh
    i = boxEndIdx + 1
  }

  return boxes
}

// ==================== Bull (상승장) 박스권 계산 ====================

/**
 * N일 범위에서 최고점인지 확인
 */
function isSignificantHigh(cycleData, idx, lookback) {
  if (idx < lookback) return false

  const current = cycleData[idx].highRate
  const start = Math.max(0, idx - lookback)
  const end = Math.min(cycleData.length, idx + lookback + 1)

  const rangeMax = Math.max(...cycleData.slice(start, end).map(d => d.highRate))
  return current >= rangeMax
}

/**
 * 고점에서 5% 이상 하락하는 저점 찾기
 */
function findDropLow(cycleData, startIdx, localHigh, config) {
  let tempMin = localHigh
  let tempMinIdx = startIdx

  for (let j = startIdx + 1; j < cycleData.length; j++) {
    const currentLow = cycleData[j].lowRate
    if (currentLow < tempMin) {
      tempMin = currentLow
      tempMinIdx = j
    }
    if (localHigh - tempMin >= config.DROP_THRESHOLD) {
      return { achieved: true, min: tempMin, idx: tempMinIdx }
    }
  }

  return { achieved: false, min: tempMin, idx: tempMinIdx }
}

/**
 * Bull 박스 종료 지점 찾기
 */
function findBullBoxEnd(cycleData, localHighIdx, localHigh, startSearchIdx, tempMin, tempMinIdx, config) {
  const breakThreshold = localHigh + (localHigh * config.BREAK_THRESHOLD / 100)

  let boxEndIdx = startSearchIdx
  let boxBroken = false
  let minLow = tempMin
  let minIdx = tempMinIdx

  for (let k = startSearchIdx + 1; k < cycleData.length; k++) {
    const checkHigh = cycleData[k].highRate
    const currentLow = cycleData[k].lowRate

    if (checkHigh >= breakThreshold) {
      boxEndIdx = k
      boxBroken = true
      break
    }

    if (currentLow < minLow) {
      minLow = currentLow
      minIdx = k
    }
    boxEndIdx = k
  }

  if (!boxBroken) {
    boxEndIdx = cycleData.length - 1
    boxBroken = true
  }

  return { boxEndIdx, boxBroken, minLow, minIdx }
}

/**
 * Bull (상승장) 박스권 계산
 */
export function calculateBullBoxes(cycleData, cycleNum, config = BULL_CONFIG) {
  // 420일 이후 데이터만 사용
  const filteredData = cycleData.filter(d => d.day >= config.MIN_DAYS_FROM_PEAK)
  if (filteredData.length < 20) return []

  const boxes = []
  let boxId = 0
  let i = config.LOOKBACK_DAYS

  while (i < filteredData.length) {
    // 1. 유의미한 고점인지 확인
    if (!isSignificantHigh(filteredData, i, config.LOOKBACK_DAYS)) {
      i++
      continue
    }

    const localHigh = filteredData[i].highRate
    const localHighIdx = i

    // 2. 5% 이상 하락하는 저점 찾기
    const { achieved, min: tempMin, idx: tempMinIdx } = findDropLow(filteredData, i, localHigh, config)
    if (!achieved) {
      i++
      continue
    }

    // 3. 박스 종료 지점 찾기
    let { boxEndIdx, boxBroken, minLow, minIdx } = findBullBoxEnd(
      filteredData, localHighIdx, localHigh, tempMinIdx, tempMin, tempMinIdx, config
    )

    // 저점 인덱스 보정
    if (minIdx > boxEndIdx) {
      const sliced = filteredData.slice(localHighIdx, boxEndIdx + 1)
      minLow = Math.min(...sliced.map(d => d.lowRate))
      minIdx = localHighIdx + sliced.findIndex(d => d.lowRate === minLow)
    }

    // 4. 최소 기간 체크
    const boxDuration = filteredData[boxEndIdx].day - filteredData[localHighIdx].day
    if (boxDuration < config.MIN_DURATION_DAYS) {
      i = boxEndIdx + 1
      continue
    }

    // 5. 박스 저장
    boxId++
    boxes.push({
      Cycle: cycleNum,
      Box_ID: boxId,
      Start_Day: filteredData[localHighIdx].day,
      Start_Timestamp: filteredData[localHighIdx].timestamp,
      Start_Rate: Math.round(localHigh * 100) / 100,
      Low_Day: filteredData[minIdx].day,
      Low_Timestamp: filteredData[minIdx].timestamp,
      Low_Rate: Math.round(minLow * 100) / 100,
      End_Day: filteredData[boxEndIdx].day,
      End_Timestamp: filteredData[boxEndIdx].timestamp,
      End_Rate: Math.round(filteredData[boxEndIdx].highRate * 100) / 100,
      Drop_Percent: Math.round((localHigh - minLow) * 100) / 100,
      Duration_Days: boxDuration,
      Box_Broken: boxBroken,
      color: COLORS[(boxId - 1) % COLORS.length],
    })

    i = boxEndIdx + 1
  }

  return boxes
}

// ==================== 유틸리티 ====================

/**
 * 날짜 포맷팅
 */
export function formatDate(timestamp) {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  } catch {
    return String(timestamp).slice(0, 10).replace(/-/g, '.')
  }
}

/**
 * Bear 차트용 라인 데이터 생성
 */
export function createBearLineData(cycleData, boxes) {
  return cycleData
    .filter(d => d.day <= BEAR_CONFIG.MAX_DURATION_DAYS)
    .map(d => {
      const currentBox = boxes.find(box => box.Start_Day <= d.day && d.day <= box.End_Day)
      const boxDay = currentBox ? d.day - currentBox.Start_Day + 1 : null

      let prevHigh = 100
      for (const box of boxes) {
        if (box.Peak_Day < d.day) {
          prevHigh = box.Peak_Rate
        }
      }

      return {
        x: d.day,
        y: Math.round(d.lowRate * 100) / 100,
        timestamp: formatDate(d.timestamp),
        box_id: currentBox?.Box_ID || null,
        box_day: boxDay,
        box_duration: currentBox?.Duration_Days || null,
        box_low: currentBox?.Start_Rate || null,
        box_high: currentBox?.Peak_Rate || null,
        prev_high: prevHigh,
      }
    })
}

/**
 * Bull 차트용 라인 데이터 생성
 */
export function createBullLineData(cycleData, boxes) {
  return cycleData
    .filter(d => d.day >= BULL_CONFIG.MIN_DAYS_FROM_PEAK)
    .map(d => {
      const currentBox = boxes.find(box => box.Start_Day <= d.day && d.day <= box.End_Day)
      const boxDay = currentBox ? d.day - currentBox.Start_Day + 1 : null

      let prevLow = cycleData[0]?.highRate || 100
      for (const box of boxes) {
        if (box.Low_Day < d.day) {
          prevLow = box.Low_Rate
        }
      }

      return {
        x: d.day,
        y: Math.round(d.highRate * 100) / 100,
        timestamp: formatDate(d.timestamp),
        box_id: currentBox?.Box_ID || null,
        box_day: boxDay,
        box_duration: currentBox?.Duration_Days || null,
        box_high: currentBox?.Start_Rate || null,
        box_low: currentBox?.Low_Rate || null,
        prev_low: prevLow,
      }
    })
}