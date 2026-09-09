#!/usr/bin/env node
// record.mjs — 사람의 조작을 기록해 장면 스크립트 초안을 만든다. (codegen 대체 — 앱의 로드 중 리다이렉트에 codegen이 죽는다)
//   CAP_PASSWORD=… node record.mjs --scene s01 --account staff --url http://localhost:3503/schedule/calendar
// 흐름: 새 로그인 상태 생성 → 헤드 브라우저 → 사용자가 조작 → 창을 닫으면 _scripts/_rec-<scene>.json + _scripts/<scene>-draft.mjs 저장
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEMO_ROOT = path.resolve(HERE, '../../../../movies/26IRDEMO')
const APP_WEB = path.join(process.env.CAPTURE_APP_ROOT ?? path.join(DEMO_ROOT, '_tool/saas-center-platform'), 'apps/web/package.json')
const a = parseArgs(process.argv.slice(2))
for (const k of ['scene', 'account', 'url']) if (!a[k]) die(`--${k} 필요`)

const accounts = JSON.parse(fs.readFileSync(path.join(DEMO_ROOT, '_state/accounts.json'), 'utf8'))
const acc = accounts.accounts[a.account]; if (!acc) die(`계정 없음: ${a.account}`)
const statePath = path.join(DEMO_ROOT, `_state/local-${a.account}.json`)
// 토큰이 회전하므로 매번 새로 로그인한다
execSync(`node "${path.join(HERE, 'login.mjs')}" --base "${accounts.base}" --out "_state/local-${a.account}.json"`,
  { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CAP_EMAIL: acc.email, CAP_PASSWORD: process.env.CAP_PASSWORD ?? accounts.password } })

const { chromium } = createRequire(APP_WEB)('playwright')
const browser = await chromium.launch({ headless: false, args: ['--window-position=80,60'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, colorScheme: 'light', locale: 'ko-KR', storageState: statePath })
const events = []
const t0 = Date.now()
await context.exposeBinding('__rec', ({ page }, ev) => {
  const e = { t: +((Date.now() - t0) / 1000).toFixed(2), url: page.url().replace(accounts.base, ''), ...ev }
  events.push(e); log(`${e.t}s ${e.kind} ${e.url} ${e.role || e.tag} "${e.name || e.value || e.key || e.dy || ''}"`)
})
await context.addInitScript(() => {
  const INTERACTIVE = 'button, a, [role=button], [role=tab], [role=menuitem], [role=option], input, textarea, select, label, [data-testid], li, td, th'
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const txt = (el) => {
    const own = clean(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.value)
    if (own) return own.slice(0, 40)
    const t = clean(el.innerText)
    if (t && t.length <= 40) return t
    // 큰 컨테이너면 안쪽의 짧은 텍스트 하나만
    const small = [...el.querySelectorAll('*')].map((c) => clean(c.innerText)).find((s) => s && s.length <= 24)
    return small || ''
  }
  const desc = (el) => {
    const t = el.closest(INTERACTIVE) || el
    return { tag: t.tagName.toLowerCase(), role: t.getAttribute('role') || (t.tagName === 'BUTTON' ? 'button' : t.tagName === 'A' ? 'link' : null),
      name: txt(t), placeholder: t.getAttribute('placeholder'), testid: t.getAttribute('data-testid'), type: t.getAttribute('type'), id: t.id || null }
  }
  // 녹화 창임을 알리는 띠 — 캡처와 무관한 기록용 창이라 페이지 위에 그려도 된다
  const banner = () => { if (document.getElementById('__recbar') || !document.body) return
    const b = document.createElement('div'); b.id = '__recbar'
    b.textContent = '● 녹화 중 — 조작을 마치면 이 창을 닫으세요'
    b.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:2147483647;background:#B3261E;color:#fff;font:600 13px/1 -apple-system,sans-serif;padding:7px 14px;border-radius:999px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.25)'
    document.body.appendChild(b) }
  banner(); document.addEventListener('DOMContentLoaded', banner); setInterval(banner, 1500)
  window.addEventListener('click', (e) => window.__rec({ kind: 'click', ...desc(e.target) }), true)
  window.addEventListener('change', (e) => { const el = e.target; if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) window.__rec({ kind: 'input', value: el.type === 'password' ? '***' : el.value, ...desc(el) }) }, true)
  window.addEventListener('keydown', (e) => { if (['Enter', 'Escape', 'Tab'].includes(e.key)) window.__rec({ kind: 'key', key: e.key, ...desc(e.target) }) }, true)
  let lastScroll = 0
  window.addEventListener('scroll', () => { const y = window.scrollY; if (Math.abs(y - lastScroll) > 200) { window.__rec({ kind: 'scroll', dy: Math.round(y - lastScroll) }); lastScroll = y } }, true)
})
const page = await context.newPage()
await page.goto(a.url, { waitUntil: 'load' }).catch(() => {})
log(`녹화 중 — ${acc.name}(${a.account}) · ${a.url}. 조작을 마치면 브라우저 창을 닫으세요.`)

await new Promise((res) => { context.on('close', res); page.on('close', () => setTimeout(res, 800)) })
await browser.close().catch(() => {})

// 기록 저장 + 초안 생성
const recFile = path.join(DEMO_ROOT, `_scripts/_rec-${a.scene}.json`)
fs.writeFileSync(recFile, JSON.stringify({ scene: a.scene, account: a.account, url: a.url, recorded_at: new Date().toISOString(), events }, null, 2))
const sel = (e) => e.testid ? `[data-testid="${e.testid}"]` : e.placeholder ? `[placeholder="${e.placeholder}"]` : (e.role && e.name) ? `role=${e.role}[name="${e.name}"]` : e.name ? `text=${e.name}` : e.id ? `#${e.id}` : e.tag
const lines = []
let lastUrl = a.url.replace(accounts.base, '')
for (const e of events) {
  if (e.url !== lastUrl) { lines.push(`  await h.beat('화면 이동 → ${e.url}')`); lastUrl = e.url }
  if (e.kind === 'click') lines.push(`  await h.click('${sel(e)}', '${e.name || ''}')`)
  else if (e.kind === 'input') lines.push(`  await h.type('${sel(e)}', '${(e.value || '').replace(/'/g, "\\'")}')`)
  else if (e.kind === 'key') lines.push(`  await page.keyboard.press('${e.key}'); await h.hold(400, '${e.key}')`)
  else if (e.kind === 'scroll') lines.push(`  await h.scroll(${e.dy}, '스크롤')`)
}
const draft = path.join(DEMO_ROOT, `_scripts/${a.scene}-draft.mjs`)
fs.writeFileSync(draft, `// ${a.scene} 초안 — record.mjs 기록(${events.length}개 이벤트)에서 생성. 계정 ${a.account} · 시작 ${a.url}
// 할 일: note 다듬기 · 상태가 바뀐 곳에 h.beat · 모달 뒤 h.modal · 노컷 구간 h.nocutStart/End · 헛클릭 삭제
export default async function steps(page, h) {
  await h.beat('첫 화면')
${lines.join('\n')}
  await h.hold(1500, '끝')
}
`)
log(`이벤트 ${events.length}개 → ${path.relative(DEMO_ROOT, recFile)} · 초안 ${path.relative(DEMO_ROOT, draft)}`)

function parseArgs(x) { const o = {}; for (let i = 0; i < x.length; i++) if (x[i].startsWith('--')) { const k = x[i].slice(2); o[k] = x[i + 1] && !x[i + 1].startsWith('--') ? x[++i] : true } return o }
function log(s) { process.stderr.write(`[record] ${s}\n`) }
function die(s) { log(s); process.exit(1) }
