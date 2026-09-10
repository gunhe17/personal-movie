import apiClient from '@/shared/api/client';
import type { HomeSignalsResponse, PrepSignalsResponse } from './types';

export async function getPrepSignals(
  centerId: string,
  scheduleId: string,
): Promise<PrepSignalsResponse> {
  const response = await apiClient.get<PrepSignalsResponse>(
    `/centers/${centerId}/schedules/${scheduleId}/prep-signals`,
  );
  return response.data;
}

export async function getHomeSignals(
  centerId: string,
): Promise<HomeSignalsResponse> {
  const response = await apiClient.get<HomeSignalsResponse>(
    `/centers/${centerId}/home-signals`,
  );
  return response.data;
}
