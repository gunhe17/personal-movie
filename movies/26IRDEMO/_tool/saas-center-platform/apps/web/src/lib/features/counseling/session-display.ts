import type { CounselingSession, SessionStatus } from '$lib/types/counseling'

/**
 * 회기 **정렬·집계 전용** 표시 상태.
 *
 * session.status는 '노쇼 버튼'(회기 상태 변경)으로만 갱신되고, 참석 토글(update_attendance)로
 * 노쇼 처리하면 session.status는 'scheduled'로 남는다. 정렬에서 이런 회기를 '예정' 그룹
 * 맨 위에 두면 어색하므로, 여기서만 참석 상태로 보정한다.
 * (진행 회기 정의 = 참석/불참/노쇼 = 열린 회기와 동일 기준)
 *
 * 🔴 **상태 배지에는 쓰지 않는다** — 배지는 `session.status`를 그대로 보여준다.
 * 이걸 배지에 쓰면 사용자가 조작한 값과 화면이 어긋난다:
 *   - 참석만 눌러도(회기 상태는 그대로) 배지가 '완료'로 바뀌어, 확인 모달을 취소해도 완료로 보인다
 *   - '예정으로 되돌리기'가 성공해도 참여자가 attended면 다시 '완료'로 덮여 되돌아가지 않은 것처럼 보인다
 *
 * 근본 해결은 출석 토글이 회기 상태까지 정합을 맞추는 것(서버). 그때까지 이 보정은 정렬에만 둔다.
 */
export function deriveSessionDisplayStatus(
  session: CounselingSession
): SessionStatus {
  if (session.status !== 'scheduled') return session.status

  const resolved = (session.clients ?? []).filter(
    (c) => c.attendance_status !== 'scheduled'
  )
  if (resolved.length === 0) return 'scheduled'

  const anyAttended = resolved.some(
    (c) => c.attendance_status === 'attended' || c.attendance_status === 'late'
  )
  return anyAttended ? 'completed' : 'no_show'
}
