import { useQuery } from '@tanstack/react-query';
import { getCenterDetail } from './api';

/** 연결된 센터 상세 — 저빈도 갱신이라 길게 캐시 */
export function useCenterDetail(centerId: string | null) {
  return useQuery({
    queryKey: ['app-center', centerId],
    queryFn: () => getCenterDetail(centerId as string),
    enabled: !!centerId,
    staleTime: 1000 * 60 * 10,
  });
}
