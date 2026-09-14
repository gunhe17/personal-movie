#!/usr/bin/env node
// frame-to-video — 첫 프레임 + 모션 프롬프트 → Kling 3.0 i2v 테이크 보관 · 채택
// 생성 자체는 하지 않는다. Artlist MCP 도구를 대화에서 직접 부른다 (SKILL.md 참조).
import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKILL = path.resolve(HERE, '..')
const ROOT = path.resolve(HERE, '../../../..')
const SCENES = path.join(ROOT, 'movies/26IRDEMO/v2')

// Kling 3.0 (base · "Kling v3 [Kling direct]"). O3(347)가 아니다 — SKILL.md §왜 3.0 base 인가
// Artlist get_model_config 349 실측(2026-09-14): resolution · duration(3~15) · generate_audio · aspect_ratio 뿐이다.
// fal 과 달리 negative_prompt · cfg_scale 이 없다. generate_audio 기본이 true, aspect_ratio 기본이 auto 라 명시한다
const MODEL = { name: 'Kling v3 Pro (1080) - No Audio - I2V [Kling direct]', modelGroupId: 349, modelId: 3146 }
const SETTINGS = { resolution: 'pro', aspect_ratio: '16:9', generate_audio: false }
const WORDS = { min: 15, sweet: 100, max: 150 }
const CHARS_MAX = 2500

const die = (msg, code = 1) => { console.error(`✗ ${msg}`); process.exit(code) }
const ok = (msg) => console.log(`✓ ${msg}`)

// ── 모션 프롬프트 파싱 · 린트 ─────────────────────────────────────────────────
// motion.md 의 `Negative:` 줄은 negative_prompt 필드로, 나머지는 prompt 로 간다.
export function parse(text) {
  const body = text.replace(/<!--[\s\S]*?-->/g, '')
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  const neg = lines.find((l) => /^Negative:/i.test(l))
  return {
    prompt: lines.filter((l) => l !== neg).join(' '),
    negative: neg ? neg.replace(/^Negative:\s*/i, '') : null,
  }
}

// 카메라 무브를 계열로 묶는다 — 계열이 둘이면 지시가 둘이다
const CAMERA = {
  static: /\b(static camera|locked[- ]off|tripod|camera (stays|remains) (still|fixed))\b/i,
  in: /\b(dolly[- ]in|push[- ]in|zoom[- ]in|track(s|ing)? forward)\b/i,
  out: /\b(pull[- ]back|pulls back|dolly[- ]out|zoom[- ]out)\b/i,
  // pan · tilt 는 물건에도 쓰는 동사다 ("tilt the phone") — 방향이나 camera 가 붙을 때만 카메라로 센다
  pan: /\b(pan(s|ning)? (left|right)|camera pans)\b/i,
  tilt: /\b(tilt(s|ing)? (up|down)|camera tilts)\b/i,
  orbit: /\b(orbit(s|ing)?|camera orbits)\b/i,
  handheld: /\bhandheld\b/i,
}
export const cameraOf = (s) => Object.keys(CAMERA).filter((k) => CAMERA[k].test(s))

