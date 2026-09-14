#!/usr/bin/env node
// first-frame — 장면 폴더 · 프롬프트 린트 · 생성물 보관
// 생성 자체는 하지 않는다. Artlist MCP 도구를 대화에서 직접 부른다 (SKILL.md 참조).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(HERE, '..')
const ROOT = path.resolve(HERE, '../../../..')
const SCENES = path.join(ROOT, 'movies/26IRDEMO/v2')

const MODEL = { name: 'Kling o3', modelGroupId: 354, modelId: 2189 }
const SETTINGS = { aspect_ratio: '16:9', resolution: '2K', num_images: 9 }
const LEN = { min: 400, sweet: 1200, max: 2500 }

const die = (msg, code = 1) => { console.error(`✗ ${msg}`); process.exit(code) }
const ok = (msg) => console.log(`✓ ${msg}`)

// ── 프롬프트 린트 ────────────────────────────────────────────────────────────
// 랩 01이 크레딧 100을 주고 산 실패 둘을 여기서 막는다:
//   ① 영어 부정문은 억제가 아니라 소환으로 작동한다 (라운드 1, 얼굴 4/4 유입)
//   ② 주체가 차지하는 사분면과 여백 예약 사분면이 겹치면 모델은 주체를 택한다 (라운드 1·2, 여백 4/4 실패)
const SIDES = ['upper', 'lower', 'top', 'bottom', 'left', 'right', 'centre', 'center']

function sidesIn(s) {
  // "left clear for copy" 의 left 는 방향이 아니라 동사다 — 사분면으로 세지 않는다
  const t = s.replace(/\bleft\s+(clear|open|empty|free|blank)\b/gi, '')
  return new Set(SIDES.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(t)))
}

export function lint(text) {
  const bad = []
  const warn = []
  const body = text.replace(/<!--[\s\S]*?-->/g, '')

  // 참조 묶음 주석만 통과시킨다 — 같은 무대를 쓰는 컷을 prompt.md 옆에 적어 두는 자리다
  if (/<!--(?!\s*참조 묶음:)/.test(text)) bad.push('템플릿 주석이 남아 있다')
  const slot = body.match(/<[^<>\n]{1,60}>/)
  if (slot) bad.push(`슬롯이 안 채워졌다: ${slot[0]}`)

  const n = body.trim().length
  if (n > LEN.max) bad.push(`${n}자 — 상한 ${LEN.max}자를 넘었다 (한글 1글자 = 1자)`)
  else if (n < LEN.min) bad.push(`${n}자 — 짧다. Prompt Enhancer가 멋대로 채운다 (${LEN.min}자 이상)`)
  else if (n > LEN.sweet) warn.push(`${n}자 — 스윗스팟 ${LEN.min}~${LEN.sweet}자를 넘었다`)

  const neg = body.match(/\bno\s+(visible|face|head|text|lettering|words|logos?|signage|watermark|people|blur|clutter)\b/i)
  if (neg) bad.push(`부정문 배제절 "${neg[0]}" — 긍정문으로 뒤집는다 (bare and unmarked / plain and unbranded)`)

  // 모델은 첫 프레임을 t=0 의 상태로 읽는다. 블러가 구워져 있으면 "빠른 움직임"이 아니라
  // "이 물체는 원래 흐릿하다"로 해석하고, 중간 동작 포즈는 방향이 모호해 되감기가 나온다
  const motion = body.match(/\b(motion blur|mid-stride|mid-air|mid-swing|mid-motion|in mid-\w+)\b/i)
  if (motion) bad.push(`모션 단서 "${motion[0]}" — i2v 는 이것을 t=0 의 상태로 읽는다. 동작의 시작점(안정 포즈)으로 쓴다`)

  const comp = body.match(/^Composition:.*(?:\n(?!\n).*)*/im)
  if (!comp) {
    warn.push('Composition 줄이 없다 — 공간을 분수로 명시하지 않으면 구도가 흔들린다')
  } else {
    const clear = comp[0].split(/;/)
    const space = clear.slice(1).join(';')
    if (!/clear for copy|copy added later|empty|negative space/i.test(space)) {
      warn.push('여백 예약 절이 없다 — 자막 자리는 motion-stage가 쓴다')
    } else {
      // 주체의 위치는 Composition 앞절에만 있지 않다 — 랩 라운드 2는 MG 줄이 주체를 우측에 두고
      // Composition 은 우상단을 비우라 했다. 그 모순에서 모델은 주체를 택했고 여백은 4/4 실패했다.
      const mg = (body.match(/\bMG:\s*([^\n]*?)(?=\s+BG:|\n|$)/i) ?? [, ''])[1]
      const subject = `${clear[0] ?? ''} ${mg}`
      const hit = [...sidesIn(subject)].filter((w) => sidesIn(space).has(w))
      if (hit.length) {
        bad.push(`주체와 여백이 같은 쪽이다 (${hit.join(' · ')}) — 겹치면 모델은 주체를 택한다. 주체(Composition 앞절 · MG)를 반대쪽으로 옮긴다`)
      }
    }
  }
  return { bad, warn, chars: n }
}

