/**
 * Billing 훅 (모바일 P0)
 *
 * TanStack Query 기반 — 조회는 useQuery, 발행·납부는 useMutation + invalidate.
 * 발행/납부 성공 시 청구 상태 배지(byRelated)·상세·납부내역을 무효화해 자동 갱신.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBillable,
  createPayment,
  getBillableDetail,
  getBillableList,
  getBillablePrefill,
  getBillablesByRelated,
  getClientVouchers,
  getPayments,
} from './api';
import type {
  ClientVoucherSummary,
  CreateBillablePayload,
  CreatePaymentPayload,
} from './types';

/** 세션/케이스에 연결된 청구 조회 — 청구 상태 배지용 */
export function useBillablesByRelated(params: {
  centerId: string | null;
  relatedType: string | string[];
  relatedCaseId?: string | null;
  relatedSessionId?: string | null;
}) {
  const { centerId, relatedType, relatedCaseId, relatedSessionId } = params;
  return useQuery({
    queryKey: [
      'billablesByRelated',
      centerId,
      relatedType,
      relatedCaseId,
      relatedSessionId,
    ],
    queryFn: () =>
      getBillablesByRelated({
        centerId: centerId!,
        relatedType,
        relatedCaseId,
        relatedSessionId,
      }),
    enabled: !!centerId && (!!relatedCaseId || !!relatedSessionId),
  });
}

/** 청구 상세 조회 */
export function useBillableDetail(
  centerId: string | null,
  billableId: string | null,
) {
  return useQuery({
    queryKey: ['billableDetail', centerId, billableId],
    queryFn: () => getBillableDetail(centerId!, billableId!),
    enabled: !!centerId && !!billableId,
  });
}

/** 청구서 납부 내역 조회 */
export function usePayments(centerId: string | null, billableId: string | null) {
  return useQuery({
    queryKey: ['billablePayments', centerId, billableId],
    queryFn: () => getPayments(centerId!, billableId!),
    enabled: !!centerId && !!billableId,
  });
}

/** 센터 전체 청구 목록 (청구 현황 화면) — counselor own scope는 백엔드에서 처리 */
export function useBillableList(centerId: string | null) {
  return useQuery({
    queryKey: ['billableList', centerId],
    queryFn: () => getBillableList(centerId!),
    enabled: !!centerId,
  });
}

/** 내담자 청구 목록 (미수 안전망) — billableList 키는 발행/납부 후 자동 무효화됨 */
export function useClientBillables(
  centerId: string | null,
  clientId: string | null,
) {
  return useQuery({
    queryKey: ['billableList', centerId, clientId],
    queryFn: () => getBillableList(centerId!, { clientId: clientId! }),
    enabled: !!centerId && !!clientId,
  });
}

/**
 * 케이스 prefill 조회 (청구 시작 시 단가 자동 채움).
 * 시트를 열 때만 fetch하도록 `enabled` 옵션으로 제어 가능.
 */
export function useBillablePrefill(
  centerId: string | null,
  caseType: 'counseling' | 'assessment' | null,
  caseId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['billablePrefill', centerId, caseType, caseId],
    queryFn: () => getBillablePrefill(centerId!, caseType!, caseId!),
    enabled:
      (options?.enabled ?? true) && !!centerId && !!caseType && !!caseId,
  });
}

/**
 * 내담자 발급 바우처 조회 (청구 발행 시 선택용).
 * 시트를 열 때만 fetch하도록 clientId가 있을 때만 활성화.
 */
export function useClientVouchers(
  centerId: string | null,
  clientId: string | null,
) {
  return useQuery({
    queryKey: ['clientVouchers', centerId, clientId],
    queryFn: () => getClientVouchers(centerId, clientId),
    enabled: !!centerId && !!clientId,
  });
}

/**
 * 오늘 기준 청구에 사용 가능한 바우처만 필터 (web `VoucherField` 로직 재현).
 * 잔여 회기 > 0 && 유효기간 내(있을 때만).
 */
export function filterUsableVouchers(
  vouchers: ClientVoucherSummary[] | undefined,
): ClientVoucherSummary[] {
  if (!vouchers) return [];
  const today = new Date().toISOString().slice(0, 10);
  return vouchers.filter((v) => {
    if (v.remaining_sessions <= 0) return false;
    if (v.valid_from && v.valid_from > today) return false;
    if (v.valid_until && v.valid_until < today) return false;
    return true;
  });
}

/** 청구서 발행 (세션 단건 / 패키지) */
export function useCreateBillable(centerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBillablePayload) =>
      createBillable(centerId!, payload),
    onSuccess: () => {
      // 상태 배지·미수 목록·미청구 안전망 갱신
      queryClient.invalidateQueries({
        queryKey: ['billablesByRelated'],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ['billableList'],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ['todayMissingBillables'],
        exact: false,
      });
      // 바우처 차감(잔여 회기·금액) 반영
      queryClient.invalidateQueries({
        queryKey: ['clientVouchers'],
        exact: false,
      });
    },
  });
}

/** 납부 등록 */
export function useCreatePayment(
  centerId: string | null,
  billableId: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) =>
      createPayment(centerId!, billableId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['billableDetail', centerId, billableId],
      });
      queryClient.invalidateQueries({
        queryKey: ['billablePayments', centerId, billableId],
      });
      queryClient.invalidateQueries({
        queryKey: ['billablesByRelated'],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ['billableList'],
        exact: false,
      });
    },
  });
}
