import type {
  OperatingTimeSummary,
  NonOperatingTimeResponse
} from '$lib/hooks/actions/center.action'
import { formatUtcToKst } from '$lib/utils/date'
import {
  WEEKDAY_ORDER,
  WEEKDAY_KO,
  MONTH_WEEK_LABELS,
  type EditableHoliday
} from './constants'

/** 개설일: created_at(UTC) → KST "YYYY.MM.DD" */
export function formatOpenDate(createdAt: string | null | undefined): string {
  if (!createdAt) return '-'
  return formatUtcToKst(createdAt, 'YYYY.MM.DD')
}

/** Select 컴포넌트 value 추출 (string 또는 {value, title} 객체 대응) */
export const getSelectValue = (val: any): string => {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'value' in val) return String(val.value)
  return ''
}

/** 전화번호 파싱: "02-1234-5678" → { prefix: "02", body: "1234-5678" } */
export const parsePhone = (
  phone: string | null
): { prefix: string; body: string } => {
  if (!phone) return { prefix: '02', body: '' }
  const match = phone.match(/^(\d{2,3})-(.+)$/)
  if (match) return { prefix: match[1], body: match[2] }
  return { prefix: '02', body: phone }
}

/** "HH:MM:SS" → "HH:MM" */
export const trimTime = (t: string | null): string => {
  if (!t) return ''
  return t.length >= 5 ? t.slice(0, 5) : t
}

/** API 영업시간 → 정렬된 요일별 표시 데이터 */
export function toSortedOperatingTimes(data: OperatingTimeSummary[]) {
  return WEEKDAY_ORDER.map((weekday) => {
    const found = data.find((ot) => ot.weekday === weekday)
    return {
      weekday,
      label: WEEKDAY_KO[weekday],
      isOpen: found ? found.open_time !== null : false,
      openTime: trimTime(found?.open_time ?? null),
      closeTime: trimTime(found?.close_time ?? null)
    }
  })
}

/** 정기휴일 → 라벨 문자열 배열 */
export function toRegularHolidayLabels(
  items: NonOperatingTimeResponse[]
): string[] {
  return items
    .filter(
      (item) =>
        item.created_by === 'CENTER' &&
        item.month_week !== null &&
        item.weekday !== null
    )
    .map((h) => {
      const weekLabel =
        MONTH_WEEK_LABELS[h.month_week!] || `${h.month_week}째주`
      const dayLabel = h.weekday ? WEEKDAY_KO[h.weekday] : ''
      return `매월 ${weekLabel} ${dayLabel}요일`
    })
}

/**
 * 정기휴일 편집 결과 → API 호출 단위(삭제 id / 신규 생성)로 변환.
 * 정기휴일 API는 부분 수정이 없어 값이 바뀐 행은 '삭제 후 재생성'으로 처리한다
 * (예전 인라인 편집은 기존 행 변경을 저장 대상에서 빠뜨려 조용히 무시됐다).
 */
export function diffRegularHolidays(
  initial: EditableHoliday[],
  current: EditableHoliday[]
): { deletedHolidayIds: string[]; newHolidays: EditableHoliday[] } {
  const deletedHolidayIds: string[] = []
  const newHolidays: EditableHoliday[] = []

  for (const before of initial) {
    if (!before.id) continue
    const after = current.find((h) => h.id === before.id)
    // 삭제됐거나, 값이 바뀌었으면 기존 행은 지운다
    if (!after) {
      deletedHolidayIds.push(before.id)
    } else if (
      after.monthWeek !== before.monthWeek ||
      after.weekday !== before.weekday
    ) {
      deletedHolidayIds.push(before.id)
      newHolidays.push(after)
    }
  }

  for (const holiday of current) {
    if (!holiday.id) newHolidays.push(holiday)
  }

  return { deletedHolidayIds, newHolidays }
}

/** CENTER 정기휴일만 필터 */
export function filterCenterRegularHolidays(
  items: NonOperatingTimeResponse[]
): NonOperatingTimeResponse[] {
  return items.filter(
    (item) =>
      item.created_by === 'CENTER' &&
      item.month_week !== null &&
      item.weekday !== null
  )
}
