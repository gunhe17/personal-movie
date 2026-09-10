#!/usr/bin/env node
// capture-phone.mjs — iOS 시뮬레이터(내담자 앱 mobile-client · 상담사 앱 mobile) 촬영 러너. SPEC_PHONE은 여기가 정본이다.
//
//   node capture-phone.mjs --scene s05-일정 --action request --udid booted \
//        --app kr.mindscope.client.dev --script _scripts/s05-phone-request.mjs --seed _seed/x.json [--calibrate]
//   node capture-phone.mjs --scene s05-일정 --action request --udid booted --manual --seconds 25 --seed _seed/x.json
//        → idb 없이 사람이 시뮬레이터를 직접 조작하는 동안 녹화만 한다 (조작 시각은 남지 않는다)
//
// 엔진: sckcap 창 모드 — Simulator 창 하나를 잡는다. 베젤 off · 터치 표시 on · Point Accurate(스케일 1.0) 전제.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { phone, hasIdb } from './phone.mjs'
import { DEMO_ROOT, APP_ROOT, SCK_BIN, ensureSck, sceneDirs, nextTake, writeMeta, seedInfo, gitShort, probeDuration, pngSize, sha256, sleep, log, die, parseArgs, sh } from './common.mjs'

// ── SPEC_PHONE ────────────────────────────────────────────────────────────
export const SPEC_PHONE = {
  version: 1,
  simulator: { showChrome: false, showSingleTouches: true, scale: 1.0, trimTopPt: 52 },   // 베젤 off · 터치 표시 · Point Accurate · 타이틀바 52pt(측정값)
  capture: { tool: 'sckcap (ScreenCaptureKit, 창 모드)', fps: 60, codec: 'h264', bitrate: 20_000_000, cursor: 'simulator touch indicator', audio: false },
  timing: { lead: 3000, tail: 3000, preTap: 400, postTap: 900, afterType: 400, swipe: 500, afterSwipe: 900, beat: 1200 }
}
const SIM_BUNDLE = 'com.apple.iphonesimulator'
// ──────────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2))
for (const k of ['scene', 'action']) if (!args[k]) die(`--${k} 필요`)
const device = 'phone'
const { sceneDir, rawDir, stillDir } = sceneDirs(args.scene)
const seed = args.dry ? { file: null, sha256: null } : seedInfo(args.seed ?? die('--seed 필요 (시험이면 --dry)'))
const sceneNo = args.scene.split('-')[0]
const take = nextTake(rawDir, sceneNo, device, args.action)
const id = `${sceneNo}_${device}_${args.action}_${take}`

// 시뮬레이터
const udid = resolveUdid(args.udid ?? 'booted')
const devName = deviceName(udid)
sh(`open -a Simulator`); await sleep(2500)
const tmpShot = path.join(stillDir, '.devshot.png')
sh(`xcrun simctl io ${udid} screenshot "${tmpShot}"`); const devicePx = pngSize(tmpShot); fs.unlinkSync(tmpShot)
const prefs = { showChrome: readPref('ShowChrome'), showSingleTouches: readPref('ShowSingleTouches') }
if (prefs.showChrome !== '0' || prefs.showSingleTouches !== '1')
  log(`경고: Simulator 설정이 SPEC과 다름 (ShowChrome=${prefs.showChrome}, ShowSingleTouches=${prefs.showSingleTouches}). \`defaults write com.apple.iphonesimulator ShowChrome -bool false; defaults write com.apple.iphonesimulator ShowSingleTouches -bool true\` 후 Simulator 재시작`)
if (args.app) { sh(`xcrun simctl launch ${udid} ${args.app}`); await sleep(1500) }
if (args.url) { sh(`xcrun simctl openurl ${udid} "${args.url}"`); await sleep(1500) }
ensureSck()
const sckArgs = ['--bundle-id', SIM_BUNDLE, '--window-title', devName, '--trim-top', String(SPEC_PHONE.simulator.trimTopPt), '--scale', '2',
  '--fps', String(SPEC_PHONE.capture.fps), '--codec', SPEC_PHONE.capture.codec, '--bitrate', String(SPEC_PHONE.capture.bitrate)]

if (args.calibrate) {
  const out = args.out ? path.resolve(args.out) : path.join(stillDir, 'calibrate-phone.png')   // --out: 기존 보정본을 덮지 않고 딴 데로 (무대 점검용)
  const r = spawnSyncSck([...sckArgs, '--still', out])
  if (!fs.existsSync(out)) die(`보정 실패\n${r}`)
  const px = pngSize(out)
  const ratioOk = Math.abs(px[1] / px[0] - devicePx[1] / devicePx[0]) < 0.01
  log(`보정 이미지: ${out}  캡처 ${px[0]}×${px[1]}  기기 ${devicePx[0]}×${devicePx[1]}  비율 ${ratioOk ? '일치' : '불일치 — trim-top 또는 베젤 설정 확인'}`)
  process.exit(ratioOk ? 0 : 2)
}

