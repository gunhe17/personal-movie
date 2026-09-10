/**
 * 상담실 관리 쿼리 입력 빌더
 */

import { getScheduleList } from '$lib/hooks/actions/schedule.action'

/** 월요일 시작 주의 [시작, 끝] ISO 문자열 (UTC) */
function weekRangeISO(now: Date): { start: string; end: string } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * 이번 주 전체 일정 조회 입력.
 * room_name 기준 집계용이라 담당자/내담자/타입 필터는 비움.
 */
export function buildWeekScheduleInput(centerId: string, now: Date) {
  const { start, end } = weekRangeISO(now)
  return {
    center_id: centerId,
    start_date: start,
    end_date: end,
    counselor_ids: [],
    client_ids: [],
    schedule_types: []
  }
}

export { getScheduleList }
