import type { WeekdayEnum } from '$lib/hooks/actions/center.action'

// ─── 요일 매핑 상수 ───

export const WEEKDAY_ORDER: WeekdayEnum[] = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN'
]

export const WEEKDAY_KO: Record<WeekdayEnum, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일'
}

export const MONTH_WEEK_LABELS: Record<number, string> = {
  1: '첫째주',
  2: '둘째주',
  3: '셋째주',
  4: '넷째주',
  5: '마지막주'
}

export const MONTH_WEEK_OPTIONS = [
  { title: '첫째주', value: '1' },
  { title: '둘째주', value: '2' },
  { title: '셋째주', value: '3' },
  { title: '넷째주', value: '4' },
  { title: '마지막주', value: '5' }
]

export const WEEKDAY_OPTIONS = [
  { title: '월요일', value: 'MON' },
  { title: '화요일', value: 'TUE' },
  { title: '수요일', value: 'WED' },
  { title: '목요일', value: 'THU' },
  { title: '금요일', value: 'FRI' },
  { title: '토요일', value: 'SAT' },
  { title: '일요일', value: 'SUN' }
]

export const PHONE_PREFIXES = ['02', '031', '032', '051', '052', '053']

// ─── 타입 ───

export type EditableOperatingTime = {
  weekday: WeekdayEnum
  isOpen: boolean
  openTime: string
  closeTime: string
}

export type EditableHoliday = {
  id: string | null
  monthWeek: string
  weekday: string
}
