/**
 * 날짜 패턴 감지 및 자동 채우기 유틸리티
 *
 * 2개 이상의 날짜에서 규칙적인 패턴(매일, 주간, 월간, 격주 교대)을 자동 감지하고,
 * 감지된 패턴으로 추가 날짜를 생성합니다.
 *
 * 감지 우선순위:
 * 1. weekly (단일/복수 요일, 격주 교대 포함) — 상담 맥락에서 요일 기반이 가장 자연스러움
 * 2. daily (7일 연속 등 진짜 매일 패턴만)
 * 3. monthly
 */

const DAY_LABELS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

export interface DetectedPattern {
  type: 'daily' | 'weekly' | 'monthly'
  interval: number
  label: string
  daysOfWeek?: string[]
  /** 격주 교대 시 두 번째 주 요일 (interval=2일 때만 사용) */
  alternatingDaysOfWeek?: string[]
}

/** 두 날짜 사이의 일 수 차이 */
function diffDays(a: Date, b: Date): number {
  const msPerDay = 86400000
  return Math.round((b.getTime() - a.getTime()) / msPerDay)
}

/**
 * 일요일 기준 주 키 반환
 * 캘린더 UI가 일요일 시작이므로 일~토를 한 주로 묶음
 * (ISO 주 번호는 월요일 기준이라 일요일이 이전 주로 빠지는 문제 있음)
 */
function getSundayWeekKey(d: Date): string {
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
  return `${sunday.getFullYear()}-${String(sunday.getMonth()).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`
}

/** 배열에서 최빈값 비율 체크 (80% 이상이면 패턴 인정) */
function majorityValue(arr: number[]): { value: number; ratio: number } | null {
  if (arr.length === 0) return null
  const counts = new Map<number, number>()
  for (const v of arr) {
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let maxVal = arr[0]
  let maxCount = 0
  for (const [val, count] of counts) {
    if (count > maxCount) {
      maxVal = val
      maxCount = count
    }
  }
  return { value: maxVal, ratio: maxCount / arr.length }
}

const THRESHOLD = 0.8

/** 주 키(YYYY-MM-DD) 2개 사이의 주 간격 계산 */
function weekKeyDiff(keyA: string, keyB: string): number {
  const [y1, m1, d1] = keyA.split('-').map(Number)
  const [y2, m2, d2] = keyB.split('-').map(Number)
  const dateA = new Date(y1, m1, d1)
  const dateB = new Date(y2, m2, d2)
  return Math.round((dateB.getTime() - dateA.getTime()) / (7 * 86400000))
}

/** 요일 세트를 정렬된 문자열로 변환 (비교용) */
function daySetKey(days: Set<number>): string {
  return [...days].sort((a, b) => a - b).join(',')
}

/**
 * 2개 이상의 날짜에서 패턴을 감지합니다.
 *
 * 감지 우선순위:
 * 1. weekly (복수 요일, 격주 교대 포함) — 화수목 같은 연속 요일도 여기서 잡힘
 * 2. daily (모든 요일이 포함된 진짜 매일 패턴만)
 * 3. monthly
 */
export function detectDatePattern(dates: Date[]): DetectedPattern | null {
  if (dates.length < 2) return null

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())

  // Step 1: daily 체크 — gap=1이 100%이고 7개 요일 모두 커버되면 진짜 매일
  const gaps = sorted.slice(1).map((d, i) => diffDays(sorted[i], d))
  const dailyResult = majorityValue(gaps)
  if (dailyResult && dailyResult.ratio === 1 && dailyResult.value === 1) {
    const uniqueDays = new Set(sorted.map((d) => d.getDay()))
    if (uniqueDays.size >= 7) {
      return { type: 'daily', interval: 1, label: '매일 규칙이에요' }
    }
  }

  // Step 2: weekly 체크 (복수 요일 패턴, 격주 교대 포함)
  // 상담 맥락에서 화수목 선택 → "매주 화, 수, 목"이 "매일"보다 자연스러움
  const weeklyResult = detectWeeklyPattern(sorted)
  if (weeklyResult) return weeklyResult

  // Step 3: monthly 체크
  const monthlyResult = detectMonthlyPattern(sorted)
  if (monthlyResult) return monthlyResult

  return null
}

