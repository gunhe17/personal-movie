import type { Plan, Selection } from './types'
import { attachmentPattern, parseSelection } from './schema'

export const comparisonLabels = {
  unchecked: '확인 전',
  match: '일치',
  different: '차이 있음',
  missing: '미구현'
} as const
export type ComparisonStatus = keyof typeof comparisonLabels
export interface Implementation {
  url: string
  version: string
  environment: string
  role: string
}
export interface ComparisonCheck {
  scenarioId: string
  stepId: string
  appearance: ComparisonStatus
  behavior: ComparisonStatus
  appearanceNote: string
  behaviorNote: string
  stepsTaken: string
  evidence: { id: string; caption: string }[]
  followUp: 'none' | 'fix' | 'question'
  followUpNote: string
  resolved: boolean
  checkedAt: string
}
export interface ComparisonRecord {
  id: string
  runId: string
  parentId: string
  planId: string
  createdAt: string
  implementation: Implementation
  baseline: { plan: Plan; selection: Selection; revision: string }
  checks: ComparisonCheck[]
}
export type ComparisonEntry = Pick<
  ComparisonRecord,
  'id' | 'runId' | 'createdAt' | 'implementation'
>
export const checkKey = (scenarioId: string, stepId: string) =>
  scenarioId + '/' + stepId
export function emptyChecks(plan: Plan): ComparisonCheck[] {
  return (plan.scenarios ?? []).flatMap((scenario) =>
    scenario.steps.map((step) => ({
      scenarioId: scenario.id,
      stepId: step.id,
      appearance: 'unchecked',
      behavior: 'unchecked',
      appearanceNote: '',
      behaviorNote: '',
      stepsTaken: '',
      evidence: [],
      followUp: 'none',
      followUpNote: '',
      resolved: false,
      checkedAt: ''
    }))
  )
}
export function aggregateStatus(
  checks: Pick<ComparisonCheck, 'appearance' | 'behavior'>[]
): ComparisonStatus {
  const statuses = checks.flatMap((check) => [check.appearance, check.behavior])
  if (statuses.includes('different')) return 'different'
  if (statuses.includes('missing')) return 'missing'
  if (!statuses.length || statuses.includes('unchecked')) return 'unchecked'
  return 'match'
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('비교 기록 형식을 확인하세요.')
  return value as Record<string, unknown>
}
function text(value: unknown, max: number, required = false) {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Error('비교 기록의 필수 항목과 길이를 확인하세요.')
  return value
}
export function safeScreenUrl(value: string) {
  if (!value) return ''
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('화면 주소는 계정 정보가 없는 http/https URL로 입력하세요.')
  return url.href
}
export function parseImplementation(value: unknown): Implementation {
  const raw = object(value)
  return {
    url: safeScreenUrl(text(raw.url, 2000)),
    version: text(raw.version, 300, true),
    environment: text(raw.environment, 500, true),
    role: text(raw.role, 300, true)
  }
}
export function parseChecks(
  input: unknown,
  plan: Plan,
  draft = false
): ComparisonCheck[] {
  if (!Array.isArray(input) || input.length > 256)
    throw new Error('단계별 비교 목록을 확인하세요.')
  const expected = emptyChecks(plan)
  const keys = new Set<string>()
  const checks = input.map((value) => {
    const raw = object(value)
    const scenarioId = text(raw.scenarioId, 80, true),
      stepId = text(raw.stepId, 80, true)
    const key = checkKey(scenarioId, stepId)
    if (
      keys.has(key) ||
      !expected.some(
        (check) => checkKey(check.scenarioId, check.stepId) === key
      )
    )
      throw new Error('중복되거나 기준 기획에 없는 비교 단계입니다.')
    keys.add(key)
    const status = (value: unknown): ComparisonStatus => {
      if (typeof value !== 'string' || !Object.hasOwn(comparisonLabels, value))
        throw new Error('비교 상태를 확인하세요.')
      return value as ComparisonStatus
    }
    const appearance = status(raw.appearance),
      behavior = status(raw.behavior)
    const appearanceNote = text(raw.appearanceNote, 4000),
      behaviorNote = text(raw.behaviorNote, 4000),
      stepsTaken = text(raw.stepsTaken, 4000)
    if (!draft && appearance !== 'unchecked' && !appearanceNote.trim())
      throw new Error('화면 판정에는 관찰 근거를 적어주세요.')
    if (
      !draft &&
      behavior !== 'unchecked' &&
      (!behaviorNote.trim() || !stepsTaken.trim())
    )
      throw new Error('동작 판정에는 실행한 절차와 관찰 결과를 적어주세요.')
    if (!Array.isArray(raw.evidence) || raw.evidence.length > 3)
      throw new Error('단계별 캡처는 3개까지입니다.')
    const evidence = raw.evidence.map((value) => {
      const image = object(value),
        id = text(image.id, 100, true)
      if (!attachmentPattern.test(id)) throw new Error('캡처 ID를 확인하세요.')
      return { id, caption: text(image.caption, 1000) }
    })
    if (new Set(evidence.map((image) => image.id)).size !== evidence.length)
      throw new Error('중복 캡처입니다.')
    if (
      !['none', 'fix', 'question'].includes(String(raw.followUp)) ||
      typeof raw.resolved !== 'boolean'
    )
      throw new Error('후속 처리 상태를 확인하세요.')
    const followUpNote = text(raw.followUpNote, 1000)
    if (!draft && raw.followUp !== 'none' && !followUpNote.trim())
      throw new Error('후속 작업이나 질문 내용을 적어주세요.')
    return {
      scenarioId,
      stepId,
      appearance,
      behavior,
      appearanceNote,
      behaviorNote,
      stepsTaken,
      evidence,
      followUp: raw.followUp as ComparisonCheck['followUp'],
      followUpNote,
      resolved: raw.followUp !== 'none' && raw.resolved,
      checkedAt: ''
    }
  })
  if (keys.size !== expected.length)
    throw new Error('모든 기준 단계의 비교 기록이 필요합니다.')
  return expected.map(
    (check) =>
      checks.find(
        (entry) =>
          checkKey(entry.scenarioId, entry.stepId) ===
          checkKey(check.scenarioId, check.stepId)
      )!
  )
}
export function selectionFingerprint(selection: Selection, plan: Plan) {
  const { contentReviews: _reviews, ...behavior } = parseSelection(
    selection,
    plan
  )
  return JSON.stringify(behavior)
}
export function comparisonStale(
  record: ComparisonRecord,
  plan: Plan,
  selection: Selection,
  revision: string
) {
  if (record.baseline.revision !== revision) return true
  try {
    return (
      selectionFingerprint(record.baseline.selection, record.baseline.plan) !==
      selectionFingerprint(selection, plan)
    )
  } catch {
    return true
  }
}