export function lint(text, { imageMove = null, imageScreen = false } = {}) {
  const bad = []
  const warn = []
  if (/<!--/.test(text)) bad.push('템플릿 주석이 남아 있다')
  const { prompt, negative } = parse(text)
  const slot = prompt.match(/<[^<>\n]{1,60}>/)
  if (slot) bad.push(`슬롯이 안 채워졌다: ${slot[0]}`)

  const words = prompt.split(/\s+/).filter(Boolean).length
  if (prompt.length > CHARS_MAX) bad.push(`${prompt.length}자 — 상한 ${CHARS_MAX}자`)
  if (words > WORDS.max) bad.push(`${words}단어 — ${WORDS.max}단어를 넘으면 지시끼리 충돌한다`)
  else if (words < WORDS.min) bad.push(`${words}단어 — 짧다. 동작 · 카메라 · 고정 절이 다 들어가야 한다`)
  else if (words > WORDS.sweet) warn.push(`${words}단어 — 40~${WORDS.sweet}단어가 스윗스팟`)

  // ① 재묘사 — 장면은 첫 프레임이 이미 준다. 반복하면 모션이 줄고 컷 전환이 난다 (Kling 공식 i2v 가이드)
  const redesc = prompt.match(/\b(documentary photograph|film grain|unretouched|low saturation gray|palette|rule of thirds|composition:|FG:|MG:|BG:|set to \d+mm|depth of field|skin texture|visible pores)/i)
  if (redesc) bad.push(`첫 프레임 재묘사 "${redesc[0]}" — 룩·구도는 이미 이미지에 있다. 움직임만 쓴다`)

  // ② 카메라는 정확히 하나. 없으면 모델이 발명하고, 둘이면 섞인다 (공식 카메라 가이드)
  const cams = cameraOf(prompt)
  if (!cams.length) bad.push('카메라 지시가 없다 — 없으면 모델이 무브를 발명한다. Locked-off tripod shot 또는 very slow dolly in 하나')
  else if (cams.length > 1) bad.push(`카메라 지시가 둘 이상이다 (${cams.join(' · ')}) — 하나만`)
  else if (imageMove && cams[0] !== 'static' && cams[0] !== imageMove) {
    warn.push(`첫 프레임은 ${imageMove} 무브를 전제로 여백을 짰는데 ${cams[0]} 이다 — 여백 없는 쪽으로 가면 프레임 밖을 지어낸다`)
  }
  if (cams.length === 1 && cams[0] !== 'static') {
    warn.push('움직이는 카메라 + 손 동작 — C1.1 t1 은 5% 돌리인이 손 동작과 겹쳐 카메라가 크게 돌았다(SSIM 0.57). Locked-off tripod shot 부터')
  }

  // ⑥ 첫 프레임에 화면이 있으면 꺼진 상태를 문장으로 잠근다 — C1.1 t1: 꺼진 모니터에 2.5초부터 가짜 글자가 떴다
  if (imageScreen && !/\b(screen|monitor|display|laptop)\b[^.;]*\b(stays?|remains?) (dark|off|out of frame|beyond the top edge)/i.test(prompt)) {
    bad.push('첫 프레임에 화면(모니터·폰·노트북)이 있는데 잠금 절이 없다 — "the monitor screen stays dark" (C1.1 t1: 꺼진 화면에 가짜 글자)')
  }

  // ③ 글자를 새로 만들게 하는 동작 — 빈 종이·꺼진 화면 위에 가짜 글자가 생긴다
  const text_ = prompt.match(/\b(writ(es|ing) (a |the |some )?(word|sentence|name|number|note|text|letter)s?|types? (a |the )?(message|text|name)|screen (lights|turns on|glows|wakes)|appears? on (the )?(screen|page|paper))/i)
  if (text_) bad.push(`글자를 만드는 동작 "${text_[0]}" — 펜 끝 · 손끝의 작은 움직임만 쓴다`)

  // ④ 프레임 밖 사람을 부르는 말 — 이미지와 크게 다른 묘사는 컷 전환 · 새 인물을 부른다
  const person = prompt.match(/\b(face|head|looks? up|walks? in|someone|another person|colleague|child|kid|she|he|her|his)\b/i)
  if (person) bad.push(`사람을 부르는 말 "${person[0]}" — 손 · 손가락 · 손목만 주어로 쓴다 (첫 배치 얼굴 유입 8/26 과 같은 원인)`)

  // ⑤ 부정문 — Artlist 349 에는 negative_prompt 필드가 없다. 짧은 국소 부정 하나는 2.6 실측에서 먹었고,
  //    그 이상은 첫 프레임 랩에서 억제가 아니라 소환으로 작동했다
  if (negative !== null) bad.push('Negative: 줄 — Artlist 349 에는 negative_prompt 가 없다. 배제는 긍정 상태 서술로 (the page stays blank)')
  const negs = prompt.match(/\b(no|not|without|never|don't)\b/gi) ?? []
  if (negs.length > 1) bad.push(`본문 부정어 ${negs.length}개 — 긍정 상태 서술로 뒤집는다 (the screen stays dark · the page stays blank)`)
  else if (negs.length === 1) warn.push('본문 부정어 1개 — 긍정 상태 서술(locked-off, stays still)로 먼저 쓴다')

  const fast = prompt.match(/\b(fast|quick(ly)?|rapid(ly)?|sudden(ly)?|whip|crash|dramatic|epic|cinematic)\b/i)
  if (fast) warn.push(`속도·극적 어휘 "${fast[0]}" — 다큐 톤에서 슬로모션·과장을 부른다. at natural speed`)
  if (!/\b(remains?|stays?|holds?) (still|steady|motionless|constant|fixed)\b/i.test(prompt)) {
    warn.push('고정 절이 없다 — "everything else remains still" 류가 없으면 모든 것이 움직인다')
  }
  return { bad, warn, words, prompt, negative }
}

// ── 장면 · cuts.json ─────────────────────────────────────────────────────────
const sceneDir = (scene) => path.join(SCENES, scene)

function cutOf(scene) {
  const m = scene.match(/^s(\d\d)-c(\d+)-/) ?? die(`컷 폴더 이름이 아니다: ${scene} (예: s01-c1-전화한통)`, 2)
  const id = `C${Number(m[1])}.${m[2]}`
  const cuts = JSON.parse(fs.readFileSync(path.join(SCENES, '_production/cuts.json'), 'utf8'))
  return cuts.find((c) => c.id === id) ?? die(`cuts.json 에 ${id} 가 없다`)
}

// 첫 프레임 프롬프트에서 린트가 알아야 할 두 가지 — 여백을 짠 무브(first-frame 규칙 4)와 화면이 있는지
function imageOf(scene) {
  const p = path.join(sceneDir(scene), 'prompt.md')
  const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
  const m = text.match(/during a ([a-z -]+?)\./i)
  return {
    imageMove: m ? (cameraOf(m[1])[0] ?? null) : null,
    // 탁상전화(desk phone · telephone · handset)는 화면이 없다 — C3.4 오탐
    imageScreen: /\b(monitor|screen|laptop|display)\b/i.test(text) || (/\bphone\b/i.test(text) && !/\b(desk phone|telephone|handset)\b/i.test(text)),
  }
}

function readMotion(scene) {
  const p = path.join(sceneDir(scene), 'motion.md')
  if (!fs.existsSync(p)) die(`${path.relative(ROOT, p)} 가 없다. 먼저 \`video.mjs new ${scene}\``)
  return fs.readFileSync(p, 'utf8')
}

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12)

// ── 명령 ────────────────────────────────────────────────────────────────────
function cmdNew(scene) {
  const dir = sceneDir(scene)
  if (!fs.existsSync(path.join(dir, 'first-frame.png'))) die(`${scene}/first-frame.png 가 없다 — first-frame 스킬로 먼저 채택한다`)
  const p = path.join(dir, 'motion.md')
  if (fs.existsSync(p)) die(`이미 있다: ${path.relative(ROOT, p)}`)
  fs.copyFileSync(path.join(SKILL, 'templates/motion.md'), p)
  const cut = cutOf(scene)
  const img = imageOf(scene)
  ok(`${path.relative(ROOT, p)} — ${cut.id} ${cut.name} · ${cut.length} · 이월 무브 ${img.imageMove ?? '없음'}${img.imageScreen ? ' · 화면 있음(잠금 절 필수)' : ''}`)
  console.log(`  situation: ${cut.situation}`)
}

function cmdCheck(scene) {
  const { bad, warn, words } = lint(readMotion(scene), imageOf(scene))
  for (const w of warn) console.log(`⚠ ${w}`)
  for (const b of bad) console.error(`✗ ${b}`)
  if (bad.length) process.exit(2)
  ok(`모션 프롬프트 ${words}단어 — 통과. \`video.mjs call ${scene}\``)
}

// 편집 여유 1초 — 컷 길이(cuts.json)보다 1초 길게 뽑아 끝을 잘라 쓴다. 3.0 은 3~15초
const durationOf = (cut, args) => Number(args.duration ?? Math.min(15, Math.max(3, Math.ceil(parseFloat(cut.length)) + 1)))

function cmdCall(scene, args) {
  const { bad, prompt } = lint(readMotion(scene), imageOf(scene))
  if (bad.length) die('린트를 통과하지 못했다 — `check` 부터', 2)
  const ff = path.join(sceneDir(scene), 'first-frame.png')
  const mb = fs.statSync(ff).size / 1e6
  if (mb > 10) die(`first-frame.png ${mb.toFixed(1)}MB — Kling 입력 상한 10MB`)
  const call = {
    tool: 'generate_video',
    modelGroupId: MODEL.modelGroupId,
    prompt,
    settings: { ...SETTINGS, duration: durationOf(cutOf(scene), args) },
    input: { assetId: '<upload_image 로 받은 assetId>' },
  }
  console.log(JSON.stringify(call, null, 2))
  console.log(`\n입력 이미지 — ${path.relative(ROOT, ff)} (${mb.toFixed(1)}MB)`)
  console.log('  upload_image { mimeType: "image/png", fileName } → uploadUrl · uploadId')
  console.log('  curl -X PUT -H "Content-Type: image/png" --data-binary @first-frame.png <uploadUrl>')
  console.log('  confirm_upload { uploadId, mimeType: "image/png" } → assetId')
  console.log(`\n받은 뒤: video.mjs save ${scene} --take N --gen <generationId> --credits <n> <url>`)
}

async function fetchTo(src, dest) {
  if (/^https?:/.test(src)) {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`${res.status} ${src}`)
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  } else {
    if (!fs.existsSync(src)) throw new Error(`없다: ${src}`)
    fs.copyFileSync(src, dest)
  }
}

