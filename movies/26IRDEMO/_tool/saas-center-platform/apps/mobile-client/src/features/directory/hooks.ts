import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getNearbyDirectoryCenters } from './api';
import type { NearbyQuery } from './types';

/** 좌표는 소수 4자리(≈11m)로 라운딩해 캐시 키 안정화 */
export function useNearbyDirectoryCenters(anchor: NearbyQuery | null) {
  return useQuery({
    queryKey: [
      'app-directory-centers',
      anchor?.latitude.toFixed(4),
      anchor?.longitude.toFixed(4),
      anchor?.radiusM,
    ],
    queryFn: () => getNearbyDirectoryCenters(anchor!),
    enabled: !!anchor,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });
}
