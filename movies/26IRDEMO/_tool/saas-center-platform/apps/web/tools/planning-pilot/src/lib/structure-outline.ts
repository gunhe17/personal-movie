import type { Plan, Scenario } from './types'

export function featureStructure(plan: Plan, featureId: string) {
  const scenarios = plan.scenarios ?? []
  const direct = scenarios.filter((s) =>
    s.steps.some((step) => step.featureId === featureId)
  )
  // Branch ancestry supplies navigation context, never a new feature requirement.
  const normals = scenarios.filter(
    (s) =>
      s.kind === 'normal' &&
      (direct.some((d) => d.id === s.id) ||
        direct.some((d) => d.branch?.scenarioId === s.id))
  )
  const standalone = direct.filter((s) => s.kind === 'exception' && !s.branch)
  return {
    normals,
    standalone,
    requirements: (plan.audit?.requirements ?? []).filter((r) =>
      r.featureIds.includes(featureId)
    )
  }
}

export function scenarioDetails(plan: Plan, scenario: Scenario) {
  return {
    exceptions: (plan.scenarios ?? []).filter(
      (s) => s.kind === 'exception' && s.branch?.scenarioId === scenario.id
    ),
    cases: (plan.audit?.cases ?? []).filter((c) => c.scenarioId === scenario.id)
  }
}

export function structureLocation(
  plan: Plan,
  key: string,
  preferredFeature = ''
) {
  const [kind, id] = key.split('/')
  if (kind === 'feature')
    return { featureId: id, scenarioId: '', exceptionId: '' }
  const selectedScenario =
    kind === 'case'
      ? (plan.audit?.cases ?? []).find((c) => c.id === id)?.scenarioId
      : kind === 'scenario'
        ? id
        : undefined
  const scenario = plan.scenarios?.find((s) => s.id === selectedScenario)
  if (!scenario) return null
  const normalId = scenario.branch?.scenarioId ?? scenario.id
  const candidates = plan.features.filter((f) => {
    const branch = featureStructure(plan, f.id)
    return (
      branch.normals.some((s) => s.id === normalId) ||
      branch.standalone.some((s) => s.id === normalId)
    )
  })
  const directCandidates = candidates.filter((f) =>
    scenario.steps.some((step) => step.featureId === f.id)
  )
  const featureId =
    candidates.find((f) => f.id === preferredFeature)?.id ??
    directCandidates[0]?.id ??
    candidates[0]?.id ??
    ''
  return {
    featureId,
    scenarioId: normalId,
    exceptionId:
      scenario.kind === 'exception' && scenario.branch ? scenario.id : ''
  }
}

export function featureLabel(plan: Plan, featureId: string) {
  const feature = plan.features.find((f) => f.id === featureId)!
  const group = feature.group.replace(/^\d+[.\s-]*/, '').trim()
  return group &&
    plan.features.filter((f) => f.group === feature.group).length === 1
    ? group
    : feature.title
}
