import type {
  ScheduleChangeRequestItem,
  ScheduleType
} from '$lib/hooks/actions/schedule.action'

/**
 * 캘린더가 그리는 일정 — API 일정에 **변경 요청 오버레이**가 얹힌 형태.
 *
 * 변경 요청은 새 일정이 아니라 "기존 일정의 제안된 이동"이다. 그래서 블록을
 * 따로 만들지 않고 같은 목록에 두 얼굴로 넣는다 —
 * 지금 자리의 `origin`(실선, 아직 유효한 일정)과 요청된 자리의 `ghost`(점선).
 * 위치 계산·겹침 분배는 기존 블록 로직을 그대로 타므로 뷰는 손대지 않는다.
 */
export type CalendarSchedule = ScheduleType & {
  /** 이 블록에 걸린 대기 중 변경 요청 (origin·ghost 공통) */
  changeRequest?: ScheduleChangeRequestItem
  changeRequestRole?: 'origin' | 'ghost'
  /** 요청 시각이 다른 일정과 겹친다 — 캘린더에서 보는 가장 큰 이유 */
  changeRequestConflict?: boolean
}

/**
 * ⚠️ `ScheduleType.start/end`는 타입만 `Date`고 **런타임 값은 API가 준 문자열**이다
 * (`'2026-09-05T07:00:00'` — 타임존 표기 없음). 화면은 이 문자열을 KST로 변환해
 * 그리므로, 여기서 `new Date(...)`로 감싸면 로컬(KST)로 한 번 해석된 뒤 다시 +9가
 * 걸려 9시간이 밀린다. 원본과 **같은 모양**으로 넘긴다.
 */
const asScheduleTime = (iso: string) => iso as unknown as Date

const overlaps = (
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string
) =>
  new Date(aStart).getTime() < new Date(bEnd).getTime() &&
  new Date(bStart).getTime() < new Date(aEnd).getTime()

/**
 * 원본이 조회 범위 밖일 때(다음 달로 옮기는 요청 등) 요청 자체로 고스트를 만든다.
 * 목록 조회는 보이는 달만 가져오므로 원본을 못 찾는 경우가 실제로 생긴다.
 */
function ghostFromRequest(r: ScheduleChangeRequestItem): ScheduleType {
  return {
    id: `change-request-${r.id}`,
    client_names: r.client_name ? [r.client_name] : [],
    clients: [],
    counselor_name: r.counselor_name ?? '',
    counselor_color: null,
    start: asScheduleTime(r.requested_start),
    end: asScheduleTime(r.requested_end),
    has_conflict: false,
    title: r.title ?? '',
    program_name: null,
    room_name: '',
    schedule_type: 'counseling',
    session_status: null
  }
}

/**
 * 일정 목록에 대기 중 변경 요청을 얹는다.
 * - 요청이 걸린 일정 → `origin` 표시만 붙인다(자리·모양 그대로)
 * - 요청된 시각 → `ghost` 블록을 하나 더 만든다
 */
export function applyChangeRequests(
  schedules: ScheduleType[],
  requests: ScheduleChangeRequestItem[]
): CalendarSchedule[] {
  if (!requests.length) return schedules

  const byScheduleId = new Map(requests.map((r) => [r.schedule_id, r]))

  const origins: CalendarSchedule[] = schedules.map((s) => {
    const request = byScheduleId.get(s.id)
    return request
      ? { ...s, changeRequest: request, changeRequestRole: 'origin' as const }
      : s
  })

  const ghosts: CalendarSchedule[] = requests.map((r) => {
    const base = schedules.find((s) => s.id === r.schedule_id)
    const start = asScheduleTime(r.requested_start)
    const end = asScheduleTime(r.requested_end)
    return {
      ...(base ?? ghostFromRequest(r)),
      id: `change-request-${r.id}`,
      start,
      end,
      // 원본은 옮겨갈 자리이므로 겹침 판정에서 뺀다
      has_conflict: false,
      changeRequest: r,
      changeRequestRole: 'ghost' as const,
      changeRequestConflict: schedules.some(
        (s) => s.id !== r.schedule_id && overlaps(start, end, s.start, s.end)
      )
    }
  })

  return [...origins, ...ghosts]
}
