/**
 * Billing 상수 / 표시 라벨
 *
 * 청구 상태·결제수단 라벨, 그리고 web `BillingActionButton`과 통일된
 * 청구 액션 상태(none/pending/completed) 판정 헬퍼.
 */
import { COLORS } from '@/shared/constants/theme';
import type { BillableStatus, BillableSummary, PaymentMethodType } from './types';

/** 청구서 상태 라벨 (결제 관점 — 발행=결제 대기, 완납=결제 완료) */
export const BILLABLE_STATUS_LABELS: Record<BillableStatus, string> = {
  issued: '결제 대기',
  paid: '결제 완료',
};

/**
 * 청구 상태 뱃지 색 (텍스트 color + 배경 bg).
 * 결제 대기(issued)=orange / 결제 완료(paid)=green.
 * 톤은 AssessmentCaseCard 상태 뱃지와 동일하게 tag 토큰(fg + bg) 사용.
 * 리스트 카드와 상세 시트가 공유한다(단일 소스).
 */
export const BILLABLE_STATUS_PALETTE: Record<
  BillableStatus,
  { color: string; bg: string }
> = {
  issued: { color: COLORS.tag.orange.fg, bg: COLORS.tag.orange.bg },
  paid: { color: COLORS.tag.green.fg, bg: COLORS.tag.green.bg },
};

/** 결제 수단 라벨 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
};

/**
 * 청구 액션 버튼 상태 (web BillingActionButton과 통일)
 * - none: 청구 없음 → "청구서 발행"
 * - pending: 발행됨·미완납 → "청구 확인"
 * - completed: 완납 → "청구 완료" / 패키지면 "선결제 완료"
 */
export type BillingActionState = 'none' | 'pending' | 'completed';

/** 청구 출처: 케이스 패키지 선결제 / 세션 단건 청구 */
export type BillingSource = 'case' | 'session';

/**
 * 단일 청구서로부터 액션 상태 판정 (web 로직과 동일)
 * billable이 없으면 none, paid면 completed, 그 외(issued)는 pending.
 */
export function resolveBillingState(
  billable?: Pick<BillableSummary, 'status'> | null,
): BillingActionState {
  if (!billable) return 'none';
  if (billable.status === 'paid') return 'completed';
  return 'pending';
}

/** related_type이 `*_case`면 패키지(case), `*_session`이면 세션(session) */
export function resolveBillingSource(relatedType?: string | null): BillingSource {
  return (relatedType ?? '').endsWith('_case') ? 'case' : 'session';
}

/** completed 상태 라벨 (출처별) */
export function completedLabel(source: BillingSource): string {
  return source === 'case' ? '선결제 완료' : '청구 완료';
}

/**
 * 청구 항목 아이콘(상담/검사 구분) 배경 박스 컬러 — 타입별 12% 틴트.
 * BillableDetailSheet · ReceiptSheet 등 청구 항목 아이콘 박스 공통.
 */
export const BILLING_ITEM_ICON_BG = {
  counseling: 'rgba(0, 229, 143, 0.12)', // #00E58F @ 12%
  assessment: 'rgba(86, 170, 255, 0.12)', // #56AAFF @ 12%
} as const;

/** related_type 기준 청구 항목 아이콘 배경색 (assessment_* → 검사, 그 외 → 상담) */
export function billingItemIconBg(relatedType?: string | null): string {
  return relatedType?.startsWith('assessment')
    ? BILLING_ITEM_ICON_BG.assessment
    : BILLING_ITEM_ICON_BG.counseling;
}