function detectWeeklyPattern(sorted: Date[]): DetectedPattern | null {
  const dayIndices = sorted.map((d) => d.getDay())
  const uniqueDays = [...new Set(dayIndices)]

  // Case A: 모든 날짜가 같은 요일 (매주 월요일 등)
  if (uniqueDays.length === 1) {
    const weekGaps = sorted.slice(1).map((d, i) => {
      const diff = diffDays(sorted[i], d)
      return Math.round(diff / 7)
    })
    const result = majorityValue(weekGaps)
    if (result && result.ratio >= THRESHOLD && result.value >= 1) {
      const dayLabel = DAY_LABELS_KO[uniqueDays[0]]
      if (result.value === 1) {
        return {
          type: 'weekly',
          interval: 1,
          label: `매주 ${dayLabel}요일 규칙이에요`,
          daysOfWeek: [dayLabel]
        }
      }
      return {
        type: 'weekly',
        interval: result.value,
        label: `${result.value}주 간격 ${dayLabel}요일 규칙이에요`,
        daysOfWeek: [dayLabel]
      }
    }
  }

  // Case B: 복수 요일 패턴 — 주별로 그룹핑
  // 토→일 경계 보정: 토요일 바로 다음 일요일은 같은 논리적 주로 합침
  // (일요일 기준 주 시작이라 토→일이 주 경계를 넘지만, 사용자 관점에선 같은 주)
  const weekGroups = new Map<string, Set<number>>()
  const weekOrder: string[] = []
  let prevKey: string | null = null
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i]
    let key = getSundayWeekKey(d)

    // 토요일 직후 일요일(gap=1)이 주가 바뀌면 이전 주에 합침
    if (i > 0 && prevKey && key !== prevKey) {
      const prevDay = sorted[i - 1].getDay()
      const curDay = d.getDay()
      const gap = diffDays(sorted[i - 1], d)
      if (prevDay === 6 && curDay === 0 && gap === 1) {
        key = prevKey
      }
    }

    if (!weekGroups.has(key)) {
      weekGroups.set(key, new Set())
      weekOrder.push(key)
    }
    weekGroups.get(key)!.add(d.getDay())
    prevKey = key
  }

  // 한 주만 있고 복수 요일(2개+)이면 "매주 X, Y, Z" 추정
  if (weekGroups.size === 1) {
    const singleWeekDays = [...weekGroups.values()][0]
    if (singleWeekDays.size >= 2) {
      const dayLabels = [...singleWeekDays].sort().map((d) => DAY_LABELS_KO[d])
      return {
        type: 'weekly',
        interval: 1,
        label: `매주 ${dayLabels.join(', ')}요일 규칙이에요`,
        daysOfWeek: dayLabels
      }
    }
    return null
  }

  // 2주 이상: 요일 세트 비교
  const weekDaySets = weekOrder.map((key) => daySetKey(weekGroups.get(key)!))

  // Case B-1: 모든 주가 동일한 요일 조합 → 매주 패턴
  const targetSet = weekDaySets[0]
  const matchCount = weekDaySets.filter((s) => s === targetSet).length
  const matchRatio = matchCount / weekDaySets.length

  if (matchRatio >= THRESHOLD) {
    const daySet = weekGroups.get(weekOrder[0])!
    const dayLabels = [...daySet].sort().map((d) => DAY_LABELS_KO[d])

    // 주 간격 계산
    const weekIntervals: number[] = []
    for (let i = 1; i < weekOrder.length; i++) {
      weekIntervals.push(weekKeyDiff(weekOrder[i - 1], weekOrder[i]))
    }
    const intervalResult = majorityValue(weekIntervals)
    const interval = (intervalResult && intervalResult.ratio >= THRESHOLD) ? intervalResult.value : 1

    const dayStr = dayLabels.join(', ')
    if (interval === 1) {
      return {
        type: 'weekly',
        interval: 1,
        label: `매주 ${dayStr}요일 규칙이에요`,
        daysOfWeek: dayLabels
      }
    }
    return {
      type: 'weekly',
      interval,
      label: `${interval}주 간격 ${dayStr}요일 규칙이에요`,
      daysOfWeek: dayLabels
    }
  }

  // Case B-2: 격주 교대 패턴 감지 (월수금 / 화목토 등)
  // 조건: 2개의 서로 다른 요일 세트가 교대로 반복
  const alternatingResult = detectAlternatingPattern(weekOrder, weekGroups)
  if (alternatingResult) return alternatingResult

  return null
}

