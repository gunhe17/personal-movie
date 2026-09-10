import { parseServerDate } from '$lib/utils/format'
import type {
  AnchorLabel,
  ExaminationApiItem,
  TimelineItem
} from './types'

/**
 * 카드에 붙는 라벨 — 위치는 예정일이 정하고, 라벨은 진행 단계를 말한다.
 *
 * 🔴 카드를 놓는 시각은 `scheduled_at` 하나다. 서버의 날짜 필터와 **같은
 * 컬럼**이어야 한다(`examination/common/repository.py` _apply_filters).
 * 다른 걸 고르면 **조회는 됐는데 화면에서 사라지는** 검사가 생긴다 —
 * 그 날 창(window)으로 받아온 항목을 TimelineCanvas·TimelineList가
 * isSameDay로 한 번 더 거르기 때문이다.
 *
 * 실제로 그런 버그가 있었다. status가 in_progress면 started_at을 썼는데,
 * 8/19로 예정된 검사를 8/13에 시작해 두면 서버는 8/19 조회에 넣어 주고
 * 프론트는 8/13에 그리려다 걸러 버렸다. "등록 직후에는 보이는데 다른
 * 페이지 갔다 오면 사라진다"가 이 현상이었다.
 *
 * 예정일이 없는 검사는 타임라인에 놓지 않는다(examinationToTimelineItem이
 * null을 반환). 예전에는 created_at으로 대신했는데, 그건 잡은 적 없는
 * 예정을 등록일에 만들어 내는 것이었다.
 */
function resolveAnchorLabel(exam: ExaminationApiItem): AnchorLabel {
  switch (exam.status) {
    case 'completed':
    case 'report_generated':
    case 'confirmed':
      return '완료'
    case 'under_review':
      return '검토중'
    case 'ai_draft_ready':
      return '검토대기'
    case 'in_progress':
      return '시작'
    default:
      return '예정'
  }
}

function calcAge(birthDate: string | null): number | undefined {
  if (!birthDate) return undefined
  const d = new Date(birthDate)
  if (isNaN(d.getTime())) return undefined
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export function examinationToTimelineItem(
  exam: ExaminationApiItem
): TimelineItem | null {
  // 예정일이 없으면 놓을 자리가 없다 — 타임라인에서 제외한다.
  if (!exam.scheduled_at) return null
  const anchorAt = parseServerDate(exam.scheduled_at)
  const anchorLabel = resolveAnchorLabel(exam)

  return {
    id: exam.id,
    who: {
      name: exam.client_name ?? '-',
      age: calcAge(exam.client_birth_date),
      gender: (exam.client_gender as 'male' | 'female' | null) ?? undefined
    },
    what: { type: exam.exam_type },
    when: { anchorAt, anchorLabel },
    state: { status: exam.status }
  }
}

export function examinationsToTimeline(
  exams: ExaminationApiItem[]
): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const exam of exams) {
    const item = examinationToTimelineItem(exam)
    if (item) items.push(item)
  }
  return items
}
