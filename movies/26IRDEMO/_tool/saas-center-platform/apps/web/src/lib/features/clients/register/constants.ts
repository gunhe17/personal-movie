/**
 * 내담자 등록 - 서버 배치 API와 맞추기 위한 상수
 */

/** UI 관계 라벨 → API relation_detail */
export const RELATION_DETAIL_MAP: Record<string, string> = {
  엄마: 'mother',
  아빠: 'father',
  할머니: 'grandmother',
  할아버지: 'grandfather',
  이모: 'aunt',
  고모: 'aunt',
  삼촌: 'uncle',
  기타: 'caregiver'
}

export const GUARDIAN_RELATION_OPTIONS = [
  '엄마',
  '아빠',
  '할머니',
  '할아버지',
  '이모',
  '고모',
  '삼촌',
  '기타'
] as const

/** API relation_detail → UI 관계 라벨 (역변환) */
export const RELATION_DETAIL_REVERSE_MAP: Record<string, string> = {
  mother: '엄마',
  father: '아빠',
  grandmother: '할머니',
  grandfather: '할아버지',
  aunt: '이모',
  uncle: '삼촌',
  caregiver: '기타',
  social_worker: '기타',
  foster_parent: '기타',
  legal_guardian: '기타'
}
