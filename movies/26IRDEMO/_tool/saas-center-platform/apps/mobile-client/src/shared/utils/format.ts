import { differenceInYears, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatKst } from './date';

/** 서버 시각(UTC naive) → `M월 d일 (요일)` KST */
export function formatDateLabel(iso: string): string {
  return formatKst(iso, 'M월 d일 (EEE)');
}

/** 서버 시각(UTC naive) → `HH:mm` KST */
export function formatTime(iso: string): string {
  return formatKst(iso, 'HH:mm');
}

/** 시작~종료 ISO → `HH:mm ~ HH:mm` */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} ~ ${formatTime(endIso)}`;
}

/**
 * `YYYY-MM-DD` → `YYYY. MM. DD` (없으면 null).
 * 생년월일은 시각이 아니라 달력상의 날짜(서버 `date` 타입)라 KST 변환 대상이 아니다.
 */
export function formatBirthDate(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const parsed = parseISO(birthDate);
  if (Number.isNaN(parsed.getTime())) return birthDate;
  return format(parsed, 'yyyy. MM. dd');
}

/**
 * YYMMDD 6자리 → `YYYY-MM-DD` (형식·실재 날짜 아니면 null).
 * 두 자리 연도는 미래가 될 수 없으므로 현재 연도를 경계로 세기를 가른다.
 */
export function birthDigitsToIso(digits: string): string | null {
  if (!/^\d{6}$/.test(digits)) return null;

  const currentYear = new Date().getFullYear();
  const shortYear = Number(digits.slice(0, 2));
  const century = shortYear <= currentYear % 100 ? 2000 : 1900;
  const year = century + shortYear;
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));

  const parsed = new Date(year, month - 1, day);
  const isRealDate =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
  if (!isRealDate) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` → YYMMDD (폼 진입 시 인풋 채우기) */
export function birthIsoToDigits(isoDate: string | null): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${year.slice(2)}${month}${day}`;
}

/** `YYYY-MM-DD` → `YYYY. MM. DD (만 N세)` (없으면 null) */
export function formatBirthWithAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const parsed = parseISO(birthDate);
  if (Number.isNaN(parsed.getTime())) return birthDate;
  const age = differenceInYears(new Date(), parsed);
  return `${format(parsed, 'yyyy. MM. dd')} (만 ${age}세)`;
}
