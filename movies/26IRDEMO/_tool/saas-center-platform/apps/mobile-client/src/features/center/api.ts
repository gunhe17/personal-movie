import apiClient from '@/shared/api/client';
import type { CenterDetail } from './types';

export async function getCenterDetail(centerId: string): Promise<CenterDetail> {
  const { data } = await apiClient.get<CenterDetail>(`/app/centers/${centerId}`);
  return data;
}
