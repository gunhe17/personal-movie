import type { QueryClient } from '@tanstack/svelte-query'

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import { extractErrorMessage } from '$lib/utils/errorHandler'
import {
  updateCounselingSession,
  cancelCounselingSession,
  patchCounselingCase,
  getCounselingDetailById
} from '$lib/hooks/actions/counseling.action'
import ConfirmModal from '$lib/components/modal/ConfirmModal.svelte'
import SessionCreateModal from '$lib/components/modal/SessionCreateModal.svelte'

export interface SignalDeps {
  queryClient: QueryClient
}

/**
 * 대시보드 시그널의 인라인 처리 — 목록 페이지로 가지 않고 여기서 끝낸다.
 * 각 함수는 처리 여부(true=행 제거)를 돌려주고, 성공 시 시그널 조회를 무효화한다.
 */
export function createSignalService(deps: SignalDeps) {
  const { queryClient } = deps

  // 회기·케이스 처리는 상담 현황·상세·청구 대상 집계를 동시에 흔든다
  const invalidateSignals = () =>
    Promise.all(
      [
        'getUnprocessedSessions',
        'getCounselingsByCenterId',
        'getCounselingDetailById',
        'getTodayMissingBillables',
        'getScheduleList'
      ].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key], exact: false })
      )
    )

  const confirm = async (params: {
    title: string
    message: string
    confirmText: string
    type?: 'info' | 'warning' | 'danger'
  }) => {
    const result = await modalStore.openWithPromise<unknown, string | null>(
      ConfirmModal,
      {
        title: params.title,
        message: params.message,
        confirmText: params.confirmText,
        type: params.type ?? 'warning'
      },
      { size: 'sm' }
    )
    return result === 'confirmed'
  }

  const changeSessionStatus = async (
    sessionId: string,
    status: 'completed' | 'no_show',
    successMessage: string
  ) => {
    try {
      await updateCounselingSession().request({
        centerId: requireCenterId(),
        sessionId,
        payload: { status }
      })
      snackbarStore.success(successMessage)
      invalidateSignals()
      return true
    } catch (error) {
      snackbarStore.error(
        extractErrorMessage(error) || '회기 처리에 실패했어요.'
      )
      return false
    }
  }

  const completeSession = (sessionId: string) =>
    changeSessionStatus(sessionId, 'completed', '완료 처리했어요.')

  const noShowSession = (sessionId: string) =>
    changeSessionStatus(sessionId, 'no_show', '노쇼로 처리했어요.')

  const cancelSession = async (sessionId: string, label: string) => {
    const ok = await confirm({
      title: '회기를 취소할까요?',
      message: `${label} 회기가 취소 상태가 돼요. 케이스 상세에서 되돌릴 수 있어요.`,
      confirmText: '취소 처리',
      type: 'danger'
    })
    if (!ok) return false
    try {
      await cancelCounselingSession().request({
        centerId: requireCenterId(),
        sessionId
      })
      snackbarStore.success('회기를 취소했어요.')
      invalidateSignals()
      return true
    } catch (error) {
      snackbarStore.error(
        extractErrorMessage(error) || '회기 취소에 실패했어요.'
      )
      return false
    }
  }

  const completeCase = async (caseId: string, label: string) => {
    const ok = await confirm({
      title: '상담을 종결할까요?',
      message: `${label} 사례가 종결 상태가 돼요.`,
      confirmText: '종결'
    })
    if (!ok) return false
    try {
      await patchCounselingCase().request({
        centerId: requireCenterId(),
        counselingId: caseId,
        status: 'completed'
      })
      snackbarStore.success('종결 처리했어요.')
      invalidateSignals()
      return true
    } catch (error) {
      snackbarStore.error(extractErrorMessage(error) || '종결에 실패했어요.')
      return false
    }
  }

  // 회기 추가 모달은 케이스 상세(방·담당자·규칙)를 요구해 목록 행 정보만으로는 못 연다
  const openAddSessions = async (caseId: string) => {
    try {
      const detail = await getCounselingDetailById().request({
        centerId: requireCenterId(),
        counselingId: caseId
      })
      modalStore.open({
        component: SessionCreateModal,
        props: {
          counselingDetail: detail,
          onSuccess: () => invalidateSignals()
        },
        options: { size: 'lg' }
      })
    } catch (error) {
      snackbarStore.error(
        extractErrorMessage(error) || '사례를 불러오지 못했어요.'
      )
    }
    return false
  }

  return {
    completeSession,
    noShowSession,
    cancelSession,
    completeCase,
    openAddSessions
  }
}
