/**
 * Operating Hours Utility Module
 * 센터 운영시간 데이터를 기반으로 시간 관련 판단/변환 유틸리티 제공
 */

import type {
  OperatingTimeSummary,
  WeekdayEnum
} from '$lib/hooks/actions/center.action'

/** 특정 날짜의 운영시간 정보 (파싱 완료) */
export interface DayOperatingHours {
  weekday: WeekdayEnum
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  breakStartHour: number | null
  breakStartMinute: number | null
  breakEndHour: number | null
  breakEndMinute: number | null
  isClosed: boolean
}

/** SSR/로딩 중 폴백 기본값 */
export const DEFAULT_OPERATING_HOURS: DayOperatingHours = {
  weekday: 'MON',
  startHour: 9,
  startMinute: 0,
  endHour: 20,
  endMinute: 0,
  breakStartHour: 12,
  breakStartMinute: 0,
  breakEndHour: 13,
  breakEndMinute: 0,
  isClosed: false
}

/** Date.getDay() (0=일~6=토) → WeekdayEnum 매핑 */
const DAY_INDEX_TO_WEEKDAY: WeekdayEnum[] = [
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT'
]

/** "HH:MM" 문자열을 시/분으로 파싱 */
function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map(Number)
  return { hour: h, minute: m ?? 0 }
}

/** OperatingTimeSummary → DayOperatingHours 변환 */
function toDayHours(item: OperatingTimeSummary): DayOperatingHours {
  if (!item.open_time || !item.close_time) {
    return {
      weekday: item.weekday,
      startHour: 0,
      startMinute: 0,
      endHour: 0,
      endMinute: 0,
      breakStartHour: null,
      breakStartMinute: null,
      breakEndHour: null,
      breakEndMinute: null,
      isClosed: true
    }
  }

  const open = parseTime(item.open_time)
  const close = parseTime(item.close_time)
  const breakStart = item.break_start_time
    ? parseTime(item.break_start_time)
    : null
  const breakEnd = item.break_end_time ? parseTime(item.break_end_time) : null

  return {
    weekday: item.weekday,
    startHour: open.hour,
    startMinute: open.minute,
    endHour: close.hour,
    endMinute: close.minute,
    breakStartHour: breakStart?.hour ?? null,
    breakStartMinute: breakStart?.minute ?? null,
    breakEndHour: breakEnd?.hour ?? null,
    breakEndMinute: breakEnd?.minute ?? null,
    isClosed: false
  }
}

/**
 * 선택한 날짜의 요일별 운영시간 반환
 * operatingTimes가 비어있으면 DEFAULT_OPERATING_HOURS 반환
 */
export function getOperatingHoursForDate(
  operatingTimes: OperatingTimeSummary[] | undefined,
  date: Date
): DayOperatingHours {
  if (!operatingTimes || operatingTimes.length === 0)
    return DEFAULT_OPERATING_HOURS

  const weekday = DAY_INDEX_TO_WEEKDAY[date.getDay()]
  const item = operatingTimes.find((ot) => ot.weekday === weekday)
  if (!item) return DEFAULT_OPERATING_HOURS

  return toDayHours(item)
}

/**
 * "HH:MM" 시간이 운영시간 밖인지 체크
 * 휴무일이면 항상 true
 */
export function isTimeOutsideOperatingHours(
  time: string,
  dayHours: DayOperatingHours
): boolean {
  if (dayHours.isClosed) return true

  const { hour, minute } = parseTime(time)
  const timeMinutes = hour * 60 + minute
  const startMinutes = dayHours.startHour * 60 + dayHours.startMinute
  const endMinutes = dayHours.endHour * 60 + dayHours.endMinute

  return timeMinutes < startMinutes || timeMinutes >= endMinutes
}

/**
 * 캘린더 시간 셀 스타일링용: 해당 시간(hour)이 운영시간 내인지 체크
 * hour는 정각 기준 (예: 9 → 09:00~10:00 구간)
 */
export function isOperatingHourForDay(
  hour: number,
  dayHours: DayOperatingHours
): boolean {
  if (dayHours.isClosed) return false
  return hour >= dayHours.startHour && hour < dayHours.endHour
}

/**
 * 캘린더 휴게시간 스타일링용: 해당 시간(hour)이 휴게시간인지 체크
 */
export function isBreakHourForDay(
  hour: number,
  dayHours: DayOperatingHours
): boolean {
  if (dayHours.isClosed) return false
  if (dayHours.breakStartHour === null || dayHours.breakEndHour === null)
    return false
  return hour >= dayHours.breakStartHour && hour < dayHours.breakEndHour
}

/**
 * "09:00~18:00" 형태 표시 문자열 생성
 * 휴무일이면 "휴무" 반환
 */
export function formatOperatingHoursRange(dayHours: DayOperatingHours): string {
  if (dayHours.isClosed) return '휴무'

  const startStr = `${String(dayHours.startHour).padStart(2, '0')}:${String(dayHours.startMinute).padStart(2, '0')}`
  const endStr = `${String(dayHours.endHour).padStart(2, '0')}:${String(dayHours.endMinute).padStart(2, '0')}`
  return `${startStr}~${endStr}`
}

/**
 * 운영시간 기반 시간 슬롯 동적 생성
 * @param dayHours 해당 날짜의 운영시간
 * @param intervalMinutes 슬롯 간격 (기본 30분)
 * @returns 오전/오후 시간 슬롯 배열
 */
export function generateTimeSlots(
  dayHours: DayOperatingHours,
  intervalMinutes: number = 30
): { morning: string[]; afternoon: string[] } {
  if (dayHours.isClosed) return { morning: [], afternoon: [] }

  const morning: string[] = []
  const afternoon: string[] = []
  const startTotal = dayHours.startHour * 60 + dayHours.startMinute
  const endTotal = dayHours.endHour * 60 + dayHours.endMinute
  const breakStartTotal =
    dayHours.breakStartHour !== null && dayHours.breakStartMinute !== null
      ? dayHours.breakStartHour * 60 + dayHours.breakStartMinute
      : null
  const breakEndTotal =
    dayHours.breakEndHour !== null && dayHours.breakEndMinute !== null
      ? dayHours.breakEndHour * 60 + dayHours.breakEndMinute
      : null

  for (let t = startTotal; t < endTotal; t += intervalMinutes) {
    // 휴게시간 구간 제외
    if (breakStartTotal !== null && breakEndTotal !== null) {
      if (t >= breakStartTotal && t < breakEndTotal) continue
    }

    const h = Math.floor(t / 60)
    const m = t % 60
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    if (h < 12) {
      morning.push(timeStr)
    } else {
      afternoon.push(timeStr)
    }
  }

  return { morning, afternoon }
}