// ── 명령 ────────────────────────────────────────────────────────────────────
const sceneDir = (scene) => path.join(SCENES, scene)

function readPrompt(scene) {
  const p = path.join(sceneDir(scene), 'prompt.md')
  if (!fs.existsSync(p)) die(`${path.relative(ROOT, p)} 가 없다. 먼저 \`frame.mjs new ${scene}\``)
  return fs.readFileSync(p, 'utf8')
}

function cmdNew(scene) {
  const dir = sceneDir(scene)
  const p = path.join(dir, 'prompt.md')
  if (fs.existsSync(p)) die(`이미 있다: ${path.relative(ROOT, p)}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.copyFileSync(path.join(SKILL, 'templates/prompt.md'), p)
  ok(`${path.relative(ROOT, p)} — 슬롯을 채우고 \`frame.mjs check ${scene}\``)
}

function cmdCheck(scene) {
  const { bad, warn, chars } = lint(readPrompt(scene))
  for (const w of warn) console.log(`⚠ ${w}`)
  for (const b of bad) console.error(`✗ ${b}`)
  if (bad.length) process.exit(2)
  ok(`프롬프트 ${chars}자 — 통과. 견적은 get_generation_cost, 생성은 artlist 도구로.`)
}

async function fetchTo(src, dest) {
  if (/^https?:/.test(src)) {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`${res.status} ${src}`)
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  } else {
    if (!fs.existsSync(src)) die(`없다: ${src}`)
    fs.copyFileSync(src, dest)
  }
}

function sheet(dir, files) {
  const cols = Math.ceil(Math.sqrt(files.length))
  const rows = Math.ceil(files.length / cols)
  const out = path.join(dir, 'contact-sheet.png')
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-framerate', '1', '-pattern_type', 'glob',
    '-i', path.join(dir, '*.png'),
    '-vf', `scale=640:-2,tile=${cols}x${rows}:padding=6:color=0x1a1a1a`,
    '-frames:v', '1', out,
  ])
  return out
}

function web(dir, files) {
  const wdir = path.join(dir, 'web')
  fs.mkdirSync(wdir, { recursive: true })
  for (const f of files) {
    const out = path.join(wdir, path.basename(f).replace(/\.png$/, '.jpg'))
    execFileSync('sips', ['-Z', '1200', '-s', 'format', 'jpeg', f, '--out', out], { stdio: 'ignore' })
  }
}

