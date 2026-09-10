export const VOUCHER_CLIENT_PAGE_SIZE = 20

export const VOUCHER_STATUS_TABS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행중' },
  { value: 'completed', label: '완료' }
]

export const VOUCHER_SORT_OPTIONS = [{ value: 'desc', title: '최신순' }]

// 대시보드 시그널 딥링크(?signal=) 진입 시 SignalQueueBar 축소 모드에 넘길 라벨.
// 임계값 정의는 백엔드(list_voucher_clients_handler)가 SSOT — 문구만 여기서 대응.
export const VOUCHER_SIGNAL_CHIPS: Record<
  'low' | 'expiring',
  { label: string }
> = {
  low: { label: '소진 임박 바우처 보유 (잔여 2회 이하)' },
  expiring: { label: '만료 임박 바우처 보유 (14일 이내)' }
}

export const VOUCHER_STATUS_STYLES: Record<
  'active' | 'completed',
  { bg: string; text: string; label: string }
> = {
  active: { bg: 'bg-[#256EF41A]', text: 'text-primary-500', label: '진행중' },
  completed: { bg: 'bg-[#22B55F1A]', text: 'text-[#22B55F]', label: '완료' }
}

/**
 * 바우처(사업) 기준 목록의 1회 로드 상한.
 * `/voucher-clients`는 내담자 축 페이지네이션만 지원하고 center_voucher_id 필터가 없어,
 * 센터 전체를 한 번에 받아 화면에서 사업별로 가른다. 상한 도달 시 화면에 고지한다.
 * (백엔드에 `center_voucher_id` 필터가 생기면 이 상한과 클라이언트 분류는 제거)
 */
export const VOUCHER_ROW_LOAD_SIZE = 200

/** 사업 안에서 사람을 훑는 순서 — 서버 정렬이 없어 화면에서 정렬한다 */
export const VOUCHER_ROW_SORT_OPTIONS = [
  { value: 'expiring', title: '만료 임박순' },
  { value: 'remaining', title: '남은 횟수 적은순' },
  { value: 'name', title: '이름순' }
] as const

export type VoucherRowSort = (typeof VOUCHER_ROW_SORT_OPTIONS)[number]['value']
