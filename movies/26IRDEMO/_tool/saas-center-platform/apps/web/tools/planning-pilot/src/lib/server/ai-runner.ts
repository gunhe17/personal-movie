import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AIConnection } from '../ai'
import { parsePlan, parseFollowUps } from '../schema'

const execute = promisify(execFile)
export interface AITask {
  kind: 'generate' | 'review' | 'questions'
  root: string
  planId: string
  recordId?: string
}
export class PlanningAIError extends Error {}
export function connectionFromEnv(env: NodeJS.ProcessEnv): AIConnection {
  const provider =
    env.PLANNING_AI_RESOLVED ?? (env.CODEX_THREAD_ID ? 'codex-thread' : 'off')
  const model = env.PLANNING_AI_MODEL || ''
  if (provider === 'codex-thread' && env.CODEX_THREAD_ID)
    return {
      provider: 'codex',
      mode: 'thread',
      available: true,
      label: 'Codex 대화 연결',
      model: ''
    }
  if (provider === 'codex' || provider === 'claude')
    return {
      provider,
      mode: 'cli',
      available: true,
      label: provider === 'codex' ? 'Codex CLI' : 'Claude Code CLI',
      model
    }
  return {
    provider: 'none',
    mode: 'off',
    available: false,
    label: 'AI 미연결 · 저장 가능',
    model: ''
  }
}

export function cliArguments(connection: AIConnection, prompt: string) {
  const model = connection.model ? ['--model', connection.model] : []
  return connection.provider === 'codex'
    ? ['exec', '--sandbox', 'read-only', '--color', 'never', ...model, prompt]
    : [
        '-p',
        '--output-format',
        'json',
        '--tools',
        'Read,Glob,Grep',
        '--allowedTools',
        'Read,Glob,Grep',
        ...model,
        '--',
        prompt
      ]
}
export function parseAIOutput(
  provider: AIConnection['provider'],
  stdout: string
): Record<string, unknown> {
  let text = stdout.trim()
  if (provider === 'claude') {
    const envelope = JSON.parse(text)
    if (envelope.is_error || typeof envelope.result !== 'string')
      throw new Error('Claude가 결과를 반환하지 못했습니다.')
    text = envelope.result.trim()
  }
  text = text.replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1')
  const result = JSON.parse(text)
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new Error('JSON 객체가 필요합니다.')
  return result
}
async function atomicWrite(path: string, content: string) {
  const temporary = path + '.' + randomUUID() + '.tmp'
  try {
    await writeFile(temporary, content, { flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

// The CLI reads the repository. Only validated planning artifacts are written by this server.
export async function runPlanningAI(
  connection: AIConnection,
  message: string,
  task: AITask,
  run: (
    command: string,
    args: string[],
    options: { cwd: string; timeout: number; maxBuffer: number }
  ) => Promise<{ stdout: string }> = execute
) {
  const planPath = join(task.root, 'plans', task.planId + '.json')
  const before = await readFile(planPath, 'utf8')
  const plan = parsePlan(JSON.parse(before))
  const recordBase = task.recordId
    ? join(task.root, 'records', task.planId, task.recordId)
    : ''
  const contract =
    task.kind === 'generate'
      ? '{"plan": 완전한 Plan 객체}'
      : task.kind === 'review'
        ? '{"markdown": 완성된 기획 문서 문자열, "followUps": 후속 질문 배열}'
        : '{"followUps": 후속 질문 배열}'
  const prompt = `기획 도구의 독립 실행 작업입니다. 저장된 기획/선택/결정 파일을 읽어 이전 맥락을 복원하세요.
코드와 문서는 읽기만 하세요. 아래 업무 설명의 파일 저장 지시는 생성할 내용과 형식을 뜻합니다. 직접 파일을 쓰거나 제품 코드를 수정하지 마세요.
최종 응답은 ${contract} 형식의 JSON 객체 하나만 반환하세요. 설명이나 코드 펜스는 붙이지 마세요. 실제 저장은 서버가 스키마 검증 후 수행합니다.
기획 형식은 ${join(task.root, 'README.md')}와 ${join(task.root, 'src/lib/schema.ts')}를 확인하세요.
업무 설명:\n${message}`
  let output: Record<string, unknown>
  try {
    const result = await run(
      connection.provider,
      cliArguments(connection, prompt),
      {
        cwd: resolve(task.root, '../../../..'),
        timeout: 600000,
        maxBuffer: 8 * 1024 * 1024
      }
    )
    output = parseAIOutput(connection.provider, result.stdout)
  } catch {
    throw new PlanningAIError(
      `${connection.label} 실행 또는 응답 해석에 실패했습니다. CLI 로그인·모델 설정을 확인하세요. 제한 시간은 10분이며 기존 기획은 유지됩니다.`
    )
  }
  try {
    if (task.kind === 'generate') {
      const updated = parsePlan(output.plan)
      if (updated.id !== plan.id)
        throw new Error('다른 기획 ID로 응답했습니다.')
      if ((await readFile(planPath, 'utf8')) !== before)
        throw new Error(
          '실행 중 기획이 변경되었습니다. 최신 초안에서 다시 요청하세요.'
        )
      await atomicWrite(planPath, JSON.stringify(updated, null, 2) + '\n')
    } else {
      if (!recordBase) throw new Error('저장 기록이 필요합니다.')
      const record = JSON.parse(await readFile(recordBase + '.json', 'utf8'))
      const followUps = parseFollowUps(output, {
        ...plan,
        features: record.features ?? []
      })
      if (
        task.kind === 'review' &&
        (typeof output.markdown !== 'string' || !output.markdown.trim())
      )
        throw new Error('기획 결과 문서가 비어 있습니다.')
      await atomicWrite(
        recordBase + '-review.json',
        JSON.stringify({ followUps }, null, 2) + '\n'
      )
      if (task.kind === 'review')
        await atomicWrite(recordBase + '-review.md', output.markdown as string)
    }
  } catch (error) {
    throw new PlanningAIError(
      'AI 결과를 저장하지 못했습니다. ' +
        (error instanceof Error ? error.message : '기획 형식을 확인하세요.')
    )
  }
  return { completed: true }
}
