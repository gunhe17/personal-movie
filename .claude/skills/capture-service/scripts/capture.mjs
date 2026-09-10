#!/usr/bin/env node
// capture.mjs — 서비스 화면 촬영 러너. SPEC은 여기가 정본이다.
//
//   node capture.mjs --scene s05-일정 --device web --action approve \
//        --url http://localhost:3503/schedule/reservations --state _state/local-admin.json \
//        --script _scripts/s05-approve.mjs --seed _seed/2026-09-10.json \
//        [--mock _mocks/s01-intake.json] [--calibrate] [--retake-of t01 --reason "..."]
//   node capture.mjs --manual raw/s05_phone_request_t01.mov --scene s05-일정 --device phone --action request --seed _seed/x.json
//
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { human } from './human.mjs'

// ── SPEC ──────────────────────────────────────────────────────────────────
export { SPEC } from './spec.mjs'
import { SPEC } from './spec.mjs'
import { ensureWav, sttArgs, installStt } from './stt.mjs'
import { checkAuth, RELOGIN_HINT } from './auth-check.mjs'
const HERE = path.dirname(fileURLToPath(import.meta.url))

const DEMO_ROOT = path.resolve(HERE, '../../../../movies/26IRDEMO')
const APP_ROOT = process.env.CAPTURE_APP_ROOT ?? path.join(DEMO_ROOT, '_tool/saas-center-platform')
const PLAYWRIGHT_FROM = process.env.CAPTURE_PLAYWRIGHT_FROM ?? path.join(APP_ROOT, 'apps/web/package.json')
const SCK_SRC = path.join(HERE, 'sckcap.swift'), SCK_BIN = path.join(HERE, 'sckcap')
const TOP_BORDER_PT = 1       // 전체화면 툴바 하단 경계선 — 보정 프레임 픽셀로 측정 (Chromium 1243 · macOS 26)
const CHROMIUM_BUNDLE_ID = 'com.google.chrome.for.testing'   // Playwright Chromium(Info.plist 기준). SCK 앱 필터가 이 앱의 창만 잡는다
// ──────────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2))
// 촬영 규격 프로파일 — 기본은 web(1600×900). `--profile phone`이면 폰 뷰포트로 찍는다(SPEC v7).
// 이 아래로 SPEC.viewport를 직접 읽지 않는다 — 전부 VP를 본다.
const VP = SPEC.profiles?.[args.profile ?? 'web'] ?? SPEC.viewport
const PARK = VP.park ?? { x: VP.width - 24, y: VP.height - 24 }
const need = (k) => { if (!args[k]) die(`--${k} 필요`) }
need('scene'); need('device'); need('action')
const sceneDir = path.join(DEMO_ROOT, args.scene)
if (!fs.existsSync(sceneDir)) die(`장면 폴더 없음: ${sceneDir}`)
const rawDir = path.join(sceneDir, 'raw'), stillDir = path.join(sceneDir, 'stills')
fs.mkdirSync(rawDir, { recursive: true }); fs.mkdirSync(stillDir, { recursive: true })
if (!args.dry) { need('seed'); if (!fs.existsSync(path.join(DEMO_ROOT, args.seed))) die(`시드 없음: ${args.seed} — 촬영 전에 _seed/에 박제할 것`) }

const sceneNo = args.scene.split('-')[0]
const take = args.manual ? takeFromName(args.manual) : nextTake(rawDir, sceneNo, args.device, args.action)
const id = `${sceneNo}_${args.device}_${args.action}_${take}`
const appCommit = gitShort(APP_ROOT)

if (args.manual) { writeMeta(manualMeta()); process.exit(0) }

need('url'); need('script')
const scriptPath = path.join(DEMO_ROOT, args.script)
if (!fs.existsSync(scriptPath)) die(`스크립트 없음: ${scriptPath}`)
const scriptSha = sha256(fs.readFileSync(scriptPath))
const steps = (await import(pathToFileURL(scriptPath).href)).default
if (typeof steps !== 'function') die('스크립트는 export default async function steps(page, h) 여야 한다')

