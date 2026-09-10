/**
 * 연락처 표시: 숫자만 추출 후 하이픈 포맷, 형식이 맞지 않으면 입력값 그대로 반환.
 * - 11자리: 010-1234-5678
 * - 10자리 (02): 02-1234-5678
 * - 10자리 (기타): 031-123-4567
 * - 9자리 (02): 02-123-4567
 */
export const formatPhoneNumber = (phoneNumber: string | undefined): string => {
  if (phoneNumber == null || phoneNumber === '') return ''
  const raw = phoneNumber.replace(/-/g, '')
  if (!/^\d+$/.test(raw)) return phoneNumber
  if (raw.length === 11) {
    return raw.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  if (raw.length === 10 && raw.startsWith('02')) {
    return raw.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  if (raw.length === 10) {
    return raw.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  }
  if (raw.length === 9 && raw.startsWith('02')) {
    return raw.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3')
  }
  return phoneNumber
}

/**
 * 사업자등록번호 포맷: 숫자만 추출 후 000-00-00000 형태로 변환.
 * 10자리가 아니면 입력값 그대로 반환.
 */
export const formatBusinessNumber = (brn: string | undefined): string => {
  if (brn == null || brn === '') return ''
  const raw = brn.replace(/-/g, '')
  if (raw.length === 10 && /^\d+$/.test(raw)) {
    return raw.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')
  }
  return brn
}

/**
 * 프로필 데이터 영역의 빈 값 placeholder — `등록된 {라벨}가 없어요`.
 * '-' 대신 무엇이 비었는지 문장으로 알린다(해요체 = Web_Design.md §Voice).
 * 라벨 끝 글자의 받침 유무로 이/가를 고른다.
 */
export const emptyValueLabel = (label: string): string => {
  const last = label.trim().slice(-1)
  const code = last.charCodeAt(0)
  const hasBatchim =
    code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false
  return `등록된 ${label}${hasBatchim ? '이' : '가'} 없어요`
}

export const generateId = (isModal: boolean = true): string => {
  return `${isModal ? 'modal' : 'panel'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
