// common.mjs — capture.mjs(web) · capture-phone.mjs(phone)가 같이 쓰는 헬퍼
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = path.dirname(fileURLToPath(import.meta.url))
export const DEMO_ROOT = path.resolve(HERE, '../../../../movies/26IRDEMO')
export const APP_ROOT = process.env.CAPTURE_APP_ROOT ?? '/Users/gunhee/workspace/codespace/domain/imomtae/imomtae-v3/TF/saas-center-platform'
export const SCK_SRC = path.join(HERE, 'sckcap.swift'), SCK_BIN = path.join(HERE, 'sckcap')

export function ensureSck() {
  const stale = !fs.existsSync(SCK_BIN) || fs.statSync(SCK_SRC).mtimeMs > fs.statSync(SCK_BIN).mtimeMs
  if (!stale) return
  log('sckcap 컴파일 중…')
  try { execSync(`swiftc -O -swift-version 5 -o "${SCK_BIN}" "${SCK_SRC}"`, { stdio: ['ignore', 'ignore', 'pipe'] }) }
  catch (e) { die(`sckcap 컴파일 실패:\n${e.stderr}`) }
}
export function sceneDirs(scene) {
  const sceneDir = path.join(DEMO_ROOT, scene)
  if (!fs.existsSync(sceneDir)) die(`장면 폴더 없음: ${sceneDir}`)
  const rawDir = path.join(sceneDir, 'raw'), stillDir = path.join(sceneDir, 'stills')
  fs.mkdirSync(rawDir, { recursive: true }); fs.mkdirSync(stillDir, { recursive: true })
  return { sceneDir, rawDir, stillDir }
}
export function nextTake(dir, s, dev, act) {
  const re = new RegExp(`^${s}_${dev}_${act}_t(\\d+)\\.`)
  const n = fs.readdirSync(dir).map((f) => f.match(re)).filter(Boolean).map((m) => +m[1])
  return `t${String((n.length ? Math.max(...n) : 0) + 1).padStart(2, '0')}`
}
export function takeFromName(f) { const m = path.basename(f).match(/_t(\d+)\./); return m ? `t${m[1]}` : 't01' }
export function writeMeta(meta, rawDir, note) {
  const metaPath = path.join(rawDir, `${meta.id}.meta.json`)
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
  const row = [meta.result.file, meta.scene, meta.device, meta.action, meta.take, '', '', '', (note ?? '').replace(/,/g, ' ')].join(',')
  fs.appendFileSync(path.join(DEMO_ROOT, 'manifest.csv'), row + '\n')
  log(`meta: ${path.relative(DEMO_ROOT, metaPath)}  manifest +1`)
}
export function seedInfo(seed) {
  if (!seed) return { file: null, sha256: null }
  const p = path.join(DEMO_ROOT, seed)
  if (!fs.existsSync(p)) die(`시드 없음: ${seed} — 촬영 전에 _seed/에 박제할 것`)
  return { file: seed, sha256: sha256(fs.readFileSync(p)) }
}
export function gitShort(root) { try { return execSync(`git -C "${root}" rev-parse --short HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return null } }
export function probeDuration(f) { try { return +(+execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString()).toFixed(2) } catch { return null } }
export function probeSize(f) { try { const [w, h] = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${f}"`).toString().trim().split(',').map(Number); return [w, h] } catch { return null } }
export function probeCodec(f) { try { return execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${f}"`).toString().trim() } catch { return null } }
export function pngSize(f) { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)] }
export function sha256(b) { return createHash('sha256').update(b).digest('hex') }
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
export function log(s) { process.stderr.write(`[capture] ${s}\n`) }
export function die(s) { log(s); process.exit(1) }
export function parseArgs(a) { const o = {}; for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; o[k] = v } } return o }
export function sh(cmd, opts = {}) { return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString() }
