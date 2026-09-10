import apiClient from '@/shared/api/client';
import type { CounselingCaseListResponse, CounselingCaseListParams, CounselingCaseDetailResponse } from './types';

export async function getCounselingCaseList(params: CounselingCaseListParams): Promise<CounselingCaseListResponse> {
  const { centerId, ...query } = params;
  const response = await apiClient.get<CounselingCaseListResponse>(
    `/centers/${centerId}/counseling/`,
    { params: { ...query, size: query.size ?? 50 } },
  );
  return response.data;
}

export async function getCounselingCaseDetail(centerId: string, caseId: string): Promise<CounselingCaseDetailResponse> {
  const response = await apiClient.get<CounselingCaseDetailResponse>(
    `/centers/${centerId}/counseling/${caseId}`,
  );
  return response.data;
}
