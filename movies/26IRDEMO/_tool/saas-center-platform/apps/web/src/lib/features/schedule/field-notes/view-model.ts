import type { FieldNoteResponse } from '$lib/hooks/actions/field-note.action'
import {
  PROCESSING_STATUS_LABELS,
  PROCESSING_STATUS_COLORS,
  PROCESSING_BADGE_STYLES,
  PROCESSING_DOT_COLORS,
  STATUS_LABELS
} from './constants'

export interface FieldNoteListVM {
  id: string
  authorId: string
  status: string
  statusLabel: string
  isLinked: boolean
  durationText: string
  processingLabel: string
  processingColor: string
  processingBadge: string
  processingDot: string
  hasSummary: boolean
  createdAt: string
  createdDate: string
}

export function mapToFieldNoteListVM(item: FieldNoteResponse): FieldNoteListVM {
  const totalSec = item.total_duration || 0
  const min = Math.floor(totalSec / 60)
  const sec = Math.round(totalSec % 60)

  const created = new Date(item.created_at)
  const createdDate = created.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const createdAt = created.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

  return {
    id: item.id,
    authorId: item.author_id,
    status: item.status,
    statusLabel: STATUS_LABELS[item.status] ?? item.status,
    isLinked: !!item.schedule_id,
    durationText: totalSec > 0 ? `${min}분 ${sec}초` : '-',
    processingLabel: PROCESSING_STATUS_LABELS[item.processing_status] ?? item.processing_status,
    processingColor: PROCESSING_STATUS_COLORS[item.processing_status] ?? 'text-gray-500',
    processingBadge: PROCESSING_BADGE_STYLES[item.processing_status] ?? 'bg-gray-100 text-gray-600',
    processingDot: PROCESSING_DOT_COLORS[item.processing_status] ?? 'bg-gray-400',
    hasSummary: item.summary_status === 'completed',
    createdAt,
    createdDate
  }
}
