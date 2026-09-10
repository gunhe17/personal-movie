/**
 * 근무일정 캘린더 보조: 구성원의 상담/검사 일정을 날짜별로 집계
 */

import { formatUtcToKst } from '$lib/utils/date'
import type { ScheduleType } from '$lib/hooks/actions/schedule.action'
import type { WeeklySchedule } from './constants'

export interface DayScheduleCount {
  counseling: number
  assessment: number
  /** 근무시간 밖(휴무일 포함)에 잡힌 일정이 하나라도 있음 */
  hasOffHours: boolean
}

/** 'YYYY-MM-DD'(KST) → 상담/검사 개수 */
export type ScheduleCountMap = Record<string, DayScheduleCount>

/** "HH:mm" → 분 단위 (비교용) */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * 일정이 해당 요일 근무시간 밖에 잡혀 있는지 판단한다.
 * - 휴무일(근무 패턴 없음) → 무조건 근무 외
 * - 근무일 → 일정 시작 시각이 [근무 시작, 근무 종료) 밖이면 근무 외
 */
function isOffHours(
  startHHmm: string,
  weekdayKr: string,
  weeklySchedule?: WeeklySchedule
): boolean {
  const work = weeklySchedule?.[weekdayKr]
  if (!work) return true // 휴무일
  const t = toMinutes(startHHmm)
  return t < toMinutes(work.start) || t >= toMinutes(work.end)
}

/**
 * getScheduleList 응답을 날짜별 상담/검사 개수 + 근무시간 외 여부로 집계한다.
 * - schedule.start는 UTC 기준이므로 KST로 변환해 날짜 키/요일/시각을 만든다
 *   (schedule 캘린더 페이지의 formatDateKey와 동일 규칙)
 * - counseling / assessment 만 카운트 (meeting/block 제외)
 * - weeklySchedule을 주면 근무시간 밖 일정을 hasOffHours로 표시
 */
export function buildScheduleCountMap(
  schedules: ScheduleType[] | undefined,
  weeklySchedule?: WeeklySchedule
): ScheduleCountMap {
  const map: ScheduleCountMap = {}
  if (!schedules) return map

  for (const s of schedules) {
    if (s.schedule_type !== 'counseling' && s.schedule_type !== 'assessment') {
      continue
    }
    const key = formatUtcToKst(s.start, 'YYYY-MM-DD')
    if (!key) continue
    if (!map[key]) {
      map[key] = { counseling: 0, assessment: 0, hasOffHours: false }
    }
    map[key][s.schedule_type] += 1

    const weekdayKr = formatUtcToKst(s.start, 'd') // '월'~'일'
    const startHHmm = formatUtcToKst(s.start, 'HH:mm')
    if (isOffHours(startHHmm, weekdayKr, weeklySchedule)) {
      map[key].hasOffHours = true
    }
  }

  return map
}

/** 캘린더 셀 날짜(로컬 Date의 연/월/일)를 'YYYY-MM-DD' 키로 변환 */
export function toDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}
