import { applicableEffects } from './types'
import type { Plan, Scenario, ScenarioStep, Selection } from './types'

// A branch occurs before its source step succeeds. Never carry that step's
// success transition into the exception path.
export function scenarioPath(scenarios: Scenario[], scenario: Scenario) {
  const source = scenarios.find(
    (entry) => entry.id === scenario.branch?.scenarioId
  )
  const forkIndex =
    source?.steps.findIndex((step) => step.id === scenario.branch?.stepId) ?? -1
  return {
    prefix: source && forkIndex >= 0 ? source.steps.slice(0, forkIndex) : [],
    fork: source && forkIndex >= 0 ? source.steps[forkIndex] : null,
    steps: scenario.steps
  }
}
export function stepEffect(
  plan: Plan,
  selection: Selection,
  step: ScenarioStep
) {
  const feature = plan.features.find((feature) => feature.id === step.featureId)
  const item = selection.items.find((item) => item.id === step.featureId)
  if (!feature || !item || item.choice !== 'include') return undefined
  return applicableEffects(feature, item).find(
    (effect) => effect.id === step.effectId
  )
}
export function scenarioIssues(
  plan: Plan,
  selection: Selection,
  scenario: Scenario
) {
  const path = scenarioPath(plan.scenarios ?? [], scenario)
  const issues = new Set<string>()
  if (scenario.branch && !path.fork)
    issues.add('분기 기준 단계가 변경되어 경로를 다시 확인해야 합니다.')
  for (const step of [
    ...path.prefix,
    ...(path.fork ? [path.fork] : []),
    ...path.steps
  ]) {
    if (!step.featureId) continue
    const feature = plan.features.find(
      (feature) => feature.id === step.featureId
    )
    const item = selection.items.find((item) => item.id === step.featureId)
    if (!feature || !item) {
      issues.add(step.title + ': 관련 기능이 변경되었습니다.')
    } else if (item.choice !== 'include') {
      issues.add(
        feature.title + ': 이번 범위에 포함되지 않았거나 범위가 미정입니다.'
      )
    } else if (step.effectId && !stepEffect(plan, selection, step)) {
      issues.add(
        step.title + ': 연결된 행동이 현재 동작 선택 또는 편집 내용과 다릅니다.'
      )
    } else if (
      step.effectId &&
      item.effects !== undefined &&
      JSON.stringify(
        item.effects.find((effect) => effect.id === step.effectId)
      ) !==
        JSON.stringify(
          feature.effects?.find((effect) => effect.id === step.effectId)
        )
    ) {
      issues.add(
        step.title +
          ': 연결 행동을 편집했습니다. 시나리오의 순서와 기대 결과도 함께 확인하세요.'
      )
    }
  }
  return [...issues]
}
