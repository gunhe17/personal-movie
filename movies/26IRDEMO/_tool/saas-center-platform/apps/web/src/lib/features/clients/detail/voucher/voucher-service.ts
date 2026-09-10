/**
 * 내담자 상세 - 바우처 발급 서비스
 *
 * 발급 모달 + invalidate + 토스트 캡슐화.
 */

import type { QueryClient } from '@tanstack/svelte-query'

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import {
  postClientVoucher,
  type CreateClientVoucherPayload
} from '$lib/hooks/actions/clientVoucher.action'
import VoucherFormModal from '$lib/components/clients/detail/VoucherFormModal.svelte'

import type { VoucherFormData } from './form-types'

export interface VoucherServiceDeps {
  queryClient: QueryClient
  clientId: string
}

export function createVoucherService(deps: VoucherServiceDeps) {
  const { queryClient, clientId } = deps

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: ['getClientVoucherList'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getVoucherUsage'],
      exact: false
    })
  }

  function formToCreatePayload(
    form: VoucherFormData
  ): CreateClientVoucherPayload {
    const totalAmount = form.totalAmount.trim()
      ? Number(form.totalAmount)
      : null
    return {
      client_id: clientId,
      center_voucher_id: form.centerVoucherId!,
      total_sessions: Number(form.totalSessions),
      total_amount: totalAmount,
      valid_from: form.validFrom || null,
      valid_until: form.validUntil || null
    }
  }

  function openCreateModal() {
    modalStore.open({
      component: VoucherFormModal,
      props: {
        mode: 'create',
        onSubmit: async (form: VoucherFormData) => {
          try {
            const centerId = requireCenterId()
            await postClientVoucher().request({
              centerId,
              payload: formToCreatePayload(form)
            })
            snackbarStore.success('바우처를 연결했어요')
            invalidateAll()
          } catch (err) {
            console.error('[postClientVoucher] failed', err)
            snackbarStore.error('바우처 연결에 실패했어요')
            throw err // 모달 닫지 않도록
          }
        }
      },
      options: { customWidth: 540 }
    })
  }

  return {
    openCreateModal,
    invalidateAll
  }
}
