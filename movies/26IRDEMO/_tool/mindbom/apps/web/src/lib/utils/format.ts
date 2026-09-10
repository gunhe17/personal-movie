/**
 * 공용 포맷 유틸 — 날짜/나이/성별/내담자 코드 등.
 */

/**
 * 서버 datetime 문자열 → Date.
 * 백엔드는 UTC naive로 직렬화(`"2026-04-29T05:30:00"`)하는데,
 * JS `new Date()`는 timezone 표기 없으면 로컬타임으로 해석함.
 * 따라서 timezone 표기 없는 문자열에는 `Z`를 붙여 UTC로 강제.
 */
export function parseServerDate(s: string): Date {
  const hasTz = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)
  return new Date(hasTz ? s : `${s}Z`)
}

/** ISO 또는 Date string → YYYY-MM-DD. 입력이 없거나 잘못되면 '-'. */
export function formatDate(s: string | null | undefined): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 만 나이 (오늘 기준). 생일 미경과면 -1. 입력 없으면 null. */
export function calcAge(birth: string | null | undefined): number | null {
  if (!birth) return null
  const b = new Date(birth)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

/** 성별 코드 → 한글 라벨. */
export function genderLabel(g: string | null | undefined): string {
  if (g === 'male') return '남'
  if (g === 'female') return '여'
  return '-'
}

/**
 * 내담자 식별용 짧은 코드 — UUID에서 영숫자 6자리만 추출해 대문자.
 * 정식 client_code 컬럼 추가되면 그쪽으로 교체.
 */
export function clientCode(id: string | null | undefined): string {
  if (!id) return ''
  return id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
}
