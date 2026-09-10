/**
 * 크레딧 ViewModel — API 응답 → UI 표현 변환
 */

import type { CreditBalance, CreditUsageResponse, CreditHistoryItem, DailyPurposeUsage } from '$lib/hooks/actions/credit.action'
import type { AIPurposeKey } from './constants'
import { parseAsUtc } from '$lib/utils/date'
import {
  CREDIT_WARNING_THRESHOLD,
  CREDIT_DANGER_THRESHOLD,
  DAILY_CHART_DAYS,
  HISTORY_DISPLAY_LIMIT,
  PURPOSE_STYLES,
  DEFAULT_PURPOSE_STYLE,
  PURPOSE_COLORS,
  DEFAULT_PURPOSE_COLOR,
  FREE_PURPOSES,
  PURPOSE_ESTIMATED_CREDITS,
  PURPOSE_LABELS,
} from './constants'
import { PLAN_LABELS as PLAN_LABEL_MAP } from '$lib/features/subscription/constants'

// ── CreditGauge 컴포넌트용 (사이드바/헤더) ──

export interface CreditVM {
  planLabel: string
  used: number
  limit: number
  remaining: number
  usagePercent: number
  gaugeColor: 'green' | 'yellow' | 'red'
  isExhausted: boolean
  periodLabel: string
  estimatedCredits: Record<string, number>
}

/**
 * 특정 purpose에 대해 크레딧이 충분한지 검사.
 * Backend의 CheckQuotaService와 동일한 로직.
 */
export function canAfford(credit: CreditVM | null, purpose: AIPurposeKey): boolean {
  if (!credit) return false  // 크레딧 정보 로드 전에는 차단 (hasFeature와 동일 방향)
  const estimated = credit.estimatedCredits[purpose] ?? 1
  return credit.remaining >= estimated
}

/** purpose가 무료(크레딧 차감 없음)인지 확인 */
export function isFree(purpose: string): boolean {
  return FREE_PURPOSES.has(purpose)
}

/** purpose의 한글 라벨 반환 */
export function purposeLabel(purpose: string): string {
  return PURPOSE_LABELS[purpose] ?? purpose
}

/** purpose의 예상 크레딧 비용 문자열 반환 (무료 / ~N 크레딧) */
export function estimatedCostLabel(purpose: string): string {
  if (FREE_PURPOSES.has(purpose)) return '무료'
  const cost = PURPOSE_ESTIMATED_CREDITS[purpose]
  if (!cost) return ''
  return `~${cost} 크레딧`
}

/** AI 작업 완료 후 사용량 피드백 메시지 생성 */
export function creditUsageFeedback(purpose: string, creditsUsed: number, remaining: number): string {
  const label = PURPOSE_LABELS[purpose] ?? 'AI'
  return `${label} 완료 · ${creditsUsed} 크레딧 사용 (잔여 ${remaining})`
}

// ── 내부 헬퍼 ──