/**
 * 격주 교대 패턴 감지
 * 예: 1주차 월수금, 2주차 화목토, 3주차 월수금, 4주차 화목토
 */
function detectAlternatingPattern(
  weekOrder: string[],
  weekGroups: Map<string, Set<number>>
): DetectedPattern | null {
  if (weekOrder.length < 2) return null

  // 고유한 요일 세트 수집
  const uniqueSets = new Map<string, Set<number>>()
  for (const key of weekOrder) {
    const days = weekGroups.get(key)!
    const setKey = daySetKey(days)
    if (!uniqueSets.has(setKey)) {
      uniqueSets.set(setKey, days)
    }
  }

  // 정확히 2개의 서로 다른 요일 세트여야 함
  if (uniqueSets.size !== 2) return null

  const [setKeyA, setKeyB] = [...uniqueSets.keys()]
  const setA = uniqueSets.get(setKeyA)!
  const setB = uniqueSets.get(setKeyB)!

  // 교대 패턴 확인: 홀수 인덱스=A, 짝수 인덱스=B (또는 반대)
  let matchesAB = 0 // 0번째=A, 1번째=B 패턴
  let matchesBA = 0 // 0번째=B, 1번째=A 패턴

  for (let i = 0; i < weekOrder.length; i++) {
    const actual = daySetKey(weekGroups.get(weekOrder[i])!)
    if (i % 2 === 0) {
      if (actual === setKeyA) matchesAB++
      if (actual === setKeyB) matchesBA++
    } else {
      if (actual === setKeyB) matchesAB++
      if (actual === setKeyA) matchesBA++
    }
  }

  const bestMatch = Math.max(matchesAB, matchesBA)
  const matchRatio = bestMatch / weekOrder.length

  if (matchRatio < THRESHOLD) return null

  // 주 간격 확인: 매주 연속인지 (격주 교대의 실제 주 간격은 1)
  const weekIntervals: number[] = []
  for (let i = 1; i < weekOrder.length; i++) {
    weekIntervals.push(weekKeyDiff(weekOrder[i - 1], weekOrder[i]))
  }
  const intervalResult = majorityValue(weekIntervals)
  if (!intervalResult || intervalResult.value !== 1) return null

  // A/B 순서 결정
  const isAFirst = matchesAB >= matchesBA
  const firstSet = isAFirst ? setA : setB
  const secondSet = isAFirst ? setB : setA

  const labelsA = [...firstSet].sort().map((d) => DAY_LABELS_KO[d])
  const labelsB = [...secondSet].sort().map((d) => DAY_LABELS_KO[d])

  return {
    type: 'weekly',
    interval: 2, // 격주 (각 세트 기준으로 2주 간격)
    label: `격주 교대 ${labelsA.join(', ')}요일 / ${labelsB.join(', ')}요일 규칙이에요`,
    daysOfWeek: labelsA,
    alternatingDaysOfWeek: labelsB
  }
}

