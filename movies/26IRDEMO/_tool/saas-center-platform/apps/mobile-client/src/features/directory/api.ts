import apiClient from '@/shared/api/client';
import type { DirectoryCenter, NearbyQuery } from './types';

/** 공개 엔드포인트 — 게스트(무토큰)도 호출 가능 */
export async function getNearbyDirectoryCenters({
  latitude,
  longitude,
  radiusM,
}: NearbyQuery): Promise<DirectoryCenter[]> {
  const { data } = await apiClient.get<DirectoryCenter[]>('/app/directory-centers', {
    params: { latitude, longitude, radius_m: radiusM, limit: 100 },
  });
  return data;
}
