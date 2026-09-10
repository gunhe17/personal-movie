import type { QueryClient } from '@tanstack/svelte-query'

import {
  getCounselingDetailById,
  updateCounselingSession,
  cancelCounselingSession,
  revertCancelCounselingSession,
  patchCounselingCase
} from '$lib/hooks/actions/counseling.action'
import { getScheduleDetail } from '$lib/hooks/actions/schedule.action'
import { openCounselingJournalModal } from '$lib/features/counseling/detail'
import { modalStore, modalUtils } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import type { CounselingSession } from '$lib/types/counseling'

export interface DashboardSessionActionsDeps {
  queryClient: QueryClient
}

/**
 * 대시보드(일정 카드 · 처리할 일 드릴다운)에서 지난 회기를 바로 정리하는 서비스.
 *
 * 상태를 바꾸는 액션(완료·취소·종결)은 **확인 팝업 → 실행 → 되돌리기 스낵바** 순서를 따른다.
 * 팝업은 오조작을 막고, 스낵바는 확인을 눌러버린 뒤의 마지막 탈출구다 —
 * 다른 화면(캘린더 회기 취소 · 상담 현황 종결)의 확인 규격과 같은 ConfirmModal을 쓴다.
 *
 * 일정 목록(ScheduleType)은 session_id를 갖고 있지 않으므로, 일정 상세를 한 번 읽어
 * 연결된 회기를 찾은 뒤 완료/취소를 호출한다. 상세는 일정 상세 모달과 같은 쿼리 키를
 * 쓰므로 이미 열어봤다면 캐시를 재사용한다.
 */
