/**
 * Voucher 상세 페이지 서비스 — 모달/토스트/invalidate 래핑.
 */
import { goto } from '$app/navigation'
import ConfirmModal from '$components/modal/ConfirmModal.svelte'
import {
  deleteVoucher,
  linkVoucherDocument,
  patchVoucher,
  unlinkVoucherDocument,
  type AdminVoucherUpdatePayload
} from '$hooks/actions/voucher.action'
import { modalStore } from '$stores/modal'
import { showErrorSnackbar, showSuccessSnackbar } from '$utils/errorHandler'
import type { QueryClient } from '@tanstack/svelte-query'

export interface VoucherDetailDeps {
  queryClient: QueryClient
}

export function createVoucherDetailService(deps: VoucherDetailDeps) {
  const { queryClient } = deps

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['getVoucherDetail'], exact: false })
    queryClient.invalidateQueries({ queryKey: ['getVoucherList'], exact: false })
    queryClient.invalidateQueries({
      queryKey: ['getVoucherDocuments'],
      exact: false
    })
  }

  const save = async (
    voucherId: string,
    payload: AdminVoucherUpdatePayload
  ): Promise<boolean> => {
    try {
      await patchVoucher().request({ voucherId, ...payload })
      showSuccessSnackbar('저장되었습니다.')
      invalidate()
      return true
    } catch (e: any) {
      showErrorSnackbar(e)
      return false
    }
  }

  const remove = (voucherId: string) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '바우처 삭제',
        message: '이 바우처를 삭제하시겠습니까?',
        confirmText: '삭제',
        type: 'danger',
        onConfirm: async () => {
          try {
            await deleteVoucher().request({ voucherId })
            showSuccessSnackbar('삭제되었습니다.')
            invalidate()
            goto('/vouchers')
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  const linkDocument = async (
    voucherId: string,
    payload: {
      global_document_id: string
      page_range: [number, number] | null
    }
  ): Promise<boolean> => {
    try {
      await linkVoucherDocument().request({ voucherId, ...payload })
      showSuccessSnackbar('자료가 연결되었습니다.')
      invalidate()
      return true
    } catch (e: any) {
      showErrorSnackbar(e)
      return false
    }
  }

  const unlinkDocument = (
    voucherId: string,
    globalDocumentId: string,
    label?: string
  ) => {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '자료 연결 해제',
        message: label
          ? `"${label}" 자료 연결을 해제하시겠습니까?`
          : '자료 연결을 해제하시겠습니까?',
        confirmText: '해제',
        onConfirm: async () => {
          try {
            await unlinkVoucherDocument().request({ voucherId, globalDocumentId })
            showSuccessSnackbar('연결이 해제되었습니다.')
            invalidate()
          } catch (e: any) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  return { save, remove, linkDocument, unlinkDocument, invalidate }
}
