import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import seed from '../../../plans/ai-case-analysis.json'
import { launchOptions, detectAI } from '../../../ai-config.mjs'
import { connectionFromEnv, runPlanningAI, cliArguments } from './ai-runner'
import { PlanningStore, revisionOf } from './store'
import { parsePlan, restoreDraft } from '../schema'
const plan = parsePlan(seed)
const codex = connectionFromEnv({ PLANNING_AI_RESOLVED: 'codex' })
const claude = connectionFromEnv({ PLANNING_AI_RESOLVED: 'claude' })
const response = (provider: string, value: unknown) => ({
  stdout:
    provider === 'claude'
      ? JSON.stringify({ is_error: false, result: JSON.stringify(value) })
      : JSON.stringify(value)
})
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'planning-ai-'))
  try {
    await mkdir(join(root, 'plans'))
    await writeFile(
      join(root, 'plans', plan.id + '.json'),
      JSON.stringify(plan)
    )
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('planning startup connection', () => {
  it('lets CLI options override per-user settings and rejects unknown providers', () => {
    expect(
      launchOptions(['--ai=claude', '--model', 'team-model'], {
        PLANNING_AI_PROVIDER: 'codex'
      })
    ).toEqual({ provider: 'claude', model: 'team-model' })
    expect(() => launchOptions(['--ai=typo'], {})).toThrow()
    expect(() => launchOptions(['--model'], {})).toThrow()
  })
  it('inherits a Codex thread only in auto mode and honors explicit Claude selection', async () => {
    const probe = vi.fn(async (_command: string) => ({
      stdout: '--thread',
      stderr: ''
    }))
    expect(await detectAI('auto', { CODEX_THREAD_ID: 'current' }, probe)).toBe(
      'codex-thread'
    )
    expect(probe).toHaveBeenCalledOnce()
    probe.mockResolvedValue({ stdout: '{"loggedIn":true}', stderr: '' })
    expect(
      await detectAI('claude', { CODEX_THREAD_ID: 'current' }, probe)
    ).toBe('claude')
    expect(probe.mock.calls.at(-1)?.[0]).toBe('claude')
  })
  it('falls back to authenticated Claude when Codex is unavailable, and never treats loggedOut as connected', async () => {
    const probe = vi.fn(async (command: string) => {
      if (command === 'codex') throw new Error('not installed')
      return { stdout: '{"loggedIn":true}', stderr: '' }
    })
    expect(await detectAI('auto', {}, probe)).toBe('claude')
    probe.mockResolvedValue({ stdout: '{"loggedIn":false}', stderr: '' })
    await expect(detectAI('claude', {}, probe)).rejects.toThrow('로그인')
    const unavailable = async () => {
      throw new Error('not installed')
    }
    expect(await detectAI('auto', {}, unavailable)).toBe('off')
    expect(
      connectionFromEnv({
        PLANNING_AI_RESOLVED: 'off',
        CODEX_THREAD_ID: 'current'
      }).available
    ).toBe(false)
  })
})

describe('provider-independent planning results', () => {
  it.each([codex, claude])(
    'validates and writes a $provider result without exposing file edits to the CLI',
    async (connection) =>
      fixture(async (root) => {
        const updated = { ...plan, notice: '새 조사 근거' }
        const run = vi.fn(async () =>
          response(connection.provider, { plan: updated })
        )
        await runPlanningAI(
          connection,
          'inspect',
          { kind: 'generate', root, planId: plan.id },
          run
        )
        expect(
          JSON.parse(
            await readFile(join(root, 'plans', plan.id + '.json'), 'utf8')
          ).notice
        ).toBe(updated.notice)
        const args = cliArguments(connection, 'quoted `prompt` $(not a shell)')
        expect(args.at(-1)).toBe('quoted `prompt` $(not a shell)')
        if (connection.provider === 'codex') expect(args).toContain('read-only')
        else expect(args).toContain('Read,Glob,Grep')
        expect(args.join(' ')).not.toMatch(
          /bypass|skip-permissions|acceptEdits/
        )
      })
  )
  it('preserves the plan when the provider returns malformed data or a different ID', async () =>
    fixture(async (root) => {
      const task = { kind: 'generate' as const, root, planId: plan.id }
      await expect(
        runPlanningAI(codex, '', task, async () => ({ stdout: 'not JSON' }))
      ).rejects.toThrow('응답 해석')
      await expect(
        runPlanningAI(codex, '', task, async () =>
          response('codex', { plan: { ...plan, id: 'another-plan' } })
        )
      ).rejects.toThrow('다른 기획 ID')
      expect(
        JSON.parse(
          await readFile(join(root, 'plans', plan.id + '.json'), 'utf8')
        )
      ).toEqual(plan)
    }))
  it('does not overwrite an edit made while AI is running', async () =>
    fixture(async (root) => {
      const changed = { ...plan, goal: '더 최근에 수정한 목적' }
      await expect(
        runPlanningAI(
          codex,
          '',
          { kind: 'generate', root, planId: plan.id },
          async () => {
            await writeFile(
              join(root, 'plans', plan.id + '.json'),
              JSON.stringify(changed)
            )
            return response('codex', { plan })
          }
        )
      ).rejects.toThrow('실행 중 기획이 변경')
      expect(
        JSON.parse(
          await readFile(join(root, 'plans', plan.id + '.json'), 'utf8')
        ).goal
      ).toBe(changed.goal)
    }))
  it('supports review and follow-up requests without a thread and keeps saved selection records intact', async () =>
    fixture(async (root) => {
      const store = new PlanningStore(
        root,
        null,
        (message, task) =>
          runPlanningAI(claude, message, task, async () =>
            response('claude', { markdown: '# 기획 결과', followUps: [] })
          ),
        claude
      )
      const selection = restoreDraft(null, plan)
      for (const item of selection.items) item.choice = 'include'
      const saved = await store.save(plan.id, selection, true, revisionOf(plan))
      expect(saved.completed).toBe(true)
      const before = await readFile(saved.path, 'utf8')
      expect((await store.results(plan.id)).results[0].content).toBe(
        '# 기획 결과'
      )
      await expect(
        store.requestFollowUps(plan.id, saved.recordId)
      ).resolves.toMatchObject({ completed: true })
      expect(await readFile(saved.path, 'utf8')).toBe(before)
      expect(JSON.parse(before).ai.provider).toBe('claude')
      expect(JSON.parse(before).delivery).toBe('completed')
    }))
  it('does not publish a review when follow-up validation fails', async () =>
    fixture(async (root) => {
      const store = new PlanningStore(
        root,
        null,
        (message, task) =>
          runPlanningAI(codex, message, task, async () =>
            response('codex', {
              markdown: '# invalid result',
              followUps: [{ question: 'incomplete' }]
            })
          ),
        codex
      )
      const selection = restoreDraft(null, plan)
      for (const item of selection.items) item.choice = 'include'
      await expect(
        store.save(plan.id, selection, true, revisionOf(plan))
      ).rejects.toThrow('선택은 저장')
      expect((await store.results(plan.id)).results).toEqual([])
    }))
})
