import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelSchedule,
  getAvailableSlots,
  getSchedules,
  requestScheduleChange,
} from './api';

/** 기간 내 일정 조회 (읽기 전용) */
export function useSchedules(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: ['schedules', start, end],
    queryFn: () => getSchedules(start, end),
    enabled,
    // 달을 옮길 때 스피너로 교체되지 않게 이전 달 데이터를 들고 있는다(기록 탭과 동일)
    placeholderData: (prev) => prev,
  });
}

/** 일정 취소 — 성공 시 일정 목록·진행현황 무효화 */
export function useCancelSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      reason,
    }: {
      scheduleId: string;
      reason?: string;
    }) => cancelSchedule(scheduleId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['profile-progress'] });
    },
  });
}

/** 선택한 날짜의 가능 시간 — 날짜를 고르기 전에는 조회하지 않는다 */
export function useAvailableSlots(scheduleId: string, date: string | null) {
  return useQuery({
    queryKey: ['available-slots', scheduleId, date],
    queryFn: () => getAvailableSlots(scheduleId, date as string),
    enabled: !!scheduleId && !!date,
  });
}

/** 변경 요청 — 성공 시 일정 목록 무효화(검토 중 배지가 붙는다) */
export function useRequestScheduleChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      startTime,
      reason,
    }: {
      scheduleId: string;
      startTime: string;
      reason?: string;
    }) => requestScheduleChange(scheduleId, startTime, reason),
    onSuccess: () => {
      // 일정 목록(홈·일정 탭 공용) + 그 일정의 슬롯 그리드 — 요청 후 다시 열면 최신으로
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
    },
  });
}
