import apiClient from '@/shared/api/client';
import type { AppBillable, AppBillableDetail } from './types';

export async function getBillables(): Promise<AppBillable[]> {
  const { data } = await apiClient.get<AppBillable[]>('/app/billables');
  return data;
}

export async function getBillableDetail(
  billableId: string,
  centerId: string,
): Promise<AppBillableDetail> {
  const { data } = await apiClient.get<AppBillableDetail>(
    `/app/billables/${billableId}`,
    { params: { center_id: centerId } },
  );
  return data;
}
