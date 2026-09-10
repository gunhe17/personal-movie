import type { GetMemberListParams } from '$lib/hooks/actions/member.action'
import type { MemberFilters } from './filters'

export type MemberListInput = GetMemberListParams

export const buildMemberListInput = (
  centerId: string,
  filters?: MemberFilters
): MemberListInput => ({
  centerId,
  search: filters?.search || undefined,
  size: 100,
  role_code: filters?.role !== 'all' ? filters?.role : undefined
})