async function cmdSave(scene, args) {
  const round = Number(args.round ?? 1)
  if (!Number.isInteger(round) || round < 1) die('--round 는 1 이상의 정수')
  const srcs = args._
  if (!srcs.length) die('내려받을 url 또는 경로를 하나 이상 준다')

  const dir = path.join(sceneDir(scene), `r${round}`)
  // 라운드는 덮어쓰지 않는다 — 시드가 없어 재생성이 불가능하다 (촬영 규칙 4와 같은 선)
  if (fs.existsSync(dir)) die(`r${round} 가 이미 있다. 라운드 번호를 올린다`)

  const prompt = readPrompt(scene)
  const { bad } = lint(prompt)
  if (bad.length && !args.force) die(`프롬프트가 린트를 통과하지 못했다 (\`check\` 로 확인). 그래도 보관하려면 --force`, 2)

  fs.mkdirSync(dir, { recursive: true })
  const files = []
  try {
    for (const [i, src] of srcs.entries()) {
      const dest = path.join(dir, `${scene}_r${round}_${String(i + 1).padStart(2, '0')}.png`)
      await fetchTo(src, dest)
      files.push(dest)
    }
  } catch (e) {
    // 반쯤 받은 폴더를 남기면 다음 save 가 "r1 있음"으로 건너뛴다 — 통째로 치운다
    fs.rmSync(dir, { recursive: true, force: true })
    die(`내려받기 실패 — r${round} 폴더를 지웠다. 다시 실행: ${e?.cause?.code ?? e?.message ?? e}`)
  }
  sheet(dir, files)
  web(dir, files)

  const metaPath = path.join(sceneDir(scene), 'meta.json')
  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    : { scene, model: MODEL, rounds: [] }
  meta.rounds.push({
    round,
    at: new Date().toISOString(),
    generationId: args.gen ?? null,
    credits: args.credits ? Number(args.credits) : null,
    settings: { ...SETTINGS, num_images: files.length },
    prompt, // 시드가 없다 — 이 스냅샷이 유일한 재현 근거다
    files: files.map((f) => path.relative(sceneDir(scene), f)),
    note: args.note ?? null,
    verdict: null, // 판정은 사람이 채운다 (SKILL.md §판정)
  })
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')

  ok(`${files.length}장 → ${path.relative(ROOT, dir)}`)
  ok(`contact-sheet.png · web/ · meta.json r${round}`)
  if (!args.gen) console.log('⚠ --gen 이 없다. generationId 는 30일 뒤 사라지는 서버 기록의 유일한 열쇠다')
}

// 채택 — 고른 한 장을 i2v 규격(정확한 16:9 · 출력 해상도)으로 내려 first-frame.png 로 올린다.
// 원본 9장은 저장소 밖(.gitignore)이고, 영상 모델이 먹는 것은 이 한 장이다.
//
// 왜 내리나: 비디오 디퓨전은 입력을 VAE 잠재공간으로 압축한다(최대 1:96). 2K의 여분 디테일은
// 어차피 버려지고, Lanczos 다운스케일이 미세 노이즈와 생성 아티팩트를 먼저 지워 증폭을 줄인다.
// AI 업스케일은 반대다 — 없던 고주파를 지어내고 그 환각이 영상에서 끓는다.
// 그리고 Kling o3 는 정확한 16:9 를 못 낸다(2720×1536 = 1.771). 여기서 잘라 맞춘다.
const OUT = { w: 1920, h: 1080 } // Kling O3 영상 `pro` = 1080p. 4K 출력을 쓸 거면 4K 스틸부터 시작한다

function cmdPick(scene, args) {
  const src = args._[0] ?? die('채택할 파일을 준다 — 예: r2/s01-접수_r2_04.png', 2)
  const abs = path.isAbsolute(src) ? src : path.join(sceneDir(scene), src)
  if (!fs.existsSync(abs)) die(`없다: ${src}`)
  const out = path.join(sceneDir(scene), 'first-frame.png')
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', abs,
    '-vf', `crop='min(iw,ih*16/9)':'min(ih,iw*9/16)',scale=${OUT.w}:${OUT.h}:flags=lanczos`,
    '-frames:v', '1', out,
  ])

  const metaPath = path.join(sceneDir(scene), 'meta.json')
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    const rel = path.relative(sceneDir(scene), abs)
    const round = meta.rounds.find((r) => r.files.includes(rel))
    if (round) round.verdict = `채택 ${rel}${args.note ? ` — ${args.note}` : ''}`
    meta.pick = { from: rel, out: `first-frame.png (${OUT.w}×${OUT.h})` }
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
  }
  ok(`${scene}/first-frame.png ${OUT.w}×${OUT.h} ← ${src} (16:9 크롭 + Lanczos)`)
}

function cmdList(scene) {
  const scenes = scene ? [scene] : fs.existsSync(SCENES)
    ? fs.readdirSync(SCENES).filter((d) => /^s\d\d-/.test(d)).sort()
    : []
  if (!scenes.length) return console.log('장면이 없다. `frame.mjs new s01-접수`')
  for (const s of scenes) {
    const metaPath = path.join(sceneDir(s), 'meta.json')
    if (!fs.existsSync(metaPath)) { console.log(`${s}  (프롬프트만)`); continue }
    const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    for (const r of m.rounds) {
      console.log(`${s}  r${r.round}  ${String(r.files.length).padStart(2)}장  ${r.credits ?? '?'}크레딧  ${r.verdict ?? '판정 없음'}`)
    }
  }
}

