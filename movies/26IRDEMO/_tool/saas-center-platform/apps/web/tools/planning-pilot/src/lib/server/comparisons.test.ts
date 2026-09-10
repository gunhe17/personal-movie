import { describe, it, expect } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import seed from '../../../plans/plan-42a3a371.json'
import { PlanningStore, revisionOf } from './store'
import { ComparisonStore } from './comparisons'
import { parsePlan, restoreDraft } from '../schema'
import {
  aggregateStatus,
  comparisonStale,
  emptyChecks,
  parseChecks,
  parseImplementation
} from '../comparison'

const plan = parsePlan(seed)
const implementation = {
  url: 'http://localhost:3503/schedule',
  version: 'dev-abc123',
  environment: '개발 서버, 승인 대기 예약 1건',
  role: '관리자'
}
function selection() {
  const draft = restoreDraft(null, plan)
  for (const item of draft.items) item.choice = 'include'
  draft.items.find((item) => item.id === 'schedule-change')!.behavior =
    'approval'
  return draft
}
async function fixture(
  run: (
    comparisons: ComparisonStore,
    plans: PlanningStore,
    root: string
  ) => Promise<void>
) {
  const root = await mkdtemp(join(tmpdir(), 'planning-comparison-'))
  const plans = new PlanningStore(root, null, async () => {
    throw new Error('must not queue')
  })
  try {
    await plans.create(plan)
    await run(new ComparisonStore(plans), plans, root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('implementation comparison evidence', () => {
  it('never treats a screenshot-only match as a verified flow', () => {
    const checks = emptyChecks(plan)
    checks[0].appearanceNote = '화면 문구와 버튼을 확인함'
    checks[0].appearance = 'match'
    expect(aggregateStatus([checks[0]])).toBe('unchecked')
    checks[0].behavior = 'match'
    expect(() => parseChecks(checks, plan)).toThrow('실행한 절차')
    checks[0].stepsTaken = '대기 예약에서 요청 승인 버튼을 누름'
    checks[0].behaviorNote = '예약 일정과 상태가 변경됨'
    expect(aggregateStatus([parseChecks(checks, plan)[0]])).toBe('match')
    expect(aggregateStatus(parseChecks(checks, plan))).toBe('unchecked')
    checks[0].behavior = 'different'
    expect(aggregateStatus(checks)).toBe('different')
  })
  it('preserves unfinished local drafts, but rejects missing evidence and incomplete follow-ups on save', () => {
    const checks = emptyChecks(plan)
    checks[0].followUp = 'fix'
    expect(parseChecks(checks, plan, true)[0].followUp).toBe('fix')
    expect(() => parseChecks(checks, plan)).toThrow('후속 작업')
    checks[0].followUpNote = '실패 후 다시 제출할 수 있도록 수정'
    checks[0].resolved = true
    expect(aggregateStatus(parseChecks(checks, plan))).toBe('unchecked')
    checks[0].appearance = 'match'
    expect(() => parseChecks(checks, plan)).toThrow('관찰 근거')
  })
  it('rejects unsafe screen links, duplicate steps, omitted steps and forged evidence IDs', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,test',
      'https://user:secret@example.com'
    ])
      expect(() => parseImplementation({ ...implementation, url })).toThrow()
    expect(() =>
      parseImplementation({ ...implementation, version: '' })
    ).toThrow()
    const checks = emptyChecks(plan)
    expect(() => parseChecks(checks.slice(1), plan)).toThrow('모든 기준')
    expect(() =>
      parseChecks([checks[0], ...checks.slice(0, -1)], plan)
    ).toThrow('중복')
    checks[0].evidence = [{ id: '../outside.png', caption: '' }]
    expect(() => parseChecks(checks, plan)).toThrow('캡처 ID')
  })
  it('keeps plan and implementation snapshots immutable across saves and later planning changes', () =>
    fixture(async (comparisons, plans, root) => {
      const draft = selection()
      const source = await comparisons.start(
        plan.id,
        draft,
        revisionOf(plan),
        implementation
      )
      const original = await readFile(
        join(root, 'records', plan.id, 'comparisons', source.id + '.json'),
        'utf8'
      )
      const checks = structuredClone(source.checks)
      checks[0].appearance = 'different'
      checks[0].appearanceNote = '인증 오류 안내가 없음'
      checks[0].followUp = 'fix'
      checks[0].followUpNote = '오류와 재입력 안내 추가'
      const changed = { ...plan, goal: '기획 목적 변경' }
      await writeFile(
        join(root, 'plans', plan.id + '.json'),
        JSON.stringify(changed)
      )
      const saved = await comparisons.save(plan.id, source.id, checks)
      expect(saved.id).not.toBe(source.id)
      expect(saved.parentId).toBe(source.id)
      expect(saved.baseline).toEqual(source.baseline)
      expect(saved.implementation).toEqual(implementation)
      expect(saved.checks[0].checkedAt).toBeTruthy()
      expect(
        await readFile(
          join(root, 'records', plan.id, 'comparisons', source.id + '.json'),
          'utf8'
        )
      ).toBe(original)
      expect(
        (await comparisons.get(plan.id, saved.id)).checks[0].appearance
      ).toBe('different')
      expect((await comparisons.list(plan.id)).entries).toHaveLength(2)
      expect(comparisonStale(saved, plan, draft, revisionOf(plan))).toBe(false)
      draft.items[0].choice = 'exclude'
      expect(comparisonStale(saved, plan, draft, revisionOf(plan))).toBe(true)
      expect(
        comparisonStale(saved, changed, selection(), revisionOf(changed))
      ).toBe(true)
      await expect(
        comparisons.start(
          plan.id,
          selection(),
          revisionOf(plan),
          implementation
        )
      ).rejects.toMatchObject({ status: 409 })
    }))
  it('isolates comparison records and screenshots by plan, and preserves the source on failed saves', () =>
    fixture(async (comparisons, plans, root) => {
      const other = await plans.create({ ...plan, id: 'another-plan' })
      const source = await comparisons.start(
        plan.id,
        selection(),
        revisionOf(plan),
        implementation
      )
      const image = await plans.upload(
        other.id,
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        'image/png'
      )
      const checks = structuredClone(source.checks)
      checks[0].evidence = [{ id: image.id, caption: '다른 기획 캡처' }]
      await expect(
        comparisons.save(plan.id, source.id, checks)
      ).rejects.toThrow('첨부 이미지')
      expect(
        (await comparisons.get(plan.id, source.id)).checks[0].evidence
      ).toEqual([])
      await expect(comparisons.get(other.id, source.id)).rejects.toThrow()
      await expect(comparisons.get('../outside', source.id)).rejects.toThrow()
      await expect(comparisons.get(plan.id, '../outside')).rejects.toThrow()
      const own = await plans.upload(
        plan.id,
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        'image/png'
      )
      checks[0].evidence = [{ id: own.id, caption: '실제 화면' }]
      const saved = await comparisons.save(plan.id, source.id, checks)
      expect(
        (await comparisons.get(plan.id, saved.id)).checks[0].evidence[0].id
      ).toBe(own.id)
      await writeFile(
        join(root, 'records', plan.id, 'comparisons', 'broken.json'),
        '{'
      )
      expect((await comparisons.list(plan.id)).warnings).toHaveLength(1)
    }))
  it('retains both versions when separate reviewers save the same baseline concurrently', () =>
    fixture(async (comparisons) => {
      const source = await comparisons.start(
        plan.id,
        selection(),
        revisionOf(plan),
        implementation
      )
      const left = structuredClone(source.checks),
        right = structuredClone(source.checks)
      left[0].appearanceNote = '첫 번째 관찰'
      right[0].appearanceNote = '두 번째 관찰'
      const records = await Promise.all([
        comparisons.save(plan.id, source.id, left),
        comparisons.save(plan.id, source.id, right)
      ])
      expect(records[0].id).not.toBe(records[1].id)
      expect((await comparisons.list(plan.id)).entries).toHaveLength(3)
      expect(records.map((record) => record.checks[0].appearanceNote)).toEqual([
        '첫 번째 관찰',
        '두 번째 관찰'
      ])
    }))
  it('requires a scenario baseline instead of inventing comparisons for legacy plans', () =>
    fixture(async (comparisons, plans) => {
      const legacy = {
        ...plan,
        id: 'legacy-plan',
        audit: undefined,
        scenarios: undefined
      }
      await plans.create(legacy)
      await expect(
        comparisons.start(
          legacy.id,
          restoreDraft(null, legacy),
          revisionOf(parsePlan(legacy)),
          implementation
        )
      ).rejects.toThrow('시나리오')
    }))
})
