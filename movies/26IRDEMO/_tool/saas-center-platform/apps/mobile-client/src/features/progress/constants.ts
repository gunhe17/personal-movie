import type { BadgeColor } from '@/shared/components/ui';
import type { AssessmentProgress } from './types';

/** 회기 상태 라벨 — 중립 톤 (채근·판정 뉘앙스 금지) */
const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행 중',
  completed: '완료',
  cancelled: '취소',
  canceled: '취소',
  no_show: '미진행',
};

export function sessionStatusLabel(status: string): string {
  return SESSION_STATUS_LABEL[status] ?? status;
}

export function sessionStatusColor(status: string): BadgeColor {
  return status === 'in_progress' ? 'green' : 'gray';
}

/**
 * 검사 상태 뱃지 — 예정/진행중/완료/결과지 도착.
 * 완료 + report_visible 이면 "결과지 도착"으로 승격.
 */
export function assessmentStatusInfo(item: AssessmentProgress): {
  label: string;
  color: BadgeColor;
} {
  if (item.report_visible) {
    return { label: '결과지 도착', color: 'green' };
  }
  switch (item.status) {
    case 'completed':
      return { label: '완료', color: 'gray' };
    case 'in_progress':
      return { label: '진행 중', color: 'green' };
    case 'scheduled':
      return { label: '예정', color: 'gray' };
    default:
      return { label: sessionStatusLabel(item.status), color: 'gray' };
  }
}

/** 개별 검사(task) 상태 — 케이스 배지보다 잘게. 중립 톤 유지 */
const TASK_STATUS_LABEL: Record<string, string> = {
  pending: '예정',
  in_progress: '진행 중',
  submitted: '제출됨',
  completed: '완료',
  refused: '미실시',
  cancelled: '중단',
  canceled: '중단',
};

export function taskStatusLabel(status: string): string {
  return TASK_STATUS_LABEL[status] ?? status;
}

/** 완료된 검사만 채워진 표식 — 미완료를 결핍으로 보이게 하지 않는다(§7-1) */
export function isTaskDone(status: string): boolean {
  return status === 'completed';
}
