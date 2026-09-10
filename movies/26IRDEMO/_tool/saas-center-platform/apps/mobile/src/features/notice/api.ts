import apiClient from '@/shared/api/client';
import type { NoticeCategory, NoticeDetail, NoticeListResponse } from './types';

export interface NoticeListParams {
  search?: string;
  category?: NoticeCategory;
  date_from?: string;
  page?: number;
  size?: number;
  center_id?: string;
}

export async function getNoticeList(params?: NoticeListParams): Promise<NoticeListResponse> {
  const response = await apiClient.get<NoticeListResponse>('/notices/', { params });
  return response.data;
}

export async function getNoticeDetail(
  noticeId: string,
  centerId?: string,
): Promise<NoticeDetail> {
  const response = await apiClient.get<NoticeDetail>(`/notices/${noticeId}`, {
    params: centerId ? { center_id: centerId } : undefined,
  });
  return response.data;
}
