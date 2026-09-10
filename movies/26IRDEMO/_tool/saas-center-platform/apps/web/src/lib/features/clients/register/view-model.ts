import { t } from '$lib/ontology/terms'
/**
 * 내담자 등록/수정 ViewModel
 * - 순수 포맷·검증 헬퍼 + API → 폼 상태 매핑 (룬/IO 없음)
 */

import type { GuardianFormState } from './register-service'
import type { RelationResponse } from '$lib/hooks/actions/client.action'
import { RELATION_DETAIL_REVERSE_MAP } from './constants'
import { formatPhoneNumber } from '$lib/utils/stringConverter'

// ── 입력 포맷터 ──

/** 생년월일 입력 → YYYY-MM-DD 마스킹 */
export function formatBirthInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

/** 전화번호 입력 → XXX-XXXX-XXXX 마스킹 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

/** 요약용 날짜 표기 (YYYY.MM.DD) */
export function formatDateForSummary(d: string): string {
  if (!d || d.length !== 10) return '-'
  return d.replace(/-/g, '.')
}

// ── 검증 헬퍼 ──

/** YYYY-MM-DD 문자열이 실재하는 날짜인지 */
export function isValidDate(dateStr: string): boolean {
  if (dateStr.length !== 10) return false
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return false
  if (y < 1900 || y > new Date().getFullYear()) return false
  const date = new Date(y, m - 1, d)
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  )
}

/** 생년월일 실시간 에러 메시지 (8자리 입력 완료 후 판정) */
export function getBirthError(dateStr: string): string {
  const digits = dateStr.replace(/-/g, '')
  if (digits.length !== 8) return ''
  if (!isValidDate(dateStr)) return '올바르지 않은 날짜입니다.'
  if (new Date(dateStr) > new Date())
    return '생년월일은 미래 날짜일 수 없습니다.'
  return ''
}

// ── 스텝퍼 프리뷰 (순수) ──

export function fmtClientPreview(
  name: string,
  gender: 'MALE' | 'FEMALE',
  birth: string
): string {
  if (!name.trim()) return `${t('subject')} 정보를 입력해주세요`
  const g = gender === 'MALE' ? '남' : '여'
  return birth.length === 10
    ? `${name.trim()} · ${g} · ${formatDateForSummary(birth)}`
    : `${name.trim()} · ${g}`
}

export function fmtGuardianPreview(
  filledGuardians: GuardianFormState[]
): string {
  if (filledGuardians.length === 0) return '선택 안 함'
  const head = filledGuardians[0].name.trim() || t('guardian')
  const rest = filledGuardians.length - 1
  return rest > 0 ? `${head} 외 ${rest}명` : head
}

export function fmtVoucherPreview(
  filledCount: number,
  touchedCount: number
): string {
  if (touchedCount === 0) return '선택 안 함'
  return `${filledCount}건`
}

// ── API → 폼 상태 매핑 ──

/**
 * 보호자 관계 + 상세 정보 → 보호자 폼 상태 배열.
 * 수정 모드에서 기존 보호자를 폼에 채울 때 사용.
 */
export function mapRelationsToGuardianForms(
  items: { relation: RelationResponse; detail: any }[]
): GuardianFormState[] {
  return items.map(({ relation, detail }) => ({
    // related_client_id는 보호자별 고유 → 폼 row id로 사용
    id: relation.related_client_id,
    clientId: relation.related_client_id,
    name: detail?.name || '',
    relation:
      RELATION_DETAIL_REVERSE_MAP[relation.relation_detail || ''] || '기타',
    birth: detail?.birth_date ? detail.birth_date.slice(0, 10) : '',
    phone: formatPhoneNumber(detail?.phone || '') || '',
    gender: detail?.gender?.toLowerCase() === 'female' ? 'female' : 'male'
  }))
}
