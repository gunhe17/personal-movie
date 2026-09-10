/**
 * 일정 충돌 확인 모달 문구 헬퍼.
 *
 * MultiDateSchedulePicker가 내보낸 conflictReason + conflictRoomName 조합으로
 * 컨펌 모달의 description을 reason별로 분기해 생성한다. 호출처마다 "등록/수정/
 * 변경/추가" 어휘만 action 파라미터로 주입한다.
 */

export type ConflictReason = 'room' | 'member' | 'both'
export type ConfirmAction = '등록' | '수정' | '변경' | '추가'

export function buildConflictConfirmDescription(
  roomName: string | null,
  reason: ConflictReason | null | undefined,
  action: ConfirmAction = '등록'
): string {
  const tail = `그래도 ${action}할까요?`
  const label = roomName ?? '해당 장소'

  if (reason === 'member') {
    return `선택한 시간에 담당자의 다른 일정이 겹쳐요.\n${tail}`
  }
  if (reason === 'both') {
    return `선택한 시간에 ${label}과 담당자의 일정이 모두 겹쳐요.\n${tail}`
  }
  // 'room' 또는 null/undefined는 기존 방 충돌 문구로 fallback
  return `선택한 시간에 ${label}의 일정이 겹쳐요.\n${tail}`
}
