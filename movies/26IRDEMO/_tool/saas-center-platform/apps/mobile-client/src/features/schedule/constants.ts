import type { ScheduleKind } from './types';

export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  counseling: '상담',
  assessment: '검사',
};

/**
 * 일정 상태 라벨 — 중립 톤 (판정·경고 뉘앙스 금지).
 * 백엔드 status 값이 미확정이라 알려진 코드만 매핑, 그 외는 표시 생략.
 */
const SCHEDULE_STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행 중',
  completed: '완료',
  cancelled: '취소',
  canceled: '취소',
  no_show: '미진행',
};

export function scheduleStatusLabel(status: string): string | null {
  return SCHEDULE_STATUS_LABEL[status] ?? null;
}
