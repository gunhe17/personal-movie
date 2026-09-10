/**
 * 시크릿 모드 마스킹 유틸 — saas-center-platform 의 maskingHandler.ts 이식 + maskEmail 추가.
 *
 * 모두 순수 함수. 의존성 0.
 * 사용: `{$isSecretMode ? maskName(client.name) : client.name}`
 */

export const maskName = (name: string | null | undefined): string => {
  if (!name) return ''
  if (name.length <= 1) return '*'
  if (name.length === 2) return `${name[0]}*`
  return `${name[0]}*${name[name.length - 1]}`
}

export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return ''
  // 처음 3자리 숫자만 노출, 나머지 숫자는 * 로 치환. 구분자(-, 공백, 괄호 등)는 보존.
  // 010-1234-5678 → 010-****-****
  // 01012345678   → 010********
  // 010 1234 5678 → 010 **** ****
  let digitsSeen = 0
  const KEEP = 3
  return Array.from(phone)
    .map((ch) => {
      if (/\d/.test(ch)) {
        digitsSeen += 1
        return digitsSeen <= KEEP ? ch : '*'
      }
      return ch
    })
    .join('')
}

export const maskBirthDate = (date: Date | null | undefined): string => {
  if (!date) return ''
  // YYYY. **. **
  return `${date.getFullYear()}. **. **`
}

export const maskAllText = (text: string | null | undefined): string => {
  if (!text) return ''
  return '*'.repeat(text.length)
}

/**
 * 이메일 마스킹: local part 첫 글자 외 마스킹.
 * "alice@example.com" → "a****@example.com"
 * "ab@example.com"    → "a*@example.com"
 * "a@example.com"     → "*@example.com"
 */
export const maskEmail = (email: string | null | undefined): string => {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at <= 0) return '*'.repeat(email.length)
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length === 1) return `*${domain}`
  return `${local[0]}${'*'.repeat(local.length - 1)}${domain}`
}
