import { parseContentReviews } from './content-review'
import { parseAudit } from './audit'
import type {
  Plan,
  Selection,
  Scope,
  Attachment,
  ActionEffect,
  Scenario
} from './types'
import {
  ownerLabels,
  decisionLabels,
  type FollowUp,
  type Decision
} from './types'
export const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const attachmentPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.](png|jpg)$/
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('객체 형식이 필요합니다.')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 4000, required = false): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Error('문자열 길이나 필수 항목을 확인하세요.')
  return value
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error('목록 형식이나 항목 수를 확인하세요.')
  return value
}
function id(value: unknown): string {
  const result = text(value, 80, true)
  if (!safeId.test(result))
    throw new Error('ID는 영문 소문자·숫자·하이픈으로 입력하세요.')
  return result
}
function key(value: unknown): string {
  const result = text(value, 80, true)
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(result))
    throw new Error('항목 ID가 올바르지 않습니다.')
  return result
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new Error('중복된 ID가 있습니다.')
}
export function parseScenarios(
  input: unknown,
  features: Plan['features']
): Scenario[] {
  const scenarios = array(input, 16).map((raw) => {
    const value = object(raw)
    if (!['normal', 'exception'].includes(String(value.kind)))
      throw new Error('시나리오 종류를 확인하세요.')
    const steps = array(value.steps, 16).map((rawStep) => {
      const step = object(rawStep)
      const featureId = step.featureId === '' ? '' : key(step.featureId)
      const effectId = step.effectId === '' ? '' : key(step.effectId)
      const feature = features.find((entry) => entry.id === featureId)
      if (
        (featureId && !feature) ||
        (effectId &&
          !feature?.effects?.some((effect) => effect.id === effectId))
      )
        throw new Error('시나리오 단계의 기능·행동 연결을 확인하세요.')
      return {
        id: key(step.id),
        title: text(step.title, 300, true),
        actor: text(step.actor, 300),
        description: text(step.description, 2000),
        expected: text(step.expected, 2000),
        featureId,
        effectId
      }
    })
    if (!steps.length)
      throw new Error('시나리오에는 단계가 하나 이상 필요합니다.')
    unique(steps.map((step) => step.id))
    const branch = value.branch === undefined ? undefined : object(value.branch)
    if (branch && value.kind !== 'exception')
      throw new Error('예외 시나리오만 분기할 수 있습니다.')
    return {
      id: key(value.id),
      title: text(value.title, 300, true),
      kind: value.kind as Scenario['kind'],
      precondition: text(value.precondition, 2000),
      trigger: text(value.trigger, 1000),
      ...(branch
        ? {
            branch: {
              scenarioId: key(branch.scenarioId),
              stepId: key(branch.stepId)
            }
          }
        : {}),
      steps,
      outcome: text(value.outcome, 2000),
      recovery: text(value.recovery, 2000),
      unresolved: text(value.unresolved, 1000)
    }
  })
  unique(scenarios.map((scenario) => scenario.id))
  for (const scenario of scenarios) {
    if (!scenario.branch) continue
    const source = scenarios.find(
      (entry) => entry.id === scenario.branch!.scenarioId
    )
    if (
      !source ||
      source.kind !== 'normal' ||
      !source.steps.some((step) => step.id === scenario.branch!.stepId)
    )
      throw new Error(
        '예외 경로는 정상 시나리오의 존재하는 단계에서 분기해야 합니다.'
      )
  }
  return scenarios
}
export function parseEffects(input: unknown): ActionEffect[] {
  const effects = array(input, 12).map((raw) => {
    const value = object(raw)
    return {
      id: key(value.id),
      optionId: value.optionId === '' ? '' : key(value.optionId),
      actor: text(value.actor, 300),
      action: text(value.action, 500),
      condition: text(value.condition, 1000),
      transitions: array(value.transitions, 8).map((raw) => {
        const row = object(raw)
        return {
          target: text(row.target, 300),
          before: text(row.before, 500),
          after: text(row.after, 500)
        }
      }),
      impacts: array(value.impacts, 8).map((raw) => {
        const row = object(raw)
        return { target: text(row.target, 300), change: text(row.change, 1000) }
      }),
      failure: text(value.failure, 1000),
      cancellation: text(value.cancellation, 1000),
      unresolved: text(value.unresolved, 1000)
    }
  })
  unique(effects.map((effect) => effect.id))
  return effects
}
function parseFollowUp(input: unknown): FollowUp {
  const value = object(input)
  if (
    typeof value.owner !== 'string' ||
    !Object.hasOwn(ownerLabels, value.owner)
  )
    throw new Error('결정 담당 구분이 올바르지 않습니다.')
  if (typeof value.blocking !== 'boolean')
    throw new Error('선행 결정 여부가 필요합니다.')
  return {
    id: key(value.id),
    question: text(value.question, 1000, true),
    context: text(value.context, 4000),
    featureId: value.featureId ? key(value.featureId) : '',
    owner: value.owner as FollowUp['owner'],
    blocking: value.blocking
  }
}
export function parseFollowUps(input: unknown, plan: Plan): FollowUp[] {
  const values = array(object(input).followUps, 60).map(parseFollowUp)
  unique(values.map((value) => value.id))
  if (
    values.some(
      (value) =>
        value.featureId &&
        !plan.features.some((feature) => feature.id === value.featureId)
    )
  )
    throw new Error('후속 질문의 관련 항목을 확인하세요.')
  return values
}
export function parseDecisions(input: unknown): Decision[] {
  const values = array(input ?? [], 60).map((raw) => {
    const value = object(raw)
    const question = parseFollowUp(raw)
    if (
      typeof value.status !== 'string' ||
      !Object.hasOwn(decisionLabels, value.status)
    )
      throw new Error('결정 상태가 올바르지 않습니다.')
    const answer = text(value.answer, 4000)
    if (value.status === 'resolved' && !answer.trim())
      throw new Error('결정한 내용과 이유를 입력하세요.')
    return {
      ...question,
      status: value.status as Decision['status'],
      answer,
      origin: text(value.origin, 200)
    }
  })
  unique(values.map((value) => value.id))
  return values
}
export function parsePlan(input: unknown): Plan {
  const value = object(input)
  const features = array(value.features, 60).map((raw) => {
    const feature = object(raw)
    const options = array(feature.options, 8).map((rawOption) => {
      const option = object(rawOption)
      const optionId = key(option.id)
      if (['undecided', 'other'].includes(optionId))
        throw new Error('예약된 선택지 ID입니다.')
      if (
        option.layout !== undefined &&
        !['stack', 'split'].includes(String(option.layout))
      )
        throw new Error('구조도 배치가 올바르지 않습니다.')
      return {
        id: optionId,
        title: text(option.title, 200, true),
        description: text(option.description, 2000),
        layout: option.layout as 'stack' | 'split' | undefined,
        panels:
          option.panels === undefined
            ? undefined
            : array(option.panels, 8).map((panel) => text(panel, 300))
      }
    })
    unique(options.map((option) => option.id))
    return {
      id: key(feature.id),
      group: text(feature.group, 100, true),
      title: text(feature.title, 200, true),
      kind: text(feature.kind, 100),
      why: text(feature.why),
      question: text(feature.question),
      recommendation: text(feature.recommendation),
      acceptance: text(feature.acceptance),
      source: text(feature.source, 1000),
      dependencies: array(feature.dependencies, 60).map(key),
      current: array(feature.current, 8).map((panel) => text(panel, 300)),
      options,
      ...(feature.effects === undefined
        ? {}
        : { effects: parseEffects(feature.effects) }),
      requirements:
        feature.requirements === undefined
          ? undefined
          : array(feature.requirements, 60).map((rawRequirement) => {
              const requirement = object(rawRequirement)
              return {
                featureId: key(requirement.featureId),
                optionId: key(requirement.optionId),
                message: text(requirement.message, 1000, true)
              }
            })
    }
  })
  unique(features.map((feature) => feature.id))
  for (const feature of features) {
    if (
      feature.effects?.some(
        (effect) =>
          effect.optionId &&
          !feature.options.some((option) => option.id === effect.optionId)
      )
    )
      throw new Error('영향·상태 변화의 동작 선택지 ID를 확인하세요.')
    if (
      feature.dependencies.some(
        (dependency) =>
          dependency === feature.id ||
          !features.some((candidate) => candidate.id === dependency)
      )
    )
      throw new Error('선행 기능 ID가 올바르지 않습니다.')
    for (const requirement of feature.requirements ?? []) {
      if (
        !feature.dependencies.includes(requirement.featureId) ||
        !features
          .find((candidate) => candidate.id === requirement.featureId)
          ?.options.some((option) => option.id === requirement.optionId)
      )
        throw new Error('선행 동작이 올바르지 않습니다.')
    }
  }
  const visited = new Set<string>()
  const visit = (featureId: string, chain: Set<string>) => {
    if (chain.has(featureId)) throw new Error('순환 의존성이 있습니다.')
    if (visited.has(featureId)) return
    const next = new Set(chain).add(featureId)
    for (const dependency of features.find(
      (feature) => feature.id === featureId
    )!.dependencies)
      visit(dependency, next)
    visited.add(featureId)
  }
  for (const feature of features) visit(feature.id, new Set())
  const scenarios =
    value.scenarios === undefined
      ? undefined
      : parseScenarios(value.scenarios, features)
  return {
    id: id(value.id),
    title: text(value.title, 200, true),
    screen: text(value.screen, 1000),
    goal: text(value.goal, 4000, true),
    baseline: text(value.baseline, 300),
    reviewedAt: text(value.reviewedAt, 100),
    notice: text(value.notice, 4000),
    existing: array(value.existing, 60).map((raw) => {
      const entry = object(raw)
      return {
        title: text(entry.title, 200, true),
        detail: text(entry.detail),
        source: text(entry.source, 1000)
      }
    }),
    features,
    ...(scenarios === undefined ? {} : { scenarios }),
    ...(value.audit === undefined
      ? {}
      : { audit: parseAudit(value.audit, features, scenarios ?? []) })
  }
}
export function parseSelection(input: unknown, plan: Plan): Selection {
  const value = object(input)
  const items = array(value.items, 60).map((raw) => {
    const item = object(raw)
    const feature = plan.features.find((feature) => feature.id === item.id)
    if (
      !feature ||
      !['include', 'later', 'exclude', 'undecided'].includes(
        String(item.choice)
      )
    )
      throw new Error('기능 선택이 올바르지 않습니다.')
    const behavior = item.behavior ?? 'undecided'
    if (
      ![
        'other',
        'undecided',
        ...feature.options.map((option) => option.id)
      ].includes(String(behavior))
    )
      throw new Error('동작 선택이 올바르지 않습니다.')
    if (item.reviewed !== undefined && typeof item.reviewed !== 'boolean')
      throw new Error('확인 여부가 올바르지 않습니다.')
    const attachments = array(item.attachments ?? [], 3).map(
      (rawAttachment) => {
        const attachment = object(rawAttachment)
        if (
          typeof attachment.id !== 'string' ||
          !attachmentPattern.test(attachment.id) ||
          !['current', 'proposal'].includes(String(attachment.kind))
        )
          throw new Error('이미지 정보가 올바르지 않습니다.')
        return {
          id: attachment.id,
          kind: attachment.kind as Attachment['kind'],
          caption: text(attachment.caption, 1000)
        }
      }
    )
    unique(attachments.map((attachment) => attachment.id))
    return {
      id: feature.id,
      choice: item.choice as Scope,
      note: text(item.note),
      behavior: String(behavior),
      reviewed: item.reviewed === true,
      attachments,
      ...(item.effects === undefined
        ? {}
        : { effects: parseEffects(item.effects) })
    }
  })
  unique(items.map((item) => item.id))
  if (items.length !== plan.features.length)
    throw new Error('기획 항목이 변경되었습니다. 새로고침 후 다시 확인하세요.')
  return {
    goal: text(value.goal, 4000, true),
    additional: text(value.additional, 8000),
    items,
    ...(value.contentReviews === undefined
      ? {}
      : { contentReviews: parseContentReviews(value.contentReviews) }),
    decisions: parseDecisions(value.decisions)
  }
}
export function restoreDraft(
  raw: unknown,
  plan: Plan
): import('./types').Draft {
  const value =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const items = plan.features.map((feature) => {
    const previous = Array.isArray(value.items)
      ? value.items.find((item) => item?.id === feature.id)
      : undefined
    const fallback = {
      id: feature.id,
      choice: 'undecided' as Scope,
      note: '',
      behavior: 'undecided',
      reviewed: false,
      attachments: []
    }
    if (!previous) return fallback
    try {
      return parseSelection(
        {
          goal: plan.goal,
          additional: '',
          items: [
            {
              ...previous,
              behavior: [
                'other',
                'undecided',
                ...feature.options.map((option) => option.id)
              ].includes(previous.behavior)
                ? previous.behavior
                : 'undecided'
            }
          ]
        },
        { ...plan, features: [feature] }
      ).items[0]
    } catch {
      return fallback
    }
  })
  const receipt = value.receipt as { snapshot?: unknown; at?: unknown } | null
  return {
    goal: typeof value.goal === 'string' ? value.goal : plan.goal,
    additional: typeof value.additional === 'string' ? value.additional : '',
    items,
    ...(Array.isArray(value.contentReviews)
      ? {
          contentReviews: value.contentReviews
            .slice(0, 512)
            .flatMap((value) => {
              try {
                return parseContentReviews([value])
              } catch {
                return []
              }
            })
            .filter(
              (value, index, all) =>
                all.findIndex((entry) => entry.key === value.key) === index
            )
        }
      : {}),
    decisions: restoreDecisions(value.decisions),
    activeId: plan.features.some((feature) => feature.id === value.activeId)
      ? String(value.activeId)
      : (plan.features[0]?.id ?? ''),
    receipt:
      receipt &&
      typeof receipt.snapshot === 'string' &&
      typeof receipt.at === 'string' &&
      Number.isFinite(Date.parse(receipt.at))
        ? { snapshot: receipt.snapshot, at: receipt.at }
        : null
  }
}
function restoreDecisions(input: unknown): Decision[] {
  // A half-written answer remains an open question after a reload.
  if (!Array.isArray(input)) return []
  const restored: Decision[] = []
  for (const value of input.slice(0, 60)) {
    try {
      const [decision] = parseDecisions([
        {
          ...value,
          status:
            value.status === 'resolved' && !value.answer?.trim()
              ? 'open'
              : value.status
        }
      ])
      if (!restored.some((entry) => entry.id === decision.id))
        restored.push(decision)
    } catch {
      /* Retain the other valid questions in a partially invalid draft. */
    }
  }
  return restored
}