function formatYMD(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function computeWeeklyTrend(recentSum: number, prevSum: number): { percent: number; trend: 'up' | 'down' | 'stable' } {
  if (prevSum > 0) {
    const percent = Math.round(((recentSum - prevSum) / prevSum) * 100)
    return { percent, trend: percent > 5 ? 'up' : percent < -5 ? 'down' : 'stable' }
  }
  if (recentSum > 0) return { percent: 100, trend: 'up' }
  return { percent: 0, trend: 'stable' }
}

export function mapToCreditVM(data: CreditBalance): CreditVM {
  const usagePercent = data.credit_limit > 0
    ? Math.min(100, Math.round((data.credit_used / data.credit_limit) * 100))
    : 100
  let gaugeColor: CreditVM['gaugeColor'] = 'green'
  if (usagePercent >= CREDIT_DANGER_THRESHOLD) {
    gaugeColor = 'red'
  } else if (usagePercent >= CREDIT_WARNING_THRESHOLD) {
    gaugeColor = 'yellow'
  }

  const start = new Date(data.period_start)
  const end = new Date(data.period_end)

  return {
    planLabel: PLAN_LABEL_MAP[data.plan_type] ?? data.plan_type,
    used: data.credit_used,
    limit: data.credit_limit,
    remaining: data.credit_remaining,
    usagePercent,
    gaugeColor,
    isExhausted: data.credit_remaining <= 0,
    periodLabel: `${formatYMD(start)} ~ ${formatYMD(end)}`,
    estimatedCredits: data.estimated_credits ?? {},
  }
}

// ── AI 사용량 페이지용 ──

export type UsageStatus = 'normal' | 'warning' | 'danger'

export interface PurposeUsageItem {
  purpose: string
  label: string
  calls: number
  credits: number
}

export interface UsageInsight {
  /** 일평균 크레딧 */
  dailyAvgCredits: number
  /** 일평균 호출 수 */
  dailyAvgCalls: number
  /** 호출당 평균 크레딧 */
  creditsPerCall: number
  /** 예상 소진까지 남은 일수 (0 = 이미 소진) */
  estimatedDepletionDays: number
  /** 크레딧 주간 추세 변화율 (%) — 저사용량에서 노이즈, 표시는 절대값 사용 권장 */
  weeklyTrendPercent: number
  /** 크레딧 주간 추세 방향 */
  weeklyTrend: 'up' | 'down' | 'stable'
  /** 최근 7일 크레딧 합계 (절대 비교용) */
  weeklyRecentCredits: number
  /** 직전 7일 크레딧 합계 (절대 비교용) */
  weeklyPrevCredits: number
  /** 호출 주간 추세 변화율 (%) */
  callsWeeklyTrendPercent: number
  /** 호출 주간 추세 방향 */
  callsWeeklyTrend: 'up' | 'down' | 'stable'
  /** 기간 중 경과 일수 */
  daysElapsed: number
}

export interface DailyCreditChartItem {
  label: string
  credits: number
  cumulativeCredits: number
}

/** TrendChart 컴포넌트용 통합 아이템 */
export interface TrendChartItem {
  label: string
  daily: number
  cumulative: number
}

/** 다중 라인 차트: purpose별 시계열 데이터 */
export interface PurposeTrendSeries {
  purpose: string
  label: string
  color: string
  data: { label: string; calls: number; credits: number }[]
}

/** 사용 속도 분석 (PaceGuideCard용) */
export interface CreditPace {
  /** 하루 권장 사용량 (remaining ÷ 남은 일수) */
  dailyBudget: number
  /** 실제 하루 평균 사용량 */
  dailyActual: number
  /** 권장 대비 비율 (%) */
  pacePercent: number
  /** 리셋 시점 예상 잔여 크레딧 */
  projectedRemaining: number
  /** 경과 일수 */
  daysElapsed: number
  /** 리셋까지 남은 일수 */
  daysUntilReset: number
  /** 상태 */
  status: 'surplus' | 'on-track' | 'over-pace' | 'exhausted'
}

/** CreditPace를 UsagePageVM에서 계산 */
export function computeCreditPace(
  creditRemaining: number,
  dailyAvgCredits: number,
  daysElapsed: number,
  daysUntilReset: number,
): CreditPace {
  const dailyBudget = daysUntilReset > 0 ? Math.round(creditRemaining / daysUntilReset) : 0
  const dailyActual = dailyAvgCredits
  const pacePercent = dailyBudget > 0 ? Math.round((dailyActual / dailyBudget) * 100) : 0
  const projectedRemaining = Math.max(0, creditRemaining - dailyActual * daysUntilReset)

  let status: CreditPace['status'] = 'on-track'
  if (creditRemaining <= 0) status = 'exhausted'
  else if (pacePercent <= 70) status = 'surplus'
  else if (pacePercent <= 110) status = 'on-track'
  else status = 'over-pace'

  return { dailyBudget, dailyActual, pacePercent, projectedRemaining, daysElapsed, daysUntilReset, status }
}

/** 남은 크레딧으로 예상 가능한 작업 수 */
export interface CapacityEstimate {
  label: string
  creditsPerCall: number
  remainingCalls: number
}

export interface UsagePageVM {
  isActive: boolean
  planLabel: string
  creditLimit: number
  creditRemaining: number
  creditUsed: number
  usagePercent: number
  status: UsageStatus
  daysUntilReset: number
  periodLabel: string
  totalCalls: number
  activeMembers: number
  topPurposeLabel: string | null
  dailyChart: DailyChartItem[]
  dailyCreditChart: DailyCreditChartItem[]
  byPurpose: PurposeUsageItem[]
  purposeTrend: PurposeTrendSeries[]
  insight: UsageInsight
  capacityEstimates: CapacityEstimate[]
}

export interface DailyChartItem {
  label: string
  calls: number
  heightPercent: number
}

export function mapToUsagePageVM(data: CreditUsageResponse): UsagePageVM {
  const usagePercent = data.credit_limit > 0
    ? Math.min(100, Math.round((data.credit_used / data.credit_limit) * 100))
    : 0

  let status: UsageStatus = 'normal'
  if (usagePercent >= CREDIT_DANGER_THRESHOLD) status = 'danger'
  else if (usagePercent >= CREDIT_WARNING_THRESHOLD) status = 'warning'

  // 리셋까지 남은 일수
  let daysUntilReset = 0
  if (data.period_end) {
    const now = new Date()
    const end = new Date(data.period_end)
    daysUntilReset = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  // 기간 라벨
  let periodLabel = ''
  if (data.period_start && data.period_end) {
    periodLabel = `${formatYMD(new Date(data.period_start))} ~ ${formatYMD(new Date(data.period_end))}`
  }

  // 일별 차트
  const recent = (data.daily_usage ?? []).slice(-DAILY_CHART_DAYS)
  const maxCalls = Math.max(...recent.map(d => d.calls), 1)
  const dailyChart: DailyChartItem[] = recent.map(d => {
    const dt = new Date(d.date)
    return {
      label: `${dt.getMonth() + 1}/${dt.getDate()}`,
      calls: d.calls,
      heightPercent: Math.max(Math.round((d.calls / maxCalls) * 100), 2),
    }
  })

  // 기능별 크레딧 사용량 (백엔드에서 sum(credits_charged) 직접 제공)
  const byPurpose: PurposeUsageItem[] = (data.by_purpose ?? [])
    .filter(p => p.credits > 0 || p.total_tokens > 0)
    .map(p => ({
      purpose: p.purpose ?? '',
      label: PURPOSE_LABELS[p.purpose ?? ''] ?? p.purpose_label,
      calls: p.calls,
      credits: p.credits,
    }))
    .filter(p => p.label !== '기타')
    .sort((a, b) => b.credits - a.credits)

  // 누적 크레딧 차트 데이터
  let cumulative = 0
  const dailyCreditChart: DailyCreditChartItem[] = recent.map(d => {
    cumulative += (d as { credits?: number }).credits ?? 0
    const dt = new Date(d.date)
    return {
      label: `${dt.getMonth() + 1}/${dt.getDate()}`,
      credits: (d as { credits?: number }).credits ?? 0,
      cumulativeCredits: cumulative,
    }
  })

  // 사용 인사이트
  let daysElapsed = 0
  if (data.period_start) {
    const start = new Date(data.period_start)
    const now = new Date()
    daysElapsed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  }

  // 일평균
  const dailyAvgCredits = daysElapsed > 0 ? Math.round(data.credit_used / daysElapsed) : 0
  const dailyAvgCalls = daysElapsed > 0 ? Math.round(data.total_calls / daysElapsed) : 0

  // 호출당 평균 크레딧
  const creditsPerCall = data.total_calls > 0 ? Math.round(data.credit_used / data.total_calls) : 0

  // 예상 소진일
  const estimatedDepletionDays = dailyAvgCredits > 0
    ? Math.floor(data.credit_remaining / dailyAvgCredits)
    : 0

  // 주간 추세: 최근 7일 vs 이전 7일 합산 비교
  const recentDays = recent.slice(-7)
  const prevDays = recent.slice(-14, -7)

  const weeklyRecentCredits = recentDays.reduce((s, d) => s + ((d as { credits?: number }).credits ?? 0), 0)
  const weeklyPrevCredits = prevDays.reduce((s, d) => s + ((d as { credits?: number }).credits ?? 0), 0)
  const creditTrend = computeWeeklyTrend(weeklyRecentCredits, weeklyPrevCredits)
  const callsTrend = computeWeeklyTrend(
    recentDays.reduce((s, d) => s + d.calls, 0),
    prevDays.reduce((s, d) => s + d.calls, 0),
  )

  const weeklyTrendPercent = creditTrend.percent
  const weeklyTrend = creditTrend.trend
  const callsWeeklyTrendPercent = callsTrend.percent
  const callsWeeklyTrend = callsTrend.trend

  const insight: UsageInsight = {
    dailyAvgCredits,
    dailyAvgCalls,
    creditsPerCall,
    estimatedDepletionDays,
    weeklyTrendPercent,
    weeklyTrend,
    weeklyRecentCredits,
    weeklyPrevCredits,
    callsWeeklyTrendPercent,
    callsWeeklyTrend,
    daysElapsed,
  }

  // purpose별 다중 라인 트렌드 데이터
  const purposeTrend = buildPurposeTrendSeries(data.daily_by_purpose ?? [])

  // 남은 크레딧으로 가능한 작업 수 추정
  const remaining = data.credit_remaining
  const capacityEstimates: CapacityEstimate[] = byPurpose
    .filter(p => p.calls > 0 && p.credits > 0)
    .map(p => {
      const cpc = Math.round(p.credits / p.calls)
      return {
        label: p.label,
        creditsPerCall: cpc,
        remainingCalls: cpc > 0 ? Math.floor(remaining / cpc) : 0,
      }
    })
    .slice(0, 3)

  return {
    isActive: data.is_active,
    planLabel: PLAN_LABEL_MAP[data.plan_type ?? ''] ?? data.plan_type ?? 'Free',
    creditLimit: data.credit_limit,
    creditRemaining: data.credit_remaining,
    creditUsed: data.credit_used,
    usagePercent,
    status,
    daysUntilReset,
    periodLabel,
    totalCalls: data.total_calls,
    activeMembers: data.active_members ?? 0,
    topPurposeLabel: byPurpose.length > 0 ? byPurpose[0].label : null,
    dailyChart,
    dailyCreditChart,
    byPurpose,
    purposeTrend,
    insight,
    capacityEstimates,
  }
}

// ── Purpose별 다중 라인 변환 ──

function buildPurposeTrendSeries(
  dailyByPurpose: DailyPurposeUsage[],
): PurposeTrendSeries[] {
  if (dailyByPurpose.length === 0) return []

  // dailyByPurpose 자체에서 고유 날짜 추출 (정렬됨)
  const uniqueDates = [...new Set(dailyByPurpose.map(d => d.date))].sort()
  const dateLabels = uniqueDates.map(date => {
    const dt = new Date(date)
    return { date, label: `${dt.getMonth() + 1}/${dt.getDate()}` }
  })

  // purpose → { date → {calls, credits} } 맵 구축
  const purposeMap = new Map<string, { label: string; byDate: Map<string, { calls: number; credits: number }> }>()
  for (const item of dailyByPurpose) {
    const key = item.purpose ?? ''
    if (!purposeMap.has(key)) {
      purposeMap.set(key, { label: PURPOSE_LABELS[key] ?? item.purpose_label, byDate: new Map() })
    }
    purposeMap.get(key)!.byDate.set(item.date, { calls: item.calls, credits: item.credits })
  }

  // 시리즈 변환
  return [...purposeMap.entries()]
    .map(([purpose, { label, byDate }]) => ({
      purpose,
      label,
      color: (PURPOSE_COLORS[purpose] ?? DEFAULT_PURPOSE_COLOR).hex,
      data: dateLabels.map(d => ({
        label: d.label,
        calls: byDate.get(d.date)?.calls ?? 0,
        credits: byDate.get(d.date)?.credits ?? 0,
      })),
    }))
    .sort((a, b) => {
      const totalA = a.data.reduce((s, d) => s + d.calls, 0)
      const totalB = b.data.reduce((s, d) => s + d.calls, 0)
      return totalB - totalA
    })
}

// ── TrendChart 데이터 변환 ──

/** DailyCreditChartItem[] → TrendChartItem[] */
export function mapCreditToTrendItems(items: DailyCreditChartItem[]): TrendChartItem[] {
  return items.map(d => ({
    label: d.label,
    daily: d.credits,
    cumulative: d.cumulativeCredits,
  }))
}

/** DailyChartItem[] → TrendChartItem[] (API 호출 누적) */
export function mapCallsToTrendItems(items: DailyChartItem[]): TrendChartItem[] {
  let cumulative = 0
  return items.map(d => {
    cumulative += d.calls
    return { label: d.label, daily: d.calls, cumulative }
  })
}

// ── 최근 활동 타임라인 ──

export interface ActivityGroup {
  dateLabel: string
  isToday: boolean
  items: ActivityItem[]
  dailyCredits: number
}

export interface ActivityItem {
  purpose: string
  purposeLabel: string
  time: string
  credits: number
  iconBg: string
  iconText: string
  memberName: string | null
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** UTC created_at → KST Date (표시용) */
function toKstDate(utcStr: string): Date {
  const utc = parseAsUtc(utcStr)
  return new Date(utc.getTime() + KST_OFFSET_MS)
}

// ── 상담사별 사용 현황 ──

export interface MemberUsageSummary {
  memberName: string
  totalCredits: number
  callCount: number
  percentage: number
}

export function mapToMemberUsage(items: CreditHistoryItem[]): MemberUsageSummary[] {
  if (items.length === 0) return []
  const memberMap = new Map<string, { credits: number; calls: number }>()
  for (const item of items) {
    const name = item.member_name ?? '알 수 없음'
    const existing = memberMap.get(name) ?? { credits: 0, calls: 0 }
    existing.credits += item.credits
    existing.calls += 1
    memberMap.set(name, existing)
  }
  const totalCredits = [...memberMap.values()].reduce((s, m) => s + m.credits, 0)
  return [...memberMap.entries()]
    .map(([name, { credits, calls }]) => ({
      memberName: name,
      totalCredits: credits,
      callCount: calls,
      percentage: totalCredits > 0 ? Math.round((credits / totalCredits) * 100) : 0,
    }))
    .sort((a, b) => b.totalCredits - a.totalCredits)
}

export function mapToActivityGroups(items: CreditHistoryItem[]): ActivityGroup[] {
  const limited = items.slice(0, HISTORY_DISPLAY_LIMIT)
  if (limited.length === 0) return []

  // KST 기준 오늘/어제 자정 (UTC 밀리초로 표현)
  const nowKst = new Date(Date.now() + KST_OFFSET_MS)
  const today = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()))
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  const groups = new Map<string, ActivityGroup>()

  for (const item of limited) {
    const kst = toKstDate(item.created_at)
    const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate()
    const dateKey = `${y}-${m}-${d}`
    const dateOnly = new Date(Date.UTC(y, m, d))

    if (!groups.has(dateKey)) {
      let dateLabel: string
      if (dateOnly.getTime() === today.getTime()) {
        dateLabel = '오늘'
      } else if (dateOnly.getTime() === yesterday.getTime()) {
        dateLabel = '어제'
      } else {
        dateLabel = `${m + 1}월 ${d}일 (${WEEKDAYS[kst.getUTCDay()]})`
      }
      groups.set(dateKey, { dateLabel, isToday: dateOnly.getTime() === today.getTime(), items: [], dailyCredits: 0 })
    }

    const style = PURPOSE_STYLES[item.purpose ?? ''] ?? DEFAULT_PURPOSE_STYLE
    const timeStr = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`

    const group = groups.get(dateKey)!
    group.items.push({
      purpose: item.purpose ?? '',
      purposeLabel: PURPOSE_LABELS[item.purpose ?? ''] ?? item.purpose_label,
      time: timeStr,
      credits: item.credits,
      iconBg: style.bg,
      iconText: style.text,
      memberName: item.member_name ?? null,
    })
    group.dailyCredits += item.credits
  }

  return [...groups.values()]
}

// ── 테이블용 Flat 히스토리 아이템 ──

export interface HistoryTableItem {
  id: string
  purpose: string
  purposeLabel: string
  memberName: string | null
  dateKey: string
  dateLabel: string
  time: string
  credits: number
  isFirstOfDate: boolean
}

export function mapToHistoryTableItems(items: CreditHistoryItem[]): HistoryTableItem[] {
  // KST 기준 오늘/어제 자정 (UTC 밀리초로 표현)
  const nowKst = new Date(Date.now() + KST_OFFSET_MS)
  const today = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()))
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  let prevDateKey = ''
  return items.map((item, idx) => {
    const kst = toKstDate(item.created_at)
    const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate()
    const dateKey = `${y}-${m}-${d}`
    const dateOnly = new Date(Date.UTC(y, m, d))
    const timeStr = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`

    let dateLabel: string
    if (dateOnly.getTime() === today.getTime()) {
      dateLabel = '오늘'
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      dateLabel = '어제'
    } else {
      dateLabel = `${m + 1}/${d} (${WEEKDAYS[kst.getUTCDay()]})`
    }

    const isFirstOfDate = dateKey !== prevDateKey
    prevDateKey = dateKey

    return {
      id: `${item.created_at}-${idx}`,
      purpose: item.purpose ?? '',
      purposeLabel: PURPOSE_LABELS[item.purpose ?? ''] ?? item.purpose_label,
      memberName: item.member_name ?? null,
      dateKey,
      dateLabel,
      time: timeStr,
      credits: item.credits,
      isFirstOfDate,
    }
  })
}
