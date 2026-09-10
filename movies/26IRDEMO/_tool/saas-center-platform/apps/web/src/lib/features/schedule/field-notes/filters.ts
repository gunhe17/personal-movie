import {
  FIELD_NOTE_LIST_PAGE_SIZE
} from './constants'

export type FieldNoteProcessingFilter =
  | 'all'
  | 'idle'
  | 'processing'
  | 'completed'
  | 'failed'
export type FieldNoteLinkedFilter = 'all' | 'true' | 'false'
export type FieldNoteViewType = 'list' | 'grid'

export interface FieldNoteFilters {
  page: number
  pageSize: number
  processingStatus: FieldNoteProcessingFilter
  linked: FieldNoteLinkedFilter
  view: FieldNoteViewType
}

export const DEFAULT_FILTERS: FieldNoteFilters = {
  page: 1,
  pageSize: FIELD_NOTE_LIST_PAGE_SIZE,
  processingStatus: 'all',
  linked: 'all',
  view: 'list'
}

const VALID_PROCESSING: FieldNoteProcessingFilter[] = [
  'all',
  'idle',
  'processing',
  'completed',
  'failed'
]
const VALID_LINKED: FieldNoteLinkedFilter[] = ['all', 'true', 'false']
const VALID_VIEW: FieldNoteViewType[] = ['list', 'grid']

export const parseFiltersFromUrl = (url: URL): FieldNoteFilters => {
  const params = url.searchParams

  const parseNumber = (key: string, fallback: number) => {
    const raw = params.get(key)
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  const processingStatus = params.get(
    'processingStatus'
  ) as FieldNoteProcessingFilter
  const linked = params.get('linked') as FieldNoteLinkedFilter
  const view = params.get('view') as FieldNoteViewType

  return {
    page: parseNumber('page', DEFAULT_FILTERS.page),
    pageSize: parseNumber('pageSize', DEFAULT_FILTERS.pageSize),
    processingStatus: VALID_PROCESSING.includes(processingStatus)
      ? processingStatus
      : DEFAULT_FILTERS.processingStatus,
    linked: VALID_LINKED.includes(linked) ? linked : DEFAULT_FILTERS.linked,
    view: VALID_VIEW.includes(view) ? view : DEFAULT_FILTERS.view
  }
}

export const toSearchParams = (filters: FieldNoteFilters) => {
  const params = new URLSearchParams()

  if (filters.page !== DEFAULT_FILTERS.page)
    params.set('page', String(filters.page))
  if (filters.pageSize !== DEFAULT_FILTERS.pageSize)
    params.set('pageSize', String(filters.pageSize))
  if (filters.processingStatus !== 'all')
    params.set('processingStatus', filters.processingStatus)
  if (filters.linked !== 'all') params.set('linked', filters.linked)
  if (filters.view !== DEFAULT_FILTERS.view) params.set('view', filters.view)

  return params
}