function detectMonthlyPattern(sorted: Date[]): DetectedPattern | null {
  const days = sorted.map((d) => d.getDate())
  const dayResult = majorityValue(days)
  if (!dayResult || dayResult.ratio < THRESHOLD) return null

  // 월 간격 계산
  const monthGaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (sorted[i].getFullYear() - sorted[i - 1].getFullYear()) * 12 +
      (sorted[i].getMonth() - sorted[i - 1].getMonth())
    monthGaps.push(diff)
  }
  const gapResult = majorityValue(monthGaps)
  if (!gapResult || gapResult.ratio < THRESHOLD || gapResult.value < 1) return null

  const dayOfMonth = dayResult.value
  if (gapResult.value === 1) {
    return { type: 'monthly', interval: 1, label: `매월 ${dayOfMonth}일 규칙이에요` }
  }
  return {
    type: 'monthly',
    interval: gapResult.value,
    label: `${gapResult.value}개월 간격 ${dayOfMonth}일 규칙이에요`
  }
}

/**
 * 패턴으로부터 마지막 날짜 이후 N개 날짜를 생성합니다.
 */
export function generateDatesFromPattern(
  pattern: DetectedPattern,
  lastDate: Date,
  count: number
): Date[] {
  const results: Date[] = []

  if (pattern.type === 'daily') {
    let current = new Date(lastDate)
    for (let i = 0; i < count; i++) {
      current = new Date(current)
      current.setDate(current.getDate() + pattern.interval)
      results.push(new Date(current))
    }
  } else if (pattern.type === 'weekly') {
    if (pattern.alternatingDaysOfWeek) {
      // 격주 교대 패턴
      generateAlternatingDates(pattern, lastDate, count, results)
    } else if (pattern.daysOfWeek && pattern.daysOfWeek.length > 1) {
      // 복수 요일: 다음 주기의 해당 요일들을 순서대로 생성
      const targetDayIndices = pattern.daysOfWeek
        .map((label) => DAY_LABELS_KO.indexOf(label as (typeof DAY_LABELS_KO)[number]))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b)

      let current = new Date(lastDate)
      let generated = 0

      while (generated < count) {
        current.setDate(current.getDate() + 1)
        const dayOfWeek = current.getDay()

        if (targetDayIndices.includes(dayOfWeek)) {
          if (pattern.interval > 1) {
            const weekDiff = Math.floor(diffDays(lastDate, current) / 7)
            if (weekDiff % pattern.interval !== 0 && weekDiff > 0) continue
          }
          results.push(new Date(current))
          generated++
        }
      }
    } else {
      // 단일 요일
      let current = new Date(lastDate)
      for (let i = 0; i < count; i++) {
        current = new Date(current)
        current.setDate(current.getDate() + 7 * pattern.interval)
        results.push(new Date(current))
      }
    }
  } else if (pattern.type === 'monthly') {
    let current = new Date(lastDate)
    for (let i = 0; i < count; i++) {
      current = new Date(current)
      current.setMonth(current.getMonth() + pattern.interval)
      results.push(new Date(current))
    }
  }

  return results
}

/**
 * 패턴으로부터 마지막 날짜 이후 특정 날짜까지 날짜를 생성합니다.
 */
export function generateDatesUntil(
  pattern: DetectedPattern,
  lastDate: Date,
  untilDate: Date
): Date[] {
  const results: Date[] = []
  const maxCount = 200 // 안전 제한

  if (pattern.type === 'daily') {
    let current = new Date(lastDate)
    let safety = 0
    while (safety++ < maxCount) {
      current = new Date(current)
      current.setDate(current.getDate() + pattern.interval)
      if (current > untilDate) break
      results.push(new Date(current))
    }
  } else if (pattern.type === 'weekly') {
    if (pattern.alternatingDaysOfWeek) {
      // 격주 교대 패턴
      generateAlternatingDatesUntil(pattern, lastDate, untilDate, results, maxCount)
    } else if (pattern.daysOfWeek && pattern.daysOfWeek.length > 1) {
      const targetDayIndices = pattern.daysOfWeek
        .map((label) => DAY_LABELS_KO.indexOf(label as (typeof DAY_LABELS_KO)[number]))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b)

      let current = new Date(lastDate)
      let safety = 0
      while (safety++ < maxCount) {
        current.setDate(current.getDate() + 1)
        if (current > untilDate) break
        if (targetDayIndices.includes(current.getDay())) {
          results.push(new Date(current))
        }
      }
    } else {
      let current = new Date(lastDate)
      let safety = 0
      while (safety++ < maxCount) {
        current = new Date(current)
        current.setDate(current.getDate() + 7 * pattern.interval)
        if (current > untilDate) break
        results.push(new Date(current))
      }
    }
  } else if (pattern.type === 'monthly') {
    let current = new Date(lastDate)
    let safety = 0
    while (safety++ < maxCount) {
      current = new Date(current)
      current.setMonth(current.getMonth() + pattern.interval)
      if (current > untilDate) break
      results.push(new Date(current))
    }
  }

  return results
}

