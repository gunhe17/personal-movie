import apiClient from '@/shared/api/client';
import type { ScheduleListItem, ScheduleDetailResponse } from './types';

/** 일정 목록 조회 (날짜 범위) */
export async function getScheduleList(
  centerId: string,
  startDate: string,
  endDate: string,
): Promise<ScheduleListItem[]> {
  const response = await apiClient.get<ScheduleListItem[]>(
    `/centers/${centerId}/schedules/`,
    { params: { start: `${startDate}T00:00:00`, end: `${endDate}T23:59:59` } },
  );
  return response.data;
}

/** 일정 상세 조회 */
export async function getScheduleDetail(
  centerId: string,
  scheduleId: string,
): Promise<ScheduleDetailResponse> {
  const response = await apiClient.get<ScheduleDetailResponse>(
    `/centers/${centerId}/schedules/${scheduleId}`,
  );
  return response.data;
}

// ─── 세션 상태 변경 API ───

/** 상담 세션 상태 변경 */
export async function updateCounselingSessionStatus(
  centerId: string,
  sessionId: string,
  status: 'completed' | 'no_show' | 'cancelled',
) {
  const response = await apiClient.patch(
    `/centers/${centerId}/counseling/sessions/${sessionId}`,
    { status },
  );
  return response.data;
}

/** 일정 메모 수정 */
export async function updateScheduleNote(
  centerId: string,
  scheduleId: string,
  note: string | null,
): Promise<ScheduleDetailResponse> {
  const response = await apiClient.patch<ScheduleDetailResponse>(
    `/centers/${centerId}/schedules/${scheduleId}`,
    { note },
  );
  return response.data;
}

/** 검사 세션 상태 변경 (dedicated endpoints) */
export async function updateAssessmentSessionStatus(
  centerId: string,
  sessionId: string,
  action: 'attend' | 'no-show' | 'cancel',
) {
  const response = await apiClient.post(
    `/centers/${centerId}/assessment-sessions/${sessionId}/${action}`,
  );
  return response.data;
}