// 목 에이전트 — saas-center-platform의 mock-capture 스킬 스크립트를 그대로 싣는다.
// 편집기(/lab/agent-mock)를 손으로 거치지 않고 sessionStorage에 직접 건다. 키는 store.svelte.ts의 KEY.
let mock = null
if (args.mock) {
  const mockPath = path.join(DEMO_ROOT, args.mock)
  if (!fs.existsSync(mockPath)) die(`목 스크립트 없음: ${mockPath}`)
  const buf = fs.readFileSync(mockPath)
  mock = { file: args.mock, sha256: sha256(buf), script: JSON.parse(buf) }
  if (!Array.isArray(mock.script.turns)) die('목 스크립트에 turns 배열이 필요하다')
}
ensureSck()

let chromium
try { ({ chromium } = createRequire(PLAYWRIGHT_FROM)('playwright')) }
catch { die(`playwright를 못 찾음 (${PLAYWRIGHT_FROM} 기준) — 앱에 의존성부터 깔 것: cd ${APP_ROOT} && pnpm install. 다른 사본을 쓰려면 CAPTURE_APP_ROOT 또는 CAPTURE_PLAYWRIGHT_FROM.`) }
// 가려진 창은 macOS/Chromium이 렌더를 멈춘다 — 창 뒤에서 촬영하려면 그 절전을 전부 꺼야 한다
const stt = args.stt ? JSON.parse(fs.readFileSync(path.join(DEMO_ROOT, args.stt), 'utf8')) : null
const sttWav = stt ? ensureWav(path.join(DEMO_ROOT, '_mocks/.stt-clip.wav'), { speechSec: stt.speechSec, silenceSec: stt.silenceSec }) : null

const browser = await chromium.launch({
  headless: false,
  args: ['--window-position=80,60', '--hide-crash-restore-bubble', '--disable-infobars',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    // 번역 풍선은 브라우저 UI인데 콘텐츠 위에 뜬다 — 프레임에 들어오므로 끈다
    // MacWebContentsOcclusion — macOS에서 창이 가려지면 렌더를 멈추는 그 기능. 이게 켜져 있으면 가려진 순간 프레임이 검게 나온다
    '--disable-features=MacWebContentsOcclusion,CalculateNativeWinOcclusion,Translate,TranslateUI',
    '--no-first-run', '--no-default-browser-check', '--lang=ko-KR',
    ...(sttWav ? sttArgs(sttWav) : [])]
})
const context = await browser.newContext({
  viewport: { width: VP.width, height: VP.height },
  deviceScaleFactor: VP.dpr,
  colorScheme: SPEC.theme,
  locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  ...(stt ? { permissions: ['microphone'] } : {}),
  ...(args.state ? { storageState: path.join(DEMO_ROOT, args.state) } : {})
})
// 로그인이 살아 있나 — **테이크를 태우기 전에** 묻는다. 죽은 토큰의 증상은 401이 아니라
// "셀렉터가 영영 안 나타남"이라 30초를 기다린 뒤에야 실패한다(s02 t06·t07을 여기서 잃었다).
if (args.state && args.url) {
  const auth = await checkAuth(context, args.url)
  log(`로그인 상태: ${auth.why}`)
  if (!auth.ok) { await browser.close(); die(RELOGIN_HINT(args.url, args.state)) }
}
if (stt) await installStt(context, stt.clips)
if (mock) {
  // 모든 내비게이션에서 돌기 때문에 이미 있으면 건드리지 않는다 — 덮으면 턴 커서가 0으로 되감긴다
  await context.addInitScript((s) => {
    try { if (!sessionStorage.getItem('agent-mock:v2')) sessionStorage.setItem('agent-mock:v2', JSON.stringify({ active: true, script: s, cursor: 0 })) } catch { /* 프라이빗 모드 — 목 없이 진행 */ }
  }, mock.script)
  log(`목 에이전트: ${mock.file} — ${mock.script.title ?? ''} (턴 ${mock.script.turns.length})`)
}
// 번역 풍선 죽이기 — 제품 app.html이 <html lang="en">이라 Chromium이 한국어 페이지를 영어로 보고 번역을 권한다.
// 그 풍선은 창에 붙는 별도 창이라 창 필터로도 안 빠지고, --disable-features=Translate·--disable-translate·--lang 전부 안 먹는다(실측).
// 파싱 시점의 lang 선언이 유일하게 듣는 신호라, 문서 응답만 가로채 그 한 글자를 바꾼다. 화면에 보이는 것은 아무것도 안 바뀐다.
await context.route('**/*', async (route) => {
  if (route.request().resourceType() !== 'document') return route.fallback()
  try {
    const res = await route.fetch()
    // **HTML일 때만 손댄다.** PDF도 document 리소스라 여기로 온다 — 그걸 text()로 읽어
    // 다시 채우면 바이너리가 깨져 뷰어가 "PDF 문서를 로드하지 못했습니다"를 띄운다
    // (s04 받는 쪽의 `결과 보기 · PDF`에서 실제로 겪었다, 2026-09-10).
    if (!/text\/html/i.test(res.headers()['content-type'] ?? '')) return route.fulfill({ response: res })
    let body = await res.text()
    body = /<html[^>]*\slang=/i.test(body)
      ? body.replace(/<html([^>]*)\slang="[^"]*"/i, '<html$1 lang="ko"')
      : body.replace(/<html/i, '<html lang="ko"')
    await route.fulfill({ response: res, body })
  } catch { await route.fallback() }
})
const page = await context.newPage()
// networkidle은 쓰지 않는다 — 알림 폴링 때문에 영원히 오지 않는다
await page.goto(args.url, { waitUntil: 'load' }).catch((e) => log(`goto 경고: ${e.message}`))
await sleep(1500)

