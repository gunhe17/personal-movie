/**
 * CenterVoucher 서비스
 * 모달/토스트/invalidate 캡슐화 (V4 아키텍처)
 */

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import type { QueryClient } from '@tanstack/svelte-query'
import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
import {
  deleteCenterVoucher,
  patchCenterVoucher,
  postCenterVoucher,
  type CenterVoucherStatsResponse,
  type CreateCenterVoucherPayload,
  type UpdateCenterVoucherPayload
} from '$lib/hooks/actions/centerVoucher.action'
import { MODAL_SIZES } from './constants'
import type { CenterVoucherVM } from './view-model'

export interface CenterVoucherDeps {
  queryClient: QueryClient
}

export function createCenterVoucherService(deps: CenterVoucherDeps) {
  const { queryClient } = deps

  const invalidateList = () => {
    queryClient.invalidateQueries({
      queryKey: ['getCenterVoucherList'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getCenterVoucherStats'],
      exact: false
    })
  }

  const invalidateDetail = () =>
    queryClient.invalidateQueries({
      queryKey: ['getCenterVoucherDetail'],
      exact: false
    })

  // 캐시된 stats에서 해당 바우처의 사용중 내담자 수를 읽음 (없으면 0)
  const getActiveClientCount = (centerVoucherId: string): number => {
    const caches = queryClient.getQueriesData<CenterVoucherStatsResponse>({
      queryKey: ['getCenterVoucherStats'],
      exact: false
    })
    for (const [, stats] of caches) {
      const found = stats?.per_voucher?.find(
        (p) => p.center_voucher_id === centerVoucherId
      )
      if (found) return found.active_client_count
    }
    return 0
  }

  // ── 등록 ──
  const openCreateModal = (CenterVoucherFormModal: any) => {
    modalStore.open({
      component: CenterVoucherFormModal,
      props: {
        mode: 'create' as const,
        onConfirm: async (data: CreateCenterVoucherPayload) => {
          try {
            await postCenterVoucher().request({
              centerId: requireCenterId(),
              payload: data
            })
            snackbarStore.success('취급 바우처가 등록되었어요')
            invalidateList()
          } catch (error) {
            console.error('[postCenterVoucher] failed', error)
            snackbarStore.error('취급 등록에 실패했어요')
            throw error
          }
        }
      },
      options: MODAL_SIZES.create
    })
  }

  // ── 수정 ──
  const openEditModal = (
    CenterVoucherFormModal: any,
    item: CenterVoucherVM
  ) => {
    modalStore.open({
      component: CenterVoucherFormModal,
      props: {
        mode: 'edit' as const,
        initialItem: item,
        onConfirm: async (data: UpdateCenterVoucherPayload) => {
          try {
            await patchCenterVoucher().request({
              centerId: requireCenterId(),
              centerVoucherId: item.id,
              payload: data
            })
            snackbarStore.success('취급 바우처가 수정되었어요')
            invalidateList()
            invalidateDetail()
          } catch (error) {
            console.error('[patchCenterVoucher] failed', error)
            snackbarStore.error('수정에 실패했어요')
            throw error
          }
        }
      },
      options: MODAL_SIZES.edit
    })
  }

  // ── 활성/비활성 토글 (간단 PATCH) ──
  const toggleActive = async (item: CenterVoucherVM) => {
    try {
      await patchCenterVoucher().request({
        centerId: requireCenterId(),
        centerVoucherId: item.id,
        payload: { is_active: !item.isActive }
      })
      snackbarStore.success(
        item.isActive ? '비활성화되었어요' : '활성화되었어요'
      )
      // 이 토글은 상세 화면(케밥)에서만 일어난다 — 상세를 갱신하지 않으면
      // 배지도 케밥 라벨도 옛 상태 그대로라 같은 요청을 다시 보내게 된다.
      invalidateDetail()
      invalidateList()
    } catch (error) {
      console.error('[toggleActive] failed', error)
      snackbarStore.error('상태 변경에 실패했어요')
    }
  }

  // ── 삭제 ── (onDeleted: 삭제 성공 후 콜백 — 상세 화면에서 목록 복귀 등)
  const openDeleteConfirm = (item: CenterVoucherVM, onDeleted?: () => void) => {
    const activeClientCount = getActiveClientCount(item.id)
    const baseDescription = `'${item.catalogName}' 등록을 해제하시겠어요?`
    const description =
      activeClientCount > 0
        ? `${baseDescription}\n 현재 ${activeClientCount}명의 내담자가 이 바우처를 사용 중이에요.`
        : baseDescription

    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: item.id,
        title: '등록 해제',
        description,
        cancelText: '닫기',
        confirmText: '해제',
        onConfirm: async () => {
          try {
            await deleteCenterVoucher().request({
              centerId: requireCenterId(),
              centerVoucherId: item.id
            })
            snackbarStore.success('등록이 해제되었어요')
            invalidateList()
            onDeleted?.()
          } catch (error) {
            console.error('[deleteCenterVoucher] failed', error)
            snackbarStore.error('해제에 실패했어요')
            throw error
          }
        }
      },
      options: MODAL_SIZES.delete
    })
  }

  return {
    invalidateList,
    invalidateDetail,
    openCreateModal,
    openEditModal,
    toggleActive,
    openDeleteConfirm
  }
}
