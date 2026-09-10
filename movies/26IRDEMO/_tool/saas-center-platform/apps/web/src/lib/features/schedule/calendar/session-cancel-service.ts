/**
 * 세션 취소/복구 서비스
 * Assessment/Counseling 세션의 취소 및 복구 로직 캡슐화
 */

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  cancelAssessmentSession,
  revertCancelAssessmentSession
} from '$lib/hooks/actions/session.action'
import {
  cancelCounselingSession,
  revertCancelCounselingSession
} from '$lib/hooks/actions/counseling.action'
import CancelScheduleModal from '$lib/components/modal/CancelScheduleModal.svelte'
import ConfirmModal from '$lib/components/modal/ConfirmModal.svelte'

export interface SessionCancelDeps {
  queryClient: QueryClient
}

export function createSessionCancelService(deps: SessionCancelDeps) {
  const { queryClient } = deps

  const invalidateQueries = (scheduleType?: string) => {
    queryClient.invalidateQueries({ queryKey: ['getScheduleList'], exact: false })
    if (scheduleType === 'assessment') {
      queryClient.invalidateQueries({ queryKey: ['getCaseById'], exact: false })
    }
    queryClient.invalidateQueries({ queryKey: ['getScheduleDetail'], exact: false })
  }

  const cancelSession = async (
    params: { sessionId: string; scheduleType: string; cancelReason?: string },
    callbacks?: { onSuccess?: () => void; onError?: () => void }
  ) => {
    const centerId = requireCenterId()

    if (!params.sessionId) {
      snackbarStore.error('세션 정보가 없어 취소할 수 없어요')
      return
    }

    try {
      const request = {
        centerId,
        sessionId: params.sessionId,
        cancelReason: params.cancelReason || undefined
      }

      if (params.scheduleType === 'assessment') {
        await cancelAssessmentSession().request(request)
      } else if (params.scheduleType === 'counseling') {
        await cancelCounselingSession().request(request)
      }

      snackbarStore.success('일정을 취소했어요!')
      invalidateQueries(params.scheduleType)
      callbacks?.onSuccess?.()
    } catch {
      snackbarStore.error('일정 취소를 실패했어요!')
      callbacks?.onError?.()
    }
  }

  const revertCancelSession = async (
    params: { sessionId: string; scheduleType: string },
    callbacks?: { onSuccess?: () => void; onError?: () => void }
  ) => {
    const centerId = requireCenterId()
    if (!params.sessionId) return

    try {
      const request = { centerId, sessionId: params.sessionId }

      if (params.scheduleType === 'assessment') {
        await revertCancelAssessmentSession().request(request)
      } else if (params.scheduleType === 'counseling') {
        await revertCancelCounselingSession().request(request)
      }

      snackbarStore.success('일정 취소를 되돌렸어요!')
      invalidateQueries(params.scheduleType)
      callbacks?.onSuccess?.()
    } catch {
      snackbarStore.error('취소 되돌리기에 실패했어요!')
      callbacks?.onError?.()
    }
  }

  const openCancelModal = (onConfirm: (cancelReason: string) => void) => {
    modalStore.open({
      component: CancelScheduleModal,
      props: { onConfirm },
      options: { customWidth: 420 }
    })
  }

  const openRevertCancelModal = (onConfirm: () => void) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '취소를 되돌릴까요?',
        description: '일정이 예정 상태로 복구됩니다.',
        type: 'warning',
        confirmText: '되돌리기',
        cancelText: '아니요',
        onConfirm
      },
      options: { customWidth: 420 }
    })
  }

  return {
    cancelSession,
    revertCancelSession,
    openCancelModal,
    openRevertCancelModal
  }
}
