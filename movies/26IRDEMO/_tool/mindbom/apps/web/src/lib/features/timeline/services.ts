import { get } from '$lib/services/api/instances'
import type { ExaminationListResponse } from './types'

export interface TimelineRange {
  /** 기간 시작(포함) */
  from: Date
  /** 기간 끝(미포함) */
  to: Date
}

/**
 * 타임라인용 검사 목록 — 기간으로 조회한다.
 *
 * "최근 N건"으로 가져오면 그 범위 밖의 예정 검사가 통째로 빠져서
 * 타임라인이 보여주는 구간과 데이터가 어긋난다. 서버가 기준시각
 * (예정일, 없으면 생성일)으로 걸러 주므로 창(window)만 넘기면 된다.
 *
 * mine 기본값은 false — 검사 목록 페이지가 기관 전체를 보여주므로
 * 대시보드만 본인 것으로 좁히면 두 화면의 건수가 어긋난다.
 * (clinician 역할은 백엔드가 어차피 본인 검사로 제한한다)
 */
export async function fetchTimelineExams(
  institutionId: string,
  range: TimelineRange,
  { size = 200, mine = false }: { size?: number; mine?: boolean } = {}
): Promise<ExaminationListResponse> {
  return await get<ExaminationListResponse>(
    `/institutions/${institutionId}/examinations`,
    {
      mine,
      size,
      date_from: toNaiveISO(range.from),
      date_to: toNaiveISO(range.to)
    }
  )
}

/**
 * 서버가 기대하는 형식(타임존 없는 로컬 시각)으로 직렬화한다.
 *
 * toISOString()은 UTC로 바꿔 'Z'를 붙이는데, 검사 시각 컬럼은
 * TIMESTAMP WITHOUT TIME ZONE이라 로컬 시각이 그대로 저장돼 있다.
 * UTC로 보내면 KST 기준 '오늘 0시'가 전날 15시로 밀려 하루가 어긋난다.
 */
function toNaiveISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** 하루치 창 — [그날 0시, 다음날 0시) */
export function dayWindow(day: Date): TimelineRange {
  const from = new Date(day)
  from.setHours(0, 0, 0, 0)

  const to = new Date(from)
  to.setDate(to.getDate() + 1)

  return { from, to }
}
