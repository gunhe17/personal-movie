// ============================================================
// 구성원 상세 - 담당 이력 (상담/검사 케이스 통합)
// ============================================================
//
// 상담 케이스(CounselingCaseItem)와 검사 케이스(CaseData)를 하나의
// CaseHistoryItem 으로 정규화하고 created_at 기준으로 머지/정렬한다.
// 두 목록 모두 counselor 필터를 지원하므로 백엔드 추가 없이 케이스 단위로 구성.

import type { CounselingCaseItem } from '$lib/types/counseling'
import type { CaseData } from '$lib/types/assessmentStatus'
import {
  STATUS_API_MAP,
  STATUS_BADGE_MAP,
  type AssessmentRowStatus
} from '$lib/types/assessmentStatus'

export type CaseHistoryKind = 'counseling' | 'assessment'

// 담당 이력 서브탭 (상담 / 검사). 단일 소스라 각 탭이 독립 스크롤된다.
export const CASE_HISTORY_SUBTABS: {
  value: CaseHistoryKind
  label: string
}[] = [
  { value: 'counseling', label: '상담' },
  { value: 'assessment', label: '검사' }
]

export interface CaseHistoryItem {
  /** 케이스 PK */
  caseId: string
  kind: CaseHistoryKind
  kindLabel: string
  caseCode: string
  /** 내담자 이름 (여러 명이면 "외 N명") */
  clientLabel: string
  /**
   * 내담자 최소 단위 표기용 (아바타 + 이름 + 생년월일|성별).
   * 대표(첫) 내담자 기준이며, 여러 명이면 clientCount로 "외 N명"을 붙인다.
   */
  clientName: string
  clientCount: number
  clientBirthDate: string | null
  clientGender: string | null
  clientProfileImageUrl: string | null
  /** 담당 상담사/검사자 이름 (여러 명이면 "외 N명", 없으면 '담당자 미지정') */
  counselorLabel: string
  /** 케이스 제목 (상담: 프로그램/제목, 검사: 세트명/검사명) */
  title: string
  statusText: string
  statusClass: string
  /** 완료 / 전체 회기(검사) 수 */
  completed: number
  total: number
  progressLabel: string
  /** 다음 일정(있으면) 또는 null */
  nextStart: string | null
  /** 다음 회기 상담실 이름 (상담만, 없으면 null) */
  roomName: string | null
  createdAt: string
  /** 세트 검사 여부 (검사만; true면 [세트] 태그 노출) */
  isSet: boolean
  /** 포함된 개별 검사명 목록 (검사만; 아코디언 하위 항목) */
  assessmentNames: string[]
}

/**
 * 케이스의 내담자 배열 → 최소 단위 표기 필드.
 * 대표는 첫 내담자, 나머지는 count로만 표현한다(카드가 한 명 기준 규격이라).
 */
function toClientIdentity(
  clients:
    | {
        name: string
        birth_date?: string | null
        gender?: string | null
        profile_image_url?: string | null
      }[]
    | undefined
): Pick<
  CaseHistoryItem,
  | 'clientName'
  | 'clientCount'
  | 'clientBirthDate'
  | 'clientGender'
  | 'clientProfileImageUrl'
> {
  const list = clients ?? []
  const first = list[0]
  return {
    clientName: first?.name || '내담자 미지정',
    clientCount: list.length,
    clientBirthDate: first?.birth_date ?? null,
    clientGender: first?.gender ?? null,
    clientProfileImageUrl: first?.profile_image_url ?? null
  }
}

/** 내담자 목록 → "홍길동" 또는 "홍길동 외 2명" */
function toClientLabel(names: string[]): string {
  const valid = names.filter(Boolean)
  if (valid.length === 0) return '내담자 미지정'
  if (valid.length === 1) return valid[0]
  return `${valid[0]} 외 ${valid.length - 1}명`
}

/** 담당자 목록 → 전원 나열 "김상담, 박상담" (없으면 '담당자 미지정') */
function toCounselorLabel(names: (string | null | undefined)[]): string {
  const valid = names.filter((n): n is string => !!n)
  if (valid.length === 0) return '담당자 미지정'
  return valid.join(', ')
}

/** 진행률 라벨: "3/8 회기" 형태 (총합이 0이면 '-') */
function toProgressLabel(completed: number, total: number, unit: string): string {
  if (!total) return '-'
  return `${completed}/${total} ${unit}`
}

/** 상담 케이스 전용 상태 보정: 'active' = 진행중 (STATUS_API_MAP엔 없음) */
const COUNSELING_STATUS_MAP: Record<string, AssessmentRowStatus> = {
  active: 'in_progress'
}

/** 서버 상태값 → 배지(텍스트/색) 정규화. 미지정/미매핑은 'pending' 처리 */
function toStatusBadge(
  status: string,
  kind: CaseHistoryKind
): { text: string; class: string } {
  const normalized: AssessmentRowStatus =
    (kind === 'counseling' ? COUNSELING_STATUS_MAP[status] : undefined) ??
    STATUS_API_MAP[status] ??
    'pending'
  return STATUS_BADGE_MAP[normalized]
}

