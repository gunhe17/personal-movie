/**
 * Billing 타입 정의 (모바일 P0 범위)
 *
 * web `apps/web/src/lib/hooks/actions/billable.action.ts` 의 타입에 대응.
 * 백엔드 응답 계약(API 스펙)이라 web과 동일하게 유지한다.
 * 환불·삭제(delete:billing)는 counselor 권한 밖이라 모바일 타입에 포함하지 않는다.
 */

// ─── 청구서 (Billable) ───

export type BillableStatus = 'issued' | 'paid';
export type BillableItemType = 'service' | 'product' | 'package';

export interface BillableItemResponse {
  id: string;
  billable_id: string;
  item_type: BillableItemType;
  item_id: string | null;
  related_type: string | null;
  related_case_id: string | null;
  related_case_code: string | null;
  related_session_id: string | null;
  client_voucher_id: string | null;
  voucher_name: string | null;
  price_list_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  subsidy_amount: number;
  provided_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

/** 목록/연관 조회용 요약 (by-related, 미수 목록) */
export interface BillableSummary {
  id: string;
  center_id: string;
  client_id: string;
  client_name: string | null;
  client_code: string | null;
  client_birth_date: string | null;
  client_gender: string | null;
  client_profile_image_url: string | null;
  billable_date: string;
  total_amount: number;
  discount_amount: number;
  subsidy_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  status: BillableStatus;
  item_count: number;
  item_summary: string;
  is_package: boolean;
  case_codes: string[];
  related_session_ids: string[];
  issued_at: string | null;
  due_date: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

/** 목록 조회 응답 (내담자 미수 등) */
export interface BillableListResponse {
  items: BillableSummary[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/** 상세 조회용 (항목 포함) */
export interface BillableDetail {
  id: string;
  center_id: string;
  client_id: string;
  client_name: string | null;
  client_code: string | null;
  billable_date: string;
  total_amount: number;
  discount_amount: number;
  subsidy_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  status: BillableStatus;
  issued_at: string | null;
  due_date: string | null;
  memo: string | null;
  created_by: string;
  created_by_name: string | null;
  items: BillableItemResponse[];
  /** 잔액 부족 등 비차단 경고 — 생성 응답에서만 채워짐 */
  warnings?: string[];
  created_at: string;
  updated_at: string;
}

// ─── 청구 발행 요청 ───

export interface BillableItemCreatePayload {
  item_type: BillableItemType;
  item_id?: string | null;
  related_type?: string | null;
  related_case_id?: string | null;
  related_session_id?: string | null;
  client_voucher_id?: string | null;
  price_list_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  provided_at?: string | null;
  memo?: string | null;
}

export interface CreateBillablePayload {
  client_id: string;
  billable_date: string;
  due_date?: string | null;
  memo?: string | null;
  discount_amount?: number;
  /** 청구서 단위 바우처 지원금 — 백엔드가 바우처 연결 item에 회기 비율로 분배 */
  subsidy_amount?: number;
  items: BillableItemCreatePayload[];
}

// ─── prefill (단가 자동 채움) ───

export interface BillablePrefillItem {
  reference_id: string;
  description: string;
  item_type: BillableItemType;
  unit_price: number;
  price_list_id: string | null;
  client_voucher_id?: string | null;
  voucher_name?: string | null;
  voucher_remaining?: number | null;
  voucher_total?: number | null;
  voucher_support_amount_text?: string | null;
}

// ─── 내담자 바우처 (청구 발행 시 선택) ───

/** 바우처 카탈로그 요약 — 표시명·지원금 안내 */
export interface VoucherCatalogSummary {
  name: string;
  support_amount_text?: string | null;
}

/**
 * 내담자 발급 바우처 요약 (web `ClientVoucherResponse` 대응).
 * 잔여 회기·금액·유효기간으로 청구 발행 시 사용 가능 여부를 판정한다.
 */
export interface ClientVoucherSummary {
  id: string;
  center_voucher_id: string;
  total_sessions: number;
  remaining_sessions: number;
  total_amount: number | null;
  remaining_amount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  catalog?: VoucherCatalogSummary | null;
}

export interface ClientVoucherListResponse {
  items: ClientVoucherSummary[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ─── by-related 조회 파라미터 ───

export interface BillableByRelatedParams {
  centerId: string;
  /** 쉼표 결합 가능: counseling_session, counseling_case, assessment_session, assessment_case */
  relatedType: string | string[];
  relatedCaseId?: string | null;
  relatedSessionId?: string | null;
}

// ─── 결제 (Payment) ───

export type PaymentMethodType = 'card' | 'transfer' | 'cash';

export interface PaymentResponse {
  id: string;
  billable_id: string;
  amount: number;
  payment_method: PaymentMethodType;
  paid_at: string;
  receipt_number: string | null;
  memo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentListResponse {
  items: PaymentResponse[];
  total_paid: number;
}

export interface CreatePaymentPayload {
  amount: number;
  payment_method: PaymentMethodType;
  paid_at: string;
  receipt_number?: string | null;
  memo?: string | null;
}
