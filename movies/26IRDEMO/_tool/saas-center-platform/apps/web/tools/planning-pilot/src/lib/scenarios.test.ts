import { describe, expect, it } from 'vitest'
import seed from '../../plans/plan-42a3a371.json'
import { parsePlan, restoreDraft } from './schema'
import { scenarioPath, scenarioIssues, stepEffect } from './scenarios'

const plan = parsePlan(seed)
function selected() {
  const draft = restoreDraft(null, plan)
  for (const item of draft.items) item.choice = 'include'
  draft.items.find((item) => item.id === 'schedule-change')!.behavior =
    'approval'
  return draft
}

describe('scenario paths', () => {
  it('branches before the normal success state rather than appending a failure after approval', () => {
    const scenario = plan.scenarios!.find(
      (entry) => entry.id === 'approval-conflict'
    )!
    const path = scenarioPath(plan.scenarios!, scenario)
    expect(path.prefix.map((step) => step.id)).toEqual([
      'authenticate',
      'view-schedule',
      'submit-request'
    ])
    expect(path.fork?.id).toBe('approve-request')
    expect(
      [...path.prefix, ...path.steps].some(
        (step) => step.effectId === 'approve-change'
      )
    ).toBe(false)
    expect(scenarioIssues(plan, selected(), scenario)).toEqual([])
  })
  it('keeps rejection separate from approval and reads edited states through the existing action link', () => {
    const rejection = plan.scenarios!.find(
      (entry) => entry.id === 'request-rejected'
    )!
    const draft = selected()
    const feature = plan.features.find(
      (feature) => feature.id === 'schedule-change'
    )!
    const item = draft.items.find((item) => item.id === feature.id)!
    item.effects = structuredClone(feature.effects!)
    item.effects.find(
      (effect) => effect.id === 'reject-change'
    )!.impacts[0].change = '사용자가 수정한 안내'
    const linked = stepEffect(plan, draft, rejection.steps[0])!
    expect(linked.transitions[1].after).toBe('기존 일정 유지')
    expect(linked.impacts[0].change).toBe('사용자가 수정한 안내')
    expect(scenarioIssues(plan, draft, rejection).join(' ')).toContain(
      '연결 행동을 편집'
    )
    item.behavior = 'instant'
    expect(stepEffect(plan, draft, rejection.steps[0])).toBeUndefined()
    expect(scenarioIssues(plan, draft, rejection).length).toBeGreaterThan(0)
    item.behavior = 'approval'
    item.choice = 'exclude'
    expect(stepEffect(plan, draft, rejection.steps[0])).toBeUndefined()
    expect(scenarioIssues(plan, draft, rejection).join(' ')).toContain(
      '이번 범위'
    )
  })
  it('rejects missing steps, cross-feature action references and recursive exception branches', () => {
    const broken = structuredClone(plan)
    const exception = broken.scenarios!.find(
      (entry) => entry.kind === 'exception'
    )!
    exception.branch!.stepId = 'missing'
    expect(() => parsePlan(broken)).toThrow('분기')
    exception.branch!.stepId = 'authenticate'
    exception.branch!.scenarioId = exception.id
    expect(() => parsePlan(broken)).toThrow('분기')
    const invalid = structuredClone(plan)
    invalid.scenarios![0].steps[0].effectId = 'approve-change'
    expect(() => parsePlan(invalid)).toThrow('기능·행동')
    invalid.scenarios![0].steps = []
    expect(() => parsePlan(invalid)).toThrow('단계가 하나 이상')
  })
  it('preserves legacy plans without fabricating a happy path from action order', () => {
    const legacy = structuredClone(plan)
    delete legacy.audit
    delete legacy.scenarios
    expect(parsePlan(legacy).scenarios).toBeUndefined()
    const exception = plan.scenarios!.find(
      (entry) => entry.kind === 'exception'
    )!
    expect(scenarioPath([], exception).prefix).toEqual([])
    expect(scenarioPath([], exception).fork).toBeNull()
  })
})
