const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * UTC naive 문자열을 UTC Date로 파싱합니다.
 * 서버에서 timezone 없이 내려오는 문자열은 UTC로 간주합니다.
 */
function parseAsUtc(date: Date | string): Date {
  if (date instanceof Date) return date
  const s = String(date).trim()
  if (!s) return new Date(NaN)
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s)
  return new Date(`${s.replace(/\.\d+$/, '')}Z`)
}

/**
 * UTC 시각을 KST로 변환하여 포맷합니다.
 * 서버에서 UTC naive로 내려오는 날짜/시간에 사용하세요.
 *
 * @param date - Date 객체 또는 문자열 (UTC naive 또는 ISO)
 * @param format - 포맷 토큰 (YYYY, YY, MM, DD, HH, mm, SS)
 * @returns 포맷된 KST 문자열, 유효하지 않으면 '-'
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: string = 'YYYY-MM-DD'
): string {
  if (!date) return '-'
  const utcDate = parseAsUtc(date)
  if (isNaN(utcDate.getTime())) return '-'

  const kst = new Date(utcDate.getTime() + KST_OFFSET_MS)
  const padZero = (n: number): string => n.toString().padStart(2, '0')
  const fullYear = kst.getUTCFullYear()

  return format
    .replace('YYYY', `${fullYear}`)
    .replace('YY', String(fullYear).slice(-2))
    .replace('MM', padZero(kst.getUTCMonth() + 1))
    .replace('DD', padZero(kst.getUTCDate()))
    .replace('HH', padZero(kst.getUTCHours()))
    .replace('mm', padZero(kst.getUTCMinutes()))
    .replace('SS', padZero(kst.getUTCSeconds()))
}

export function formatAddress(address: any): string {
  if (!address) return '-'
  const parts = [address.address, address.detail].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : '-'
}
