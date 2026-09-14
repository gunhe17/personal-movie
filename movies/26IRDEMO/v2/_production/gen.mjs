#!/usr/bin/env node
// ff-gen 드라이버 — 이 세션엔 Artlist 도구가 안 붙어 새 헤드리스 세션(claude -p)으로 컷마다 생성한다.
// 재개 가능: r1/ 이 있으면 건너뛴다. C3.5 는 C3.2 와 프롬프트가 같아 생성하지 않는다(재사용).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
const ROOT = '/Users/markos/workspace/service/personal-movie'
const V2 = path.join(ROOT, 'movies/26IRDEMO/v2')
const FRAME = path.join(ROOT, '.claude/skills/first-frame/scripts/frame.mjs')
const STATUS = path.join(V2, '_production/status/ff-gen.md')
const SKIP = new Set(['s03-c5-다시쓴다'])
const ROUND = Number(process.env.ROUND || 1)
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null
const scenes = fs.readdirSync(V2).filter(d => /^s\d\d-c\d+-/.test(d)).sort()
const log = (l) => { fs.appendFileSync(STATUS, l + '\n'); console.log(l) }
if (!fs.existsSync(STATUS)) fs.writeFileSync(STATUS, '# ff-gen\n\n| 컷 폴더 | generationId | 장수 | 크레딧 | 결과 |\n|---|---|---|---|---|\n')
for (const scene of scenes) {
  const dir = path.join(V2, scene)
  if (ONLY && !ONLY.has(scene)) continue
  if (fs.existsSync(path.join(dir, `r${ROUND}`))) { log(`| ${scene} | — | — | — | 건너뜀(r${ROUND} 있음) |`); continue }
  if (SKIP.has(scene)) { log(`| ${scene} | — | — | 0 | 재사용: s03-c2-달력에서지운다 |`); continue }
  const prompt = fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim()
  const ask = `다음 프롬프트로 이미지를 한 번만 생성해라. generate_image — kind image, modelGroupId 354, settings { aspect_ratio: "16:9", resolution: "2K", num_images: 4 }.
생성이 시작되면 get_generation_status 로 완료될 때까지 폴링해라(pending 이면 즉시 다시, 최대 6분).
출력 형식은 오직 마지막 한 줄이다. 다른 말·코드블록·설명은 쓰지 마:
RESULT: {"generationId":"...","urls":["assetUrl1","assetUrl2","assetUrl3","assetUrl4"]}
urls 는 assets[].assetUrl 을 순서대로. 실패하면 RESULT: {"error":"이유"} 한 줄.

=== PROMPT ===
${prompt}
=== END ===`
  const r = spawnSync('claude', ['-p', '--output-format', 'text', '--max-turns', '30', '--allowedTools', 'mcp__artlist__generate_image,mcp__artlist__get_generation_status'], { input: ask, encoding: 'utf8', timeout: 9 * 60 * 1000 })
  const out = (r.stdout || '') + (r.stderr || '')
  const m = out.match(/RESULT:\s*(\{[\s\S]*\})\s*$/m) || out.match(/RESULT:\s*(\{.*?\})/s)
  let res = null; try { res = m && JSON.parse(m[1]) } catch {}
  if (!res || res.error || !Array.isArray(res.urls) || res.urls.length === 0) {
    log(`| ${scene} | ${res?.generationId ?? '—'} | 0 | ? | ✗ ${res?.error ?? '응답 파싱 실패'} |`)
    fs.writeFileSync(path.join(dir, `gen-fail-${Date.now()}.log`), out); continue
  }
  const s = spawnSync('node', [FRAME, 'save', scene, '--round', String(ROUND), '--gen', res.generationId, '--credits', '100', ...res.urls], { encoding: 'utf8' })
  const ok = s.status === 0
  log(`| ${scene} | ${res.generationId} | ${res.urls.length} | 100 | ${ok ? `✓ r${ROUND} 저장` : '✗ save 실패: ' + (s.stderr || '').trim().slice(0, 120)} |`)
}
log(`\nDONE ${new Date().toISOString()}`)