// 전체화면도 포커스도 쓰지 않는다 — 창 필터로 잡으므로 창은 뒤에 있어도 되고, 사용자는 하던 일을 계속한다.
// 창 높이 = 뷰포트 + 브라우저 크롬 + 여유(아래 둥근 모서리를 캡처 사각형 밖으로 밀어낸다)
const cdp = await context.newCDPSession(page)
const { windowId } = await cdp.send('Browser.getWindowForTarget')
// 창을 특정하는 표식 — 창 제목은 페이지 제목이다. 캡처 사각형은 크롬 아래부터라 프레임엔 안 들어간다.
// SCK는 시작할 때 창을 한 번 잡으므로, 잡힌 뒤엔 페이지가 제목을 바꿔도 상관없다.
const WIN_MARK = `CAP-${id}`
// 앱이 하이드레이션·라우팅하며 document.title을 덮어쓴다 — sckcap을 띄우기 직전마다 다시 박는다
const markWindow = async () => {
  await page.evaluate((t) => { document.title = t }, WIN_MARK).catch(() => {})
  await sleep(350)
}
await markWindow()
// 창 위쪽 브라우저 크롬의 높이. 계산으로는 못 얻는다 —
// outerHeight-innerHeight는 7pt 틀리고, window.screenY는 뷰포트 에뮬레이션 때문에 0이 나온다.
// 그래서 페이지 맨 위에 마젠타 띠를 한 줄 넣고 창 전체를 한 장 찍어 그 줄이 몇 픽셀에 있는지 센다.
async function measureChromePt() {
  await page.evaluate(() => {
    const d = document.createElement('div'); d.id = '__capTop'
    d.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:2px;background:#FF00FF;z-index:2147483647;pointer-events:none'
    document.documentElement.appendChild(d)
  }).catch(() => {})
  await sleep(250)
  const probe = path.join(stillDir, '.probe.png')
  // 제목을 바꿔도 SCK의 창 목록에 반영되기까지 시간이 걸린다 — 한 번에 못 잡으면 더 기다렸다 다시 (실측: 간헐적)
  let sckErr = ''
  for (const wait of [0, 700, 1500]) {
    await sleep(wait)
    await markWindow()
    const r = spawnSync(SCK_BIN, ['--bundle-id', CHROMIUM_BUNDLE_ID, '--window-title', WIN_MARK, '--window-mode', 'display', '--scale', String(VP.dpr), '--trim-top', '0', '--still', probe])
    if (fs.existsSync(probe)) break
    sckErr = r.stderr || r.stdout
  }
  await page.evaluate(() => document.getElementById('__capTop')?.remove()).catch(() => {})
  if (!fs.existsSync(probe)) { log(`크롬 높이 측정: 창 스냅샷이 나오지 않았다 — 창 제목 '${WIN_MARK}' 매칭 실패\n${sckErr}`); return null }
  let px = null
  try {
    const raw = execSync(`ffmpeg -v error -i "${probe}" -vf "crop=1:ih:20:0" -f rawvideo -pix_fmt rgb24 -`, { maxBuffer: 1 << 26 })
    for (let y = 0; y * 3 + 2 < raw.length; y++) {
      if (raw[y * 3] > 200 && raw[y * 3 + 1] < 80 && raw[y * 3 + 2] > 200) { px = y; break }
    }
  } catch (e) { log(`크롬 높이 측정 실패: ${e.message}`) }
  fs.unlinkSync(probe)
  return px == null ? null : px / VP.dpr
}

