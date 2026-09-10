import type { NoticeCategory } from '$lib/hooks/actions/notice.action'

export const CATEGORY_LABELS: Record<NoticeCategory, string> = {
  maintenance: '점검',
  update: '업데이트',
  announcement: '공지'
}

/**
 * 유형 배지 색 — `BadgeRectangle`의 tag 색 이름(§Colors > Tag).
 * 하드코딩 클래스(`bg-orange-100 text-orange-700`) 금지 — 배지 규격은 컴포넌트가 소유한다.
 */
export type NoticeBadgeColor = 'orange' | 'blue' | 'gray'

export const CATEGORY_COLORS: Record<NoticeCategory, NoticeBadgeColor> = {
  maintenance: 'orange',
  update: 'blue',
  announcement: 'gray'
}

export const NOTICE_PAGE_SIZE = 20

export const CATEGORY_FILTER_OPTIONS = [
  { value: '', title: '전체 유형' },
  { value: 'announcement', title: '공지' },
  { value: 'update', title: '업데이트' },
  { value: 'maintenance', title: '점검' }
]

export const DATE_FILTER_OPTIONS = [
  { value: '', title: '전체 날짜' },
  { value: 'week', title: '최근 1주일' },
  { value: 'month', title: '최근 1개월' },
  { value: '3months', title: '최근 3개월' }
]
