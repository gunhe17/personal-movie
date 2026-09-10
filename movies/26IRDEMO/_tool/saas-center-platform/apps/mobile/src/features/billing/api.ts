/**
 * Billing API (모바일 P0)
 *
 * 백엔드 `app/modules/billing/` 엔드포인트 호출.
 * 발행·납부·prefill·조회만 포함 — 환불·삭제(delete:billing)는 counselor 권한 밖이라 제외.
 */
import apiClient from '@/shared/api/client';
import type {
  BillableSummary,
  BillableDetail,
  BillablePrefillItem,
  BillableByRelatedParams,
  CreateBillablePayload,
  PaymentResponse,
  PaymentListResponse,
  CreatePaymentPayload,
  BillableListResponse,
  ClientVoucherSummary,
} from './types';

/**
 * 세션/케이스에 연결된 청구 조회 — 청구 상태 배지(none/pending/completed)의 데이터 소스.
 * case_id 또는 session_id 둘 다 없으면 호출하지 않고 빈 배열 반환.
 */
export async function getBillablesByRelated(
  params: BillableByRelatedParams,
): Promise<BillableSummary[]> {
  const { centerId, relatedType, relatedCaseId, relatedSessionId } = params;
  if (!relatedCaseId && !relatedSessionId) return [];

  const typeValue = Array.isArray(relatedType) ? relatedType.join(',') : relatedType;
  const query: Record<string, string> = { related_type: typeValue };
  if (relatedSessionId) query.related_session_id = relatedSessionId;
  if (relatedCaseId) query.related_case_id = relatedCaseId;

  const response = await apiClient.get<BillableSummary[]>(
    `/centers/${centerId}/billables/by-related`,
    { params: query },
  );
  return response.data;
}

/**
 * 내담자 발급 바우처 목록 (청구 발행 시 선택용 — web `getClientVoucherList` 동일 엔드포인트).
 * centerId/clientId 없으면 호출하지 않고 빈 배열 반환.
 */
export async function getClientVouchers(
  centerId: string | null,
  clientId: string | null,
): Promise<ClientVoucherSummary[]> {
  if (!centerId || !clientId) return [];
  const response = await apiClient.get<{ items: ClientVoucherSummary[] }>(
    `/centers/${centerId}/client-vouchers`,
    { params: { client_id: clientId, page: 1, size: 100 } },
  );
  return response.data.items ?? [];
}

/** 케이스 기준 청구 prefill 항목 (단가표 매칭된 항목 후보 — 발행 시 자동 채움) */
export async function getBillablePrefill(
  centerId: string,
  caseType: 'counseling' | 'assessment',
  caseId: string,
): Promise<BillablePrefillItem[]> {
  const response = await apiClient.get<BillablePrefillItem[]>(
    `/centers/${centerId}/billables/prefill`,
    { params: { case_type: caseType, case_id: caseId } },
  );
  return response.data;
}

/** 청구서 상세 조회 (항목 포함) */
export async function getBillableDetail(
  centerId: string,
  billableId: string,
): Promise<BillableDetail> {
  const response = await apiClient.get<BillableDetail>(
    `/centers/${centerId}/billables/${billableId}`,
  );
  return response.data;
}

/** 청구서 발행 (세션 단건 / 패키지 선결제 공용 — payload의 items로 구분) */
export async function createBillable(
  centerId: string,
  payload: CreateBillablePayload,
): Promise<BillableDetail> {
  const response = await apiClient.post<BillableDetail>(
    // trailing slash 필수 — 없으면 서버가 307 redirect(`/billables/`)를 반환하고,
    // RN 네트워크 계층이 POST 리다이렉트에서 Authorization 헤더/본문을 유실해 발행이 스톨됨.
    // 같은 파일의 getBillableList(`/billables/`)와 동일하게 슬래시를 둔다.
    `/centers/${centerId}/billables/`,
    payload,
  );
  return response.data;
}

/** 청구서 납부 내역 조회 */
export async function getPayments(
  centerId: string,
  billableId: string,
): Promise<PaymentListResponse> {
  const response = await apiClient.get<PaymentListResponse>(
    `/centers/${centerId}/billables/${billableId}/payments/`,
  );
  return response.data;
}

/** 납부 등록 (영수증 번호 미입력 시 백엔드 자동 생성, 미수금 초과 시 백엔드 차단) */
export async function createPayment(
  centerId: string,
  billableId: string,
  payload: CreatePaymentPayload,
): Promise<PaymentResponse> {
  const response = await apiClient.post<PaymentResponse>(
    // trailing slash 필수 — 발행 POST와 동일하게, 없으면 307 redirect로 납부 등록이 스톨됨
    `/centers/${centerId}/billables/${billableId}/payments/`,
    payload,
  );
  return response.data;
}

/** 내담자별 청구 목록 (미수 안전망용 — counselor own scope) */
export async function getBillableList(
  centerId: string,
  params: { clientId?: string; status?: string } = {},
): Promise<BillableListResponse> {
  const response = await apiClient.get<BillableListResponse>(
    `/centers/${centerId}/billables/`,
    {
      params: {
        client_id: params.clientId,
        status: params.status,
        size: 100,
      },
    },
  );
  return response.data;
}
