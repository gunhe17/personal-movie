import { COLORS } from '@/shared/constants/theme';

/** 케이스 상태 라벨 */
export const COUNSELING_STATUS_LABELS: Record<string, string> = {
  active: '진행중',
  completed: '종결',
  cancelled: '취소',
};

/** 케이스 상태 색상 (Solid — Extended Palette) */
export const COUNSELING_STATUS_COLORS: Record<string, string> = {
  active: COLORS.tag.blue.fg,
  completed: COLORS.tag.green.fg,
  cancelled: COLORS.tag.gray.fg,
};

/** 케이스 상태 배경색 (OpacityBG — Extended Palette) */
export const COUNSELING_STATUS_BG: Record<string, string> = {
  active: COLORS.tag.blue.bg,
  completed: COLORS.tag.green.bg,
  cancelled: COLORS.tag.gray.bg,
};

/** 케이스 유형 라벨 */
export const CASE_TYPE_LABELS: Record<string, string> = {
  individual: '개인상담',
  group: '집단상담',
  couple: '커플상담',
};