function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }))
  const v = j.streams.find((s) => s.codec_type === 'video') ?? {}
  const [n, d] = String(v.r_frame_rate ?? '0/1').split('/').map(Number)
  return {
    width: v.width, height: v.height, fps: d ? +(n / d).toFixed(3) : null,
    duration: +Number(j.format.duration).toFixed(2),
    audio: j.streams.some((s) => s.codec_type === 'audio'),
  }
}

// 판정용 한 장 — 입력 첫 프레임 | 영상 0% · 33% · 66% · 끝. 끝 프레임 워핑과 손 모핑이 여기서 보인다
function sheet(dir, file, ff, dur) {
  const out = path.join(dir, 'sheet.png')
  const at = [0, dur / 3, (2 * dur) / 3, Math.max(0, dur - 0.05)]
  const inputs = [['-i', ff], ...at.map((t) => ['-ss', t.toFixed(2), '-i', file])].flat()
  const scaled = [0, 1, 2, 3, 4].map((i) => `[${i}:v]scale=640:360,setsar=1[s${i}]`).join(';')
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex',
    `${scaled};[s0][s1][s2][s3][s4]xstack=inputs=5:layout=0_0|w0+6_0|w0+w1+12_0|w0+w1+w2+18_0|w0+w1+w2+w3+24_0:fill=0x1a1a1a`,
    '-frames:v', '1', out])
  return out
}

