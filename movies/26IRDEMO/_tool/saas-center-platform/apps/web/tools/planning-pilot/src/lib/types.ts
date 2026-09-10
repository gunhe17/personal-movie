import type { AIConnection } from './ai'
import type { ContentReview } from './content-review'
import type { PlanningAudit } from './audit'
export type Scope = 'undecided' | 'include' | 'later' | 'exclude'
export interface Option {
  id: string
  title: string
  description: string
  layout?: 'stack' | 'split'
  panels?: string[]
}
export interface Feature {
  id: string
  group: string
  title: string
  kind: string
  why: string
  question: string
  recommendation: string
  acceptance: string
  source: string
  dependencies: string[]
  current: string[]
  options: Option[]
  requirements?: { featureId: string; optionId: string; message: string }[]
  effects?: ActionEffect[]
}
export interface ActionEffect {
  id: string
  optionId: string
  actor: string
  action: string
  condition: string
  transitions: { target: string; before: string; after: string }[]
  impacts: { target: string; change: string }[]
  failure: string
  cancellation: string
  unresolved: string
}
export function actionEffects(feature: Feature, item: SelectionItem) {
  return item.effects ?? feature.effects ?? []
}
export function applicableEffects(feature: Feature, item: SelectionItem) {
  return actionEffects(feature, item).filter(
    (effect) => !effect.optionId || effect.optionId === item.behavior
  )
}
export interface Plan {
  id: string
  title: string
  screen: string
  goal: string
  reviewedAt: string
  baseline: string
  notice: string
  existing: { title: string; detail: string; source: string }[]
  features: Feature[]
  audit?: PlanningAudit
  scenarios?: Scenario[]
}
export interface ScenarioStep {
  id: string
  title: string
  actor: string
  description: string
  expected: string
  featureId: string
  effectId: string
}
export interface Scenario {
  id: string
  title: string
  kind: 'normal' | 'exception'
  precondition: string
  trigger: string
  branch?: { scenarioId: string; stepId: string }
  steps: ScenarioStep[]
  outcome: string
  recovery: string
  unresolved: string
}
export interface Attachment {
  id: string
  kind: 'current' | 'proposal'
  caption: string
  path?: string
}
export interface SelectionItem {
  id: string
  choice: Scope
  note: string
  behavior: string
  reviewed: boolean
  attachments: Attachment[]
  effects?: ActionEffect[]
}
export interface Selection {
  goal: string
  additional: string
  items: SelectionItem[]
  contentReviews?: ContentReview[]
  decisions?: Decision[]
}
export const ownerLabels = {
  together: '함께 결정',
  developer: '개발자 조사',
  designer: '디자이너 판단',
  operator: '운영 담당자 확인'
} as const
export const decisionLabels = {
  open: '답변 필요',
  resolved: '결정함',
  later: '보류',
  excluded: '이번 범위에서 제외'
} as const
export interface FollowUp {
  id: string
  question: string
  context: string
  featureId: string
  owner: keyof typeof ownerLabels
  blocking: boolean
}
export interface Decision extends FollowUp {
  status: keyof typeof decisionLabels
  answer: string
  origin: string
}
export function decisionIsPending(decision: Decision) {
  return (
    decision.status === 'open' ||
    decision.status === 'later' ||
    (decision.status === 'resolved' && !decision.answer.trim())
  )
}
export function blockingDecisions(selection: Selection) {
  return (selection.decisions ?? []).filter(
    (decision) =>
      decision.blocking &&
      decisionIsPending(decision) &&
      (!decision.featureId ||
        !selection.items.some(
          (item) =>
            item.id === decision.featureId &&
            ['later', 'exclude'].includes(item.choice)
        ))
  )
}
// Repeated reviews must never overwrite a person's answer or scope decision.
export function addFollowUp(
  decisions: Decision[],
  followUp: FollowUp,
  origin: string
) {
  if (decisions.some((decision) => decision.id === followUp.id))
    return decisions
  return [
    ...decisions,
    { ...followUp, status: 'open' as const, answer: '', origin }
  ]
}
export interface Draft extends Selection {
  activeId: string
  receipt?: { snapshot: string; at: string } | null
}
export interface PlanningRecord extends Selection {
  id: string
  planId: string
  title: string
  createdAt: string
  baseline: string
  features: Feature[]
  audit?: PlanningAudit
  scenarios?: Scenario[]
  designApproval: 'not_requested'
  delivery:
    | 'saved'
    | 'pending'
    | 'queued'
    | 'unconfirmed'
    | 'completed'
    | 'failed'
  thread: string | null
  ai?: AIConnection
}
export interface RecordEntry {
  id: string
  createdAt: string
  delivery: string
}
export const scopeLabels: Record<Scope, string> = {
  undecided: '미정',
  include: '이번에 포함',
  later: '다음으로 보류',
  exclude: '제외'
}
export const shortLabels: Record<Scope, string> = {
  undecided: '미정',
  include: '포함',
  later: '보류',
  exclude: '제외'
}
export function behaviorLabel(feature: Feature, item: SelectionItem) {
  return item.behavior === 'other'
    ? '다른 방식 제안'
    : (feature.options.find((option) => option.id === item.behavior)?.title ??
        '아직 결정하지 않음')
}
export function needsAnswer(item: SelectionItem) {
  return (
    item.choice === 'include' &&
    (item.behavior === 'undecided' ||
      (item.behavior === 'other' && !item.note.trim()))
  )
}
export function conflicts(plan: Plan, selection: Selection): Feature[] {
  return plan.features.filter((feature) => {
    const item = selection.items.find(
      (candidate) => candidate.id === feature.id
    )
    return (
      item?.choice === 'include' &&
      (feature.dependencies.some(
        (id) =>
          selection.items.find((candidate) => candidate.id === id)?.choice !==
          'include'
      ) ||
        (feature.requirements ?? []).some(
          (requirement) =>
            !['undecided', 'other', requirement.optionId].includes(
              selection.items.find(
                (candidate) => candidate.id === requirement.featureId
              )?.behavior ?? 'undecided'
            )
        ))
    )
  })
}
