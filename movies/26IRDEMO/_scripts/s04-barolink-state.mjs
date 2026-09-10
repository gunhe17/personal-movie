#!/usr/bin/env node
// s04 준비 — **바로링크 인증 상태**를 상태 파일로 굳힌다. 조회 테이크(B)가 문자·인증 없이 바로 목록에서 시작한다.
//
// 제품이 원래 그렇게 동작한다: 인증하면 BFF가 `barolink_<linkId>` 쿠키(httpOnly · 2시간)를 심고,
// 새로고침하면 `restoreSession()`이 그 쿠키로 목록을 되살린다(+page.svelte:583).
// 여기서는 그 쿠키를 API에서 직접 받아 Playwright storageState로 적는다 — 화면에서 하는 일과 같다.
//
//   node _scripts/s04-barolink-state.mjs           # → _state/local-barolink.json
//
// ⚠️ 쿠키 수명 2시간. 촬영 직전에 다시 만든다.
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const API = process.env.S04_API ?? 'http://localhost:3502'
const OUT = '_state/local-barolink.json'

const psql = (q) =>
  execSync(`docker exec saas-postgres psql -U imomtae -d imomtae -t -A -c ${JSON.stringify(q)}`)
    .toString().trim()

const [linkId, code] = psql(
  "select id||'|'||verification_code from assessment_send_links order by created_at desc limit 1"
).split('|')
if (!linkId) { console.error('바로링크가 없다 — s04 보내는 쪽을 먼저 돌려라'); process.exit(1) }

const res = await fetch(`${API}/api/v1/assessment-send-links/${linkId}/verify`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ verification_code: code })
})
if (!res.ok) { console.error(`인증 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`); process.exit(1) }
const { access_token } = await res.json()

// BFF가 심는 것과 같은 쿠키다(+server.ts:47-55) — 이름·경로·httpOnly·sameSite까지 맞춘다
fs.writeFileSync(OUT, JSON.stringify({
  cookies: [{
    name: `barolink_${linkId}`, value: access_token,
    domain: 'localhost', path: `/api/barolink/${linkId}`,
    expires: Math.floor(Date.now() / 1000) + 7200,
    httpOnly: true, secure: false, sameSite: 'Strict'
  }],
  origins: []
}, null, 2))

console.log(`${OUT} — 링크 ${linkId} · 인증번호 ${code}`)
console.log(`  촬영 URL: http://localhost:3503/verify-link?send_link_id=${linkId}`)
