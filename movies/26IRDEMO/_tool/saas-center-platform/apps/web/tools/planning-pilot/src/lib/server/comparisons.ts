import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PlanningStore, StoreError, revisionOf, store } from './store'
import { parseSelection, parsePlan } from '../schema'
import { emptyChecks, parseChecks, parseImplementation } from '../comparison'
import type { ComparisonEntry, ComparisonRecord } from '../comparison'

const recordIdPattern = /^compare-[a-f0-9-]{36}$/
export class ComparisonStore {
  constructor(private plans: PlanningStore) {}
  private directory(planId: string) {
    return join(this.plans.root, 'records', planId, 'comparisons')
  }
  async list(planId: string) {
    await this.plans.getPlan(planId)
    let names: string[]
    try {
      names = await readdir(this.directory(planId))
    } catch (reason) {
      if ((reason as NodeJS.ErrnoException).code === 'ENOENT')
        return { entries: [], warnings: [] }
      throw reason
    }
    const entries: ComparisonEntry[] = [],
      warnings: string[] = []
    for (const name of names.filter((name) => name.endsWith('.json'))) {
      try {
        const record = await this.get(planId, name.slice(0, -5))
        entries.push({
          id: record.id,
          runId: record.runId,
          createdAt: record.createdAt,
          implementation: record.implementation
        })
      } catch {
        warnings.push(name + ': 비교 기록을 읽지 못했습니다.')
      }
    }
    return {
      entries: entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      warnings
    }
  }
  async get(planId: string, id: string): Promise<ComparisonRecord> {
    await this.plans.getPlan(planId)
    if (!recordIdPattern.test(id))
      throw new StoreError(400, '비교 기록 ID를 확인하세요.')
    const record: ComparisonRecord = JSON.parse(
      await readFile(join(this.directory(planId), id + '.json'), 'utf8')
    )
    if (
      record.id !== id ||
      record.planId !== planId ||
      record.baseline.plan.id !== planId
    )
      throw new StoreError(400, '다른 기획의 비교 기록입니다.')
    const plan = parsePlan(record.baseline.plan)
    parseChecks(record.checks, plan)
    return {
      ...record,
      implementation: parseImplementation(record.implementation),
      baseline: {
        ...record.baseline,
        plan,
        selection: parseSelection(record.baseline.selection, plan)
      }
    }
  }
  private async write(record: ComparisonRecord) {
    await mkdir(this.directory(record.planId), { recursive: true })
    await writeFile(
      join(this.directory(record.planId), record.id + '.json'),
      JSON.stringify(record, null, 2) + '\n',
      { flag: 'wx' }
    )
    return record
  }
  async start(
    planId: string,
    selection: unknown,
    revision: string,
    implementation: unknown
  ) {
    const plan = await this.plans.getPlan(planId)
    if (revision !== revisionOf(plan))
      throw new StoreError(
        409,
        '기획이 변경되었습니다. 초안을 새로고침하고 비교를 시작하세요.'
      )
    if (!plan.scenarios?.length)
      throw new StoreError(409, '정상·예외 시나리오를 먼저 준비하세요.')
    const parsed = parseSelection(selection, plan)
    for (const item of parsed.items)
      for (const image of item.attachments)
        await this.plans.imagePath(planId, image.id)
    const id = 'compare-' + randomUUID()
    return this.write({
      id,
      runId: id,
      parentId: '',
      planId,
      createdAt: new Date().toISOString(),
      implementation: parseImplementation(implementation),
      baseline: { plan, selection: parsed, revision },
      checks: emptyChecks(plan)
    })
  }
  async save(planId: string, sourceId: string, input: unknown) {
    const source = await this.get(planId, sourceId)
    const checks = parseChecks(input, source.baseline.plan)
    for (const check of checks)
      for (const image of check.evidence)
        await this.plans.imagePath(planId, image.id)
    const createdAt = new Date().toISOString()
    for (const check of checks) {
      const previous = source.checks.find(
        (entry) =>
          entry.scenarioId === check.scenarioId && entry.stepId === check.stepId
      )!
      const { checkedAt: _, ...before } = previous
      const { checkedAt: __, ...after } = check
      check.checkedAt =
        JSON.stringify(before) === JSON.stringify(after)
          ? previous.checkedAt
          : createdAt
    }
    // Every save is a new immutable version. Concurrent reviewers never overwrite evidence.
    return this.write({
      ...source,
      id: 'compare-' + randomUUID(),
      parentId: sourceId,
      createdAt,
      checks
    })
  }
}
export const comparisons = new ComparisonStore(store)
