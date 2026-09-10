import type { Plan, Selection } from './types'
export const auditAxes = {
  access: '권한·주체',
  state: '상태·완료',
  input: '입력·경계',
  time: '시간·만료',
  concurrency: '동시 처리',
  failure: '부분 실패',
  recovery: '재시도·중단',
  propagation: '다른 화면·업무',
  experience: '안내·사용 경험'
} as const
export type AuditAxis = keyof typeof auditAxes
export const auditStatuses = {
  cases: '사례 발견',
  na: '해당 없음',
  policy: '정책 미정',
  unknown: '미조사'
} as const
export interface AuditRequirement {
  id: string
  text: string
  source: string
  featureIds: string[]
  scenarioIds: string[]
}
export interface ChangeImpact {
  featureId: string
  status: 'mapped' | 'na' | 'unknown'
  before: string
  after: string
  invariants: string[]
  targets: { target: string; change: string; source: string }[]
  reason: string
  source: string
}
export interface EdgeCase {
  id: string
  title: string
  scenarioId: string
  stepId: string
  axes: AuditAxis[]
  condition: string
  invariant: string
  expected: string
  feedback: string
  recovery: string
  verification: string
  source: string
  priority: 'high' | 'medium' | 'low'
  rationale: string
  question: string
}
export interface AuditCheck {
  scenarioId: string
  stepId: string
  axis: AuditAxis
  status: keyof typeof auditStatuses
  reason: string
  caseIds: string[]
}
export interface PlanningAudit {
  requirements: AuditRequirement[]
  impacts: ChangeImpact[]
  checks: AuditCheck[]
  cases: EdgeCase[]
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('점검 데이터는 객체여야 합니다.')
  return value as Record<string, unknown>
}
const text = (value: unknown, max = 2000, required = false): string => {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Error('점검 근거와 필수 항목을 확인하세요.')
  return value
}
const list = (value: unknown, max: number): unknown[] => {
  if (!Array.isArray(value) || value.length > max)
    throw new Error('점검 목록의 형식과 개수를 확인하세요.')
  return value
}
const id = (value: unknown) => {
  const result = text(value, 80, true)
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(result))
    throw new Error('점검 ID가 올바르지 않습니다.')
  return result
}
const unique = (ids: string[]) => {
  if (new Set(ids).size !== ids.length) throw new Error('중복 점검 항목입니다.')
}
export function parseAudit(
  input: unknown,
  features: Plan['features'],
  scenarios: NonNullable<Plan['scenarios']>
): PlanningAudit {
  const raw = object(input)
  const stepRef = (raw: Record<string, unknown>) => {
    const scenarioId = id(raw.scenarioId),
      stepId = id(raw.stepId)
    if (
      !scenarios
        .find((s) => s.id === scenarioId)
        ?.steps.some((step) => step.id === stepId)
    )
      throw new Error('점검의 시나리오·단계 연결을 확인하세요.')
    return { scenarioId, stepId }
  }
  const axis = (value: unknown): AuditAxis => {
    if (typeof value !== 'string' || !Object.hasOwn(auditAxes, value))
      throw new Error('점검 관점을 확인하세요.')
    return value as AuditAxis
  }
  const requirements = list(raw.requirements, 80).map((value) => {
    const row = object(value),
      featureIds = list(row.featureIds, 60).map(id),
      scenarioIds = list(row.scenarioIds, 16).map(id)
    unique(featureIds)
    unique(scenarioIds)
    if (
      featureIds.some((id) => !features.some((f) => f.id === id)) ||
      scenarioIds.some(
        (id) => !scenarios.some((s) => s.id === id && s.kind === 'normal')
      )
    )
      throw new Error('요구사항의 기능·정상 흐름 연결을 확인하세요.')
    return {
      id: id(row.id),
      text: text(row.text, 2000, true),
      source: text(row.source, 1000, true),
      featureIds,
      scenarioIds
    }
  })
  unique(requirements.map((row) => row.id))
  const impacts = list(raw.impacts, 60).map((value) => {
    const row = object(value),
      featureId = id(row.featureId)
    if (
      !features.some((f) => f.id === featureId) ||
      !['mapped', 'na', 'unknown'].includes(String(row.status))
    )
      throw new Error('기능 영향 점검을 확인하세요.')
    const before = text(row.before),
      after = text(row.after),
      source = text(row.source, 1000),
      reason = text(row.reason)
    const invariants = list(row.invariants, 12).map((value) =>
      text(value, 1000, true)
    )
    const targets = list(row.targets, 12).map((value) => {
      const target = object(value)
      return {
        target: text(target.target, 300, true),
        change: text(target.change, 2000, true),
        source: text(target.source, 1000, true)
      }
    })
    if (
      row.status === 'mapped' &&
      (!before.trim() ||
        !after.trim() ||
        !invariants.length ||
        !targets.length ||
        !source.trim())
    )
      throw new Error(
        '영향 정리에는 이전·이후 동작, 유지 조건, 영향 대상과 근거가 필요합니다.'
      )
    if (row.status === 'na' && (!reason.trim() || !source.trim()))
      throw new Error('영향 없음에는 이유와 조사 근거가 필요합니다.')
    return {
      featureId,
      status: row.status as ChangeImpact['status'],
      before,
      after,
      source,
      reason,
      invariants,
      targets
    }
  })
  unique(impacts.map((row) => row.featureId))
  const cases = list(raw.cases, 256).map((value) => {
    const row = object(value),
      axes = list(row.axes, 9).map(axis)
    if (!axes.length) throw new Error('상세 사례에 점검 관점이 필요합니다.')
    unique(axes)
    if (!['high', 'medium', 'low'].includes(String(row.priority)))
      throw new Error('사례 우선순위를 확인하세요.')
    return {
      id: id(row.id),
      title: text(row.title, 300, true),
      ...stepRef(row),
      axes,
      condition: text(row.condition, 2000, true),
      invariant: text(row.invariant),
      expected: text(row.expected),
      feedback: text(row.feedback),
      recovery: text(row.recovery),
      verification: text(row.verification),
      source: text(row.source, 1000, true),
      priority: row.priority as EdgeCase['priority'],
      rationale: text(row.rationale, 1000, true),
      question: text(row.question, 1000)
    }
  })
  unique(cases.map((row) => row.id))
  const checks = list(raw.checks, 2304).map((value) => {
    const row = object(value),
      ref = stepRef(row),
      dimension = axis(row.axis)
    if (!Object.hasOwn(auditStatuses, String(row.status)))
      throw new Error('점검 상태를 확인하세요.')
    const caseIds = list(row.caseIds, 256).map(id),
      reason = text(row.reason)
    unique(caseIds)
    if (
      caseIds.some(
        (id) =>
          !cases.some(
            (c) =>
              c.id === id &&
              c.scenarioId === ref.scenarioId &&
              c.stepId === ref.stepId &&
              c.axes.includes(dimension)
          )
      )
    )
      throw new Error('다른 단계·관점의 사례를 점검 근거로 연결할 수 없습니다.')
    if (row.status === 'cases' && !caseIds.length)
      throw new Error('사례 발견에는 연결된 상세 사례가 필요합니다.')
    if (['na', 'policy'].includes(String(row.status)) && !reason.trim())
      throw new Error('해당 없음·정책 미정에는 근거가 필요합니다.')
    if (
      row.status === 'na' &&
      (caseIds.length ||
        cases.some(
          (c) =>
            c.scenarioId === ref.scenarioId &&
            c.stepId === ref.stepId &&
            c.axes.includes(dimension)
        ))
    )
      throw new Error('사례가 있는 관점을 해당 없음으로 처리할 수 없습니다.')
    return {
      ...ref,
      axis: dimension,
      status: row.status as AuditCheck['status'],
      reason,
      caseIds
    }
  })
  unique(
    checks.map((row) => row.scenarioId + '/' + row.stepId + '/' + row.axis)
  )
  return { requirements, impacts, checks, cases }
}
export function auditRows(plan: Plan) {
  const recorded = new Map(
    (plan.audit?.checks ?? []).map((row) => [
      row.scenarioId + '/' + row.stepId + '/' + row.axis,
      row
    ])
  )
  return (plan.scenarios ?? []).flatMap((scenario) =>
    scenario.steps.flatMap((step) =>
      (Object.keys(auditAxes) as AuditAxis[]).map((axis) => {
        const check = recorded.get(scenario.id + '/' + step.id + '/' + axis)
        return {
          scenario,
          step,
          axis,
          check,
          status: check?.status ?? ('unknown' as const)
        }
      })
    )
  )
}
export function auditCoverage(plan: Plan, selection: Selection) {
  const active = (id: string) =>
    !['exclude', 'later'].includes(
      selection.items.find((item) => item.id === id)?.choice ?? 'undecided'
    )
  const features = plan.features.filter((f) => active(f.id))
  const normal = (plan.scenarios ?? []).filter((s) => s.kind === 'normal')
  return {
    missingFlows: features.filter(
      (f) =>
        !normal.some((s) => s.steps.some((step) => step.featureId === f.id))
    ),
    missingImpacts: features.filter(
      (f) =>
        !plan.audit?.impacts.some(
          (impact) => impact.featureId === f.id && impact.status !== 'unknown'
        )
    ),
    missingRequirements: (plan.audit?.requirements ?? []).filter((req) => {
      if (req.featureIds.length && !req.featureIds.some(active)) return false
      return (
        !req.featureIds.length ||
        !req.scenarioIds.length ||
        req.featureIds
          .filter(active)
          .some(
            (id) =>
              !normal.some(
                (s) =>
                  req.scenarioIds.includes(s.id) &&
                  s.steps.some((step) => step.featureId === id)
              )
          )
      )
    }),
    unreviewed: auditRows(plan).filter((row) => row.status === 'unknown')
      .length,
    policy: auditRows(plan).filter((row) => row.status === 'policy').length,
    requirementsMissing: !plan.audit?.requirements.length
  }
}
export function incompleteCase(row: EdgeCase) {
  return [
    'invariant',
    'expected',
    'feedback',
    'recovery',
    'verification'
  ].filter((key) => !row[key as keyof EdgeCase]?.length)
}
export function auditMarkdown(plan: Plan, selection: Selection) {
  const coverage = auditCoverage(plan, selection)
  const lines = [
    '## 범위·영향·예외 점검',
    '',
    '기획 점검 기록이며 실제 테스트 완료나 누락 없음의 보장이 아닙니다.',
    '',
    `- 흐름 미작성: ${coverage.missingFlows.map((f) => f.title).join(', ') || '없음'}`,
    `- 영향 미확인: ${coverage.missingImpacts.map((f) => f.title).join(', ') || '없음'}`,
    `- 전체 단계 관점 미조사: ${coverage.unreviewed} · 정책 미정: ${coverage.policy}`,
    `- 요구사항 추적: ${coverage.requirementsMissing ? '미작성' : '작성됨'}`,
    ''
  ]
  for (const req of plan.audit?.requirements ?? [])
    lines.push(
      '### 요구: ' + req.text,
      '- 근거: ' + req.source,
      '- 기능: ' + (req.featureIds.join(', ') || '미연결'),
      '- 정상 흐름: ' + (req.scenarioIds.join(', ') || '미연결'),
      ''
    )
  for (const impact of plan.audit?.impacts ?? [])
    lines.push(
      '### 기존 동작 영향: ' + impact.featureId,
      '- 상태: ' + impact.status,
      '- 이전: ' + (impact.before || '미정'),
      '- 이후: ' + (impact.after || '미정'),
      '- 유지 조건: ' + impact.invariants.join(' / '),
      ...impact.targets.map(
        (t) =>
          '- 영향 대상: ' +
          t.target +
          ' — ' +
          t.change +
          ' (근거: ' +
          t.source +
          ')'
      ),
      '- 조사 근거: ' + impact.source,
      '- 남은 확인: ' + impact.reason,
      ''
    )
  for (const row of auditRows(plan))
    lines.push(
      `- ${row.scenario.title} / ${row.step.title} / ${auditAxes[row.axis]}: ${auditStatuses[row.status]} — ${row.check?.reason || '점검 기록 없음'}`
    )
  for (const c of plan.audit?.cases ?? [])
    lines.push(
      '',
      '### 상세 사례: ' + c.title,
      `- 연결: ${c.scenarioId} / ${c.stepId}`,
      '- 관점: ' + c.axes.map((a) => auditAxes[a]).join(', '),
      '- 발생 조건: ' + c.condition,
      '- 유지 조건: ' + (c.invariant || '미정'),
      '- 처리 후 상태: ' + (c.expected || '미정'),
      '- 사용자 안내: ' + (c.feedback || '미정'),
      '- 복구·다음 행동: ' + (c.recovery || '미정'),
      '- 검증 방법: ' + (c.verification || '미정'),
      '- 우선순위: ' + c.priority + ' — ' + c.rationale,
      '- 근거: ' + c.source,
      '- 남은 질문: ' + c.question
    )
  return lines.join('\n')
}
