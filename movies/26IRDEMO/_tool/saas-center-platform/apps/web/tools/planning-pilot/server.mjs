import { createServer, loadEnv } from 'vite'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchOptions, detectAI } from './ai-config.mjs'
process.chdir(dirname(fileURLToPath(import.meta.url)))
const local = loadEnv('development', process.cwd(), 'PLANNING_')
const env = { ...local, ...process.env }
let server
try {
  const { provider, model } = launchOptions(process.argv.slice(2), env)
  const selected = await detectAI(provider, env)
  if (selected === 'codex-thread' && model)
    throw new Error(
      '기존 대화는 해당 대화의 모델을 사용합니다. 모델을 지정하려면 --ai=codex로 실행하세요.'
    )
  for (const [key, value] of Object.entries(local)) process.env[key] ??= value
  process.env.PLANNING_AI_RESOLVED = selected
  process.env.PLANNING_AI_MODEL = model
  console.log(
    '[기획 AI] ' +
      {
        'codex-thread': '현재 Codex 대화 연결',
        codex: 'Codex CLI · 독립 실행',
        claude: 'Claude Code CLI · 독립 실행',
        off: '미연결 · 조회와 저장 가능 (CLI 로그인 후 재실행)'
      }[selected]
  )
  if (model) console.log('[기획 AI 모델] ' + model)
  server = await createServer()
  await server.listen()
  server.printUrls()
} catch (error) {
  await server?.close()
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
