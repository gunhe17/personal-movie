import type { FieldNoteFilters } from './filters'

export function buildFieldNoteListInput(
  centerId: string,
  filters: FieldNoteFilters
) {
  return {
    centerId,
    page: filters.page,
    size: filters.pageSize,
    processingStatus:
      filters.processingStatus === 'all' ? undefined : filters.processingStatus,
    linked:
      filters.linked === 'true'
        ? true
        : filters.linked === 'false'
          ? false
          : undefined
  }
}
