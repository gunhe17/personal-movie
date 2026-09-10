/**
 * 상담 현황 페이지 서비스
 * - 모달, 스낵바, 쿼리 무효화 등 비즈니스 로직 캡슐화
 */
import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
import ConfirmModal from '$root/src/lib/components/modal/ConfirmModal.svelte'
import {
  patchCounselingCase,
  deleteCounseling
} from '$lib/hooks/actions/counseling.action'
import type { CounselingStatusRow } from './view-model'
import type { CounselingVM } from './view-model'
import type { QueryClient } from '@tanstack/svelte-query'
import type { Readable } from 'svelte/store'

export interface CounselingServiceDeps {
  queryClient: QueryClient
  centerId: Readable<string | null>
}

export function createCounselingService({
  queryClient,
  centerId
}: CounselingServiceDeps) {
  const invalidateCounselings = () =>
    queryClient.invalidateQueries({
      queryKey: ['getCounselingsByCenterId'],
      exact: false
    })

  function getCenterId(): string {
    let value: string | null = null
    centerId.subscribe((v) => (value = v))()
    if (!value) throw new Error('centerId is not available')
    return value
  }

  // 종결 처리 실행
  async function executeCloseCounseling(row: CounselingStatusRow) {
    try {
      const action = patchCounselingCase()
      await action.request({
        centerId: getCenterId(),
        counselingId: row.id,
        status: 'completed'
      })
      snackbarStore.success('상담을 종결 처리했어요.')
      invalidateCounselings()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      snackbarStore.error(detail || '종결 처리에 실패했어요.')
    }
  }

  // 종결 처리: 컨펌 모달 표시 (예정 회기가 남아있으면 경고)
  function closeCounseling(row: CounselingStatusRow) {
    const hasScheduled = row.scheduledSessions > 0
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '상담을 종결할까요?',
        message: hasScheduled
          ? `아직 예정된 회기가 ${row.scheduledSessions}건 있어요. 종결하면 이 회기들은 처리되지 않은 채 남아요.`
          : '종결 처리 후에도 되돌릴 수 있어요',
        type: 'warning',
        confirmText: '종결하기',
        cancelText: '아니요',
        onConfirm: () => executeCloseCounseling(row)
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 종결 되돌리기 실행
  async function executeReopenCounseling(row: CounselingStatusRow) {
    try {
      const action = patchCounselingCase()
      await action.request({
        centerId: getCenterId(),
        counselingId: row.id,
        status: 'active'
      })
      snackbarStore.success('상담을 미종결 상태로 되돌렸어요.')
      invalidateCounselings()
    } catch {
      snackbarStore.error('되돌리기에 실패했어요.')
    }
  }

  // 종결 되돌리기: 컨펌 모달 표시
  function reopenCounseling(row: CounselingStatusRow) {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '상담을 진행중으로 되돌릴까요?',
        message: '종결 이전 상태로 돌아가며, 다시 진행할 수 있어요.',
        type: 'warning',
        confirmText: '되돌리기',
        cancelText: '아니요',
        onConfirm: () => executeReopenCounseling(row)
      },
      options: {
        customWidth: 420
      }
    })
  }

  // 벌크 삭제 실행
  function executeBulkDelete(rows: CounselingStatusRow[]) {
    snackbarStore.info(`${rows.length}건의 상담을 삭제했어요.`)
    invalidateCounselings()
  }

  // 벌크 삭제: 컨펌 모달 표시
  function bulkDeleteCounselings(rows: CounselingStatusRow[]) {
    if (rows.length === 0) return

    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: rows.map((r) => r.id).join(','),
        title: `${rows.length}건의 상담을 삭제할까요?`,
        description: '상담 내용이 모두 삭제되며 다시 복구할 수 없어요',
        cancelText: '닫기',
        confirmText: '상담 삭제',
        onConfirm: () => executeBulkDelete(rows)
      },
      options: {
        customWidth: 420,
        customHeight: 270
      }
    })
  }

  // 단건 삭제: 컨펌 모달 표시
  /**
   * onSuccess: 삭제 후 후속 동작(상세 페이지에서 목록 복귀 등)
   * 회기 수는 행/카드가 이미 갖고 있고(totalSessions / total_sessions),
   * 상세에서는 호출부가 직접 넘긴다.
   */
  function deleteCounselingCase(
    counseling:
      | CounselingStatusRow
      | CounselingVM
      | { id: string; totalSessions?: number },
    onSuccess?: () => void
  ) {
    const sessionCount =
      (counseling as CounselingStatusRow).totalSessions ??
      (counseling as CounselingVM).total_sessions ??
      0
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: `상담을 삭제할까요?`,
        message: sessionCount
          ? `등록된 회기 ${sessionCount}건도 함께 삭제되며 복구할 수 없어요`
          : '삭제된 상담은 복구할 수 없어요',
        type: 'warning',
        confirmText: '삭제할게요',
        cancelText: '아니요',
        onConfirm: async () => {
          try {
            await deleteCounseling().request({
              centerId: getCenterId(),
              counselingId: counseling.id
            })
            snackbarStore.success('상담 일정을 삭제했어요')
            invalidateCounselings()
            onSuccess?.()
          } catch (err: any) {
            const detail = err?.response?.data?.detail
            snackbarStore.error(detail || '상담 삭제에 실패했어요.')
          }
        }
      },
      // 소형 다이얼로그 규격 폭 420 — 같은 파일의 종결/되돌리기 확인 팝업과 동일
      options: { customWidth: 420 }
    })
  }

  return {
    closeCounseling,
    reopenCounseling,
    deleteCounselingCase,
    bulkDeleteCounselings,
    invalidateCounselings
  }
}