export function createDashboardSessionActions(
  deps: DashboardSessionActionsDeps
) {
  const { queryClient } = deps

  const invalidateSchedules = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['getScheduleList'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getCounselingsByCenterId'],
        exact: false
      })
    ])

  /** 일정 → 연결된 상담 회기 (없으면 null) */
  async function resolveSession(scheduleId: string) {
    const centerId = requireCenterId()
    const action = getScheduleDetail()
    const params = { center_id: centerId, schedule_id: scheduleId }
    const detail = await queryClient.fetchQuery({
      queryKey: [action.key![0], params] as const,
      queryFn: () => action.request(params)
    })
    const session = detail?.sessions?.[0]
    if (!session?.session_id) return null
    return {
      centerId,
      sessionId: session.session_id,
      caseId: session.case_id,
      clientId: session.clients?.[0]?.client_id ?? ''
    }
  }

  // ── 확인 팝업 ──
  // 문구·타입은 같은 처리를 하는 다른 화면과 맞춘다(캘린더 회기 취소 = danger,
  // 상담 현황 종결 = warning + '아니요'). 완료는 되돌릴 수 있는 중립 확인이라 info —
  // 경고 삼각형을 붙이면 모든 확인이 위험해 보여 경고가 무뎌진다(§popup).
  const confirmComplete = () =>
    modalUtils.confirm(
      '완료한 회기는 상담일지를 작성할 수 있어요',
      '회기를 완료 처리할까요?',
      {
        type: 'info',
        confirmText: '완료하기',
        cancelText: '아니요'
      }
    )

  const confirmCancel = () =>
    modalUtils.confirm(
      '취소한 회기는 일정에서 취소 상태로 표시돼요',
      '회기를 취소할까요?',
      {
        type: 'danger',
        confirmText: '취소하기',
        cancelText: '아니요'
      }
    )

  const confirmClose = () =>
    modalUtils.confirm(
      '종결 처리 후에도 되돌릴 수 있어요',
      '상담을 종결할까요?',
      {
        type: 'warning',
        confirmText: '종결하기',
        cancelText: '아니요'
      }
    )

  // ── 되돌리기 ──
  // onRestored = 호출부의 화면 상태 복구(드릴다운에서 뺀 행 되살리기 · 일지 작성 대기 해제).
  // 서버 복구가 성공한 뒤에만 부른다 — 실패했는데 행만 돌아오면 화면이 거짓말을 한다.
  async function undoComplete(sessionId: string, onRestored?: () => void) {
    try {
      await updateCounselingSession().request({
        centerId: requireCenterId(),
        sessionId,
        payload: { status: 'scheduled' }
      })
      await invalidateAll()
      onRestored?.()
      snackbarStore.success('완료 처리를 되돌렸어요')
    } catch {
      snackbarStore.error('되돌리기에 실패했어요')
    }
  }

  async function undoCancel(sessionId: string, onRestored?: () => void) {
    try {
      await revertCancelCounselingSession().request({
        centerId: requireCenterId(),
        sessionId
      })
      await invalidateAll()
      onRestored?.()
      snackbarStore.success('취소를 되돌렸어요')
    } catch {
      snackbarStore.error('되돌리기에 실패했어요')
    }
  }

  async function undoCloseCase(caseId: string, onRestored?: () => void) {
    try {
      await patchCounselingCase().request({
        centerId: requireCenterId(),
        counselingId: caseId,
        status: 'active'
      })
      await invalidateAll()
      onRestored?.()
      snackbarStore.success('종결을 되돌렸어요')
    } catch {
      snackbarStore.error('되돌리기에 실패했어요')
    }
  }

  /** onRestored = 되돌리기 성공 시 화면 상태 복구(일지 작성 대기 해제 등) */
  async function complete(scheduleId: string, onRestored?: () => void) {
    if (!(await confirmComplete())) return false
    const target = await resolveSession(scheduleId)
    if (!target) {
      snackbarStore.error('회기 정보를 찾을 수 없어요')
      return false
    }
    await updateCounselingSession().request({
      centerId: target.centerId,
      sessionId: target.sessionId,
      payload: { status: 'completed' }
    })
    await invalidateSchedules()
    snackbarStore.undoable('회기를 완료 처리했어요', () =>
      undoComplete(target.sessionId, onRestored)
    )
    return true
  }

  async function cancel(scheduleId: string, onRestored?: () => void) {
    if (!(await confirmCancel())) return false
    const target = await resolveSession(scheduleId)
    if (!target) {
      snackbarStore.error('회기 정보를 찾을 수 없어요')
      return false
    }
    await cancelCounselingSession().request({
      centerId: target.centerId,
      sessionId: target.sessionId
    })
    await invalidateSchedules()
    snackbarStore.undoable('회기를 취소 처리했어요', () =>
      undoCancel(target.sessionId, onRestored)
    )
    return true
  }

  /** 완료 처리한 회기의 상담일지 작성 모달 열기 (내 상담일지와 동일 모달 재사용) */
  async function writeNote(scheduleId: string) {
    const target = await resolveSession(scheduleId)
    if (!target?.caseId) {
      snackbarStore.error('회기 정보를 찾을 수 없어요')
      return
    }
    try {
      const detail = await getCounselingDetailById().request({
        centerId: target.centerId,
        counselingId: target.caseId
      })
      const session = (detail.sessions ?? []).find(
        (s: CounselingSession) => s.session_id === target.sessionId
      )
      if (!session) {
        snackbarStore.error('회기 정보를 찾을 수 없어요')
        return
      }
      const programName =
        detail.case_type === 'individual'
          ? detail.program_name
          : `${detail.program_name} - 그룹`

      const modalId = openCounselingJournalModal({
        session,
        caseClients: detail.clients ?? [],
        programName,
        initialClientId:
          target.clientId || (detail.clients?.[0]?.client_id ?? '')
      })

      const unsubscribe = modalStore.subscribe((state) => {
        const stillOpen = state.modals.some((m) => m.id === modalId)
        if (!stillOpen) {
          setTimeout(() => unsubscribe(), 0)
          invalidateSchedules()
        }
      })
    } catch {
      snackbarStore.error('일지 정보를 불러오지 못했어요')
    }
  }

  // ── 처리할 일 드릴다운 모달에서 쓰는 단건 처리 (session_id를 이미 아는 경로) ──

  // 확인 팝업에서 물러나면 false — 드릴다운은 이 값을 보고 행을 목록에 남긴다.
  // onRestored = 되돌리기 성공 시 뺐던 행을 되살리는 콜백(드릴다운이 넘겨준다).
  async function completeSessionById(
    sessionId: string,
    onRestored?: () => void
  ) {
    if (!(await confirmComplete())) return false
    try {
      await updateCounselingSession().request({
        centerId: requireCenterId(),
        sessionId,
        payload: { status: 'completed' }
      })
      await invalidateAll()
      snackbarStore.undoable('회기를 완료 처리했어요', () =>
        undoComplete(sessionId, onRestored)
      )
      return true
    } catch {
      snackbarStore.error('완료 처리에 실패했어요')
      return false
    }
  }

  async function cancelSessionById(sessionId: string, onRestored?: () => void) {
    if (!(await confirmCancel())) return false
    try {
      await cancelCounselingSession().request({
        centerId: requireCenterId(),
        sessionId
      })
      await invalidateAll()
      snackbarStore.undoable('회기를 취소 처리했어요', () =>
        undoCancel(sessionId, onRestored)
      )
      return true
    } catch {
      snackbarStore.error('취소 처리에 실패했어요')
      return false
    }
  }

  /** 상담 사례 종결 — 상담 현황의 종결 처리와 같은 API·같은 확인 문구 */
  async function closeCase(caseId: string, onRestored?: () => void) {
    if (!(await confirmClose())) return false
    try {
      await patchCounselingCase().request({
        centerId: requireCenterId(),
        counselingId: caseId,
        status: 'completed'
      })
      await invalidateAll()
      snackbarStore.undoable('상담을 종결 처리했어요', () =>
        undoCloseCase(caseId, onRestored)
      )
      return true
    } catch (err: any) {
      snackbarStore.error(
        err?.response?.data?.detail || '종결 처리에 실패했어요'
      )
      return false
    }
  }

  const invalidateAll = () =>
    Promise.all([
      invalidateSchedules(),
      queryClient.invalidateQueries({
        queryKey: ['getUnprocessedSessions'],
        exact: false
      }),
      queryClient.invalidateQueries({
        queryKey: ['getTodayMissingBillables'],
        exact: false
      })
    ])

  return {
    complete,
    cancel,
    writeNote,
    completeSessionById,
    cancelSessionById,
    closeCase
  }
}
