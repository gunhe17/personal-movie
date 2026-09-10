import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execute = promisify(execFile)
const providers = ['auto', 'codex', 'claude', 'codex-thread', 'off']

export function launchOptions(args, env) {
  let provider = env.PLANNING_AI_PROVIDER || 'auto'
  let model = env.PLANNING_AI_MODEL || ''
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--') continue
    if (arg.startsWith('--ai=')) provider = arg.slice(5)
    else if (arg === '--ai') provider = args[++i]
    else if (arg.startsWith('--model=')) model = arg.slice(8)
    else if (arg === '--model') model = args[++i]
    else throw new Error('지원하지 않는 옵션: ' + arg)
  }
  if (!providers.includes(provider))
    throw new Error(
      '--ai는 auto, codex, claude, codex-thread, off 중 하나입니다.'
    )
  if (typeof model !== 'string' || model.length > 200 || /[\r\n\0]/.test(model))
    throw new Error('모델 이름을 확인하세요.')
  return { provider, model }
}

// Only authentication/help checks run at startup; no model request is made.
/**
 * @param {string} provider
 * @param {NodeJS.ProcessEnv} env
 * @param {(command: string, args: string[], options: {timeout: number, maxBuffer: number}) => Promise<{stdout: string, stderr: string}>} run
 */
export async function detectAI(provider, env, run = execute) {
  async function probe(command, args) {
    try {
      return await run(command, args, { timeout: 5000, maxBuffer: 64000 })
    } catch {
      return null
    }
  }
  if (provider === 'off') return 'off'
  if (
    (provider === 'auto' || provider === 'codex-thread') &&
    env.CODEX_THREAD_ID
  ) {
    const help = await probe('codex', ['queue', '--help'])
    if (help?.stdout.includes('--thread')) return 'codex-thread'
  }
  if (provider === 'codex-thread')
    throw new Error(
      'CODEX_THREAD_ID와 codex queue 지원이 필요합니다. 독립 실행은 --ai=codex를 사용하세요.'
    )
  for (const candidate of provider === 'auto'
    ? ['codex', 'claude']
    : [provider]) {
    const status = await probe(
      candidate,
      candidate === 'codex' ? ['login', 'status'] : ['auth', 'status', '--json']
    )
    if (!status) continue
    if (candidate === 'claude') {
      try {
        if (JSON.parse(status.stdout).loggedIn !== true) continue
      } catch {
        continue
      }
    }
    return candidate
  }
  if (provider !== 'auto')
    throw new Error(
      provider +
        ' CLI 설치와 로그인을 확인하세요. 저장만 사용하려면 --ai=off로 실행하세요.'
    )
  return 'off'
}
