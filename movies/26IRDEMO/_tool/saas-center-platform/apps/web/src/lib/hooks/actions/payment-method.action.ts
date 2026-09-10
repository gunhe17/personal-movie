/**
 * Payment Method (결제 수단) API 액션
 *
 * 토스 빌링키 기반 결제 수단 등록/조회/삭제.
 * 빌링키 연동 후 활성화 예정.
 *
 * GET    /centers/{center_id}/payment-methods
 * POST   /centers/{center_id}/payment-methods
 * DELETE /centers/{center_id}/payment-methods/{id}
 * PATCH  /centers/{center_id}/payment-methods/{id}/default
 */

import { get, post, patch, deleteResource } from '$lib/services/api/instances'

// ─── 타입 ───

export interface PaymentMethod {
  id: string
  card_company: string
  card_number_last4: string
  card_type: string // 신용 | 체크
  is_default: boolean
  registered_at: string
}

export interface RegisterPaymentMethodRequest {
  auth_key: string // 토스 customerKey 인증 후 받은 authKey
}

export interface RegisterPaymentMethodResponse {
  id: string
  card_company: string
  card_number_last4: string
  card_type: string
  is_default: boolean
}

// ─── 카드사 라벨 ───

export const CARD_COMPANY_LABELS: Record<string, string> = {
  '삼성': '삼성카드',
  '현대': '현대카드',
  '국민': 'KB국민카드',
  '신한': '신한카드',
  '롯데': '롯데카드',
  '하나': '하나카드',
  '우리': '우리카드',
  'BC': 'BC카드',
  '농협': 'NH농협카드',
  '카카오뱅크': '카카오뱅크',
  '토스뱅크': '토스뱅크',
} as const

// ─── 액션 ───

export const getPaymentMethods = () => ({
  key: ['getPaymentMethods'],
  request: async (params: { centerId: string | null | undefined }) => {
    if (!params.centerId) return []
    return get<PaymentMethod[]>(
      `/centers/${params.centerId}/payment-methods`
    )
  }
})

export const registerPaymentMethod = () => ({
  key: ['registerPaymentMethod'],
  request: async (params: { centerId: string; authKey: string }) => {
    return post<RegisterPaymentMethodResponse>(
      `/centers/${params.centerId}/payment-methods`,
      { auth_key: params.authKey }
    )
  }
})

export const deletePaymentMethod = () => ({
  key: ['deletePaymentMethod'],
  request: async (params: { centerId: string; methodId: string }) => {
    return deleteResource(
      `/centers/${params.centerId}/payment-methods/${params.methodId}`
    )
  }
})

export const setDefaultPaymentMethod = () => ({
  key: ['setDefaultPaymentMethod'],
  request: async (params: { centerId: string; methodId: string }) => {
    return patch(
      `/centers/${params.centerId}/payment-methods/${params.methodId}/default`
    )
  }
})