await cdp.send('Browser.setWindowBounds', {
  windowId,
  bounds: { left: 80, top: 60, width: VP.width, height: VP.height + 140, windowState: 'normal' }
})
await sleep(1200)
const inner = await page.evaluate(() => [window.innerWidth, window.innerHeight])
if (inner[0] !== VP.width || inner[1] !== VP.height)
  log(`경고: 뷰포트 ${inner[0]}×${inner[1]} — SPEC ${VP.width}×${VP.height}과 다르다`)
await page.mouse.move(PARK.x, PARK.y)
await sleep(300)

const chromeH = await measureChromePt()
if (chromeH == null) die('브라우저 크롬 높이를 재지 못했다 — 창 캡처가 되는지(화면 기록 권한) 확인')

const rect = { x: 0, y: chromeH, w: VP.width, h: VP.height }   // 창 기준 points
log(`창 모드 '${WIN_MARK}' 크롬높이=${chromeH}pt → rect ${rect.w}×${rect.h}+${rect.x}+${rect.y}`)
const sckArgs = ['--rect', `${rect.x},${rect.y},${rect.w},${rect.h}`, '--trim-top', String(rect.y),
  '--scale', String(VP.dpr), '--fps', String(SPEC.capture.fps),
  '--codec', SPEC.capture.codec, '--bitrate', String(SPEC.capture.bitrate),
  '--bundle-id', CHROMIUM_BUNDLE_ID, '--window-title', WIN_MARK, '--window-mode', 'display', '--cursor', 'on']

// 캡처 직전에 한 번 더 앞으로 — 웹 모드는 디스플레이 기준 캡처라(앱 필터 + sourceRect)
// 전체화면 Chromium의 Space가 내려가 있으면 통째로 흰 프레임이 잡힌다. 조용히 망하는 실패라 여기서 막는다.
await page.bringToFront()
await sleep(800)

await markWindow()
if (args.calibrate) {
  const out = path.join(stillDir, 'calibrate.png')
  fs.rmSync(out, { force: true })   // 지우고 시작한다 — 남아 있으면 캡처가 실패해도 옛 프레임을 성공으로 읽는다
  const r = spawnSync(SCK_BIN, [...sckArgs, '--still', out])
  if (!fs.existsSync(out)) { await browser.close(); die(`보정 실패 — 화면 기록 권한 확인\n${r.stderr || r.stdout}`) }
  log(`보정 이미지: ${out}  rect=${JSON.stringify(rect)}`)
  await browser.close(); process.exit(0)
}

