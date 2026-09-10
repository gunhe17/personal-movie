import type { QueryClient } from '@tanstack/svelte-query'

import {
  postApproveScheduleChangeRequest,
  postRejectScheduleChangeRequest
} from '$lib/hooks/actions/schedule.action'
import { requireCenterId } from '$lib/stores/center.store'
import { modalUtils } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'

export interface ReservationsDeps {
  queryClient: QueryClient
}

export function createReservationsService(deps: ReservationsDeps) {
  const { queryClient } = deps

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['getScheduleChangeRequests'],
      exact: false
    })
    queryClient.invalidateQueries({ queryKey: ['getScheduleList'], exact: false })
  }

  // 처리 여부를 돌려준다 — 대시보드 시그널이 행을 뺄지 판단하는 데 쓴다
  const approve = async (requestId: string) => {
    const confirmed = await modalUtils.confirm(
      '요청한 시간으로 일정을 변경할까요?',
      '변경 승인'
    )
    if (!confirmed) return false

    try {
      await postApproveScheduleChangeRequest().request({
        center_id: requireCenterId(),
        request_id: requestId
      })
      snackbarStore.success('일정을 변경했어요')
      invalidate()
      return true
    } catch (error) {
      // 승인 사이에 그 시간이 차면 서버가 막고 요청을 반려로 넘긴다
      const detail = (error as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      snackbarStore.error(detail || '승인하지 못했어요')
      invalidate()
      return false
    }
  }

  const reject = async (requestId: string) => {
    const reason = await modalUtils.prompt(
      '내담자에게 그대로 전달돼요.',
      '반려 사유',
      { placeholder: '예) 해당 시간은 다른 일정이 있어요', maxLength: 500 }
    )
    if (!reason || reason === 'cancelled') return false

    try {
      await postRejectScheduleChangeRequest().request({
        center_id: requireCenterId(),
        request_id: requestId,
        reason
      })
      snackbarStore.success('요청을 반려했어요')
      invalidate()
      return true
    } catch {
      snackbarStore.error('반려하지 못했어요')
      return false
    }
  }

  return { approve, reject, invalidate }
}
