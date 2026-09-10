import type { MemberListItem } from '$lib/hooks/actions/member.action'
import type { MemberFilters } from './filters'
import { MEMBER_EMPLOYMENT_TYPE_MAP } from './constants'
import { formatUtcToKst } from '$lib/utils/date'

// MemberVM: 목록용 (MemberListItem에서 flatten)
export interface MemberVM {
  id: string
  name: string // ← person.name
  role_code: string
  role_name: string
  phone: string | null // ← person.phone
  email: string | null // ← person.email
  gender: string | null // ← person.gender (아바타 성별 폴백용)
  profileImageUrl: string | null // ← 프로필 이미지 (목록 카드 아바타)
  employment_type: string
  employmentLabel: string // 고용형태 한글 라벨 (정규직/계약직/프리랜서)
  memo: string | null
  is_active: boolean
  is_certified: boolean
  createdAt: string | null // 원본 ISO (정렬용)
  createdAtDate: string // 'YYYY-MM-DD' (등록일 셀 상단)
  createdAtTime: string // '(목) HH:mm' (등록일 셀 하단)
}

// MemberDetailVM은 삭제: action.ts의 MemberDetailResponse를 직접 사용

export function mapMembersToVM(
  items: MemberListItem[] | undefined
): MemberVM[] {
  if (!items) return []
  return items.map((item) => ({
    id: item.id,
    name: item.person.name,
    role_code: item.role_code,
    role_name: item.role_name,
    phone: item.person.phone,
    email: item.person.email,
    gender: item.person.gender ?? null,
    profileImageUrl: item.profile_image_url ?? null,
    employment_type: item.employment_type,
    employmentLabel:
      MEMBER_EMPLOYMENT_TYPE_MAP[
        item.employment_type as keyof typeof MEMBER_EMPLOYMENT_TYPE_MAP
      ] ?? '-',
    memo: item.memo,
    is_active: item.is_active,
    is_certified: item.is_certified ?? false,
    createdAt: item.created_at ?? null,
    createdAtDate: item.created_at
      ? formatUtcToKst(item.created_at, 'YYYY-MM-DD')
      : '-',
    createdAtTime: item.created_at
      ? formatUtcToKst(item.created_at, '(d) HH:mm')
      : ''
  }))
}

export function filterMembers(members: MemberVM[], search: string) {
  const query = search.trim().toLowerCase()
  if (!query) return [...members]
  return members.filter(
    (m) =>
      m.name.toLowerCase().includes(query) ||
      m.email?.toLowerCase().includes(query) ||
      m.phone?.toLowerCase().includes(query)
  )
}

// 등록일 기준 정렬 — desc=최신순, asc=오래된순 (내담자·상담 현황과 동일 규약)
export function sortMembers(members: MemberVM[], sort: 'asc' | 'desc') {
  return [...members].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return sort === 'desc' ? tb - ta : ta - tb
  })
}

export function paginateMembers(
  members: MemberVM[],
  page: number,
  size: number
) {
  const start = (page - 1) * size
  return members.slice(start, start + size)
}

export function filterMembersByOptions(
  members: MemberVM[],
  filters: MemberFilters
) {
  // search는 API에서 처리 (name 기준 ILIKE 검색)
  return members.filter((m) => {
    if (filters.role !== 'all' && m.role_code !== filters.role) return false
    if (
      filters.employmentType !== 'all' &&
      m.employment_type !== filters.employmentType
    )
      return false
    return true
  })
}

// UI 헬퍼 함수
export function getInitial(name: string): string {
  return name?.[0] ?? '?'
}