// 스크립트 또는 수동
let steps = null, scriptSha = null
if (!args.manual) {
  if (!args.script) die('--script 또는 --manual 필요')
  if (!hasIdb()) die('idb 없음 — 설치: brew tap facebook/fb && brew install idb-companion && python3 -m pip install fb-idb  (설치 전엔 --manual)')
  const scriptPath = path.join(DEMO_ROOT, args.script)
  if (!fs.existsSync(scriptPath)) die(`스크립트 없음: ${scriptPath}`)
  scriptSha = sha256(fs.readFileSync(scriptPath))
  steps = (await import(pathToFileURL(scriptPath).href)).default
  if (typeof steps !== 'function') die('스크립트는 export default async function steps(p) 여야 한다')
}

// ── 캡처 ──
const outFile = path.join(rawDir, `${id}.mov`)
if (fs.existsSync(outFile)) die(`이미 있음 (덮어쓰기 금지): ${outFile}`)
const cap = spawn(SCK_BIN, [...sckArgs, '--out', outFile], { stdio: ['pipe', 'pipe', 'pipe'] })
let capOut = '', capErr = ''
cap.stderr.on('data', (d) => { capErr += d })
const ready = new Promise((res) => { cap.stdout.on('data', (d) => { capOut += d; if (capOut.includes('READY')) res(true) }); cap.on('close', () => res(false)); setTimeout(() => res(false), 8000) })
if (!(await ready)) die(`캡처러가 첫 프레임을 내지 못함\n${capErr.slice(-800)}`)
const t0 = Date.now()
const clock = { now: () => (Date.now() - t0) / 1000 }
const p = phone(udid, SPEC_PHONE.timing, clock)

let ok = true, err = null
try {
  await sleep(SPEC_PHONE.timing.lead)
  p.marks.push({ t: +clock.now().toFixed(2), kind: 'lead-end', target: '' })
  if (steps) await steps(p)
  else {
    const secs = +(args.seconds ?? 20)
    log(`수동 조작 ${secs}초 — 지금 시뮬레이터를 조작하세요`)
    p.marks.push({ t: +clock.now().toFixed(2), kind: 'manual', target: `${secs}s`, note: '사람이 직접 조작' })
    await sleep(secs * 1000)
  }
  p.marks.push({ t: +clock.now().toFixed(2), kind: 'steps-end', target: '' })
  await sleep(SPEC_PHONE.timing.tail)
} catch (e) { ok = false; err = e.message; log(`조작 실패: ${e.message}`) }

cap.stdin.write('q\n'); cap.stdin.end()
await new Promise((res) => cap.on('close', res))
const statsLine = capOut.trim().split('\n').filter((l) => l.startsWith('{')).pop()
const stats = statsLine ? JSON.parse(statsLine) : null
if (!fs.existsSync(outFile)) die(`캡처 출력 없음\n${capErr.slice(-800)}`)

writeMeta({
  id, scene: args.scene, device, action: args.action, take,
  captured_at: new Date().toISOString(), spec_version: SPEC_PHONE.version, captured_by: `skill:capture-service (phone${args.manual ? ', manual' : ''})`,
  app: { bundle_id: args.app ?? null, url: args.url ?? null, env: 'local', commit: gitShort(APP_ROOT) },
  viewport: { simulator: devName, udid, device_px: devicePx, pixels: stats?.size ?? null, scale: 'point-accurate (창 pt × 2)', theme: null },
  capture: { ...SPEC_PHONE.capture, simulator_prefs: SPEC_PHONE.simulator, stats },
  timing: SPEC_PHONE.timing, seed,
  script: scriptSha ? { file: args.script, sha256: scriptSha } : null,
  steps: p.marks, nocut: p.nocut,
  ...(args['retake-of'] ? { retake_of: args['retake-of'], retake_reason: args.reason ?? '' } : {}),
  result: { file: path.relative(sceneDir, outFile), duration: probeDuration(outFile), ok, error: err }
}, rawDir, args.note)
log(`${ok ? '완료' : '실패(파일은 남김)'}: ${path.relative(DEMO_ROOT, outFile)}  ${probeDuration(outFile)}s  ${stats ? `frames=${stats.appended} dup=${stats.dupped} sck=${stats.received} ${stats.size.join('×')}` : ''}`)
process.exit(ok ? 0 : 2)

// ── helpers ──
function resolveUdid(u) {
  const j = JSON.parse(sh('xcrun simctl list devices -j'))
  const all = Object.values(j.devices).flat()
  if (u === 'booted') { const b = all.find((d) => d.state === 'Booted'); if (!b) die('부팅된 시뮬레이터 없음 — --udid <UDID> 로 지정'); return b.udid }
  const d = all.find((x) => x.udid === u || x.name === u); if (!d) die(`시뮬레이터 없음: ${u}`)
  if (d.state !== 'Booted') { log(`부팅: ${d.name}`); sh(`xcrun simctl boot ${d.udid}`); sh(`xcrun simctl bootstatus ${d.udid} -b`) }
  return d.udid
}
function deviceName(u) { const j = JSON.parse(sh('xcrun simctl list devices -j')); return Object.values(j.devices).flat().find((d) => d.udid === u)?.name ?? die('기기 이름 없음') }
function readPref(k) { try { return sh(`defaults read com.apple.iphonesimulator ${k}`).trim() } catch { return null } }
function spawnSyncSck(a) { try { return sh(`"${SCK_BIN}" ${a.map((x) => `"${x}"`).join(' ')}`, { timeout: 15000 }) } catch (e) { return String(e.stderr ?? e.message) } }
