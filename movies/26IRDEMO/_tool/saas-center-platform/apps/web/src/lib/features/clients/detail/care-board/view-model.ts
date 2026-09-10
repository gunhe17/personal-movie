// 케어보드 서버 행 → 도크가 그리는 StreamItem.
//
// 도크는 표현만 한다 — 날짜/시각 라벨, 종류 메타, 원본 이동 경로를 여기서 만든다.

import type {
  CareBoardKind,
  CareBoardStreamRow
} from '$lib/hooks/actions/care-board.action'

export type TagColor = 'blue' | 'teal' | 'amber' | 'purple' | 'gray' | 'green'

export const KIND_META: Record<string, { label: string; color: TagColor }> = {
  memo: { label: '메모', color: 'amber' },
  counseling: { label: '상담', color: 'green' },
  assessment: { label: '검사', color: 'blue' },
  fieldnote: { label: '필드노트', color: 'purple' },
  document: { label: '문서', color: 'gray' },
  voucher: { label: '바우처', color: 'teal' },
  handover: { label: '인계', color: 'gray' }
}

export const FILTERS: { value: string; label: string; kinds: string[] }[] = [
  { value: 'all', label: '전체', kinds: [] },
  { value: 'memo', label: '메모', kinds: ['memo'] },
  { value: 'counseling', label: '상담', kinds: ['counseling'] },
  { value: 'assessment', label: '검사', kinds: ['assessment'] },
  {
    value: 'etc',
    label: '기타',
    kinds: ['fieldnote', 'document', 'voucher', 'handover']
  }
]

export interface StreamItem {
  id: string
  /** 행의 신원 = 가리키는 **원천**(엔트리 id 아님).
   *  낙관 행은 임시 엔트리 id로 먼저 그려지고 재조회가 진짜 엔트리로 갈아끼우는데,
   *  엔트리 id로 키를 잡으면 그 교체가 "제거 + 삽입"이 돼 등장 전환(in:fly)이 다시
   *  돌면서 말풍선이 한 번 깜빡인다. 원천(care_memos:{memo id})은 그 교체를 건너
   *  동일하므로 같은 행으로 인식돼 내용만 제자리에서 바뀐다.
   *  care_board_entries는 (source_table, source_id) 유니크라 신원으로 성립한다. */
  key: string
  kind: CareBoardKind | string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm (24h) */
  time: string
  /** 메모: 작성자 / 이벤트: null — 아바타 유무가 곧 "누가 썼나"의 구분 */
  author: string | null
  authorId: string | null
  title?: string
  subtitle?: string
  body?: string
  meta?: string
  pinned: boolean
  pinnedByName: string | null
  /** 원본이 지워졌으면 행은 남기고 클릭만 막는다 */
  sourceDeleted: boolean
  sourceTable: string
  sourceId: string
  caseId: string | null
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export function toStreamItem(row: CareBoardStreamRow): StreamItem {
  const at = new Date(row.occurred_at)
  return {
    id: row.id,
    key: row.source_id
      ? `${row.source_table}:${row.source_id}`
      : `entry:${row.id}`,
    kind: row.kind,
    date: toIsoDate(at),
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
    author: row.kind === 'memo' ? row.actor_name : null,
    authorId: row.actor_id,
    title: row.title ?? undefined,
    subtitle: row.subtitle ?? undefined,
    body: row.body ?? undefined,
    meta: row.meta ?? undefined,
    pinned: row.pinned,
    pinnedByName: row.pinned_by_name,
    sourceDeleted: row.source_deleted_at !== null,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    caseId: row.case_id
  }
}

export interface DayGroup {
  key: string
  label: string
  rows: StreamItem[]
}

/** 채팅과 같은 오름차순(위=오래된, 아래=최신)으로 날짜 구분자를 만든다 */
export function groupByDay(items: StreamItem[]): DayGroup[] {
  const out: DayGroup[] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (last?.key === item.date) last.rows.push(item)
    else out.push({ key: item.date, label: dayLabel(item.date), rows: [item] })
  }
  return out
}

export function dayLabel(iso: string) {
  const today = toIsoDate(new Date())
  const yesterday = toIsoDate(new Date(Date.now() - 86_400_000))
  if (iso === today) return '오늘'
  if (iso === yesterday) return '어제'
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일 (${DAYS[new Date(y, m - 1, d).getDay()]})`
}

/** '15:00' → '오후 3:00' */
export function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`
}

/** 행 클릭 목적지 — 원본이 지워졌거나 경로가 없으면 null(클릭 비활성) */
export function sourceHref(item: StreamItem): string | null {
  if (item.sourceDeleted) return null
  switch (item.sourceTable) {
    case 'counseling_cases':
      return `/counseling/status/${item.sourceId}`
    case 'counseling_sessions':
      return item.caseId ? `/counseling/status/${item.caseId}` : null
    case 'assessment_tasks':
      return item.caseId ? `/assessment/status/${item.caseId}` : null
    default:
      return null
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
