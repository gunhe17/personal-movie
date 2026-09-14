#!/usr/bin/env node
// 내담자 앱(mobile-client) 무대 세우기 — 보호자 계정 · 센터 연결 · 토큰까지.
// C3.6(일정 변경 요청) · C5.6(공유문 도착) · C7.5(잔여 회기) 세 컷이 이 상태 위에서 찍힌다.
//
//   CAP_PASSWORD=… node movies/26IRDEMO/v2/_scripts/phone-link.mjs
//
// 하는 일 (전부 제품 API 그대로 — DB를 직접 쓰지 않는다):
//   1. 센터 쪽 로그인(admin) → 보호자 이수진의 클라이언트에 **앱 연동 초대 코드** 발급
//   2. 앱 쪽 `/app/auth/signup` 으로 이수진 계정 생성 (이미 있으면 login)
//   3. `/app/link-invitations/verify` → `/app/links/claim` 으로 센터 연결 확정
//   4. 토큰과 프로필을 `_state/local-client-이수진.json` 에 남긴다 — 시뮬레이터 주입용
//
// 시드를 다시 만들면 계정도 사라진다(계정은 DB에 있다) — 재시드 뒤 다시 돌린다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEMO = path.resolve(HERE, '../..')
const API = process.env.CAP_API ?? 'http://localhost:3502/api/v1'
// 이메일은 CAP_GUARDIAN_EMAIL로 바꿀 수 있다 — `c37-approve-setup.sql`이 같은 전화번호로 `guardian.leesujin@…` 계정을 먼저 만들면
// signup이 409(이미 사용 중인 전화번호)라 그 계정으로 로그인해야 한다(2026-09-14 실측).
const GUARDIAN = { name: '이수진', phone: '010-3000-0001', email: process.env.CAP_GUARDIAN_EMAIL ?? 'guardian.lee@mindscope.com' }

const pw = process.env.CAP_PASSWORD
if (!pw) { console.error('CAP_PASSWORD 환경변수가 필요하다 (_state/accounts.json의 password)'); process.exit(1) }

const accounts = JSON.parse(fs.readFileSync(path.join(DEMO, '_state/accounts.json'), 'utf8'))

async function call(method, url, { token, body } = {}) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 그대로 */ }
  return { ok: res.ok, status: res.status, json, text }
}

// 1 ─ 센터 쪽: 초대 코드
const staff = await call('POST', '/auth/login', {
  body: { email: accounts.accounts.admin.email, password: pw }
})
if (!staff.ok) { console.error('센터 로그인 실패', staff.status, staff.text.slice(0, 200)); process.exit(1) }
const staffToken = staff.json.access_token

const centers = await call('GET', '/centers/', { token: staffToken })
const centerId = (centers.json?.centers ?? centers.json?.items ?? [])[0]?.id
if (!centerId) { console.error('센터를 못 찾았다', centers.status, centers.text.slice(0, 200)); process.exit(1) }

const clients = await call('GET', `/centers/${centerId}/clients?limit=100`, { token: staffToken })
const guardianClient = (clients.json?.items ?? []).find((c) => c.name === GUARDIAN.name)
if (!guardianClient) { console.error(`${GUARDIAN.name} 내담자 행이 없다 — 시드 확인`); process.exit(1) }

const inv = await call('POST', `/centers/${centerId}/clients/${guardianClient.id}/app-link/invitations`, { token: staffToken })
if (!inv.ok) { console.error('초대 코드 발급 실패', inv.status, inv.text.slice(0, 300)); process.exit(1) }
const code = inv.json.code ?? inv.json.invitation_code
console.log(`초대 코드 ${code}`)

// 2 ─ 앱 쪽: 계정
let tok = await call('POST', '/app/auth/signup', {
  body: { email: GUARDIAN.email, password: pw, name: GUARDIAN.name, phone: GUARDIAN.phone }
})
if (!tok.ok) {
  tok = await call('POST', '/app/auth/login', { body: { email: GUARDIAN.email, password: pw } })
  if (!tok.ok) { console.error('앱 계정 생성·로그인 실패', tok.status, tok.text.slice(0, 300)); process.exit(1) }
  console.log('앱 계정: 기존 계정으로 로그인')
} else {
  console.log('앱 계정: 새로 만들었다')
}
const appToken = tok.json.access_token

// 3 ─ 연결
const verify = await call('POST', '/app/link-invitations/verify', { token: appToken, body: { code } })
if (!verify.ok) { console.error('초대 코드 열람 실패', verify.status, verify.text.slice(0, 300)); process.exit(1) }
console.log('초대 열람:', JSON.stringify(verify.json).slice(0, 300))

// 아이는 앱 안에 프로필이 없으므로 `new_profile`로 만든다 (ClaimMapping: profile_id 또는 new_profile 중 하나)
const mappings = (verify.json.children ?? []).map((c) => (
  c.suggested_profile_id
    ? { client_id: c.client_id, profile_id: c.suggested_profile_id }
    : { client_id: c.client_id, new_profile: { display_name: c.name, birth_date: c.birth_date ?? undefined, gender: c.gender ?? undefined } }
))
const claim = await call('POST', '/app/links/claim', { token: appToken, body: { code, mappings } })
console.log('연결 확정:', claim.status, JSON.stringify(claim.json ?? claim.text).slice(0, 300))

const me = await call('GET', '/app/me', { token: appToken })
const out = path.join(DEMO, '_state/local-client-guardian.json')
fs.writeFileSync(out, JSON.stringify({
  api: API, email: GUARDIAN.email, name: GUARDIAN.name,
  access_token: appToken, refresh_token: tok.json.refresh_token,
  me: me.json
}, null, 2))
console.log(`상태 파일 ${out}`)
console.log('me:', JSON.stringify(me.json).slice(0, 400))

// 5 ─ 시뮬레이터 주입 (phone-stage의 login과 같은 방식 — RCTAsyncLocalStorage_V1/manifest.json)
//     앱이 살아 있으면 AsyncStorage가 메모리 캐시를 들고 있어 파일 수정을 안 읽는다 — 먼저 죽인다.
const BUNDLE = 'kr.mindscope.client.dev'
const udid = process.env.CAP_UDID ?? 'booted'
const { execSync } = await import('node:child_process')
const sh = (c) => execSync(c, { encoding: 'utf8' })
try {
  try { sh(`xcrun simctl terminate ${udid} ${BUNDLE}`) } catch { /* 안 떠 있어도 된다 */ }
  const data = sh(`xcrun simctl get_app_container ${udid} ${BUNDLE} data`).trim()
  const dir = path.join(data, 'Library', 'Application Support', BUNDLE, 'RCTAsyncLocalStorage_V1')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'manifest.json')
  let prev = {}
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* 처음 */ }
  fs.writeFileSync(file, JSON.stringify({
    ...prev,
    access_token: appToken,                 // storage.ts TokenStorage
    refresh_token: tok.json.refresh_token
  }))
  sh(`xcrun simctl launch ${udid} ${BUNDLE}`)
  console.log('시뮬레이터 주입 완료 — 앱을 다시 띄웠다 (토큰 값은 찍지 않는다)')
} catch (e) {
  console.log('시뮬레이터 주입 건너뜀:', String(e.message).slice(0, 160))
}
