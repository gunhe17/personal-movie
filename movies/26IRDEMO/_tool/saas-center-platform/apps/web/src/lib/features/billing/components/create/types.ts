/**
 * 청구서 생성 모달 공통 타입
 */

export interface ItemRow {
  id: number
  description: string
  quantity: number
  unitPrice: number
  priceListId: string | null
  itemType: string
  /** 설명 수정 불가 (세션 연동 prefill 등) */
  locked?: boolean
  /** RelationPicker에서 자동 추가된 항목 플래그 */
  autoFromRelation?: boolean
  /** 이 항목이 참조하는 세션 ID (패키지 선결제 1:1 매핑용) */
  relatedSessionId?: string
  /** 연결된 내담자 바우처 ID — set 시 생성 단계에서 회기 차감 */
  clientVoucherId?: string | null
  /** 표시용 바우처 이름 */
  voucherName?: string | null
  /** 표시용 바우처 잔여 회기 */
  voucherRemaining?: number | null
  /** 표시용 바우처 총 회기 */
  voucherTotal?: number | null
  /** 카탈로그의 지원금 안내 텍스트 (참고용) */
  voucherSupportText?: string | null
}

export interface PrefillItem {
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

/** 회기 선택 청구 모달(CaseBillingModal)에 넘기는 회기 후보 */
export interface SessionOption {
  id: string
  sessionNumber: number
  /** 회기 시작 시각 (UTC — 표시 시 KST 변환) */
  start: string | Date
  /** 'scheduled' | 'completed' | 'no_show' | 'cancelled' */
  status: string
  /** 이미 청구된 회기 — 선택 불가 */
  billed: boolean
}
