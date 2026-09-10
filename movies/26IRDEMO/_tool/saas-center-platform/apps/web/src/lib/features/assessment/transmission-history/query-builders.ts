import type { GetTransmissionHistoryParams } from '$lib/hooks/actions/transmission.action'
import { toTransmissionQueryParams, type TransmissionFilters } from './filters'

export function buildTransmissionQueryInput(filters: TransmissionFilters, centerId: string): GetTransmissionHistoryParams {
	return toTransmissionQueryParams(filters, centerId)
}
