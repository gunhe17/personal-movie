import { isBefore } from 'date-fns';
import { normalizeSessionStatus, type ScheduleListItem } from '@/features/schedule';
import { parseDate } from '@/shared/utils/date';
import type { BadgeRoundVariant } from '@/shared/components/ui/BadgeRound';

export function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export type ScheduleStatus =
  | 'completed'
  | 'in_progress'
  | 'upcoming'
  | 'no_show'
  | 'cancelled';

export function deriveStatus(item: ScheduleListItem): ScheduleStatus {
  const normalized = normalizeSessionStatus(item.session_status);
  if (normalized === 'completed') return 'completed';
  if (normalized === 'no_show') return 'no_show';
  if (normalized === 'cancelled') return 'cancelled';

  const now = new Date();
  const start = parseDate(item.start);
  const end = parseDate(item.end);
  if (isBefore(start, now) && !isBefore(end, now)) return 'in_progress';
  // 종료 시각이 현재보다 과거라면 자동 완료 처리 (서버 상태와 무관한 표시 전용)
  if (isBefore(end, now)) return 'completed';
  return 'upcoming';
}

export const STATUS_BADGE: Record<ScheduleStatus, { label: string; variant: BadgeRoundVariant }> = {
  completed: { label: '완료', variant: 'primary' },
  in_progress: { label: '진행중', variant: 'warning' },
  upcoming: { label: '예정', variant: 'gray' },
  // 노쇼/취소는 사용자 관점에서 동일하게 '취소'로 통일
  no_show: { label: '취소', variant: 'error' },
  cancelled: { label: '취소', variant: 'error' },
};
