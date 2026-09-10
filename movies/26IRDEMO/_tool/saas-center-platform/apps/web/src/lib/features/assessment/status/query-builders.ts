import type { CasesQueryInput, StatusCountsInput } from './filters'
import { toCasesQueryParams, toStatusCountsInput } from './filters'
import type { StatusFilters } from './filters'

export function buildCasesQueryInput(filters: StatusFilters, centerId: string): CasesQueryInput {
  return toCasesQueryParams(filters, centerId)
}

export function buildStatusCountsInput(centerId: string): StatusCountsInput {
  return toStatusCountsInput(centerId)
}

