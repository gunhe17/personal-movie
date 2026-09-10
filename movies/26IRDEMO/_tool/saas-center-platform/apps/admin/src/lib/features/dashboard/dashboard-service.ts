import type { QueryClient } from '@tanstack/svelte-query'
import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { auth } from '$lib/stores/auth'
import { get as storeGet } from 'svelte/store'
import { canAdminister } from '$lib/utils/permissions'
import {
  getInquiryDetail,
  patchInquiryAnswer,
  patchInquiryStatus,
  deleteInquiry,
  type InquirySummary,
  type InquiryStatus,
  type InquiryDetailResponse
} from '$hooks/actions/inquiry.action'
import {
  getCSMemoDetail,
  patchCSMemo,
  deleteCSMemo,
  type CSMemoSummary,
  type CSMemoDetailResponse
} from '$hooks/actions/cs-memo.action'
import type { ApplicationSummary } from '$hooks/actions/application.action'
import ApplicationDetailModal from '$lib/components/modal/ApplicationDetailModal.svelte'
import InquiryDetailModal from '../../../routes/(protected)/inquiries/components/InquiryDetailModal.svelte'
import MemoDetailModal from '../../../routes/(protected)/cs-memos/components/MemoDetailModal.svelte'
import MemoFormModal from '../../../routes/(protected)/cs-memos/components/MemoFormModal.svelte'
import ConfirmModal from '$components/modal/ConfirmModal.svelte'

export interface DashboardDeps {
  queryClient: QueryClient
}

export function createDashboardService(deps: DashboardDeps) {
  const { queryClient } = deps

  const invalidateInquiries = () =>
    queryClient.invalidateQueries({ queryKey: ['getInquiryList'], exact: false })

  const invalidateMemos = () =>
    queryClient.invalidateQueries({ queryKey: ['getCSMemoList'], exact: false })

  // ── 센터 신청 ──
  function openApplicationDetail(item: ApplicationSummary) {
    modalStore.open({
      component: ApplicationDetailModal,
      props: { applicationId: item.id },
      options: { size: 'lg' }
    })
  }

  // ── 문의 ──
  async function openInquiryDetail(item: InquirySummary) {
    try {
      const inquiry = await getInquiryDetail().request({ inquiryId: item.id })
      _openInquiryModal(inquiry)
    } catch {
      snackbarStore.error('문의를 불러올 수 없습니다.')
    }
  }

  function _openInquiryModal(inquiry: InquiryDetailResponse) {
    modalStore.open({
      component: InquiryDetailModal,
      props: {
        inquiry,
        onSave: async (answer: string, status: InquiryStatus) => {
          await patchInquiryAnswer().request({ inquiryId: inquiry.id, answer })
          await patchInquiryStatus().request({ inquiryId: inquiry.id, status })
          snackbarStore.success('저장되었습니다.')
          invalidateInquiries()
        },
        onDelete: () => {
          modalStore.close()
          modalStore.open({
            component: ConfirmModal,
            props: {
              title: '문의 삭제',
              message: '이 문의를 삭제하시겠습니까? 답변 내용도 함께 삭제됩니다.',
              confirmText: '삭제',
              type: 'danger',
              onConfirm: async () => {
                try {
                  await deleteInquiry().request({ inquiryId: inquiry.id })
                  snackbarStore.success('문의가 삭제되었습니다.')
                  invalidateInquiries()
                } catch {
                  snackbarStore.error('삭제에 실패했습니다.')
                }
              }
            },
            options: { size: 'sm' }
          })
        }
      },
      options: { size: 'lg' }
    })
  }

  // ── CS 메모 ──
  async function openMemoDetail(item: CSMemoSummary) {
    try {
      const memo = await getCSMemoDetail().request({ memoId: item.id })
      _openMemoModal(memo)
    } catch {
      snackbarStore.error('메모를 불러올 수 없습니다.')
    }
  }

  function _openMemoModal(memo: CSMemoDetailResponse) {
    const authState = storeGet(auth)
    const canModify = canAdminister(authState.user?.role) || memo.created_by === authState.user?.id

    modalStore.open({
      component: MemoDetailModal,
      props: {
        memo,
        canModify,
        onEdit: () => {
          modalStore.close()
          modalStore.open({
            component: MemoFormModal,
            props: {
              memo,
              onSubmit: async (data: any) => {
                await patchCSMemo().request({ memoId: memo.id, ...data })
                snackbarStore.success('메모가 수정되었습니다.')
                invalidateMemos()
              }
            },
            options: { size: 'md' }
          })
        },
        onDelete: () => {
          modalStore.close()
          modalStore.open({
            component: ConfirmModal,
            props: {
              title: '메모 삭제',
              message: '이 메모를 삭제하시겠습니까?',
              confirmText: '삭제',
              type: 'danger',
              onConfirm: async () => {
                try {
                  await deleteCSMemo().request({ memoId: memo.id })
                  snackbarStore.success('메모가 삭제되었습니다.')
                  invalidateMemos()
                } catch {
                  snackbarStore.error('삭제에 실패했습니다.')
                }
              }
            },
            options: { size: 'sm' }
          })
        }
      },
      options: { size: 'md' }
    })
  }

  return {
    openApplicationDetail,
    openInquiryDetail,
    openMemoDetail
  }
}
