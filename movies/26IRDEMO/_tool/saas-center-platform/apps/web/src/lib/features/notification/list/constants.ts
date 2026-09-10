/**
 * 알림 목록 페이지 상수
 */

/** 목록 페이지 크기 */
export const LIST_PAGE_SIZE = 15

/**
 * 상단 고정(공지) 블록 — 최대 노출 건수.
 * 고정은 목록을 밀어내면 안 된다. 4건을 넘기면 스크롤 없이는 일반 알림이 안 보인다.
 */
export const PINNED_NOTICE_LIMIT = 4

/**
 * 고정 블록을 채우기 위해 훑는 **안 읽은** `system` 알림 수.
 * 서버가 event_type 필터를 주지 않아 카테고리로 받아 공지만 걸러낸다
 * (system에는 문의 답변·자격 인증도 섞여 있다).
 */
export const PINNED_NOTICE_SCAN_SIZE = 50

/** 카테고리 필터 타입 */
export type CategoryFilter = 'all' | 'assessment' | 'counseling' | 'system'

/** 정렬 — 리스트 화면 공통 어휘(청구·상담현황·검사현황과 값·라벨 동일) */
export type SortOrder = 'desc' | 'asc'

export const SORT_OPTIONS: { value: SortOrder; title: string }[] = [
  { value: 'desc', title: '최신순' },
  { value: 'asc', title: '오래된순' }
]

/** 검색어 디바운스(ms) — 상담현황과 동일 */
export const SEARCH_DEBOUNCE_DELAY = 300

/**
 * 카테고리 = **탭 축** (2026-09-08 — 읽음 상태 탭 + 카테고리 드롭다운 조합을 대체).
 *
 * 알림을 찾는 기준은 "무엇에 대한 알림인가"이지 "읽었는가"가 아니다. 읽음 상태는
 * 목록을 가르는 축이 아니라 **행마다의 표식**이라, 필터가 아니라 좌측 빨간 점으로
 * 표시한다 — 안 읽은 것만 보려고 탭을 옮길 필요 없이 한 화면에서 눈에 띈다.
 * 필터 드롭다운은 축이 탭으로 올라오면서 없앴다(같은 축을 두 컨트롤이 갖지 않는다).
 */
export const CATEGORY_TAB_OPTIONS: { value: CategoryFilter; label: string }[] =
  [
    { value: 'all', label: '전체' },
    { value: 'counseling', label: '상담' },
    { value: 'assessment', label: '검사' },
    { value: 'system', label: '소식' }
  ]
