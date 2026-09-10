/**
 * 프로그램 관리 ViewModel
 * - API 응답 → 카드 렌더용 표현 모델 변환
 * - 검색/필터/정렬 + 상단 요약 통계 계산 (프론트 처리)
 */

import type {
  ProgramListItem,
  ProgramType
} from '$lib/hooks/actions/program.action'
import {
  PROGRAM_TYPE_LABELS,
  type ProgramActiveFilter,
  type ProgramSortKey,
  type ProgramTypeFilter
} from './constants'

/** 카드 담당자 표시용 */
export interface ProgramManagerVM {
  id: string
  name: string
}

/** 카드 렌더용 ViewModel */
export interface ProgramCardVM {
  id: string
  name: string
  type: ProgramType
  typeLabel: string
  price: number
  priceLabel: string
  durationLabel: string
  isActive: boolean
  managers: ProgramManagerVM[]
  raw: ProgramListItem
}

/** 상단 요약 대시보드 통계 */
export interface ProgramSummaryStats {
  total: number
  individual: number
  group: number
  /** 평균 금액 (운영중 프로그램 기준, 0건이면 0) */
  avgPrice: number
}

export function mapToProgramCardVM(item: ProgramListItem): ProgramCardVM {
  return {
    id: item.id,
    name: item.name,
    type: item.program_type,
    typeLabel: PROGRAM_TYPE_LABELS[item.program_type] ?? item.program_type,
    price: item.price,
    priceLabel: `${item.price.toLocaleString()}원`,
    durationLabel: `${item.duration_minutes}분`,
    isActive: item.is_active,
    managers: item.members.map((m) => ({ id: m.member_id, name: m.name })),
    raw: item
  }
}

/** 검색/유형/활성 필터 + 정렬 적용 */
export function filterAndSortPrograms(
  items: ProgramListItem[],
  opts: {
    search: string
    type: ProgramTypeFilter
    active: ProgramActiveFilter
    sort: ProgramSortKey
  }
): ProgramCardVM[] {
  const keyword = opts.search.trim().toLowerCase()

  const filtered = items.filter((item) => {
    if (opts.type !== 'all' && item.program_type !== opts.type) return false
    if (opts.active === 'active' && !item.is_active) return false
    if (opts.active === 'inactive' && item.is_active) return false
    if (keyword) {
      const inName = item.name.toLowerCase().includes(keyword)
      const inManager = item.members.some((m) =>
        m.name.toLowerCase().includes(keyword)
      )
      if (!inName && !inManager) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (opts.sort) {
      case 'price_desc':
        return b.price - a.price
      case 'price_asc':
        return a.price - b.price
      case 'duration':
        return b.duration_minutes - a.duration_minutes
      case 'name':
      default:
        return a.name.localeCompare(b.name, 'ko')
    }
  })

  return sorted.map(mapToProgramCardVM)
}

/** 전체 목록 기준 요약 통계 (필터 무관) */
export function buildProgramSummary(
  items: ProgramListItem[]
): ProgramSummaryStats {
  const individual = items.filter(
    (i) => i.program_type === 'INDIVIDUAL'
  ).length
  const group = items.filter((i) => i.program_type === 'GROUP').length

  const active = items.filter((i) => i.is_active)
  const avgPrice = active.length
    ? Math.round(active.reduce((sum, i) => sum + i.price, 0) / active.length)
    : 0

  return {
    total: items.length,
    individual,
    group,
    avgPrice
  }
}
