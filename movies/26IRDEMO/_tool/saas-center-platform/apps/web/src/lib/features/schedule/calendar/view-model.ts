import {
  dateToString,
  DAYS_IN_KOREA,
  formatUtcToKst
} from '$root/src/lib/utils/date'
import type { DateRangeMode } from './constants'
import type { ScheduleType } from '$lib/hooks/actions/schedule.action'
import type { RoomItemType } from '$lib/hooks/actions/room.action'

interface HeaderParams {
  dateRange: DateRangeMode
  year: number
  month: number
  selectedDate: Date | null
  weekStart: Date
  weekEnd: Date
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const day = DAYS_IN_KOREA[date.getDay()]
  return `${y}-${m}-${d} (${day})`
}

const WEEK_ORDINALS = [
  '첫째주',
  '둘째주',
  '셋째주',
  '넷째주',
  '다섯째주',
  '여섯째주'
] as const

function getWeekOfMonth(date: Date): string {
  const month = date.getMonth()
  const year = date.getFullYear()
  const firstOfMonth = new Date(year, month, 1)
  // 월요일 시작 기준 offset (월=0, 화=1, ..., 일=6)
  const firstDayOffset =
    firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1
  const weekIndex = Math.floor((date.getDate() + firstDayOffset - 1) / 7)
  return `${month + 1}월 ${WEEK_ORDINALS[weekIndex] ?? `${weekIndex + 1}째주`}`
}

export function formatHeaderText(params: HeaderParams) {
  const { dateRange, year, month, selectedDate, weekStart, weekEnd } = params

  if (dateRange === '월간') {
    return `${year}년 ${month + 1}월`
  }

  if (dateRange === '주간') {
    // 주의 중간 날짜(목요일)를 기준으로 월/주차 결정
    const midWeek = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + 3
    )
    return getWeekOfMonth(midWeek)
  }

  if (dateRange === '일간' && selectedDate) {
    return formatDateISO(selectedDate)
  }

  return ''
}

export function isToday(date: Date | null): boolean {
  if (!date) return false
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

export function isTodayInRange(weekStart: Date, weekEnd: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(weekStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(weekEnd)
  end.setHours(23, 59, 59, 999)
  return today >= start && today <= end
}

export function formatScheduleBlockText(schedule: ScheduleType): string {
  const startDate = new Date(schedule.start)
  const h = String(startDate.getHours()).padStart(2, '0')
  const m = String(startDate.getMinutes()).padStart(2, '0')
  const typeLabel =
    schedule.schedule_type === 'assessment'
      ? '검사'
      : schedule.schedule_type === 'counseling'
        ? '상담'
        : '운영'
  const clientName = schedule.client_names?.[0] || schedule.title || ''
  return `${h}:${m} [${typeLabel}] ${clientName}`
}

export function getScheduleTypeLabel(type: string): string {
  switch (type) {
    case 'assessment':
      return '검사'
    case 'counseling':
      return '상담'
    case 'meeting':
      return '운영'
    default:
      return type
  }
}

export function getSessionStatusLabel(status: string | null): string {
  switch (status) {
    case 'scheduled':
      return '예정'
    case 'completed':
      return '완료'
    case 'cancelled':
      return '취소'
    case 'no_show':
      return '노쇼'
    default:
      return '예정'
  }
}

export function getSessionStatusColor(status: string | null): string {
  switch (status) {
    case 'completed':
      return 'text-green-600 bg-green-50'
    case 'cancelled':
      return 'text-red-600 bg-red-50'
    case 'no_show':
      return 'text-orange-600 bg-orange-50'
    default:
      return 'text-blue-600 bg-blue-50'
  }
}

export interface WeeklySummaryDay {
  date: Date
  dayOfMonth: number
  dayLabel: string
  count: number
  isSunday: boolean
  isToday: boolean
  isAnomaly: boolean
}

export interface WeeklySummary {
  days: WeeklySummaryDay[]
  totalCount: number
  previousWeekTotal: number | null
  weekOverWeekChange: number | null
}

export function computeWeeklySummary(
  schedules: ScheduleType[],
  weekStart: Date,
  weekEnd: Date,
  previousWeekTotal: number | null = null
): WeeklySummary {
  const days: WeeklySummaryDay[] = []
  const current = new Date(weekStart)

  while (current <= weekEnd) {
    const date = new Date(current)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const count = schedules.filter((s) => {
      return formatUtcToKst(s.start, 'YYYY-MM-DD') === dateStr
    }).length

    const today = new Date()
    days.push({
      date,
      dayOfMonth: date.getDate(),
      dayLabel: DAYS_IN_KOREA[date.getDay()],
      count,
      isSunday: date.getDay() === 0,
      isToday:
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate(),
      isAnomaly: false
    })
    current.setDate(current.getDate() + 1)
  }

  const totalCount = days.reduce((sum, d) => sum + d.count, 0)
  const avgCount =
    totalCount / Math.max(days.filter((d) => d.count > 0).length, 1)

  // 평균의 1.5배 이상이면 특이일
  days.forEach((d) => {
    if (d.count > avgCount * 1.5 && d.count > 0) {
      d.isAnomaly = true
    }
  })

  const weekOverWeekChange =
    previousWeekTotal !== null ? totalCount - previousWeekTotal : null

  return { days, totalCount, previousWeekTotal, weekOverWeekChange }
}
