#!/usr/bin/env node
// rehearse.mjs — 촬영 전 리허설. 캡처하지 않는다.
// 장면 스크립트와 목 대본을 촬영과 똑같은 조건으로 돌려서, 끝까지 가는지·무엇이 깨지는지만 본다.
//
//   node rehearse.mjs --scene s01-접수 --url http://localhost:3503/agent \
//        --state _state/local-saas-counselor1.json --script _scripts/s01-intake.mjs \
//        --mock _mocks/s01-intake.json [--fast] [--headless] [--keep]
//
// 종료 코드: 0 통과 · 2 조작 실패 · 3 서버 오류(4xx·5xx) · 4 페이지 오류
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { human } from '../../capture-service/scripts/human.mjs'
import { SPEC } from '../../capture-service/scripts/spec.mjs'
import { ensureWav, sttArgs, installStt } from '../../capture-service/scripts/stt.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEMO_ROOT = path.resolve(HERE, '../../../../movies/26IRDEMO')
const APP_ROOT = process.env.CAPTURE_APP_ROOT ?? path.join(DEMO_ROOT, '_tool/saas-center-platform')
const PLAYWRIGHT_FROM = process.env.CAPTURE_PLAYWRIGHT_FROM ?? path.join(APP_ROOT, 'apps/web/package.json')

const args = parseArgs(process.argv.slice(2))
for (const k of ['scene', 'url', 'script']) if (!args[k]) die(`--${k} 필요`)

const scriptPath = path.join(DEMO_ROOT, args.script)
if (!fs.existsSync(scriptPath)) die(`스크립트 없음: ${scriptPath}`)
const steps = (await import(pathToFileURL(scriptPath).href + `?t=${Date.now()}`)).default
if (typeof steps !== 'function') die('스크립트는 export default async function steps(page, h) 여야 한다')

let mock = null
if (args.mock) {
  const p = path.join(DEMO_ROOT, args.mock)
  if (!fs.existsSync(p)) die(`목 대본 없음: ${p}`)
  mock = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (!Array.isArray(mock.turns)) die('목 대본에 turns 배열이 필요하다')
}

// 리허설은 SPEC 타이밍을 그대로 쓴다 — 대기가 짧아서 되던 것이 촬영에서 깨지면 안 된다.
// --fast는 셀렉터만 빠르게 훑어볼 때. 이걸로 통과했다고 촬영 통과는 아니다.
const T = args.fast
  ? { ...SPEC.timing, move: 120, moveSteps: 6, preClick: 80, postClick: 200, type: 8, afterType: 100, beat: 300, modal: 250, scrollEvery: 10, afterScroll: 200 }
  : SPEC.timing

const { chromium } = createRequire(PLAYWRIGHT_FROM)('playwright')
const stt = args.stt ? JSON.parse(fs.readFileSync(path.join(DEMO_ROOT, args.stt), 'utf8')) : null
const sttWav = stt ? ensureWav(path.join(DEMO_ROOT, '_mocks/.stt-clip.wav')) : null

const browser = await chromium.launch({
  headless: !!args.headless,
  args: ['--window-position=80,60', '--hide-crash-restore-bubble', '--disable-infobars',
    '--disable-features=MacWebContentsOcclusion,CalculateNativeWinOcclusion,Translate,TranslateUI',
    '--no-first-run', '--no-default-browser-check', '--lang=ko-KR',
    ...(sttWav ? sttArgs(sttWav) : [])]
})
const context = await browser.newContext({
  viewport: { width: SPEC.viewport.width, height: SPEC.viewport.height },
  deviceScaleFactor: SPEC.viewport.dpr,
  colorScheme: SPEC.theme,
  locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  ...(stt ? { permissions: ['microphone'] } : {}),
  ...(args.state ? { storageState: path.join(DEMO_ROOT, args.state) } : {})
})
if (stt) await installStt(context, stt.clips)
if (mock) {
  await context.addInitScript((s) => {
    try { if (!sessionStorage.getItem('agent-mock:v2')) sessionStorage.setItem('agent-mock:v2', JSON.stringify({ active: true, script: s, cursor: 0 })) } catch { /* noop */ }
  }, mock)
}

// ── 관찰: 서버 오류 · 페이지 오류 · 콘솔 오류 ──
const httpErrors = [], pageErrors = [], consoleErrors = []
const page = await context.newPage()
page.on('response', (r) => {
  if (r.status() >= 400) httpErrors.push({ status: r.status(), method: r.request().method(), url: shortUrl(r.url()) })
})
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })

await page.goto(args.url, { waitUntil: 'load' }).catch((e) => log(`goto 경고: ${e.message}`))
await sleep(1500)

const t0 = Date.now()
const clock = { now: () => (Date.now() - t0) / 1000 }
const h = human(page, T, clock, SPEC.park)

let ok = true, failedAt = null, err = null
try {
  await steps(page, h)
} catch (e) {
  ok = false
  err = e.message.split('\n')[0]
  failedAt = h.marks[h.marks.length - 1] ?? null
}
await sleep(800)   // 마지막 조작의 응답이 도착할 시간

// ── 보고 ──
const line = (s) => process.stdout.write(s + '\n')
line('')
line(`장면 ${args.scene}  ·  ${path.basename(args.script)}${mock ? `  ·  목 "${mock.title ?? ''}" (턴 ${mock.turns.length})` : ''}`)
line(`조작 ${h.marks.length}단계  ${clock.now().toFixed(1)}초  →  ${ok ? '끝까지 감' : '중간에 멈춤'}`)
if (!ok) {
  line(`  실패: ${err}`)
  if (failedAt) line(`  마지막 성공 단계: t=${failedAt.t} ${failedAt.kind} ${failedAt.note ?? failedAt.target ?? ''}`)
}
if (httpErrors.length) {
  line(`서버 오류 ${httpErrors.length}건 — 화면은 멀쩡해 보여도 저장이 안 된 것일 수 있다`)
  for (const e of dedupe(httpErrors)) line(`  ${e.status} ${e.method} ${e.url}`)
}
if (pageErrors.length) { line(`페이지 오류 ${pageErrors.length}건`); for (const e of [...new Set(pageErrors)].slice(0, 5)) line(`  ${e}`) }
if (consoleErrors.length) { line(`콘솔 오류 ${consoleErrors.length}건`); for (const e of [...new Set(consoleErrors)].slice(0, 5)) line(`  ${e}`) }
if (ok && !httpErrors.length && !pageErrors.length) line('깨끗하다 — 촬영 가능')
line('')
line('단계 기록:')
for (const m of h.marks) line(`  t=${String(m.t).padEnd(6)} ${m.kind.padEnd(9)} ${m.note ?? m.target ?? ''}`)
if (h.nocut.length) { line('노컷 후보:'); for (const n of h.nocut) line(`  ${n.start}–${n.end ?? '?'}  ${n.note ?? ''}`) }

if (args.keep) { line(''); line('브라우저를 열어 둔다 — 확인 후 직접 닫아라'); await new Promise(() => {}) }
await browser.close()
process.exit(!ok ? 2 : httpErrors.length ? 3 : pageErrors.length ? 4 : 0)

function dedupe(list) {
  const seen = new Map()
  for (const e of list) seen.set(`${e.status} ${e.method} ${e.url}`, e)
  return [...seen.values()]
}
function shortUrl(u) { try { const x = new URL(u); return x.pathname.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/g, '/<id>') } catch { return u.slice(0, 80) } }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function log(s) { process.stderr.write(`[rehearse] ${s}\n`) }
function die(s) { log(s); process.exit(1) }
function parseArgs(a) { const o = {}; for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; o[k] = v } } return o }
