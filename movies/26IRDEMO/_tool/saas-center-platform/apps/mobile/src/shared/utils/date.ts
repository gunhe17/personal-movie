import {
  format,
  parseISO,
  differenceInMinutes,
  differenceInCalendarDays,
  isToday,
  isBefore,
  isAfter,
} from 'date-fns';
import { ko } from 'date-fns/locale';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 상대 시간 (디자인 §12.7) — `방금 전` / `N분 전` / `N시간 전` / `어제` / `N일 전`.
 * 7일 초과 시 `YYYY. MM. DD (요일)` 절대 날짜로 전환.
 * 주의: '지금' 기준 1회 계산값이라 화면이 떠 있는 동안 자동 갱신되지 않음.
 */
export function formatRelativeKo(iso: string | Date): string {
  const d = typeof iso === 'string' ? parseDate(iso) : iso;
  const now = new Date();
  const mins = differenceInMinutes(now, d);

  // 미래(시계 오차)거나 1분 미만 → 방금 전
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;

  const days = differenceInCalendarDays(now, d);
  if (days < 1) return `${Math.floor(mins / 60)}시간 전`;
  if (days === 1) return '어제';
  if (days <= 7) return `${days}일 전`;

  return `${format(d, 'yyyy. MM. dd')} (${WEEKDAY_KO[d.getDay()]})`;
}

/**
 * UTC naive ISO 문자열 → 로컬 Date
 * 백엔드는 timezone 없는 UTC naive datetime을 반환하므로
 * 'Z'를 붙여 UTC로 해석한 뒤 JS Date(로컬)로 변환
 */
export function parseDate(iso: string): Date {
  if (iso.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso)) {
    return parseISO(iso);
  }
  return parseISO(iso + 'Z');
}

/** 시간 포맷 (HH:mm) */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return format(d, 'HH:mm');
}

/** 날짜 포맷 (M월 d일 (E)) */
export function formatDateKo(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return format(d, 'M월 d일 (E)', { locale: ko });
}

/** 날짜 포맷 (yyyy-MM-dd) */
export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** 소요 시간 (분) */
export function getDurationMinutes(start: string, end: string): number {
  return differenceInMinutes(parseDate(end), parseDate(start));
}

/** 시간 범위 문자열 */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/** 날짜 포맷 (yyyy.MM.dd) */
export function formatDateDot(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return format(d, 'yyyy.MM.dd');
}

/** 날짜 포맷 (yyyy.MM) */
export function formatDateDotShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  return format(d, 'yyyy.MM');
}

// ─── KST 강제 포매터 ─────────────────────────────────────────────────────
// 디바이스 timezone과 무관하게 항상 KST(UTC+9)로 표시.
// 백엔드는 UTC naive datetime을 응답하므로 parseDate로 UTC 해석 후 +9h 가산.
// (한국은 DST 없음 — 단순 오프셋으로 정확)
// ─────────────────────────────────────────────────────────────────────────

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** UTC ISO 문자열 → KST 기준 가상 Date.
 *  결과 Date의 getUTC* 메서드가 KST 시각을 반환하도록 timestamp를 +9h 이동.
 *  표시 전용 — 다른 연산(비교·정렬)에는 절대 사용하지 말 것. */
function toKst(iso: string | Date): Date {
  const base = typeof iso === 'string' ? parseDate(iso) : iso;
  return new Date(base.getTime() + KST_OFFSET_MS);
}

/** 날짜 (KST) — `YYYY.MM.DD` */
export function formatKstDate(iso: string | Date): string {
  const d = toKst(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** 날짜 (KST, 디자인 §12.7) — `YYYY. MM. DD` (공백 포함) */
export function formatKstDateSpaced(iso: string | Date): string {
  const d = toKst(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}. ${m}. ${day}`;
}

/** 시간 (KST) — `HH:mm` */
export function formatKstTime(iso: string | Date): string {
  const d = toKst(iso);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** 날짜+시간 (KST) — `YYYY.MM.DD HH:mm` */
export function formatKstDateTime(iso: string | Date): string {
  return `${formatKstDate(iso)} ${formatKstTime(iso)}`;
}

/** 시간 범위 (KST) — `HH:mm - HH:mm` */
export function formatKstTimeRange(startIso: string, endIso: string): string {
  return `${formatKstTime(startIso)} - ${formatKstTime(endIso)}`;
}

export { isToday, isBefore, isAfter, format };
