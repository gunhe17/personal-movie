import { COLORS } from '@/shared/constants/theme';
import type { AssessmentTaskStatus, ExecutionMethod } from './types';

/** 케이스 상태 라벨 */
export const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  processing: '진행중',
  completed: '완료',
  cancelled: '취소',
};

/** 케이스 상태 색상 (Solid — Extended Palette) */
export const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  pending: COLORS.tag.gray.fg,
  processing: COLORS.tag.blue.fg,
  completed: COLORS.tag.green.fg,
  cancelled: COLORS.tag.gray.fg,
};

/** 케이스 상태 배경색 (OpacityBG — Extended Palette) */
export const ASSESSMENT_STATUS_BG: Record<string, string> = {
  pending: COLORS.tag.gray.bg,
  processing: COLORS.tag.blue.bg,
  completed: COLORS.tag.green.bg,
  cancelled: COLORS.tag.gray.bg,
};

/** 검사 과제 상태 라벨 */
export const TASK_STATUS_LABELS: Record<AssessmentTaskStatus, string> = {
  pending: '대기',
  in_progress: '진행중',
  submitted: '제출완료',
  completed: '검수완료',
  refused: '거부',
  cancelled: '취소',
};

/** 검사 과제 상태 색상 (Solid — Extended Palette) */
export const TASK_STATUS_COLORS: Record<AssessmentTaskStatus, string> = {
  pending: COLORS.tag.gray.fg,
  in_progress: COLORS.tag.blue.fg,
  submitted: COLORS.tag.amber.fg,
  completed: COLORS.tag.green.fg,
  refused: COLORS.tag.red.fg,
  cancelled: COLORS.tag.gray.fg,
};

/** 검사 과제 상태 배경색 (OpacityBG — Extended Palette) */
export const TASK_STATUS_BG: Record<AssessmentTaskStatus, string> = {
  pending: COLORS.tag.gray.bg,
  in_progress: COLORS.tag.blue.bg,
  submitted: COLORS.tag.amber.bg,
  completed: COLORS.tag.green.bg,
  refused: COLORS.tag.red.bg,
  cancelled: COLORS.tag.gray.bg,
};

/** 세션 상태 라벨 */
export const SESSION_STATUS_LABELS: Record<string, string> = {
  scheduled: '예정',
  attended: '참석',
  no_show: '불참',
  cancelled: '취소',
};

/** 실행 방법 라벨 */
export const EXECUTION_METHOD_LABELS: Record<ExecutionMethod, string> = {
  onsite: '대면',
  online: '온라인',
};

/** 케이스 유형 라벨 */
export const CASE_TYPE_LABELS: Record<string, string> = {
  individual: '개인검사',
  group: '집단검사',
};