async function cmdSave(scene, args) {
  const take = Number(args.take ?? 1)
  if (!Number.isInteger(take) || take < 1) die('--take 는 1 이상의 정수')
  const src = args._[0] ?? die('내려받을 url 또는 경로를 준다', 2)
  const dir = path.join(sceneDir(scene), `t${take}`)
  // 테이크는 덮어쓰지 않는다 — 시드가 없어 재생성이 불가능하다 (촬영 규칙 4와 같은 선)
  if (fs.existsSync(dir)) die(`t${take} 가 이미 있다. 테이크 번호를 올린다`)

  const text = readMotion(scene)
  const { bad, prompt } = lint(text, imageOf(scene))
  if (bad.length && !args.force) die('모션 프롬프트가 린트를 통과하지 못했다. 그래도 보관하려면 --force', 2)

  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${scene}_t${take}.mp4`)
  try { await fetchTo(src, file) } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true })
    die(`내려받기 실패 — t${take} 폴더를 지웠다: ${e?.cause?.code ?? e?.message ?? e}`)
  }
  const ff = path.join(sceneDir(scene), 'first-frame.png')
  const info = probe(file)
  sheet(dir, file, ff, info.duration)

  const cut = cutOf(scene)
  const metaPath = path.join(sceneDir(scene), 'motion.json')
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : { scene, cut: cut.id, model: MODEL, takes: [] }
  meta.takes.push({
    take,
    at: new Date().toISOString(),
    generationId: args.gen ?? null,
    credits: args.credits ? Number(args.credits) : null,
    settings: { ...SETTINGS, duration: args.duration ? Number(args.duration) : durationOf(cut, {}) },
    firstFrame: `first-frame.png sha256:${sha(ff)}`, // 프레임을 다시 뽑으면 테이크가 어느 프레임에서 왔는지 이것으로 가른다
    prompt, // 시드가 없다 — 이 스냅샷이 유일한 재현 근거다
    file: path.relative(sceneDir(scene), file),
    probe: info,
    note: args.note ?? null,
    verdict: null, // 판정은 사람이 채운다 (SKILL.md §판정)
  })
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
  ok(`${path.relative(ROOT, file)} — ${info.width}×${info.height} · ${info.fps}fps · ${info.duration}s${info.audio ? ' · ⚠ 오디오 트랙 있음' : ''}`)
  ok(`sheet.png · motion.json t${take}`)
  if (!args.gen) console.log('⚠ --gen 이 없다. generationId 는 30일 뒤 사라지는 서버 기록의 유일한 열쇠다')
}

// 생성 — 헤드리스 세션(claude -p)에 Artlist 도구 다섯과 curl 만 열어 업로드 → 견적 → 생성 → 폴링을 맡기고 save 로 받는다.
// 이 세션에 MCP 도구가 안 붙어 있어도 돈다(_production/gen.mjs 와 같은 길). 견적이 --max-credits 를 넘으면 생성하지 않는다
async function cmdGen(scene, args) {
  const max = Number(args['max-credits'] ?? die('--max-credits 가 필요하다 — 크레딧 상한 없이 생성하지 않는다', 2))
  const { bad, prompt } = lint(readMotion(scene), imageOf(scene))
  if (bad.length) die('린트를 통과하지 못했다 — `check` 부터', 2)
  const dir = sceneDir(scene)
  const take = Number(args.take ?? fs.readdirSync(dir).filter((d) => /^t\d+$/.test(d)).length + 1)
  if (fs.existsSync(path.join(dir, `t${take}`))) die(`t${take} 가 이미 있다. --take 를 올린다`)
  const ff = path.join(dir, 'first-frame.png')
  const settings = { ...SETTINGS, duration: durationOf(cutOf(scene), args) }
  const ask = `Generate ONE image-to-video clip on Artlist. Follow these steps exactly, no other generations.
1. mcp__artlist__upload_image with mimeType "image/png", fileName "${scene}-first-frame.png" → uploadUrl, uploadId.
2. Bash: curl -sS -f -X PUT -H "Content-Type: image/png" --data-binary @"${ff}" "<uploadUrl>" (add any headers the upload response requires).
3. mcp__artlist__confirm_upload { uploadId, mimeType: "image/png" } → assetId.
4. mcp__artlist__get_generation_cost for kind video, modelGroupId ${MODEL.modelGroupId}, the settings below, input {"assetId":"<assetId>"}.
   If the cost exceeds ${max} credits, STOP without generating and output RESULT: {"stopped":"cost","credits":N}.
5. mcp__artlist__generate_video with modelGroupId ${MODEL.modelGroupId}, input {"assetId":"<assetId>"}, confirmCost true,
   prompt: ${JSON.stringify(prompt)}
   settings: ${JSON.stringify(settings)}
6. Poll mcp__artlist__get_generation_status until completed or failed (up to ~15 minutes).
7. Output as the very last line only:
RESULT: {"generationId":"...","credits":N,"assetId":"...","url":"<output video url>","modelId":N,"resolvedSettings":{...}}
On failure: RESULT: {"error":"reason","step":N,"generationId":"... if any"}`
  const tools = ['upload_image', 'confirm_upload', 'get_generation_cost', 'generate_video', 'get_generation_status']
    .map((t) => `mcp__artlist__${t}`).concat('Bash(curl:*)').join(',')
  console.log(`… ${scene} t${take} 생성 중 — ${settings.duration}초 · 상한 ${max} 크레딧`)
  const r = spawnSync('claude', ['-p', '--output-format', 'text', '--max-turns', '60', '--allowedTools', tools],
    { input: ask, encoding: 'utf8', cwd: ROOT, timeout: 25 * 60 * 1000 })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const m = [...out.matchAll(/RESULT:\s*(\{.*\})\s*$/gm)].pop()
  let res = null
  try { res = m && JSON.parse(m[1]) } catch {}
  if (!res?.url) {
    const log = path.join(dir, `t${take}-gen-fail.log`)
    fs.writeFileSync(log, out)
    die(res?.stopped ? `견적 ${res.credits} 크레딧 > 상한 ${max} — 생성하지 않았다` : `생성 실패 — ${res?.error ?? '응답 파싱 실패'} (${path.relative(ROOT, log)})`, 3)
  }
  await cmdSave(scene, { take, gen: res.generationId, credits: res.credits, duration: settings.duration, note: `assetId ${res.assetId} · modelId ${res.modelId}`, _: [res.url] })
}

// 채택 — 무대 컷(CN.N_imac.mp4)과 같은 완성본을 컷 폴더에 CN.N_ai.mp4 로 굽는다:
// cuts.json 길이로 자르고 · 30fps(절차 표시줄 자산과 같다) · 절차 표시줄을 얹고 · 무음.
// 표시줄은 render.mjs 와 같은 규칙 — head 는 0초부터, hold PNG 는 head 뒤에서 tail 앞까지, tail 은 끝에.
// mov 는 곱한 알파(ProRes 4444), png 는 straight — overlay alpha 모드를 각각 맞춘다(안 맞추면 테두리가 어둡다)
function cmdPick(scene, args) {
  const src = args._[0] ?? die('채택할 파일을 준다 — 예: t2/s01-c1-전화한통_t2.mp4', 2)
  const abs = path.isAbsolute(src) ? src : path.join(sceneDir(scene), src)
  if (!fs.existsSync(abs)) die(`없다: ${src}`)
  const cut = cutOf(scene)
  const name = `${cut.id}_ai.mp4`
  const out = path.join(sceneDir(scene), name)
  const len = parseFloat(cut.length)
  if (probe(abs).duration + 0.05 < len) die(`테이크가 컷 길이(${len}s)보다 짧다`)
  const st = cut.steps
  const inputs = ['-i', abs]
  let graph = '[0:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1[v0]'
  let top = '[v0]'
  let n = 1
  const layer = (args_, alpha) => {
    inputs.push(...args_)
    graph += `;${top}[${n}:v]overlay=0:0:eof_action=pass:format=auto:alpha=${alpha}[s${n}]`
    top = `[s${n}]`
    n++
  }
  if (st) {
    const dir = path.join(SCENES, '_assets/steps', st.track)
    const file = (k) => path.join(dir, st[k]) // 없는 자산이면 ffmpeg 가 이름을 대고 멈춘다
    const hd = st.head ? probe(file('head')).duration : 0
    const tl = st.tail ? probe(file('tail')).duration : 0
    if (st.head) layer(['-i', file('head')], 'premultiplied')
    if (st.hold) layer(['-loop', '1', '-t', String(Math.max(0.1, len - hd - tl)), '-itsoffset', String(hd), '-i', file('hold')], 'straight')
    if (st.tail) layer(['-itsoffset', String(Math.max(0, len - tl)), '-i', file('tail')], 'premultiplied')
  }
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', top, '-t', String(len), '-an',
    '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out])
  const bar = st ? `${st.track} ${st.step} (${[st.head, st.hold, st.tail].filter(Boolean).join(' → ')})` : '없음'
  const metaPath = path.join(sceneDir(scene), 'motion.json')
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    const rel = path.relative(sceneDir(scene), abs)
    const t = meta.takes.find((x) => x.file === rel)
    if (t) t.verdict = `채택${args.note ? ` — ${args.note}` : ''}`
    meta.pick = { from: rel, out: name, length: len, fps: 30, steps: bar }
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
  }
  ok(`${scene}/${name} ← ${src} — ${len}s · 30fps · 무음 · 절차 표시줄 ${bar}`)
}

function cmdList(scene) {
  const scenes = scene ? [scene] : fs.readdirSync(SCENES).filter((d) => fs.existsSync(path.join(SCENES, d, 'motion.md'))).sort()
  if (!scenes.length) return console.log('모션 프롬프트가 있는 컷이 없다. `video.mjs new s01-c1-전화한통`')
  for (const s of scenes) {
    const metaPath = path.join(sceneDir(s), 'motion.json')
    if (!fs.existsSync(metaPath)) { console.log(`${s}  (프롬프트만)`); continue }
    const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    for (const t of m.takes) console.log(`${s}  t${t.take}  ${t.probe.duration}s  ${t.credits ?? '?'}크레딧  ${t.verdict ?? '판정 없음'}`)
  }
}

function selftest() {
  const assert = (cond, msg) => { if (!cond) die(`selftest: ${msg}`) }
  const good = 'Very slow dolly in, about 5% over the whole shot. The fingers press the keys in a steady, unhurried typing rhythm at natural speed; the wrists stay resting on the desk edge. Everything else remains still and the window light stays constant.'
  const r = lint(good, { imageMove: 'in' })
  assert(!r.bad.length, `정상 프롬프트를 오탐했다: ${r.bad.join(' / ')}`)
  const has = (t, key, opts) => lint(t, opts).bad.some((b) => b.includes(key))
  assert(has(good.replace('Very slow dolly in', 'Slow pan left and a slow dolly in'), '둘 이상'), '카메라 둘을 못 잡았다')
  assert(!has(good.replace('press the keys', 'tilt the phone slightly'), '둘 이상'), '물건을 기울이는 동작을 카메라 틸트로 오탐했다')
  assert(has(good.replace('Very slow dolly in, about 5% over the whole shot.', 'The shot.'), '카메라 지시가 없다'), '카메라 없음을 못 잡았다')
  assert(has(good + ' Low Saturation Gray palette.', '재묘사'), '재묘사를 못 잡았다')
  assert(has(good + '\nNegative: blur, text', 'negative_prompt'), 'Artlist 에 없는 Negative 줄을 못 잡았다')
  assert(has(good.replace('press the keys', 'type a message'), '글자를 만드는'), '글자 생성 동작을 못 잡았다')
  assert(has(good.replace('The fingers', 'Her fingers'), '사람을 부르는'), '사람 대명사를 못 잡았다')
  assert(has(good + ' No text, no faces.', '부정어'), '본문 부정어 둘을 못 잡았다')
  assert(lint(good.replace('Very slow dolly in', 'Slow pan left'), { imageMove: 'in' }).warn.some((w) => w.includes('여백')), '이월 무브 불일치를 못 잡았다')
  assert(!lint(good.replace('Very slow dolly in, about 5% over the whole shot.', 'Locked-off tripod shot.'), { imageMove: 'in' }).warn.some((w) => w.includes('여백')), '정지 카메라를 불일치로 오탐했다')
  assert(has('<동작>', '슬롯'), '빈 슬롯을 못 잡았다')
  assert(has(good, '잠금 절', { imageScreen: true }), '화면 있는 첫 프레임의 잠금 절 누락을 못 잡았다')
  assert(!has(good.replace('Everything else', 'The monitor screen stays dark. Everything else'), '잠금 절', { imageScreen: true }), '화면 잠금 절을 오탐했다')
  assert(lint(good).warn.some((w) => w.includes('Locked-off')), '움직이는 카메라 경고를 못 냈다')
  ok('selftest 통과')
}

// ── 인자 ────────────────────────────────────────────────────────────────────
function args_(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') out.force = true
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i]
    else out._.push(a)
  }
  return out
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) await main()

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const args = args_(rest)
  const scene = args._.shift()
  const need = () => scene ?? die('컷 폴더 이름을 준다 — 예: s01-c1-전화한통', 2)
  switch (cmd) {
    case 'new': cmdNew(need()); break
    case 'check': cmdCheck(need()); break
    case 'call': cmdCall(need(), args); break
    case 'gen': await cmdGen(need(), args); break
    case 'save': await cmdSave(need(), args); break
    case 'pick': cmdPick(need(), args); break
    case 'list': cmdList(scene); break
    case 'selftest': selftest(); break
    default:
      console.log(`video.mjs <명령>

  new   <컷>                               motion.md 골격 (first-frame.png 필수)
  check <컷>                               모션 프롬프트 린트 — 종료 코드 2가 불합격
  call  <컷> [--duration N]                Artlist 호출 페이로드 + 입력 이미지 경로
  gen   <컷> --max-credits N [--take N]    헤드리스 생성(업로드 → 견적 → 생성) → save 까지
  save <컷> --take N [옵션] <url|경로>      내려받기 + sheet.png + motion.json 기록
        --gen <generationId> --credits <n> --duration <n> --note "…" --force
  pick  <컷> <파일> [--note …]              채택 → 컷 폴더 CN.N_ai.mp4 (컷 길이 · 30fps · 절차 표시줄 · 무음)
  list  [컷]                               테이크 목록
  selftest                                린트 자체 검사

생성은 이 스크립트가 하지 않는다 — Artlist MCP 도구를 대화에서 직접 부른다.`)
      process.exit(cmd ? 2 : 0)
  }
}
