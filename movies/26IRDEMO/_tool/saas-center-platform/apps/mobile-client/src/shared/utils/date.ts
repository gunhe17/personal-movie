/**
 * 서버 시각 ↔ 화면 시각 변환 — 이 앱에서 시각을 다루는 유일한 통로.
 *
 * ⚠️ 서버는 타임존 없는 **UTC naive** 문자열을 준다("2026-07-16T05:00:00" —
 * apps/api `app/core/type.py`의 `utc_dt = datetime  # naive, 값은 UTC 규약`).
 * JS `new Date(s)`·`parseISO(s)`는 오프셋 없는 문자열을 **로컬**로 읽어서,
 * 그대로 쓰면 KST 기기에서 9시간 밀린 시각이 찍힌다. 반대로 로컬 벽시계를
 * 그냥 보내면 서버가 그 값을 UTC로 저장해 9시간 이른 기록이 된다.
 *
 * 표시는 전문가앱(apps/mobile `shared/utils/date.ts`)과 같이 기기 타임존과
 * 무관하게 **KST 고정**이다 — 센터 일정은 한국 시각이 정본이고, 보호자가 해외에
 * 있어도 "오후 2시 상담"은 한국 오후 2시여야 한다. 한국은 DST가 없어 +9h 고정.
 *
 * 규칙:
 *   서버 → 화면 : `formatKst(iso, pattern)` / `toKst(iso)`
 *   화면 → 서버 : `toServerDateTime(fromKst(date))`
 *   화면 안의 Date 값(선택한 날짜·오늘)은 전부 **KST 벽시계** 기준 — `nowKst()`로 만든다.
 *
 * 날짜만 오는 필드(`birth_date`, `application_end_date`처럼 `date` 타입)는 시각이
 * 아니라 달력상의 날짜라 변환하지 않는다 — `parseISO`를 그대로 쓴다.
 */
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 서버 naive UTC 문자열 → 실제 순간(Date). 오프셋이 붙어 있으면 그대로 믿는다. */
export function parseServerDateTime(iso: string): Date {
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  return parseISO(hasOffset ? iso : `${iso}Z`);
}

/**
 * 표시용 — 로컬 필드(getHours 등)를 읽으면 KST 벽시계가 나오는 Date.
 * date-fns `format`·`isSameDay` 등이 로컬 필드를 보므로 이 값으로 넘기면
 * 기기 타임존과 무관하게 KST로 찍힌다. **비교·저장에는 쓰지 말 것**(가짜 순간이다).
 */
export function toKst(value: string | Date): Date {
  const instant =
    typeof value === 'string' ? parseServerDateTime(value) : value;
  // KST 벽시계를 UTC 필드에 담은 뒤, 기기 오프셋만큼 되돌려 로컬 필드로 옮긴다
  const asIfUtc = new Date(instant.getTime() + KST_OFFSET_MS);
  return new Date(asIfUtc.getTime() + asIfUtc.getTimezoneOffset() * 60_000);
}

/** KST 벽시계 Date → 실제 순간(Date). `toKst`의 역변환. */
export function fromKst(kst: Date): Date {
  const wall = Date.UTC(
    kst.getFullYear(),
    kst.getMonth(),
    kst.getDate(),
    kst.getHours(),
    kst.getMinutes(),
    kst.getSeconds(),
    kst.getMilliseconds(),
  );
  return new Date(wall - KST_OFFSET_MS);
}

/** 실제 순간 → 서버가 받는 naive UTC 문자열(`YYYY-MM-DDTHH:mm:ss`) */
export function toServerDateTime(instant: Date): string {
  return instant.toISOString().slice(0, 19);
}

/** KST 벽시계 Date → 서버 문자열. 화면 상태(선택한 날짜 등)를 보낼 때 쓴다. */
export function kstToServerDateTime(kst: Date): string {
  return toServerDateTime(fromKst(kst));
}

/** 지금 — KST 벽시계 기준. 화면의 "오늘"은 전부 이걸로 만든다. */
export function nowKst(): Date {
  return toKst(new Date());
}

/** 서버 시각을 KST로 포맷. date-fns 패턴 그대로 쓴다(기본 로케일 ko) */
export function formatKst(value: string | Date, pattern: string): string {
  return format(toKst(value), pattern, { locale: ko });
}
