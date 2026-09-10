/**
 * 검사 상세 - 청구 연계 서비스
 * 검사 케이스(set + tasks)에서 단가표 매칭 + 청구 생성/조회 캡슐화
 */

import type { QueryClient } from '@tanstack/svelte-query'
import type { CaseDetail } from '$lib/hooks/actions/case.action'
import { getBillablePrefill } from '$lib/hooks/actions/billable.action'
import { requireCenterId } from '$lib/stores/center.store'
import { createBillableService } from '$lib/features/billing/billable-service'

export interface AssessmentBillingDeps {
  queryClient: QueryClient
}

interface PrefillItem {
  description: string
  unitPrice?: number
  priceListId?: string | null
  itemType?: string
}

export function createAssessmentBillingService(deps: AssessmentBillingDeps) {
  const billableService = createBillableService(deps)

  const matchPriceListItems = async (
    caseData: CaseDetail
  ): Promise<PrefillItem[]> => {
    try {
      const items = await getBillablePrefill().request({
        centerId: requireCenterId(),
        caseType: 'assessment',
        caseId: caseData.case_id
      })
      return items.map((it) => ({
        description: it.description,
        unitPrice: it.unit_price,
        priceListId: it.price_list_id,
        itemType: it.item_type
      }))
    } catch {
      return []
    }
  }

  const openCreateBilling = async (params: {
    caseData: CaseDetail
    SessionBillingModal: any
    BillableCreateModal: any
  }) => {
    const { caseData, SessionBillingModal, BillableCreateModal } = params

    const firstClient = caseData.clients?.[0]
    let prefillItems = await matchPriceListItems(caseData)
    if (prefillItems.length === 0) {
      prefillItems = [{ description: '검사', itemType: 'service' }]
    }

    const sessionId = caseData.schedule?.session_id
    // client가 있으면 세션 청구 모달 (sessionId 없어도 케이스 단위로 prefill)
    // client도 없으면 자유 생성 모달로 폴백
    if (firstClient) {
      billableService.openSessionBilling(SessionBillingModal, {
        client: {
          id: firstClient.client_id,
          name: firstClient.name ?? '',
          gender: firstClient.gender,
          profile_image_url: firstClient.profile_image_url
        },
        items: prefillItems,
        // 세션 없으면(일정 없이 접수) case 단위로 청구
        relatedType: sessionId ? 'assessment_session' : 'assessment_case',
        relatedCaseId: caseData.case_id,
        relatedSessionId: sessionId ?? undefined
      })
    } else {
      billableService.openCreateModal(BillableCreateModal)
    }
  }

  const openViewBilling = async (params: {
    existingBillables: any[]
    canWriteBilling: boolean
    BillableDetailModal: any
  }) => {
    const { existingBillables, canWriteBilling, BillableDetailModal } = params

    const target =
      existingBillables.find(
        (b: any) => b.status === 'draft' || b.status === 'issued'
      ) ?? existingBillables[0]
    if (!target) return

    billableService.openDetailModal(BillableDetailModal, target.id, canWriteBilling)
  }

  return {
    matchPriceListItems,
    openCreateBilling,
    openViewBilling
  }
}
