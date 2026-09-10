import { describe, it, expect } from 'vitest'
import seed from '../../plans/plan-42a3a371.json'
import { parsePlan } from './schema'
import {
  featureStructure,
  scenarioDetails,
  structureLocation,
  featureLabel
} from './structure-outline'
const plan = parsePlan(seed)
describe('progressive structure navigation', () => {
  it('uses concise existing group labels and keeps the full title when a group is shared', () => {
    expect(featureLabel(plan, 'assessment-action')).toBe('검사 진행')
    const shared = structuredClone(plan)
    shared.features[1].group = shared.features[0].group
    expect(featureLabel(shared, shared.features[0].id)).toBe(
      shared.features[0].title
    )
  })
  it('shows normal paths for one feature and obtains exceptions only from the chosen path', () => {
    const group = featureStructure(plan, 'assessment-action')
    expect(group.normals.map((s) => s.id)).toContain('assessment-happy-path')
    expect(group.normals.map((s) => s.id)).not.toContain('schedule-happy-path')
    const details = scenarioDetails(
      plan,
      group.normals.find((s) => s.id === 'assessment-happy-path')!
    )
    expect(details.exceptions.map((s) => s.id)).toContain('submission-unknown')
    expect(details.exceptions.map((s) => s.id)).not.toContain(
      'approval-conflict'
    )
    expect(
      details.cases.every((c) => c.scenarioId === 'assessment-happy-path')
    ).toBe(true)
  })
  it('locates a reviewed case through its exception branch without losing the current valid feature', () => {
    const changed = structuredClone(plan)
    const failure = changed.scenarios!.find(s => s.id === 'submission-unknown')!
    const entry = { ...changed.audit!.cases[0], id: 'exception-case', scenarioId: failure.id, stepId: failure.steps[0].id }
    changed.audit!.cases.push(entry)
    expect(
      structureLocation(changed, 'case/' + entry.id, 'assessment-action')
    ).toEqual({
      featureId: 'assessment-action',
      scenarioId: 'assessment-happy-path',
      exceptionId: 'submission-unknown'
    })
    expect(structureLocation(plan, 'overview/' + plan.id)).toBeNull()
    expect(structureLocation(plan, 'case/does-not-exist')).toBeNull()
  })
  it('does not drop standalone exceptions or invent a feature link for an orphan path', () => {
    const changed = structuredClone(plan)
    const failure = changed.scenarios!.find(
      (s) => s.id === 'submission-unknown'
    )!
    delete failure.branch
    const featureId = failure.steps.find((s) => s.featureId)!.featureId
    expect(
      featureStructure(changed, featureId).standalone.map((s) => s.id)
    ).toContain(failure.id)
    expect(
      structureLocation(changed, 'scenario/' + failure.id, featureId)
        ?.scenarioId
    ).toBe(failure.id)
    const orphan = changed.scenarios![0]
    for (const step of orphan.steps) step.featureId = ''
    changed.scenarios = [orphan]
    expect(structureLocation(changed, 'scenario/' + orphan.id)?.featureId).toBe(
      ''
    )
  })
})
