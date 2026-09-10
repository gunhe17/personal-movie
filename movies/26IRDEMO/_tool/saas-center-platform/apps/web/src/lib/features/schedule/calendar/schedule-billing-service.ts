/**
 * 스케줄-청구 연계 서비스
 * 일정 상세에서 청구 생성/조회/그룹 청구 연계 로직 캡슐화
 */

import type { QueryClient } from '@tanstack/svelte-query'
import type { MappedSchedule, ScheduleDetailResponse } from '$lib/hooks/actions/schedule.action'
import { getBillablePrefill } from '$lib/hooks/actions/billable.action'
import { requireCenterId } from '$lib/stores/center.store'
import { createBillableService } from '$lib/features/billing/billable-service'

export interface ScheduleBillingDeps {
  queryClient: QueryClient
}

interface PrefillItem {
  description: string
  unitPrice?: number
  priceListId?: string | null
  itemType?: string
}

interface BasePrefill {
  description: string
  related_type: string
  related_case_id: string
  related_session_id: string
  amount: number
}

export function createScheduleBillingService(deps: ScheduleBillingDeps) {
  const billableService = createBillableService(deps)

  const buildBasePrefill = (
    scheduleData: ScheduleDetailResponse | undefined,
    schedule: MappedSchedule | undefined
  ): BasePrefill => {
    const session = scheduleData?.sessions?.[0]
    const scheduleType = scheduleData?.schedule_type ?? 'meeting'
    return {
      description: scheduleType === 'assessment' ? '검사' : scheduleType === 'counseling' ? '상담' : '운영',
      related_type: scheduleType === 'meeting' ? 'schedule' : `${scheduleType}_session`,
      related_case_id: session?.case_id ?? '',
      related_session_id: session?.session_id ?? schedule?.id ?? '',
      amount: 0
    }
  }

  const matchPriceListItems = async (
    scheduleData: ScheduleDetailResponse | undefined,
    _schedule: MappedSchedule | undefined
  ): Promise<PrefillItem[]> => {
    if (!scheduleData) return []

    const session = scheduleData.sessions?.[0]
    const scheduleType = scheduleData.schedule_type
    const caseId = session?.case_id

    if (!caseId || (scheduleType !== 'counseling' && scheduleType !== 'assessment')) {
      return []
    }

    try {
      const items = await getBillablePrefill().request({
        centerId: requireCenterId(),
        caseType: scheduleType,
        caseId
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
    scheduleData: ScheduleDetailResponse | undefined
    schedule: MappedSchedule | undefined
    closeModal: () => void
    SessionBillingModal: any
    BillableCreateModal: any
  }) => {
    const {
      scheduleData,
      schedule,
      closeModal,
      SessionBillingModal,
      BillableCreateModal
    } = params
    if (!scheduleData || !schedule) return

    closeModal()

    const session = scheduleData.sessions?.[0]
    const firstClient = session?.clients?.[0]
    const basePrefill = buildBasePrefill(scheduleData, schedule)

    let prefillItems = await matchPriceListItems(scheduleData, schedule)
    if (prefillItems.length === 0) {
      prefillItems = [{ description: basePrefill.description, itemType: 'service' }]
    }

    // client + session이 모두 있으면 세션 단건 모달, 아니면 자유 생성 모달로 폴백
    if (
      firstClient &&
      basePrefill.related_type &&
      basePrefill.related_case_id &&
      basePrefill.related_session_id
    ) {
      billableService.openSessionBilling(SessionBillingModal, {
        client: {
          id: firstClient.client_id,
          name: firstClient.client_name ?? ''
        },
        items: prefillItems,
        relatedType: basePrefill.related_type,
        relatedCaseId: basePrefill.related_case_id,
        relatedSessionId: basePrefill.related_session_id
      })
    } else {
      billableService.openCreateModal(BillableCreateModal)
    }
  }

  const openViewBilling = async (params: {
    existingBillables: any[]
    canWriteBilling: boolean
    closeModal: () => void
    BillableDetailModal: any
  }) => {
    const { existingBillables, canWriteBilling, closeModal, BillableDetailModal } = params

    const target =
      existingBillables.find((b: any) => b.status === 'draft' || b.status === 'issued') ??
      existingBillables[0]
    if (!target) return

    closeModal()
    billableService.openDetailModal(BillableDetailModal, target.id, canWriteBilling)
  }

  const openGroupBilling = async (params: {
    scheduleData: ScheduleDetailResponse | undefined
    schedule: MappedSchedule | undefined
    existingBillables: any[]
    canWriteBilling: boolean
    reopenScheduleDetail: () => void
    closeModal: () => void
    BillableDetailModal: any
  }) => {
    const { scheduleData, schedule, existingBillables, canWriteBilling, reopenScheduleDetail, closeModal, BillableDetailModal } = params
    if (!scheduleData || !schedule) return

    closeModal()

    const session = scheduleData.sessions?.[0]
    const clients = session?.clients ?? []
    const basePrefill = buildBasePrefill(scheduleData, schedule)

    // 참여자별 청구 상태 매핑 (billable 기반)
    const billedClientIds = existingBillables.map((b: any) => b.client_id as string)
    const billableMap: Record<string, string> = {}
    for (const b of existingBillables) {
      if ((b as any).client_id) {
        billableMap[(b as any).client_id] = (b as any).id
      }
    }

    // 단가표 매칭
    let prefillItems = await matchPriceListItems(scheduleData, schedule)
    if (prefillItems.length === 0) {
      prefillItems = [{ description: basePrefill.description, itemType: 'service' }]
    }

    const items = prefillItems.map((item) => ({
      item_type: (item.itemType ?? 'service') as any,
      price_list_id: item.priceListId ?? undefined,
      description: item.description,
      quantity: 1,
      unit_price: item.unitPrice ?? 0
    }))

    billableService.openGroupCreateModal(clients, {
      billedClientIds,
      billableMap,
      canWrite: canWriteBilling,
      items,
      relatedType: basePrefill.related_type,
      relatedCaseId: basePrefill.related_case_id,
      relatedSessionId: basePrefill.related_session_id,
      onClose: reopenScheduleDetail,
      BillableDetailModal
    })
  }

  return {
    buildBasePrefill,
    matchPriceListItems,
    openCreateBilling,
    openViewBilling,
    openGroupBilling
  }
}
