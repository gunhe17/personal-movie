import type { NoticeSummary } from '$lib/hooks/actions/notice.action'
import { formatUtcToKst } from '$lib/utils/date'
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type NoticeBadgeColor
} from './constants'

export interface NoticeRow {
  id: string
  categoryLabel: string
  categoryColor: NoticeBadgeColor
  title: string
  isPinned: boolean
  isRead: boolean
  authorName: string
  publishedAt: string
}

export function mapNoticeToRow(item: NoticeSummary): NoticeRow {
  return {
    id: item.id,
    categoryLabel: CATEGORY_LABELS[item.category],
    categoryColor: CATEGORY_COLORS[item.category],
    title: item.title,
    isPinned: item.is_pinned,
    isRead: item.is_read,
    authorName: item.created_by_name ?? '관리자',
    // 목록의 등록일은 날짜만 — 시각은 정렬·식별에 쓰이지 않고 열 폭만 잡아먹는다(상세에는 시각까지)
    publishedAt: formatUtcToKst(
      item.published_at ?? item.created_at,
      'YYYY-MM-DD'
    )
  }
}

export function mapNoticesToRows(items: NoticeSummary[]): NoticeRow[] {
  return items.map(mapNoticeToRow)
}
