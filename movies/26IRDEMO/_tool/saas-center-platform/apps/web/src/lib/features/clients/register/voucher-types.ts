/**
 * 내담자 등록 폼 — 바우처 발급 입력 row 타입
 *
 * 1바우처 = ClientVoucher 1건 (백엔드 v3 모델).
 * 한 내담자가 여러 사업 바우처를 가질 수 있으므로 row를 여러 개 추가 가능.
 */

export interface VoucherRow {
  /** 폼 내부 임시 id (등록 후 client_voucher_id가 생성됨) */
  id: string
  centerVoucherId: string | null
  totalSessions: string // 문자열로 보유 후 발급 시 숫자 변환
  totalAmount: string // 통지서 잔액 원액 (옵션). 문자열로 보유 후 숫자 변환
  validFrom: string
  validUntil: string
}

export function emptyVoucherRow(): VoucherRow {
  return {
    id: `vrow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    centerVoucherId: null,
    totalSessions: '',
    totalAmount: '',
    validFrom: '',
    validUntil: ''
  }
}

/** 발급 대상으로 인정되는 row (필수 필드 채워졌는지) */
export function isVoucherRowFilled(row: VoucherRow): boolean {
  return !!row.centerVoucherId && !!row.totalSessions.trim()
}

/** 무언가라도 입력된 row (부분 입력 감지용) */
export function isVoucherRowTouched(row: VoucherRow): boolean {
  return (
    !!row.centerVoucherId ||
    !!row.totalSessions.trim() ||
    !!row.totalAmount.trim() ||
    !!row.validFrom ||
    !!row.validUntil
  )
}