// ── 캡처 시작 ──
const outFile = path.join(rawDir, `${id}.mov`)
if (fs.existsSync(outFile)) die(`이미 있음 (덮어쓰기 금지): ${outFile}`)
const cap = spawn(SCK_BIN, [...sckArgs, '--out', outFile], { stdio: ['pipe', 'pipe', 'pipe'] })
let capOut = '', capErr = ''
cap.stderr.on('data', (d) => { capErr += d })
const ready = new Promise((res) => { cap.stdout.on('data', (d) => { capOut += d; if (capOut.includes('READY')) res(true) }); cap.on('close', () => res(false)); setTimeout(() => res(false), 8000) })
if (!(await ready)) { await browser.close(); die(`캡처러가 첫 프레임을 내지 못함 — 화면 기록 권한 확인\n${capErr.slice(-800)}`) }
await page.evaluate(() => { document.title = document.title.startsWith('CAP-') ? '' : document.title }).catch(() => {})
const t0 = Date.now()
const clock = { now: () => (Date.now() - t0) / 1000 }
const h = human(page, SPEC.timing, clock, PARK, (line) => { try { cap.stdin.write(line + '\n') } catch { /* 캡처러가 이미 닫혔다 */ } })

let ok = true, err = null
try {
  await sleep(SPEC.timing.lead)
  h.marks.push({ t: +clock.now().toFixed(2), kind: 'lead-end', target: '' })
  await steps(page, h)
  h.marks.push({ t: +clock.now().toFixed(2), kind: 'steps-end', target: '' })
  await sleep(SPEC.timing.tail)
} catch (e) { ok = false; err = e.message; log(`조작 실패: ${e.message}`) }

cap.stdin.write('q\n'); cap.stdin.end()
await new Promise((res) => cap.on('close', res))
const statsLine = capOut.trim().split('\n').filter((l) => l.startsWith('{')).pop()
const stats = statsLine ? JSON.parse(statsLine) : null
// 토큰이 회전하므로 갱신된 로그인 상태를 되써 둔다 — 다음 촬영이 만료된 상태로 시작하지 않게
if (args.state) await context.storageState({ path: path.join(DEMO_ROOT, args.state) }).catch(() => {})
await browser.close()
if (!fs.existsSync(outFile)) die(`캡처 출력 없음\n${capErr.slice(-800)}`)
const duration = probeDuration(outFile)

writeMeta({
  id, scene: args.scene, device: args.device, action: args.action, take,
  captured_at: new Date().toISOString(), spec_version: SPEC.version, captured_by: 'skill:capture-service',
  app: { url: args.url, env: args.env ?? guessEnv(args.url), commit: appCommit },
  viewport: { profile: args.profile ?? 'web', css: [VP.width, VP.height], dpr: VP.dpr, pixels: [rect.w * VP.dpr, rect.h * VP.dpr], theme: SPEC.theme },
  capture: { ...SPEC.capture, mode: 'window', chrome_pt: chromeH, rect_pt: rect, stats },
  timing: SPEC.timing,
  seed: { file: args.seed ?? null, sha256: args.seed ? sha256(fs.readFileSync(path.join(DEMO_ROOT, args.seed))) : null },
  script: { file: args.script, sha256: scriptSha },
  stt: stt ? { file: args.stt, clips: stt.clips } : null,
  mock: mock ? { file: mock.file, sha256: mock.sha256, title: mock.script.title ?? null, turns: mock.script.turns.length } : null,
  steps: h.marks, nocut: h.nocut,
  ...(args['retake-of'] ? { retake_of: args['retake-of'], retake_reason: args.reason ?? '' } : {}),
  result: { file: path.relative(sceneDir, outFile), duration, ok, error: err }
})
log(`${ok ? '완료' : '실패(파일은 남김)'}: ${path.relative(DEMO_ROOT, outFile)}  ${duration}s  steps=${h.marks.length}  ${stats ? `frames=${stats.appended} dup=${stats.dupped} sck=${stats.received}` : ''}`)
process.exit(ok ? 0 : 2)

