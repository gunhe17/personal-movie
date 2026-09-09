#!/usr/bin/env node
// capture.mjs — 서비스 화면 촬영 러너. SPEC은 여기가 정본이다.
//
//   node capture.mjs --scene s05-일정 --device web --action approve \
//        --url http://localhost:3503/schedule/reservations --state _state/local-admin.json \
//        --script _scripts/s05-approve.mjs --seed _seed/2026-09-10.json [--calibrate] [--retake-of t01 --reason "..."]
//   node capture.mjs --manual raw/s05_phone_request_t01.mov --scene s05-일정 --device phone --action request --seed _seed/x.json
//
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { human, CURSOR_INIT } from './human.mjs'

// ── SPEC ──────────────────────────────────────────────────────────────────
export const SPEC = {
  version: 2,
  viewport: { width: 1600, height: 900, dpr: 2 },           // CSS px · 16:9 · 캡처 3200×1800
  park: { x: 1576, y: 876 },                                // 커서 대기 위치 — 우하단, 툴팁을 띄우는 요소가 없는 곳
  theme: 'light',
  capture: { tool: 'sckcap (ScreenCaptureKit, 앱 필터)', fps: 60, codec: 'h264', bitrate: 40_000_000, cursor: 'overlay (OS 커서 제외)', audio: false },
  timing: { lead: 3000, tail: 3000, move: 700, moveSteps: 28, preClick: 500, postClick: 800, type: 70, afterType: 400, scrollStep: 120, scrollEvery: 60, afterScroll: 1000, beat: 1200, modal: 1000 }
}
const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEMO_ROOT = path.resolve(HERE, '../../../../movies/26IRDEMO')
const APP_ROOT = process.env.CAPTURE_APP_ROOT ?? '/Users/gunhee/workspace/codespace/domain/imomtae/imomtae-v3/TF/saas-center-platform'
const PLAYWRIGHT_FROM = process.env.CAPTURE_PLAYWRIGHT_FROM ?? path.join(APP_ROOT, 'apps/web/package.json')
const SCK_SRC = path.join(HERE, 'sckcap.swift'), SCK_BIN = path.join(HERE, 'sckcap')
const TOP_BORDER_PT = 1       // 전체화면 툴바 하단 경계선 — 보정 프레임 픽셀로 측정 (Chromium 1243 · macOS 26)
const CHROMIUM_BUNDLE_ID = 'com.google.chrome.for.testing'   // Playwright Chromium(Info.plist 기준). SCK 앱 필터가 이 앱의 창만 잡는다
// ──────────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2))
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
ensureSck()

const { chromium } = createRequire(PLAYWRIGHT_FROM)('playwright')
const browser = await chromium.launch({ headless: false, args: ['--window-position=120,80', '--hide-crash-restore-bubble', '--disable-infobars'] })
const context = await browser.newContext({
  viewport: { width: SPEC.viewport.width, height: SPEC.viewport.height },
  deviceScaleFactor: SPEC.viewport.dpr,
  colorScheme: SPEC.theme,
  locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  ...(args.state ? { storageState: path.join(DEMO_ROOT, args.state) } : {})
})
await context.addInitScript(CURSOR_INIT)
const page = await context.newPage()
// networkidle은 쓰지 않는다 — 알림 폴링 때문에 영원히 오지 않는다
await page.goto(args.url, { waitUntil: 'load' }).catch((e) => log(`goto 경고: ${e.message}`))
await sleep(1500)

// 네이티브 전체화면 — 페이지가 화면 좌상단에 붙어 크롭이 결정적이다. (SCK 앱 필터라 다른 창 간섭은 어차피 없다)
const cdp = await context.newCDPSession(page)
const { windowId } = await cdp.send('Browser.getWindowForTarget')
await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } })
await page.bringToFront()
await sleep(5000)                       // 전환 애니메이션 + Chromium "전체 화면 종료: Esc" 풍선(Chromium 소유 창이라 필터에 잡힌다)이 사라질 때까지
await page.mouse.move(SPEC.park.x, SPEC.park.y)
await sleep(300)

const geom = () => page.evaluate(() => ({ sx: window.screenX, sy: window.screenY, ow: window.outerWidth, oh: window.outerHeight }))
let g = await geom()
if (g.sx !== 0) {   // 전환이 씹히는 경우가 있다 — 한 번 더
  log(`전체화면 재시도 (창 x=${g.sx})`)
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } })
  await sleep(5000); await page.mouse.move(SPEC.park.x, SPEC.park.y); await sleep(300)
  g = await geom()
  if (g.sx !== 0) die(`전체화면이 되지 않음 — 창 x=${g.sx}. 다른 앱이 전체화면 전환을 막고 있는지 확인`)
}
const rect = { x: g.sx, y: g.sy + TOP_BORDER_PT, w: SPEC.viewport.width, h: SPEC.viewport.height }   // points
log(`전체화면 outer=${g.ow}×${g.oh} at (${g.sx},${g.sy})  → rect ${rect.w}×${rect.h}+${rect.x}+${rect.y} pt`)
const sckArgs = ['--rect', `${rect.x},${rect.y},${rect.w},${rect.h}`, '--scale', String(SPEC.viewport.dpr), '--fps', String(SPEC.capture.fps),
  '--codec', SPEC.capture.codec, '--bitrate', String(SPEC.capture.bitrate), '--bundle-id', CHROMIUM_BUNDLE_ID]

if (args.calibrate) {
  const out = path.join(stillDir, 'calibrate.png')
  const r = spawnSync(SCK_BIN, [...sckArgs, '--still', out])
  if (!fs.existsSync(out)) die(`보정 실패\n${r.stderr}`)
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
const t0 = Date.now()
const clock = { now: () => (Date.now() - t0) / 1000 }
const h = human(page, SPEC.timing, clock, SPEC.park)

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
  viewport: { css: [SPEC.viewport.width, SPEC.viewport.height], dpr: SPEC.viewport.dpr, pixels: [rect.w * SPEC.viewport.dpr, rect.h * SPEC.viewport.dpr], theme: SPEC.theme },
  capture: { ...SPEC.capture, rect_pt: rect, stats },
  timing: SPEC.timing,
  seed: { file: args.seed ?? null, sha256: args.seed ? sha256(fs.readFileSync(path.join(DEMO_ROOT, args.seed))) : null },
  script: { file: args.script, sha256: scriptSha },
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