function selftest() {
  const assert = (cond, msg) => { if (!cond) die(`selftest: ${msg}`) }
  const base = (comp) => `Documentary photograph aesthetic, unretouched.\nA woman.\nFG: a. MG: b. BG: c.\nLight: warm.\n${comp}\nAngle: eye-level.\nTone: Low Saturation Gray palette.\nThe counter surface is bare and unmarked.`

  assert(lint(base('Composition: x. Her hand caught in mid-air, motion blur on the pen.')).bad.some((b) => b.includes('모션 단서')), '모션 단서를 못 잡았다')

  const conflict = lint(base('Composition: rule of thirds. The hands fill the lower right (1/3); the upper right quadrant is empty, left clear for copy added later.'))
  assert(conflict.bad.some((b) => b.includes('같은 쪽')), '사분면 충돌을 못 잡았다')

  // 랩 라운드 2의 실제 모순 — Composition 끼리는 안 겹치는데 MG 가 주체를 여백 쪽에 둔다
  const viaMg = lint(`Documentary photograph aesthetic.\nA woman.\nFG: the counter edge. MG: the woman behind it, seated, occupying the right third. BG: a blind.\nLight: warm.\nComposition: rule of thirds. The counter and her hands fill the lower left (1/3 of the frame); the upper right quadrant is calm empty wall, left clear for copy added later.\nTone: Low Saturation Gray palette.\nEvery surface is bare and unmarked.`)
  assert(viaMg.bad.some((b) => b.includes('같은 쪽')), 'MG 줄의 주체 위치 충돌을 못 잡았다')

  const clean = lint(base('Composition: rule of thirds. The hands fill the lower left (1/3); the entire right half is empty wall, left clear for copy added later.'))
  assert(!clean.bad.some((b) => b.includes('같은 쪽')), '겹치지 않는 구도를 오탐했다')

  assert(lint(base('Composition: x. No visible words or logos.')).bad.some((b) => b.includes('부정문')), '부정문을 못 잡았다')
  assert(lint('<주체와 동작>').bad.some((b) => b.includes('슬롯')), '빈 슬롯을 못 잡았다')
  assert(!lint('<!-- 참조 묶음: s01-c2-x 와 같은 무대 -->').bad.some((b) => b.includes('템플릿 주석')), '참조 묶음 주석을 오탐했다')
  assert(lint('a'.repeat(3000)).bad.some((b) => b.includes('상한')), '2500자 상한을 못 잡았다')
  ok('selftest 통과')
}

// ── 인자 ────────────────────────────────────────────────────────────────────
function parse(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') out.force = true
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i]
    else out._.push(a)
  }
  return out
}

// 직접 실행할 때만 명령을 돈다 — import 하면 lint 만 가져다 쓸 수 있다
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) await main()

async function main() {
const [cmd, ...rest] = process.argv.slice(2)
const args = parse(rest)
const scene = args._.shift()

const need = () => scene ?? die('장면 이름을 준다 — 예: s01-접수', 2)

switch (cmd) {
  case 'new': cmdNew(need()); break
  case 'check': cmdCheck(need()); break
  case 'save': await cmdSave(need(), args); break
  case 'pick': cmdPick(need(), args); break
  case 'list': cmdList(scene); break
  case 'selftest': selftest(); break
  default:
    console.log(`frame.mjs <명령>

  new <sNN-이름>                        장면 폴더 + prompt.md 골격
  check <sNN-이름>                      프롬프트 린트 — 부정문 · 사분면 충돌 · 길이
  save <sNN-이름> --round N [옵션] <url…>  생성물 보관 + 컨택트 시트 + meta 기록
       --gen <generationId>  --credits <n>  --note "…"  --force
  pick <sNN-이름> <파일> [--note …]      채택 → first-frame.png · meta 판정 기록
  list [sNN-이름]                       라운드 목록
  selftest                             린트 자체 검사

생성은 이 스크립트가 하지 않는다 — Artlist MCP 도구를 대화에서 직접 부른다.`)
    process.exit(cmd ? 2 : 0)
}
}
