/**
 * 필드노트 쿼리 입력 빌더
 *
 * queryBuilder()에 전달할 입력을 조립한다.
 * centerId는 호출 시점에 반응형 값으로 주입 (SSR 안전).
 */

export function buildFieldNoteBySchedule(
  centerId: string | null,
  scheduleId: string | null
) {
  if (!centerId || !scheduleId) return null
  return { centerId, scheduleId }
}

export function buildFieldNoteStatuses(
  centerId: string | null,
  scheduleIds: string[]
) {
  if (!centerId || !scheduleIds?.length) return null
  return { centerId, scheduleIds }
}

export function buildFieldNoteDetail(
  centerId: string | null,
  fieldNoteId: string | null
) {
  if (!centerId || !fieldNoteId) return null
  return { centerId, fieldNoteId }
}

export function buildUnlinkedFieldNotes(centerId: string | null) {
  if (!centerId) return null
  return { centerId }
}
