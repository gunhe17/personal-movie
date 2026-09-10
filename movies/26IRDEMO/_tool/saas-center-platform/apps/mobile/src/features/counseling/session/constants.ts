import { COLORS } from '@/shared/constants/theme';
import type { AttendanceStatus, SessionStatus } from './types';

/** 출석 상태 라벨 */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  scheduled: '예정',
  attended: '참석',
  absent: '불참',
  late: '지각',
  excused: '사전결석',
  no_show: '노쇼',
};

/** 출석 상태 색상 */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  scheduled: COLORS.gray[500],
  attended: COLORS.success,
  absent: COLORS.error,
  late: COLORS.warning,
  excused: COLORS.info,
  no_show: COLORS.tag.orange.fg,
};

/** 출석 상태 배경색 */
export const ATTENDANCE_STATUS_BG: Record<AttendanceStatus, string> = {
  scheduled: COLORS.gray[100],
  attended: '#E8F5E9',
  absent: '#FFEBEE',
  late: '#FFF3E0',
  excused: '#E3F2FD',
  no_show: COLORS.tag.orange.bg,
};

/** 세션 상태 라벨 */
export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: '예정',
  completed: '완료',
  no_show: '노쇼',
  cancelled: '취소',
};

/** 세션 상태 색상 */
export const SESSION_STATUS_COLORS: Record<SessionStatus, string> = {
  scheduled: COLORS.info,
  completed: COLORS.success,
  no_show: COLORS.warning,
  cancelled: COLORS.gray[400],
};

/** 케이스 유형 라벨 */
export const CASE_TYPE_LABELS: Record<string, string> = {
  individual: '개인상담',
  group: '집단상담',
  couple: '커플상담',
};

/** 출석 변경 가능한 상태 목록 (BottomSheet 옵션) */
export const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'attended', label: '참석' },
  { value: 'absent', label: '불참' },
  { value: 'late', label: '지각' },
  { value: 'excused', label: '사전결석' },
  { value: 'no_show', label: '노쇼' },
];
