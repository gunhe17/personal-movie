import type { Client } from '$root/src/lib/types/client'
import type { ClientFilters } from './filters'
import { formatUtcToKst } from '$lib/utils/date'
import { RELATION_DETAIL_REVERSE_MAP } from './register/constants'

export interface ClientCardVM {
  id: string
  name: string
  code: string
  birth: string
  memo: string
  status: 'ACTIVE' | 'INACTIVE'
  personCreatedAt: Date | undefined
  createdAtDate: string // 'YYYY-MM-DD' (등록일 셀 상단)
  createdAtTime: string // '(목) HH:mm' (등록일 셀 하단)
  isGuardian: boolean
  phone: string
  gender: 'MALE' | 'FEMALE'
  guardianName: string
  guardianRelation: string
  profileImageUrl: string | null
  voucherPrimary: { name: string; remaining: number; total: number } | null
  voucherCount: number
  vouchers: { name: string; remaining: number; total: number }[]
}

export function mapClientsToVM(data: Client[] | undefined): ClientCardVM[] {
  if (!data) return []
  return data.map((client) => {
    const id = (client as any).uid || (client as any).id || ''
    const code = (client as any).code || ''
    const birth =
      (client as any).birth ||
      (client as any).birth_date ||
      (client as any).birthDate ||
      ''
    const phone = (client as any).phone
    const name = (client as any).name
    const roleRaw = (client as any).role
    const isGuardian =
      typeof (client as any).isGuardian === 'boolean'
        ? (client as any).isGuardian
        : ['guardian', 'both', 'GUARDIAN', 'BOTH'].includes(
            String(roleRaw || '').toLowerCase()
          )
    const genderRaw = (client as any).gender
    const memo = (client as any).memo
    const statusRaw = (client as any).status
    const status =
      statusRaw === 'active' || statusRaw === 'ACTIVE'
        ? 'ACTIVE'
        : statusRaw === 'inactive' || statusRaw === 'INACTIVE'
          ? 'INACTIVE'
          : statusRaw === 'archived' || statusRaw === 'ARCHIVED'
            ? 'INACTIVE'
            : 'ACTIVE'
    const createdAtRaw =
      (client as any).created_at ||
      (client as any).personCreatedAt ||
      (client as any).createdAt
    const personCreatedAt = createdAtRaw ? new Date(createdAtRaw) : undefined
    const createdAtDate = createdAtRaw
      ? formatUtcToKst(createdAtRaw, 'YYYY-MM-DD')
      : '-'
    const createdAtTime = createdAtRaw
      ? formatUtcToKst(createdAtRaw, '(d) HH:mm')
      : ''
    const gender =
      genderRaw === 'male' || genderRaw === 'MALE' || genderRaw === '남자'
        ? 'MALE'
        : genderRaw === 'female' ||
            genderRaw === 'FEMALE' ||
            genderRaw === '여자'
          ? 'FEMALE'
          : 'FEMALE'

    return {
      id,
      name,
      code,
      birth,
      memo,
      status,
      personCreatedAt,
      createdAtDate,
      createdAtTime,
      isGuardian,
      phone,
      gender,
      guardianName: (client as any).guardian_name ?? '',
      guardianRelation:
        RELATION_DETAIL_REVERSE_MAP[
          String((client as any).guardian_relationship ?? '')
        ] ??
        (client as any).guardian_relationship ??
        '',
      profileImageUrl: (client as any).profile_image_url ?? null,
      voucherPrimary: (client as any).voucher_primary
        ? {
            name: (client as any).voucher_primary.name,
            remaining: (client as any).voucher_primary.remaining_sessions,
            total: (client as any).voucher_primary.total_sessions
          }
        : null,
      voucherCount: (client as any).voucher_count ?? 0,
      vouchers: Array.isArray((client as any).vouchers)
        ? (client as any).vouchers.map((v: any) => ({
            name: v.name,
            remaining: v.remaining_sessions,
            total: v.total_sessions
          }))
        : []
    }
  })
}

export const filterClients = (
  clients: ClientCardVM[],
  filters: ClientFilters
): ClientCardVM[] => {
  const query = filters.search.trim().toLowerCase()

  return clients.filter((client) => {
    const matchesSearch = query
      ? [client.name, client.code, client.phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      : true

    const matchesGuardian =
      filters.guardian === 'all'
        ? true
        : filters.guardian === 'GUARDIAN'
          ? client.isGuardian === true
          : client.isGuardian === false

    const matchesGender =
      filters.gender === 'all' || client.gender === filters.gender

    const matchesStatus =
      filters.status === 'all' || client.status === filters.status

    return matchesSearch && matchesGuardian && matchesGender && matchesStatus
  })
}

export function sortClients(
  clients: ClientCardVM[],
  sort: ClientFilters['sort']
) {
  const sorted = [...clients]
  if (sort === 'asc') return sorted.reverse()
  return sorted
}

export function paginateClients(
  clients: ClientCardVM[],
  page: number,
  size: number
) {
  const start = (page - 1) * size
  return clients.slice(start, start + size)
}