/** 상담 케이스 → 통합 이력 아이템 */
export function mapCounselingToHistory(
  item: CounselingCaseItem
): CaseHistoryItem {
  const badge = toStatusBadge(item.status, 'counseling')
  return {
    caseId: item.case_id,
    kind: 'counseling',
    kindLabel: '상담',
    caseCode: item.case_code,
    clientLabel: toClientLabel(item.clients?.map((c) => c.name) ?? []),
    ...toClientIdentity(item.clients),
    counselorLabel: toCounselorLabel(
      item.counselor_names?.length
        ? item.counselor_names
        : [item.counselor_name]
    ),
    title: item.program_name || item.title || '상담',
    statusText: badge.text,
    statusClass: badge.class,
    completed: item.completed_sessions,
    total: item.total_sessions,
    progressLabel: toProgressLabel(
      item.completed_sessions,
      item.total_sessions,
      '회기'
    ),
    nextStart: item.next_session_start,
    roomName: item.room_name ?? item.next_session_room_name ?? null,
    createdAt: item.created_at,
    isSet: false,
    assessmentNames: []
  }
}

/** 검사 케이스 → 통합 이력 아이템 */
export function mapAssessmentToHistory(item: CaseData): CaseHistoryItem {
  const badge = toStatusBadge(item.status, 'assessment')
  const title =
    item.set_name ||
    (item.assessment_names?.length
      ? item.assessment_names.join(', ')
      : '검사')
  return {
    caseId: item.case_id,
    kind: 'assessment',
    kindLabel: '검사',
    caseCode: item.case_code,
    clientLabel: toClientLabel(item.clients?.map((c) => c.name) ?? []),
    ...toClientIdentity(item.clients),
    counselorLabel: toCounselorLabel([item.counselor_name]),
    title,
    statusText: badge.text,
    statusClass: badge.class,
    completed: item.completed_count,
    total: item.total_count,
    progressLabel: toProgressLabel(
      item.completed_count,
      item.total_count,
      '검사'
    ),
    nextStart: item.scheduled_start,
    roomName: item.room_name ?? null,
    createdAt: item.created_at,
    isSet: !!item.set_name,
    assessmentNames: item.assessment_names ?? []
  }
}

/** 스크롤 한 페이지의 정규화 결과 */
export interface CaseHistoryPage {
  items: CaseHistoryItem[]
  /** 다음 페이지 존재 여부 (createInfiniteQuery getNextPageParam용) */
  hasNext: boolean
  /** 전체 건수 (헤더 카운트용; 모든 페이지 동일 값) */
  total: number
}

/**
 * 상담 케이스 목록 응답(RowPaginationRes) → 정규화 페이지.
 * 응답: { items, page, pages, total }
 */
export function toCounselingHistoryPage(
  resp:
    | { items?: CounselingCaseItem[]; page?: number; pages?: number; total?: number }
    | undefined
): CaseHistoryPage {
  const items = (resp?.items ?? []).map(mapCounselingToHistory)
  const page = resp?.page ?? 1
  const pages = resp?.pages ?? 1
  // 방어: 빈 페이지가 오면 pages 값과 무관하게 종료 (백엔드 pages 오류 대비)
  return { items, hasNext: items.length > 0 && page < pages, total: resp?.total ?? 0 }
}

/**
 * 검사 케이스 목록 응답(PaginationRes) → 정규화 페이지.
 * 응답: { data, pagination: { page, total_pages, total } }
 */
export function toAssessmentHistoryPage(
  resp:
    | {
        data?: CaseData[]
        pagination?: { page?: number; total_pages?: number; total?: number }
      }
    | undefined
): CaseHistoryPage {
  const items = (resp?.data ?? []).map(mapAssessmentToHistory)
  const page = resp?.pagination?.page ?? 1
  const totalPages = resp?.pagination?.total_pages ?? 1
  // 방어: 빈 페이지가 오면 total_pages 값과 무관하게 종료 (백엔드 오류 대비)
  return {
    items,
    hasNext: items.length > 0 && page < totalPages,
    total: resp?.pagination?.total ?? 0
  }
}

/** 날짜별 그룹 (타임라인 표시용) */
export interface CaseHistoryGroup {
  /** 표시용 날짜 라벨 (예: '2026-06-05') */
  dateLabel: string
  items: CaseHistoryItem[]
}

/**
 * 정렬된 이력을 날짜별로 그룹핑한다.
 * createdAt은 UTC ISO이므로, KST 날짜로 묶으려면 호출부에서
 * KST 변환 함수(toDateLabel)를 주입한다. 입력 순서(최신순)를 유지한다.
 */
export function groupCaseHistoryByDate(
  items: CaseHistoryItem[],
  toDateLabel: (iso: string) => string
): CaseHistoryGroup[] {
  const groups: CaseHistoryGroup[] = []
  for (const item of items) {
    const dateLabel = toDateLabel(item.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.dateLabel === dateLabel) {
      last.items.push(item)
    } else {
      groups.push({ dateLabel, items: [item] })
    }
  }
  return groups
}
