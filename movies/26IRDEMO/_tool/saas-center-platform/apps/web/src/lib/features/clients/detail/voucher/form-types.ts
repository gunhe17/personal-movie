/**
 * 내담자 상세 - 바우처 발급/수정 모달 폼 데이터
 *
 * 단건 폼. 등록 화면의 VoucherRow와 컨셉은 같지만, 모달에서 한 건씩 다루는 용도라 분리.
 */

export interface VoucherFormData {
  centerVoucherId: string | null
  totalSessions: string // 숫자로 변환 후 발급
  totalAmount: string // 옵션
  remainingSessions: string // 수정 모드 전용 — 발급 시엔 무시 (서버가 total로 자동 채움)
  remainingAmount: string // 수정 모드 전용 (보정용, 음수 허용)
  validFrom: string
  validUntil: string
}

export function emptyVoucherForm(): VoucherFormData {
  return {
    centerVoucherId: null,
    totalSessions: '',
    totalAmount: '',
    remainingSessions: '',
    remainingAmount: '',
    validFrom: '',
    validUntil: ''
  }
}

export interface VoucherFormErrors {
  centerVoucher?: string
  totalSessions?: string
  totalAmount?: string
  remainingSessions?: string
  remainingAmount?: string
  validRange?: string
}
