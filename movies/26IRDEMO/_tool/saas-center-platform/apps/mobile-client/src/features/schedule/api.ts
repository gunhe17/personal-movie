import apiClient from '@/shared/api/client';
import type { AppSchedule, AvailableSlots } from './types';

/** 기간 내 일정 조회 — start/end는 `YYYY-MM-DDTHH:mm:ss` */
export async function getSchedules(
  start: string,
  end: string,
): Promise<AppSchedule[]> {
  const { data } = await apiClient.get<AppSchedule[]>('/app/schedules', {
    params: { start, end },
  });
  return data;
}

/** 일정(상담 회기) 취소 — 가족·담당자·센터에 알림이 나간다 */
export async function cancelSchedule(
  scheduleId: string,
  reason?: string,
): Promise<void> {
  await apiClient.post(`/app/schedules/${scheduleId}/cancel`, { reason });
}

/** 변경 가능한 시간대 — 센터 운영시간 격자에 담당 상담사 가능 여부를 얹어 준다 */
export async function getAvailableSlots(
  scheduleId: string,
  date: string,
): Promise<AvailableSlots> {
  const { data } = await apiClient.get<AvailableSlots>(
    `/app/schedules/${scheduleId}/available-slots`,
    { params: { date } },
  );
  return data;
}

/** 일정 변경 요청 — 소요 시간은 서버가 기존 일정에서 가져간다 */
export async function requestScheduleChange(
  scheduleId: string,
  startTime: string,
  reason?: string,
): Promise<void> {
  await apiClient.post(`/app/schedules/${scheduleId}/change-requests`, {
    start_time: startTime,
    reason,
  });
}
