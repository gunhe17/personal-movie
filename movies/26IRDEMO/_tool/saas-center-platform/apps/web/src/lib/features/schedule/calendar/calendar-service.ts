import { deleteSchedule } from '$root/src/lib/hooks/actions/schedule.action'

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$root/src/lib/stores/snackbar'

import DeleteConfirmModal from '$root/src/lib/components/modal/DeleteConfirmModal.svelte'
import ConfirmModal from '$root/src/lib/components/modal/ConfirmModal.svelte'
import { centerId, requireCenterId } from '$root/src/lib/stores/center.store'
import { get } from 'svelte/store'
import type { QueryClient } from '@tanstack/svelte-query'

export interface ScheduleServiceDeps {
  queryClient: QueryClient
}

export function createScheduleService(deps: ScheduleServiceDeps) {
  const { queryClient } = deps

  // 일정 취소: 상태를 'cancelled'로 변경 (데이터 유지)
  const handleCancelSchedule = async (scheduleId: string) => {
    // 추후 API 연동
  }

  // 일정 삭제: 데이터 완전 삭제
  const handleDeleteSchedule = async (scheduleId: string) => {
    await deleteSchedule().request({
      center_id: get(centerId) || '',
      schedule_id: scheduleId
    })
    snackbarStore.success('일정을 삭제했어요!')
    queryClient.invalidateQueries({
      queryKey: ['getScheduleList'],
      exact: false
    })
  }

  const openCancelScheduleModal = (scheduleId: string) => {
    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: scheduleId,
        title: '일정을 취소할까요?',
        description: '해당 일정을 취소합니다.',
        confirmText: '취소',
        onConfirm: handleCancelSchedule
      },
      options: { customWidth: 420 }
    })
  }

  const openDeleteScheduleModal = (
    scheduleId: string,
    opts?: { isAssessment?: boolean; onSuccess?: () => void }
  ) => {
    const onConfirm = async () => {
      try {
        await deleteSchedule().request({
          center_id: requireCenterId(),
          schedule_id: scheduleId
        })
        snackbarStore.success('일정을 삭제했어요!')
        queryClient.invalidateQueries({
          queryKey: ['getScheduleList'],
          exact: false
        })
        opts?.onSuccess?.()
      } catch {
        snackbarStore.error('일정 삭제를 실패했어요!')
      }
    }

    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '일정을 삭제할까요?',
        ...(opts?.isAssessment
          ? {
              description:
                '검사는 유지되며 필요시 검사 상세에서\n일정을 다시 추가할 수 있어요',
              type: 'warning',
              confirmText: '삭제',
              cancelText: '닫기'
            }
          : {
              message: '삭제된 일정은 캘린더에서 사라지며 복구할 수 없어요',
              type: 'warning',
              confirmText: '삭제할게요',
              cancelText: '아니요'
            }),
        onConfirm
      },
      options: { customWidth: 420 }
    })
  }

  return {
    handleCancelSchedule,
    handleDeleteSchedule,
    openCancelScheduleModal,
    openDeleteScheduleModal
  }
}
