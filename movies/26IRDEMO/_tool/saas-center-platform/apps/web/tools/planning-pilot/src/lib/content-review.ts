import type { Plan, Selection } from './types'
import { scopeLabels, behaviorLabel } from './types'
import { auditAxes } from './audit'
export type ReviewKind =
  | 'overview'
  | 'requirement'
  | 'feature'
  | 'scenario'
  | 'case'
export const reviewKindLabels = {
  overview: '기획 개요',
  requirement: '요구사항',
  feature: '기능',
  scenario: '사용자 흐름',
  case: '상세 예외'
} as const
export const reviewStatusLabels = {
  new: '미검토',
  stale: '재검토',
  accepted: '내용 채택',
  changes: '수정 요청',
  deferred: '판단 보류'
} as const
export interface ContentReview {
  key: string
  status: 'accepted' | 'changes' | 'deferred'
  snapshot: string
  note: string
  at: string
}
export interface ReviewItem {
  key: string
  id: string
  kind: ReviewKind
  title: string
  sections: { label: string; value: string }[]
  links: string[]
}
export function reviewItems(plan: Plan, selection: Selection): ReviewItem[] {
  const requirements = plan.audit?.requirements ?? [],
    cases = plan.audit?.cases ?? [],
    scenarios = plan.scenarios ?? []
  return [
    {
      key: 'overview/' + plan.id,
      id: plan.id,
      kind: 'overview',
      title: plan.title,
      sections: [
        { label: '목적', value: selection.goal },
        { label: '추가 의견', value: selection.additional },
        { label: '조사 범위', value: plan.notice }
      ],
      links: requirements.map((r) => 'requirement/' + r.id)
    },
    ...requirements.map((r) => ({
      key: 'requirement/' + r.id,
      id: r.id,
      kind: 'requirement' as const,
      title: r.text,
      sections: [
        { label: '요구 내용', value: r.text },
        { label: '근거', value: r.source },
        {
          label: '정상 흐름 연결',
          value:
            r.scenarioIds
              .map((id) => scenarios.find((s) => s.id === id)?.title ?? id)
              .join('\n') || '정상 흐름 미연결'
        }
      ],
      links: r.featureIds.map((id) => 'feature/' + id)
    })),
    ...plan.features.map((f) => {
      const item = selection.items.find((item) => item.id === f.id)
      const impact = plan.audit?.impacts.find(
        (impact) => impact.featureId === f.id
      )
      return {
        key: 'feature/' + f.id,
        id: f.id,
        kind: 'feature' as const,
        title: f.title,
        sections: [
          { label: '필요한 이유', value: f.why },
          {
            label: '현재 범위·동작',
            value: item
              ? scopeLabels[item.choice] + ' / ' + behaviorLabel(f, item)
              : '미정'
          },
          { label: '결정 질문', value: f.question },
          { label: '제안', value: f.recommendation },
          { label: '완료 조건', value: f.acceptance },
          { label: '사용자 의견', value: item?.note ?? '' },
          {
            label: '동작 대안',
            value: f.options
              .map((o) => o.title + ': ' + o.description)
              .join('\n')
          },
          {
            label: '상태 변화·영향',
            value: [
              ...(item?.effects ?? f.effects ?? []).map((e) =>
                [
                  e.actor + ' · ' + e.action,
                  '조건: ' + e.condition,
                  ...e.transitions.map(
                    (t) => t.target + ': ' + t.before + ' → ' + t.after
                  ),
                  ...e.impacts.map((i) => i.target + ': ' + i.change),
                  '실패: ' + e.failure,
                  '취소: ' + e.cancellation,
                  '미결정: ' + e.unresolved
                ].join('\n')
              ),
              impact
                ? [
                    '기존: ' + impact.before,
                    '변경 후: ' + impact.after,
                    ...impact.invariants.map((i) => '유지: ' + i),
                    ...impact.targets.map((t) => t.target + ': ' + t.change),
                    '조사: ' + impact.reason,
                    '근거: ' + impact.source
                  ].join('\n')
                : '기존 동작 영향 미확인'
            ].join('\n\n')
          },
          {
            label: '관련 결정',
            value: (selection.decisions ?? [])
              .filter((d) => d.featureId === f.id)
              .map((d) => d.question + ' / ' + d.status + ' / ' + d.answer)
              .join('\n')
          },
          { label: '근거', value: f.source }
        ],
        links: scenarios
          .filter((s) => s.steps.some((step) => step.featureId === f.id))
          .map((s) => 'scenario/' + s.id)
      }
    }),
    ...scenarios.map((s) => ({
      key: 'scenario/' + s.id,
      id: s.id,
      kind: 'scenario' as const,
      title: s.title,
      sections: [
        {
          label: '경로 구분',
          value: s.kind === 'normal' ? '정상 경로' : '예외 경로'
        },
        { label: '시작 조건', value: s.precondition },
        { label: '발생 조건', value: s.trigger },
        {
          label: '분기',
          value: s.branch
            ? (scenarios
                .find((n) => n.id === s.branch!.scenarioId)
                ?.steps.find((step) => step.id === s.branch!.stepId)?.title ??
              '분기 확인 필요')
            : ''
        },
        {
          label: '진행 순서',
          value: s.steps
            .map(
              (step, index) =>
                `${index + 1}. ${step.title} (${step.actor})\n${step.description}\n기대 결과: ${step.expected}`
            )
            .join('\n\n')
        },
        { label: '최종 결과', value: s.outcome },
        { label: '복구·다음 행동', value: s.recovery },
        { label: '남은 질문', value: s.unresolved }
      ],
      links: cases
        .filter((c) => c.scenarioId === s.id)
        .map((c) => 'case/' + c.id)
    })),
    ...cases.map((c) => ({
      key: 'case/' + c.id,
      id: c.id,
      kind: 'case' as const,
      title: c.title,
      sections: [
        { label: '발생 조건', value: c.condition },
        { label: '지켜야 할 조건', value: c.invariant },
        { label: '처리 후 상태', value: c.expected },
        { label: '사용자 안내', value: c.feedback },
        { label: '복구·다음 행동', value: c.recovery },
        { label: '검증 방법 · 실행 미검증', value: c.verification },
        {
          label: '점검 관점',
          value: c.axes.map((a) => auditAxes[a]).join(' · ')
        },
        { label: '우선순위 근거', value: c.priority + ' / ' + c.rationale },
        { label: '남은 질문', value: c.question },
        { label: '근거', value: c.source }
      ],
      links: []
    }))
  ]
}
export function reviewSnapshot(item: ReviewItem) {
  return JSON.stringify({
    title: item.title,
    sections: item.sections,
    links: item.links
  })
}
export function reviewStatus(item: ReviewItem, reviews: ContentReview[]) {
  const review = reviews.find((r) => r.key === item.key)
  return !review
    ? 'new'
    : review.snapshot !== reviewSnapshot(item)
      ? 'stale'
      : review.status
}
export function reviewDiff(item: ReviewItem, previous?: ContentReview) {
  if (!previous) return []
  try {
    const old = JSON.parse(previous.snapshot) as {
      title: string
      sections: ReviewItem['sections']
      links: string[]
    }
    const before = [
      { label: '제목', value: old.title },
      ...old.sections,
      { label: '연결 항목', value: old.links.join('\n') }
    ]
    const after = [
      { label: '제목', value: item.title },
      ...item.sections,
      { label: '연결 항목', value: item.links.join('\n') }
    ]
    return [...new Set([...before, ...after].map((s) => s.label))]
      .map((label) => ({
        label,
        before: before.find((s) => s.label === label)?.value ?? '',
        after: after.find((s) => s.label === label)?.value ?? ''
      }))
      .filter((row) => row.before !== row.after)
  } catch {
    return [
      {
        label: '이전 내용',
        before: '이전 내용을 읽을 수 없습니다.',
        after: '현재 내용을 다시 검토하세요.'
      }
    ]
  }
}
export function setContentReview(
  reviews: ContentReview[],
  item: ReviewItem,
  status: ContentReview['status'],
  note: string,
  at = new Date().toISOString()
) {
  if (status === 'changes' && !note.trim())
    throw new Error('수정할 내용과 이유를 적어주세요.')
  const entry = {
    key: item.key,
    status,
    snapshot: reviewSnapshot(item),
    note,
    at
  }
  return [...reviews.filter((r) => r.key !== item.key), entry]
}
export function parseContentReviews(input: unknown): ContentReview[] {
  if (!Array.isArray(input) || input.length > 512)
    throw new Error('내용 검토 기록은 최대 512개입니다.')
  const keys = new Set<string>()
  return input.map((raw) => {
    if (
      !raw ||
      typeof raw !== 'object' ||
      typeof raw.key !== 'string' ||
      !/^(overview|requirement|feature|scenario|case)\/[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(
        raw.key
      ) ||
      raw.key.length > 100 ||
      keys.has(raw.key)
    )
      throw new Error('내용 검토 항목 ID를 확인하세요.')
    if (
      !['accepted', 'changes', 'deferred'].includes(raw.status) ||
      typeof raw.snapshot !== 'string' ||
      raw.snapshot.length > 100000 ||
      typeof raw.note !== 'string' ||
      raw.note.length > 4000 ||
      typeof raw.at !== 'string' ||
      !Number.isFinite(Date.parse(raw.at))
    )
      throw new Error('내용 검토 기록을 확인하세요.')
    const snapshot = JSON.parse(raw.snapshot)
    if (
      !snapshot ||
      typeof snapshot.title !== 'string' ||
      !Array.isArray(snapshot.sections) ||
      snapshot.sections.length > 32 ||
      !snapshot.sections.every(
        (s: unknown) =>
          s &&
          typeof s === 'object' &&
          typeof (s as { label: unknown }).label === 'string' &&
          typeof (s as { value: unknown }).value === 'string'
      ) ||
      !Array.isArray(snapshot.links) ||
      !snapshot.links.every((link: unknown) => typeof link === 'string')
    )
      throw new Error('검토한 내용의 스냅샷을 확인하세요.')
    if (raw.status === 'changes' && !raw.note.trim())
      throw new Error('수정 요청에는 의견이 필요합니다.')
    keys.add(raw.key)
    return {
      key: raw.key,
      status: raw.status,
      snapshot: raw.snapshot,
      note: raw.note,
      at: raw.at
    }
  })
}
export function nextUnreviewed(
  items: ReviewItem[],
  reviews: ContentReview[],
  current: string
) {
  const index = items.findIndex((item) => item.key === current)
  return [...items.slice(index + 1), ...items.slice(0, index)].find((item) =>
    ['new', 'stale'].includes(reviewStatus(item, reviews))
  )?.key
}
