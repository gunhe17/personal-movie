/**
 * 상담 상세 - 청구 연계 서비스
 * 세션 × 클라이언트 단위 단건 청구
 */

import type { QueryClient } from '@tanstack/svelte-query'
import type {
  CounselingCaseBaseDetail,
  CounselingSession,
  SessionParticipant
} from '$lib/types/counseling'
import {
  getBillablePrefill,
  getBillableByRelated
} from '$lib/hooks/actions/billable.action'
import { requireCenterId } from '$lib/stores/center.store'
import { createBillableService } from '$lib/features/billing/billable-service'
import type { SessionOption } from '$lib/features/billing/components/create/types'

export interface CounselingBillingDeps {
  queryClient: QueryClient
}

interface PrefillItem {
  description: string
  unitPrice?: number
  priceListId?: string | null
  itemType?: string
  relatedSessionId?: string
  clientVoucherId?: string | null
  voucherName?: string | null
  voucherRemaining?: number | null
  voucherTotal?: number | null
  voucherSupportText?: string | null
}

export function createCounselingBillingService(deps: CounselingBillingDeps) {
  const billableService = createBillableService(deps)

  /**
   * 상담 케이스 prefill (백엔드 통합 핸들러 위임)
   */
  const matchPriceListItems = async (
    caseData: CounselingCaseBaseDetail
  ): Promise<PrefillItem[]> => {
    try {
      const items = await getBillablePrefill().request({
        centerId: requireCenterId(),
        caseType: 'counseling',
        caseId: caseData.case_id
      })
      return items.map((it) => ({
        description: it.description,
        unitPrice: it.unit_price,
        priceListId: it.price_list_id,
        itemType: it.item_type,
        clientVoucherId: it.client_voucher_id ?? null,
        voucherName: it.voucher_name ?? null,
        voucherRemaining: it.voucher_remaining ?? null,
        voucherTotal: it.voucher_total ?? null,
        voucherSupportText: it.voucher_support_amount_text ?? null
      }))
    } catch {
      return []
    }
  }

  const openCreateBilling = async (params: {
    caseData: CounselingCaseBaseDetail
    session: CounselingSession
    client: SessionParticipant
    SessionBillingModal: any
  }) => {
    const { caseData, session, client, SessionBillingModal } = params

    let prefillItems = await matchPriceListItems(caseData)
    if (prefillItems.length === 0) {
      prefillItems = [{ description: '상담', itemType: 'service' }]
    }

    // 아바타용 이미지·성별은 회기 참여자에 없다 — 케이스 내담자 목록에서 끌어온다
    const clientInfo = caseData.clients?.find(
      (c) => c.client_id === client.participant_id
    )

    billableService.openSessionBilling(SessionBillingModal, {
      client: {
        id: client.participant_id,
        name: client.participant_name,
        gender: clientInfo?.gender ?? null,
        profile_image_url: clientInfo?.profile_image_url ?? null
      },
      items: prefillItems,
      relatedType: 'counseling_session',
      relatedCaseId: caseData.case_id,
      relatedSessionId: session.session_id
    })
  }

  const openViewBilling = (params: {
    billableId: string
    canWriteBilling: boolean
    BillableDetailModal: any
  }) => {
    billableService.openDetailModal(
      params.BillableDetailModal,
      params.billableId,
      params.canWriteBilling
    )
  }

  /**
   * 케이스 청구 모달 열기 (회기 선택형)
   * - 케이스의 회기를 체크박스로 골라 청구한다
   * - 청구 가능한 회기를 전량 고르면 패키지 선결제(counseling_case),
   *   일부만 고르면 회기별 청구(counseling_session)로 모달이 자동 전환
   * - 이미 청구된 회기는 선택 불가로 표시된다
   */
  const openCaseBilling = async (params: {
    caseData: CounselingCaseBaseDetail
    sessions: CounselingSession[]
    client: SessionParticipant
    CaseBillingModal: any
  }) => {
    const { caseData, sessions, client, CaseBillingModal } = params

    // 단가표 매칭 (1건 기대)
    const matched = await matchPriceListItems(caseData)
    const priceTemplate = matched[0] ?? {
      description: caseData.program_name || '상담',
      itemType: 'service',
      unitPrice: 0,
      priceListId: null
    }

    // 이 내담자가 이미 청구한 회기 — 모달에서 선택 불가로 표시
    const billedSessionIds = new Set<string>()
    try {
      const existing = await getBillableByRelated().request({
        centerId: requireCenterId(),
        relatedType: ['counseling_case', 'counseling_session'],
        relatedCaseId: caseData.case_id
      })
      for (const b of existing) {
        if (b.client_id !== client.participant_id) continue
        for (const sid of b.related_session_ids ?? []) {
          billedSessionIds.add(sid)
        }
      }
    } catch {
      // 조회 실패 시엔 청구 표시 없이 진행 (중복은 백엔드가 차단)
    }

    // 내담자가 참여한 회기만 추림 + 시간순 정렬 (취소 회기도 선택 불가로 함께 노출)
    const sessionOptions: SessionOption[] = sessions
      .filter((s) =>
        s.clients.some((c) => c.participant_id === client.participant_id)
      )
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .map((s) => ({
        id: s.session_id,
        sessionNumber: s.session_number,
        start: s.start,
        status: s.status,
        billed: billedSessionIds.has(s.session_id)
      }))

    const caseClientInfo = caseData.clients?.find(
      (c) => c.client_id === client.participant_id
    )

    billableService.openCaseBilling(CaseBillingModal, {
      client: {
        id: client.participant_id,
        name: client.participant_name,
        gender: caseClientInfo?.gender ?? null,
        profile_image_url: caseClientInfo?.profile_image_url ?? null
      },
      sessions: sessionOptions,
      priceTemplate,
      caseRelatedType: 'counseling_case',
      relatedCaseId: caseData.case_id
    })
  }

  return {
    matchPriceListItems,
    openCreateBilling,
    openViewBilling,
    openCaseBilling
  }
}
