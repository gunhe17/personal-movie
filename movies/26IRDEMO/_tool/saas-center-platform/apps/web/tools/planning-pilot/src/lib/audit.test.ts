import { describe, it, expect } from 'vitest'
import seed from '../../plans/plan-42a3a371.json'
import { parsePlan, restoreDraft } from './schema'
import {
  auditCoverage,
  auditRows,
  incompleteCase,
  auditMarkdown
} from './audit'
const plan = parsePlan(seed)
const included = () => {
  const draft = restoreDraft(null, plan)
  for (const item of draft.items) item.choice = 'include'
  return draft
}
describe('planning audit completeness', () => {
  it('detects the original missing assessment flows without mistaking excluded scope for a gap', () => {
    const old = structuredClone(plan)
    old.scenarios = old.scenarios!.filter((s) => s.id === 'schedule-happy-path')
    delete old.audit
    const draft = included()
    expect(auditCoverage(old, draft).missingFlows.map((f) => f.id)).toEqual(
      expect.arrayContaining([
        'assessment-action',
        'assessment-resume',
        'all-assessments'
      ])
    )
    expect(auditCoverage(old, draft).requirementsMissing).toBe(true)
    draft.items.find((item) => item.id === 'assessment-resume')!.choice =
      'exclude'
    expect(
      auditCoverage(old, draft).missingFlows.map((f) => f.id)
    ).not.toContain('assessment-resume')
  })
  it('covers all active features with normal paths while keeping untraced result access and unknown impacts visible', () => {
    const coverage = auditCoverage(plan, included())
    expect(coverage.missingFlows).toEqual([])
    expect(coverage.missingRequirements.map((r) => r.id)).toContain(
      'result-access'
    )
    expect(coverage.missingImpacts.map((f) => f.id)).toContain(
      'schedule-change'
    )
    expect(coverage.unreviewed).toBeGreaterThan(0)
    expect(coverage.policy).toBeGreaterThan(0)
    const assessment = plan.scenarios!.find(
      (s) => s.id === 'assessment-happy-path'
    )!
    expect(assessment.steps.map((s) => s.id)).toContain('submit-answers')
    expect(
      assessment.steps.some((s) => s.featureId === 'schedule-change')
    ).toBe(false)
  })
  it('expands all nine perspectives for every step and never infers review from an existing scenario or case', () => {
    const rows = auditRows(plan)
    expect(rows).toHaveLength(
      plan.scenarios!.reduce((sum, s) => sum + s.steps.length, 0) * 9
    )
    const legacy = structuredClone(plan)
    delete legacy.audit
    expect(auditRows(legacy).every((row) => row.status === 'unknown')).toBe(
      true
    )
    expect(
      incompleteCase(
        plan.audit!.cases.find((c) => c.id === 'submit-response-lost')!
      )
    ).toContain('expected')
    const missing = structuredClone(plan)
    missing.audit!.checks = []
    expect(auditRows(missing).every((row) => row.status === 'unknown')).toBe(
      true
    )
  })
  it('rejects false no-impact and not-applicable declarations and mismatched evidence', () => {
    const noImpact = structuredClone(plan)
    noImpact.audit!.impacts[0].status = 'na'
    noImpact.audit!.impacts[0].source = ''
    expect(() => parsePlan(noImpact)).toThrow('이유와 조사 근거')
    const na = structuredClone(plan)
    na.audit!.checks[0].status = 'na'
    expect(() => parsePlan(na)).toThrow('해당 없음')
    const cross = structuredClone(plan)
    cross.audit!.checks[0].caseIds = ['submit-response-lost']
    expect(() => parsePlan(cross)).toThrow('다른 단계')
    const duplicate = structuredClone(plan)
    duplicate.audit!.checks.push(duplicate.audit!.checks[0])
    expect(() => parsePlan(duplicate)).toThrow('중복')
    const disconnected = structuredClone(plan)
    disconnected.audit!.requirements[0].scenarioIds = ['missing-path']
    expect(() => parsePlan(disconnected)).toThrow('정상 흐름 연결')
  })
  it('exports reasons, unknowns, impact chains and recovery criteria without marking cases tested', () => {
    const md = auditMarkdown(plan, included())
    expect(md).toContain('실제 테스트 완료나 누락 없음의 보장이 아닙니다')
    expect(md).toContain('미조사')
    expect(md).toContain('기존 동작 영향: assessment-resume')
    expect(md).toContain('서버 상태 확인 후 완료 또는 재시도')
    expect(md).toContain('결과를 나중에 확인')
  })
})
