import { useQuery } from '@tanstack/react-query';
import { getMyVouchers, getVoucherCatalog } from './api';

/** 제도 카탈로그 — 저빈도 갱신 데이터라 길게 캐시 */
export function useVoucherCatalog() {
  return useQuery({
    queryKey: ['app-vouchers'],
    queryFn: getVoucherCatalog,
    staleTime: 1000 * 60 * 60,
  });
}

/** 내 보유 바우처 — 게스트/미연결에서는 호출하지 않는다 */
export function useMyVouchers(enabled = true) {
  return useQuery({
    queryKey: ['app-client-vouchers'],
    queryFn: getMyVouchers,
    enabled,
  });
}
