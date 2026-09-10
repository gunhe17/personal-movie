import apiClient from '@/shared/api/client';
import type { ClientVoucher, VoucherProgram } from './types';

/** 공개 엔드포인트 — 게스트(무토큰)도 호출 가능 */
export async function getVoucherCatalog(): Promise<VoucherProgram[]> {
  const { data } = await apiClient.get<VoucherProgram[]>('/app/vouchers');
  return data;
}

/** 내 가족 프로필들이 보유한 바우처 — 센터 연결이 있어야 값이 있다 */
export async function getMyVouchers(): Promise<ClientVoucher[]> {
  const { data } = await apiClient.get<ClientVoucher[]>('/app/client-vouchers');
  return data;
}