// ============ 격주 교대 날짜 생성 헬퍼 ============

/** lastDate가 속한 주의 세트(A or B)를 판단하고, 다음 날짜부터 교대 생성 */
function generateAlternatingDates(
  pattern: DetectedPattern,
  lastDate: Date,
  count: number,
  results: Date[]
) {
  const daysA = pattern.daysOfWeek!
    .map((l) => DAY_LABELS_KO.indexOf(l as (typeof DAY_LABELS_KO)[number]))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)
  const daysB = pattern.alternatingDaysOfWeek!
    .map((l) => DAY_LABELS_KO.indexOf(l as (typeof DAY_LABELS_KO)[number]))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)

  // lastDate의 요일로 현재 어떤 세트인지 판단
  const lastDayOfWeek = lastDate.getDay()
  const isLastInA = daysA.includes(lastDayOfWeek)
  // lastDate가 속한 주의 일요일 기준으로 주 인덱스 계산
  const lastWeekStart = new Date(lastDate)
  lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay())
  const baseWeekNum = Math.round(lastWeekStart.getTime() / (7 * 86400000))

  let current = new Date(lastDate)
  let generated = 0

  while (generated < count) {
    current.setDate(current.getDate() + 1)
    const dayOfWeek = current.getDay()

    // 현재 날짜의 주 인덱스 계산
    const weekStart = new Date(current)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekNum = Math.round(weekStart.getTime() / (7 * 86400000))
    const weekOffset = weekNum - baseWeekNum

    // 홀수 주 오프셋이면 다른 세트
    const isSetA = isLastInA ? (weekOffset % 2 === 0) : (weekOffset % 2 !== 0)
    const targetDays = isSetA ? daysA : daysB

    if (targetDays.includes(dayOfWeek)) {
      results.push(new Date(current))
      generated++
    }
  }
}

function generateAlternatingDatesUntil(
  pattern: DetectedPattern,
  lastDate: Date,
  untilDate: Date,
  results: Date[],
  maxCount: number
) {
  const daysA = pattern.daysOfWeek!
    .map((l) => DAY_LABELS_KO.indexOf(l as (typeof DAY_LABELS_KO)[number]))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)
  const daysB = pattern.alternatingDaysOfWeek!
    .map((l) => DAY_LABELS_KO.indexOf(l as (typeof DAY_LABELS_KO)[number]))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)

  const lastDayOfWeek = lastDate.getDay()
  const isLastInA = daysA.includes(lastDayOfWeek)
  const lastWeekStart = new Date(lastDate)
  lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay())
  const baseWeekNum = Math.round(lastWeekStart.getTime() / (7 * 86400000))

  let current = new Date(lastDate)
  let safety = 0

  while (safety++ < maxCount) {
    current.setDate(current.getDate() + 1)
    if (current > untilDate) break

    const dayOfWeek = current.getDay()
    const weekStart = new Date(current)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekNum = Math.round(weekStart.getTime() / (7 * 86400000))
    const weekOffset = weekNum - baseWeekNum

    const isSetA = isLastInA ? (weekOffset % 2 === 0) : (weekOffset % 2 !== 0)
    const targetDays = isSetA ? daysA : daysB

    if (targetDays.includes(dayOfWeek)) {
      results.push(new Date(current))
    }
  }
}
