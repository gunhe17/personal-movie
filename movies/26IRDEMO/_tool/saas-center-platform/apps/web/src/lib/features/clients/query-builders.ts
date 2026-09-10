import type { ClientFilters } from './filters'
import type { ClientRole, ClientStatus } from '$lib/hooks/actions/client.action'

export type ClientListInput = {
  centerId: string
  skip: number
  limit: number
  role?: ClientRole
  status?: ClientStatus
  gender?: string
  search?: string
  sort?: string
}

const roleMap: Record<string, ClientRole | undefined> = {
  all: undefined,
  GUARDIAN: 'guardian',
  CHILD: 'client'
}

const statusMap: Record<string, ClientStatus | undefined> = {
  all: undefined,
  ACTIVE: 'active',
  INACTIVE: 'inactive'
}

const genderMap: Record<string, string | undefined> = {
  all: undefined,
  MALE: 'male',
  FEMALE: 'female'
}

export const buildClientListInput = (
  centerId: string,
  filters: ClientFilters
): ClientListInput => ({
  centerId,
  skip: (filters.page - 1) * filters.pageSize,
  limit: filters.pageSize,
  role: roleMap[filters.guardian],
  status: statusMap[filters.status],
  gender: genderMap[filters.gender],
  search: filters.search || undefined,
  sort: filters.sort
})
