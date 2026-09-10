import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import seed from '../../../plans/plan-42a3a371.json'
import { PlanningStore, revisionOf } from './store'
import { ComparisonStore } from './comparisons'
import { parsePlan, restoreDraft } from '../schema'
import { comparisonStale } from '../comparison'

describe('audit generation and snapshot integration', () => {
  it('uses the new investigation instructions for both candidate generation and final review, preserving their exact audit baseline', async () => {
    const root = await mkdtemp(join(tmpdir(), 'planning-audit-'))
    const messages: string[] = []
    const store = new PlanningStore(root, 'test-thread', async (message) => {
      messages.push(message)
    })
    try {
      const plan = await store.create(parsePlan(seed)),
        selection = restoreDraft(null, plan)
      for (const item of selection.items) item.choice = 'include'
      await store.generate(plan.id, selection, revisionOf(plan))
      const saved = await store.save(plan.id, selection, true, revisionOf(plan))
      for (const prompt of messages) {
        expect(prompt).toContain('audit.requirements')
        expect(prompt).toContain('기존 동작(before)')
        expect(prompt).toContain('부분 실패')
        expect(prompt).toContain('미기록은 미조사')
        expect(prompt).toContain('승인과 철회')
      }
      expect((await store.getRecord(plan.id, saved.recordId)).audit).toEqual(
        plan.audit
      )
      expect(await readFile(saved.documentPath, 'utf8')).toContain(
        '범위·영향·예외 점검'
      )
      const comparisons = new ComparisonStore(store)
      const comparison = await comparisons.start(
        plan.id,
        selection,
        revisionOf(plan),
        { url: '', version: 'test-build', environment: 'test', role: 'tester' }
      )
      expect(comparison.baseline.plan.audit).toEqual(plan.audit)
      const changed = structuredClone(plan)
      changed.audit!.cases[0].recovery = '수정된 복구 기준'
      expect(
        comparisonStale(comparison, changed, selection, revisionOf(changed))
      ).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
