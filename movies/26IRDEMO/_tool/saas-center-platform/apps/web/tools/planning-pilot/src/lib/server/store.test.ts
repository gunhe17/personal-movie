import { reviewItems, setContentReview } from '../content-review'
import { describe, it, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import seed from '../../../plans/ai-case-analysis.json'
import linkSeed from '../../../plans/plan-42a3a371.json'
import { PlanningStore, revisionOf } from './store'
import {
  parsePlan,
  parseSelection,
  parseFollowUps,
  parseEffects,
  restoreDraft
} from '../schema'
import {
  conflicts,
  addFollowUp,
  blockingDecisions,
  needsAnswer,
  actionEffects,
  applicableEffects,
  type ActionEffect,
  type FollowUp
} from '../types'

const plan = parsePlan(seed)
const selection = () => parseSelection(restoreDraft(null, plan), plan)
const question: FollowUp = {
  id: 'approval-owner',
  question: '누가 요청을 승인하나요?',
  context: '승인 방식 선택 후에도 담당은 미정입니다.',
  featureId: plan.features[0].id,
  owner: 'operator',
  blocking: true
}
const effect: ActionEffect = {
  id: 'submit-request',
  optionId: '',
  actor: '사용자',
  action: '변경 요청 제출',
  condition: '수정 권한 필요',
  transitions: [
    { target: '변경 요청', before: '없음', after: '승인 대기' },
    { target: '실제 예약', before: '기존 일정', after: '기존 일정 유지' }
  ],
  impacts: [{ target: '승인 담당자', change: '처리할 요청이 생김' }],
  failure: '실패 시 기존 일정 유지',
  cancellation: '철회 정책 미정',
  unresolved: '승인 담당자는 누구인가요?'
}
async function fixture(
  run: (store: PlanningStore, root: string, messages: string[]) => Promise<void>
) {
  const root = await mkdtemp(join(tmpdir(), 'planning-workspace-'))
  const messages: string[] = []
  const store = new PlanningStore(root, 'test-thread', async (message) => {
    messages.push(message)
  })
  try {
    await store.create(plan)
    await run(store, root, messages)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('planning data contracts', () => {
  it('keeps request and reservation states separate in the real planning example', () => {
    const link = parsePlan(linkSeed)
    const feature = link.features.find(
      (feature) => feature.id === 'schedule-change'
    )!
    const draft = restoreDraft(null, link)
    const item = draft.items.find((item) => item.id === feature.id)!
    expect(applicableEffects(feature, item)).toHaveLength(0)
    item.behavior = 'approval'
    const steps = applicableEffects(feature, item)
    expect(steps).toHaveLength(3)
    expect(steps[0].transitions).toEqual([
      { target: '변경 요청', before: '요청 없음', after: '승인 대기' },
      { target: '실제 예약', before: '기존 일정', after: '기존 일정 유지' }
    ])
    item.behavior = 'instant'
    expect(applicableEffects(feature, item)).toHaveLength(0)
    expect(actionEffects(feature, item)).toHaveLength(3)
  })
  it('preserves edited effects across candidate refresh, behavior changes and explicit clearing', () => {
    const candidate = structuredClone(plan)
    candidate.features[0].effects = [structuredClone(effect)]
    const draft = restoreDraft(null, candidate)
    draft.items[0].effects = [
      {
        ...effect,
        condition: '사용자가 변경한 조건',
        optionId: candidate.features[0].options[0].id
      }
    ]
    candidate.features[0].effects[0].condition = '새 AI 후보 조건'
    let restored = restoreDraft(draft, candidate)
    expect(
      actionEffects(candidate.features[0], restored.items[0])[0].condition
    ).toBe('사용자가 변경한 조건')
    restored.items[0].behavior = candidate.features[0].options[1].id
    expect(
      applicableEffects(candidate.features[0], restored.items[0])
    ).toHaveLength(0)
    expect(restored.items[0].effects).toHaveLength(1)
    restored.items[0].effects = []
    restored = restoreDraft(restored, candidate)
    expect(actionEffects(candidate.features[0], restored.items[0])).toEqual([])
    const legacy = restoreDraft(null, plan)
    expect(actionEffects(plan.features[0], legacy.items[0])).toEqual([])
  })
  it('validates effects while allowing incomplete planning drafts', () => {
    expect(
      parseEffects([{ ...effect, action: '', transitions: [], impacts: [] }])
    ).toHaveLength(1)
    expect(() => parseEffects([effect, effect])).toThrow('중복')
    expect(() =>
      parseEffects([
        { ...effect, transitions: Array(9).fill(effect.transitions[0]) }
      ])
    ).toThrow()
    expect(() =>
      parseEffects([{ ...effect, impacts: [{ target: '화면', change: 123 }] }])
    ).toThrow()
    const invalid = structuredClone(plan)
    invalid.features[0].effects = [{ ...effect, optionId: 'missing' }]
    expect(() => parsePlan(invalid)).toThrow('동작 선택지')
  })
  it('tracks unanswered policies independently of selected behavior and preserves answers on reimport', () => {
    const input = selection()
    input.items[0].choice = 'include'
    input.items[0].behavior = plan.features[0].options[0].id
    input.decisions = addFollowUp([], question, 'first-review')
    expect(needsAnswer(input.items[0])).toBe(false)
    expect(blockingDecisions(input)).toHaveLength(1)
    input.decisions[0].status = 'later'
    expect(blockingDecisions(input)).toHaveLength(1)
    input.decisions[0].answer = '센터 담당자가 승인한다.'
    input.decisions[0].status = 'resolved'
    expect(blockingDecisions(input)).toHaveLength(0)
    const again = addFollowUp(
      input.decisions,
      { ...question, context: '새로운 AI 제안' },
      'second-review'
    )
    expect(again).toEqual(input.decisions)
    expect(restoreDraft(input, plan).decisions).toEqual(input.decisions)
    const changedPlan = {
      ...plan,
      features: plan.features.filter(
        (feature) => feature.id !== question.featureId
      )
    }
    expect(restoreDraft(input, changedPlan).decisions?.[0].answer).toBe(
      '센터 담당자가 승인한다.'
    )
  })
  it('does not mark empty answers as resolved and handles excluded scope without losing questions', () => {
    const input = selection()
    input.decisions = addFollowUp([], question, '')
    input.decisions[0].status = 'resolved'
    expect(() => parseSelection(input, plan)).toThrow('결정한 내용')
    expect(restoreDraft(input, plan).decisions?.[0].status).toBe('open')
    input.decisions[0].status = 'open'
    input.items[0].choice = 'exclude'
    expect(blockingDecisions(input)).toHaveLength(0)
    input.items[0].choice = 'include'
    expect(blockingDecisions(input)).toHaveLength(1)
    expect(() =>
      parseFollowUps(
        { followUps: [{ ...question, featureId: 'missing' }] },
        plan
      )
    ).toThrow()
    expect(() =>
      parseFollowUps({ followUps: [question, question] }, plan)
    ).toThrow()
    expect(() =>
      parseFollowUps({ followUps: [{ ...question, owner: '__proto__' }] }, plan)
    ).toThrow()
  })
  it('rejects duplicate IDs, invalid references, cycles and reserved option IDs', () => {
    const copy = structuredClone(plan)
    copy.features[1].id = copy.features[0].id
    expect(() => parsePlan(copy)).toThrow()
    const invalid = structuredClone(plan)
    invalid.features[0].dependencies = ['missing']
    expect(() => parsePlan(invalid)).toThrow()
    invalid.features[0].dependencies = [invalid.features[1].id]
    invalid.features[1].dependencies = [invalid.features[0].id]
    expect(() => parsePlan(invalid)).toThrow()
    const reserved = structuredClone(plan)
    reserved.features[0].options[0].id = 'other'
    expect(() => parsePlan(reserved)).toThrow()
  })
  it('restores old browser drafts without treating reviewed as approval', () => {
    const legacy = {
      goal: plan.goal,
      additional: '',
      items: plan.features.map((feature) => ({
        id: feature.id,
        choice: 'include',
        note: '이전 메모'
      }))
    }
    const restored = restoreDraft(legacy, plan)
    expect(restored.items[0]).toMatchObject({
      choice: 'include',
      note: '이전 메모',
      behavior: 'undecided',
      reviewed: false
    })
    expect(restored.items).toHaveLength(plan.features.length)
  })
  it('reports conflicting behavior as well as missing dependencies', () => {
    const input = selection()
    input.items.find((item) => item.id === 'compare')!.choice = 'include'
    expect(conflicts(plan, input)).toHaveLength(1)
    const history = input.items.find((item) => item.id === 'history')!
    history.choice = 'include'
    history.behavior = 'latest'
    expect(conflicts(plan, input)).toHaveLength(1)
    history.behavior = 'list'
    expect(conflicts(plan, input)).toHaveLength(0)
  })
})

describe('multiple plans and legacy records', () => {
  it('snapshots scenarios and exports the exception branch without carrying over normal approval', () =>
    fixture(async (store, root, messages) => {
      const link = await store.create(parsePlan(linkSeed))
      const input = restoreDraft(null, link)
      for (const item of input.items) item.choice = 'include'
      input.items.find((item) => item.id === 'schedule-change')!.behavior =
        'approval'
      const saved = await store.save(link.id, input, true, revisionOf(link))
      const record = await store.getRecord(link.id, saved.recordId)
      expect(record.scenarios).toEqual(link.scenarios)
      const document = await readFile(saved.documentPath, 'utf8')
      const conflict = document
        .split('### 예외: 승인 중 일정 충돌 · 동시 변경')[1]
        .split('### 예외:')[0]
      expect(conflict).toContain('분기 지점: 센터에서 승인 처리 도중')
      expect(conflict).toContain('승인 완료 처리 중단')
      expect(conflict).not.toContain(
        '승인에 성공한 경우에만 실제 예약이 변경된다.'
      )
      expect(conflict).toContain('이후 행동·복구')
      expect(messages[0]).toContain('scenarioId/stepId')
      const updated = { ...link, audit: undefined, scenarios: [] }
      await writeFile(
        join(root, 'plans', link.id + '.json'),
        JSON.stringify(updated)
      )
      expect(
        (await store.getRecord(link.id, saved.recordId)).scenarios
      ).toEqual(link.scenarios)
    }))
  it('saves all alternatives but exports only the chosen effects and preserves them on delivery failure', () =>
    fixture(async (store, root, messages) => {
      const input = selection()
      input.items[0].choice = 'include'
      input.items[0].behavior = plan.features[0].options[0].id
      input.items[0].effects = [
        effect,
        {
          ...effect,
          id: 'other-effect',
          optionId: plan.features[0].options[1].id,
          action: '다른 대안 전용 행동'
        }
      ]
      const saved = await store.save(plan.id, input, true, revisionOf(plan))
      const record = await store.getRecord(plan.id, saved.recordId)
      expect(record.items[0].effects).toEqual(input.items[0].effects)
      const markdown = await readFile(saved.documentPath, 'utf8')
      expect(markdown).toContain('실제 예약: 기존 일정 → 기존 일정 유지')
      expect(markdown).toContain('승인 담당자: 처리할 요청이 생김')
      expect(markdown).toContain('실패·중복·동시 변경: 실패 시 기존 일정 유지')
      expect(markdown).not.toContain('다른 대안 전용 행동')
      expect(messages[0]).toContain('items[].effects')
      const failing = new PlanningStore(root, 'thread', async () => {
        throw new Error('offline')
      })
      await expect(
        failing.save(plan.id, input, true, revisionOf(plan))
      ).rejects.toMatchObject({ status: 502 })
      const latest = (await store.recordEntries(plan.id))[0]
      expect(
        (await store.getRecord(plan.id, latest.id)).items[0].effects
      ).toEqual(input.items[0].effects)
    }))
  it('returns actionable follow-ups without hiding legacy results when JSON is missing or malformed', () =>
    fixture(async (store, root, messages) => {
      const input = selection()
      input.decisions = addFollowUp([], question, '')
      const saved = await store.save(plan.id, input, true, revisionOf(plan))
      const base = join(root, 'records', plan.id, saved.recordId)
      await writeFile(
        base + '-review.md',
        '# 기획 결과\n\n승인 담당은 미정입니다.'
      )
      expect((await store.results(plan.id)).results[0].followUps).toBeNull()
      await store.requestFollowUps(plan.id, saved.recordId)
      expect(messages.at(-1)).toContain(base + '-review.json')
      expect(messages.at(-1)).toContain('기존 Markdown')
      expect(await readFile(saved.documentPath, 'utf8')).toContain(
        '누가 요청을 승인하나요?'
      )
      expect(
        (await store.getRecord(plan.id, saved.recordId)).decisions
      ).toEqual(input.decisions)
      await writeFile(base + '-review.json', '{broken')
      let result = (await store.results(plan.id)).results[0]
      expect(result.content).toContain('승인 담당은 미정')
      expect(result.followUpError).toBeTruthy()
      await writeFile(
        base + '-review.json',
        JSON.stringify({ followUps: [question] })
      )
      result = (await store.results(plan.id)).results[0]
      expect(result.followUps).toEqual([question])
      expect(result.followUpError).toBe('')
      await store.create({ ...plan, id: 'second-plan' })
      await expect(
        store.requestFollowUps('second-plan', saved.recordId)
      ).rejects.toMatchObject({ status: 404 })
      await expect(
        store.requestFollowUps(plan.id, '../private')
      ).rejects.toMatchObject({ status: 400 })
      const offline = new PlanningStore(root, 'thread', async () => {
        throw new Error('offline')
      })
      await expect(
        offline.requestFollowUps(plan.id, saved.recordId)
      ).rejects.toMatchObject({ status: 502 })
      expect(await readFile(base + '-review.md', 'utf8')).toContain(
        '승인 담당은 미정'
      )
    }))
  it('distinguishes queued requests from completed results and isolates plans', () =>
    fixture(async (store, root, messages) => {
      const saved = await store.save(
        plan.id,
        selection(),
        true,
        revisionOf(plan)
      )
      expect(messages[0]).toContain(saved.recordId + '-review.md')
      expect((await store.results(plan.id)).waitingFor?.id).toBe(saved.recordId)
      expect((await store.results(plan.id)).results).toHaveLength(0)
      const resultPath = join(
        root,
        'records',
        plan.id,
        saved.recordId + '-review.md'
      )
      await writeFile(resultPath, '   ')
      expect((await store.results(plan.id)).results).toHaveLength(0)
      await writeFile(resultPath, '# 기획 결과\n\n<script>alert(1)</script>')
      const completed = await store.results(plan.id)
      expect(completed.waitingFor).toBeNull()
      expect(completed.results[0]).toMatchObject({
        recordId: saved.recordId,
        selection: selection(),
        content: '# 기획 결과\n\n<script>alert(1)</script>'
      })
      await store.create({ ...plan, id: 'different-plan' })
      expect((await store.results('different-plan')).results).toHaveLength(0)
      await expect(store.results('../outside')).rejects.toThrow()
    }))
  it('keeps plans, records and uploads isolated and creates Markdown', () =>
    fixture(async (store, root) => {
      const second = await store.create({
        ...plan,
        id: 'schedule-review',
        title: '예약 변경 검토'
      })
      expect((await store.list()).plans).toHaveLength(2)
      const original = selection()
      original.items[0].note = '첫 번째 화면의 의견'
      const saved = await store.save(plan.id, original, false, revisionOf(plan))
      expect(await store.recordEntries(plan.id)).toHaveLength(1)
      expect(await store.recordEntries(second.id)).toHaveLength(0)
      await expect(store.getRecord(second.id, saved.recordId)).rejects.toThrow()
      expect(await readFile(saved.documentPath, 'utf8')).toContain(
        '첫 번째 화면의 의견'
      )
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64'
      )
      const attachment = await store.upload(plan.id, png, 'image/png')
      await expect(store.imagePath(second.id, attachment.id)).rejects.toThrow()
      original.items[0].attachments = [
        { ...attachment, kind: 'proposal', caption: '변경안' }
      ]
      original.items[0].reviewed = true
      const updated = await store.save(
        plan.id,
        original,
        false,
        revisionOf(plan)
      )
      const record = await store.getRecord(plan.id, updated.recordId)
      expect(record.designApproval).toBe('not_requested')
      expect(record.items[0].attachments[0].path).toContain(root)
      await expect(
        store.upload(plan.id, Buffer.from('<svg/>'), 'image/svg+xml')
      ).rejects.toThrow()
      await expect(store.imagePath(plan.id, '../../secret')).rejects.toThrow()
    }))
  it('retains legacy AI-analysis records and images without moving them', () =>
    fixture(async (store, root) => {
      const id = '2026-09-07T02-30-21.034Z-0cba0832'
      await mkdir(join(root, 'records', 'attachments'), { recursive: true })
      await writeFile(
        join(root, 'records', id + '.json'),
        JSON.stringify({
          ...selection(),
          id,
          createdAt: '2026-09-07T02:30:21.034Z',
          delivery: 'queued'
        })
      )
      const imageId = '00000000-0000-0000-0000-000000000000.png'
      await writeFile(join(root, 'records', 'attachments', imageId), 'legacy')
      expect((await store.recordEntries(plan.id))[0].id).toBe(id)
      expect((await store.getRecord(plan.id, id)).items).toHaveLength(
        plan.features.length
      )
      expect(await store.imagePath(plan.id, imageId)).toBe(
        join(root, 'records', 'attachments', imageId)
      )
    }))
  it('prevents import overwrite, invalid paths and saving a stale schema', () =>
    fixture(async (store) => {
      await expect(store.create(plan)).rejects.toMatchObject({ status: 409 })
      await expect(store.getPlan('../private')).rejects.toThrow()
      await expect(
        store.save(plan.id, selection(), false, 'stale')
      ).rejects.toMatchObject({ status: 409 })
    }))
  it('sends generic planning requests for any plan and preserves data on queue failure', () =>
    fixture(async (store, root, messages) => {
      const other = await store.create({
        ...plan,
        id: 'other-page',
        title: '다른 화면'
      })
      const sent = await store.save(
        other.id,
        selection(),
        true,
        revisionOf(other)
      )
      expect(sent.delivered).toBe(true)
      expect(messages[0]).toContain(sent.path)
      expect(messages[0]).not.toContain('AI 경과 분석 기획 화면')
      await store.generate(other.id)
      expect(messages[1]).toContain(join(root, 'plans', 'other-page.json'))
      const failing = new PlanningStore(root, 'test-thread', async () => {
        throw new Error('offline')
      })
      await expect(
        failing.save(other.id, selection(), true, revisionOf(other))
      ).rejects.toMatchObject({ status: 502 })
      const records = await failing.recordEntries(other.id)
      expect(records.some((record) => record.delivery === 'unconfirmed')).toBe(
        true
      )
    }))
  it('allows brief-only plans and reports malformed imported documents', () =>
    fixture(async (store, root, messages) => {
      const brief = await store.create({
        ...plan,
        id: 'new-page',
        features: [],
        existing: []
      })
      expect(brief.features).toHaveLength(0)
      await expect(
        store.save(
          brief.id,
          { goal: brief.goal, additional: '', items: [] },
          true,
          revisionOf(brief)
        )
      ).rejects.toMatchObject({ status: 409 })
      await expect(store.create({ id: 'bad' })).rejects.toThrow()
      await store.generate(
        brief.id,
        { goal: '수정한 기획 목적', additional: '새 의견', items: [] },
        revisionOf(brief)
      )
      const latest = (await store.recordEntries(brief.id))[0]
      const savedBrief = await store.getRecord(brief.id, latest.id)
      expect(savedBrief.goal).toBe('수정한 기획 목적')
      expect(savedBrief.additional).toBe('새 의견')
      expect(messages[0]).toContain(
        join(root, 'records', brief.id, latest.id + '.json')
      )
    }))
})

it('persists content review snapshots in records, exports and generated results', () =>
  fixture(async (store, root, messages) => {
    const input = selection()
    input.contentReviews = setContentReview(
      [],
      reviewItems(plan, input)[0],
      'changes',
      '목적에 제출 완료를 포함해 주세요.'
    )
    const saved = await store.save(plan.id, input, true, revisionOf(plan))
    expect(
      (await store.getRecord(plan.id, saved.recordId)).contentReviews
    ).toEqual(input.contentReviews)
    expect(await readFile(saved.documentPath, 'utf8')).toContain(
      '목적에 제출 완료를 포함해 주세요.'
    )
    expect(messages.at(-1)).toContain('contentReviews')
    await writeFile(
      join(root, 'records', plan.id, saved.recordId) + '-review.md',
      '# 검토 결과'
    )
    expect(
      (await store.results(plan.id)).results[0].selection.contentReviews
    ).toEqual(input.contentReviews)
  }))
