/**
 * 단가표 서비스
 * 모달/토스트/invalidate 로직 캡슐화
 */

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  postPriceList,
  patchPriceList,
  deletePriceList,
  getPriceListList,
  type CreatePriceListPayload,
  type UpdatePriceListPayload,
  type PriceListResponse
} from '$lib/hooks/actions/priceList.action'
import {
  getCenterAssessments,
  type CenterAssessment
} from '$lib/hooks/actions/assessment.action'
import {
  getProgramList,
  type ProgramListItem
} from '$lib/hooks/actions/program.action'
import {
  getAssessmentSetList,
  type AssessmentSetItem
} from '$lib/hooks/actions/assessmentSet.action'
import type { PriceListVM } from './view-model'
import { MODAL_SIZES } from './constants'
import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'

export interface PriceListDeps {
  queryClient: QueryClient
}

export function createPriceListService(deps: PriceListDeps) {
  const { queryClient } = deps

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: ['getPriceListList'],
      exact: false
    })

  const openCreateModal = (PriceListFormModal: any) => {
    modalStore.open({
      component: PriceListFormModal,
      props: {
        mode: 'create' as const,
        onConfirm: async (data: CreatePriceListPayload) => {
          try {
            await postPriceList().request({
              centerId: requireCenterId(),
              payload: data
            })
            snackbarStore.success('단가표 항목이 추가되었습니다')
            invalidateList()
          } catch (error) {
            console.error('[postPriceList] failed', error)
            snackbarStore.error('단가표 추가에 실패했습니다')
            throw error
          }
        }
      },
      options: MODAL_SIZES.create
    })
  }

  const openEditModal = (PriceListFormModal: any, item: PriceListVM) => {
    modalStore.open({
      component: PriceListFormModal,
      props: {
        mode: 'edit' as const,
        initialData: {
          service_type: item.serviceType,
          service_name: item.serviceName,
          reference_id: item.referenceId,
          unit_price: item.unitPrice,
          is_active: item.isActive,
          notes: item.notes
        },
        onConfirm: async (data: UpdatePriceListPayload) => {
          try {
            await patchPriceList().request({
              centerId: requireCenterId(),
              priceListId: item.id,
              payload: data
            })
            snackbarStore.success('단가표 항목이 수정되었습니다')
            invalidateList()
          } catch (error) {
            console.error('[patchPriceList] failed', error)
            snackbarStore.error('단가표 수정에 실패했습니다')
            throw error
          }
        }
      },
      options: MODAL_SIZES.edit
    })
  }

  const openDeleteConfirm = (item: PriceListVM) => {
    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: item.id,
        title: `[${item.serviceName}]을(를) 삭제할까요?`,
        description: '삭제된 단가표 항목은 복구할 수 없습니다',
        cancelText: '닫기',
        confirmText: '삭제',
        onConfirm: async () => {
          try {
            await deletePriceList().request({
              centerId: requireCenterId(),
              priceListId: item.id
            })
            snackbarStore.success('단가표 항목이 삭제되었습니다')
            invalidateList()
          } catch (error) {
            console.error('[deletePriceList] failed', error)
            snackbarStore.error('단가표 삭제에 실패했습니다')
          }
        }
      },
      options: MODAL_SIZES.delete
    })
  }

  const toggleActive = async (item: PriceListVM) => {
    try {
      await patchPriceList().request({
        centerId: requireCenterId(),
        priceListId: item.id,
        payload: { is_active: !item.isActive }
      })
      snackbarStore.success(
        item.isActive ? '비활성 처리되었습니다' : '활성 처리되었습니다'
      )
      invalidateList()
    } catch (error) {
      console.error('[toggleActive] failed', error)
      snackbarStore.error('상태 변경에 실패했습니다')
    }
  }

  /** 검사/프로그램/패키지 → 단가표 일괄 동기화 */
  const syncFromServices = async () => {
    const centerId = requireCenterId()
    let created = 0, updated = 0, skipped = 0, failed = 0

    try {
      const [existingRes, assessmentRes, programRes, packageRes] = await Promise.all([
        getPriceListList().request({ centerId, size: 200 }),
        getCenterAssessments().request({ centerId, is_active: true }),
        getProgramList().request({ centerId, size: 100 }),
        getAssessmentSetList().request({ centerId, size: 100 })
      ])

      const existingByRef = new Map<string, PriceListResponse>()
      const existingByName = new Map<string, PriceListResponse>()
      for (const item of existingRes?.items ?? []) {
        if (item.reference_id) existingByRef.set(item.reference_id, item)
        existingByName.set(item.service_name, item)
      }

      type SyncItem = { type: CreatePriceListPayload['service_type']; name: string; price: number; refId: string }
      const items: SyncItem[] = [
        ...(assessmentRes ?? []).filter((a: CenterAssessment) => a.is_active)
          .map((a) => ({ type: 'assessment' as const, name: a.kor_name, price: 0, refId: a.assessment_id })),
        ...(programRes?.items ?? []).filter((p: ProgramListItem) => p.is_active)
          .map((p) => ({ type: 'counseling' as const, name: p.name, price: p.price, refId: p.id })),
        ...(packageRes?.items ?? [])
          .map((s: AssessmentSetItem) => ({ type: 'package' as const, name: s.name, price: 0, refId: s.id }))
      ]

      for (const item of items) {
        try {
          const match = existingByRef.get(item.refId) ?? existingByName.get(item.name)
          if (match) {
            const updates: UpdatePriceListPayload = {}
            if (item.price > 0 && match.unit_price !== item.price) updates.unit_price = item.price
            if (!match.reference_id) updates.reference_id = item.refId
            if (match.service_name !== item.name) updates.service_name = item.name
            if (Object.keys(updates).length > 0) {
              await patchPriceList().request({ centerId, priceListId: match.id, payload: updates })
              updated++
            } else { skipped++ }
            continue
          }
          await postPriceList().request({
            centerId,
            payload: { service_type: item.type, service_name: item.name, reference_id: item.refId, unit_price: item.price, is_active: true, source: 'synced' }
          })
          created++
        } catch { failed++ }
      }

      const parts = [
        created > 0 && `${created}건 추가`,
        updated > 0 && `${updated}건 가격 업데이트`,
        skipped > 0 && `${skipped}건 이미 존재`,
        failed > 0 && `${failed}건 실패`
      ].filter(Boolean)

      if (failed > 0 && created === 0 && updated === 0) {
        snackbarStore.error(`동기화 실패: ${failed}건`)
      } else {
        snackbarStore.success(parts.length > 0 ? `동기화 완료: ${parts.join(', ')}` : '동기화할 항목이 없습니다')
      }
      invalidateList()
    } catch (error) {
      console.error('[syncFromServices] failed', error)
      snackbarStore.error('동기화에 실패했습니다')
    }
  }

  return {
    invalidateList,
    openCreateModal,
    openEditModal,
    openDeleteConfirm,
    toggleActive,
    syncFromServices
  }
}
