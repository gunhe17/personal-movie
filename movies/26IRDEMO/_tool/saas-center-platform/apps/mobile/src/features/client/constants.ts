import { COLORS } from '@/shared/constants/theme';

export const CLIENT_ROLE_LABELS: Record<string, string> = {
  client: '내담자',
  guardian: '보호자',
  both: '내담자/보호자',
};

export const CLIENT_ROLE_COLORS: Record<string, string> = {
  client: COLORS.primary,
  guardian: COLORS.palette.violet,
  both: COLORS.palette.mint,
};

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: '활성',
  inactive: '비활성',
  archived: '보관',
};

export const GENDER_LABELS: Record<string, string> = {
  male: '남',
  female: '여',
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  processing: '진행중',
  completed: '완료',
  cancelled: '취소',
};

export const CASE_STATUS_COLORS: Record<string, string> = {
  pending: COLORS.palette.yellow,
  processing: COLORS.palette.blue,
  completed: COLORS.palette.green,
  cancelled: COLORS.palette.gray,
};

export const CASE_STATUS_BG: Record<string, string> = {
  pending: COLORS.paletteBg.yellow,
  processing: COLORS.paletteBg.blue,
  active: COLORS.paletteBg.blue,
  completed: COLORS.paletteBg.green,
  cancelled: COLORS.paletteBg.gray,
};

export const COUNSELING_TYPE_LABELS: Record<string, string> = {
  individual: '개인상담',
  group: '집단상담',
};

export const COUNSELING_STATUS_LABELS: Record<string, string> = {
  active: '진행중',
  completed: '완료',
  cancelled: '취소',
};

/** API relation_detail → UI 관계 라벨 (역변환) */
export const RELATION_DETAIL_REVERSE_MAP: Record<string, string> = {
  mother: '엄마',
  father: '아빠',
  grandmother: '할머니',
  grandfather: '할아버지',
  aunt: '이모/고모',
  uncle: '삼촌',
  caregiver: '기타',
  social_worker: '기타',
  foster_parent: '기타',
  legal_guardian: '기타',
};

// --- Registration Constants ---

/** UI 관계 라벨 → API relation_detail */
export const RELATION_DETAIL_MAP: Record<string, string> = {
  '엄마': 'mother',
  '아빠': 'father',
  '할머니': 'grandmother',
  '할아버지': 'grandfather',
  '이모': 'aunt',
  '고모': 'aunt',
  '삼촌': 'uncle',
  '기타': 'caregiver',
};

export const GUARDIAN_RELATION_OPTIONS = [
  '엄마', '아빠', '할머니', '할아버지', '이모', '고모', '삼촌', '기타',
] as const;

export const GENDER_OPTIONS = [
  { value: 'male' as const, label: '남' },
  { value: 'female' as const, label: '여' },
] as const;
