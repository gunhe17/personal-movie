/**
 * 검사 관리 페이지 상수 및 타입 정의
 */

// 탭 타입
export type TabType = 'single' | 'set'

// 탭 목록
export const MANAGE_TABS: { value: TabType; label: string }[] = [
  { value: 'single', label: '단일 검사' },
  { value: 'set', label: '검사 세트' }
]

// 기본 페이지 사이즈
export const DEFAULT_PAGE_SIZE = 18

// 검색 디바운스 딜레이 (ms)
export const SEARCH_DEBOUNCE_DELAY = 500

// 운영 상태 필터 옵션
export const activeFilterOptions = [
  { value: 'all', title: '운영 전체' },
  { value: 'active', title: '운영중' },
  { value: 'inactive', title: '운영 안함' }
]

// 정렬 옵션
export const sortOptions = [
  { value: 'oldest', title: '오래된 순' },
  { value: 'newest', title: '최신 순' }
]

// 검사 분류 타입 (서버 기준)
export type AssessmentTypeFilter =
  | 'all'
  | 'projective'
  | 'intelligence'
  | 'objective'
  | 'developmental'

// 검사 분류 필터 옵션
export const assessmentTypeFilterOptions = [
  { value: 'all', title: '검사 분류' },
  { value: 'projective', title: '투사적 검사' },
  { value: 'intelligence', title: '지능검사' },
  { value: 'objective', title: '객관적 검사' },
  { value: 'developmental', title: '발달검사' }
]

// 검사 마스터는 센터가 바꾸는 데이터가 아니라 세션 내 재조회가 불필요하다.
// 카드를 다시 눌러도 캐시에서 즉시 열린다.
export const ASSESSMENT_DETAIL_STALE_TIME = 5 * 60 * 1000

// 모달 사이즈 설정
export const MODAL_SIZES = {
  assessmentToggle: { customWidth: 540, customHeight: 560 },
  // 높이 고정 없음 — 콘텐츠가 높이를 정한다(고정 740은 바디 하단에 죽은 여백 175를 만들었다).
  // 바디 하단 여백은 모달 규격의 20(p-5)만 남는다.
  packageSetting: { customWidth: 640, desktopOnly: true },
  packageEdit: { customWidth: 540, customHeight: 640 },
  assessmentRequest: { customWidth: 540, customHeight: 499, desktopOnly: true },
  // 조회 전용 — 높이는 콘텐츠(검사 설명 길이)가 정한다
  assessmentDetail: { customWidth: 540 }
} as const
