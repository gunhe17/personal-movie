export const DETAIL_TABS = [
  { value: 'history', label: '진행 현황' },
  { value: 'preAdmission', label: '사전기록지' },
  { value: 'documents', label: '문서' },
  { value: 'vouchers', label: '바우처' }
] as const

// 탭바에 노출하지 않는 탭 (좌측 카드 버튼 등 다른 진입점으로 접근)
export const HIDDEN_DETAIL_TABS: DetailTab[] = ['preAdmission']

export type DetailTab = (typeof DETAIL_TABS)[number]['value']

export const MODAL_SIZES = {
  preAdmission: { customWidth: 540, customHeight: 720 },
  uploadDocument: { customWidth: 540 },
  uploadSingle: { customWidth: 540 },
  clientDetail: { customWidth: 540 }
} as const
