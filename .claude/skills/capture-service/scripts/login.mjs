#!/usr/bin/env node
// login.mjs — 로그인해서 storageState를 저장한다. capture.mjs --state 로 넘긴다.
//   CAP_EMAIL=... CAP_PASSWORD=... node login.mjs --base http://localhost:3503 --out _state/local-admin.json
// 자격증명은 환경변수로만 받는다 — 파일·meta·manifest 어디에도 남기지 않는다.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEMO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../../../movies/26IRDEMO')
const APP_ROOT = process.env.CAPTURE_APP_ROOT ?? path.join(DEMO_ROOT, '_tool/saas-center-platform')
const { chromium } = createRequire(process.env.CAPTURE_PLAYWRIGHT_FROM ?? path.join(APP_ROOT, 'apps/web/package.json'))('playwright')

const a = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true] }))
const base = a.base, out = path.join(DEMO_ROOT, a.out ?? '_state/state.json')
const email = process.env.CAP_EMAIL, password = process.env.CAP_PASSWORD
if (!base || !email || !password) { console.error('--base, CAP_EMAIL, CAP_PASSWORD 필요'); process.exit(1) }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ locale: 'ko-KR' })
const page = await ctx.newPage()
await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.fill('#email', email)
await page.fill('#password', password)
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }), page.click('button[type=submit]')])
await page.waitForLoadState('networkidle').catch(() => {})
// 복수 센터 계정은 /welcome에서 센터를 골라야 centerId가 localStorage에 들어간다. --center "이름" 으로 지정, 없으면 첫 번째.
if (page.url().includes('/welcome')) {
  const row = a.center ? page.locator(`text=${a.center}`).locator('xpath=ancestor::*[.//button][1]') : page.locator('main, body')
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/welcome'), { timeout: 15000 }), row.locator('button', { hasText: '참여' }).first().click()])
  await page.waitForLoadState('networkidle').catch(() => {})
}
// 마인드봄은 /select-institution을 거친다. 기관이 하나면 페이지가 알아서 /dashboard로 보내지만
// 그때는 기관 쿠키가 안 붙어 API가 403 "기관이 선택되지 않았습니다"가 된다 — 버튼이 있으면 반드시 누른다.
if (page.url().includes('/select-institution')) {
  const pick = a.center ? page.locator('button', { hasText: a.center }) : page.locator('button:has(p)').first()
  await pick.first().click().catch(() => {})
  await page.waitForURL((u) => !u.pathname.startsWith('/select-institution'), { timeout: 15000 }).catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})
}
fs.mkdirSync(path.dirname(out), { recursive: true })
await ctx.storageState({ path: out })
console.error(`[login] ${page.url()} → ${path.relative(DEMO_ROOT, out)}`)
await browser.close()