// ── helpers ──
function ensureSck() {
  const stale = !fs.existsSync(SCK_BIN) || fs.statSync(SCK_SRC).mtimeMs > fs.statSync(SCK_BIN).mtimeMs
  if (!stale) return
  log('sckcap 컴파일 중…')
  try { execSync(`swiftc -O -swift-version 5 -o "${SCK_BIN}" "${SCK_SRC}"`, { stdio: ['ignore', 'ignore', 'pipe'] }) }
  catch (e) { die(`sckcap 컴파일 실패:\n${e.stderr}`) }
}
function spawnSync(bin, a) { try { return { stdout: execSync(`"${bin}" ${a.map((x) => `"${x}"`).join(' ')}`, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 }).toString(), stderr: '' } } catch (e) { return { stdout: '', stderr: String(e.stderr ?? e.message) } } }
function manualMeta() {
  const file = path.join(DEMO_ROOT, args.scene, args.manual.startsWith('raw/') ? args.manual : `raw/${path.basename(args.manual)}`)
  if (!fs.existsSync(file)) die(`파일 없음: ${file}`)
  const tool = args.device === 'device' ? 'ios-screen-recording' : 'simctl-recordVideo'
  return {
    id, scene: args.scene, device: args.device, action: args.action, take,
    captured_at: new Date().toISOString(), spec_version: SPEC.version, captured_by: 'skill:capture-service (manual)',
    app: { url: args.url ?? null, env: args.env ?? 'staging', commit: appCommit },
    viewport: probeSize(file), capture: { tool, fps: null, codec: probeCodec(file), cursor: 'native', audio: false },
    timing: null, seed: { file: args.seed ?? null, sha256: args.seed ? sha256(fs.readFileSync(path.join(DEMO_ROOT, args.seed))) : null },
    script: null, steps: [], nocut: [],
    ...(args['retake-of'] ? { retake_of: args['retake-of'], retake_reason: args.reason ?? '' } : {}),
    result: { file: path.relative(path.join(DEMO_ROOT, args.scene), file), duration: probeDuration(file), ok: true, error: null }
  }
}
function writeMeta(meta) {
  const metaPath = path.join(rawDir, `${meta.id}.meta.json`)
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
  const row = [meta.result.file, meta.scene, meta.device, meta.action, meta.take, '', '', '', (args.note ?? '').replace(/,/g, ' ')].join(',')
  fs.appendFileSync(path.join(DEMO_ROOT, 'manifest.csv'), row + '\n')
  log(`meta: ${path.relative(DEMO_ROOT, metaPath)}  manifest +1`)
}
function nextTake(dir, s, dev, act) {
  const re = new RegExp(`^${s}_${dev}_${act}_t(\\d+)\\.`)
  const n = fs.readdirSync(dir).map((f) => f.match(re)).filter(Boolean).map((m) => +m[1])
  return `t${String((n.length ? Math.max(...n) : 0) + 1).padStart(2, '0')}`
}
function takeFromName(f) { const m = path.basename(f).match(/_t(\d+)\./); return m ? `t${m[1]}` : 't01' }
function gitShort(root) { try { return execSync(`git -C "${root}" rev-parse --short HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return null } }
function probeDuration(f) { try { return +(+execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString()).toFixed(2) } catch { return null } }
function probeSize(f) { try { const [w, h] = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${f}"`).toString().trim().split(',').map(Number); return { css: null, dpr: null, pixels: [w, h], theme: null } } catch { return null } }
function probeCodec(f) { try { return execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${f}"`).toString().trim() } catch { return null } }
function guessEnv(u) { return /staging/.test(u) ? 'staging' : /^(file:|data:)|localhost|127\.0\.0\.1|192\.168/.test(u) ? 'local' : 'prod' }
function sha256(b) { return createHash('sha256').update(b).digest('hex') }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function log(s) { process.stderr.write(`[capture] ${s}\n`) }
function die(s) { log(s); process.exit(1) }
function parseArgs(a) { const o = {}; for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; o[k] = v } } return o }
