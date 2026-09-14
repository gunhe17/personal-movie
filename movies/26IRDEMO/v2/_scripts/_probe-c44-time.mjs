// C4.4 · C4.5 시각 표시 실측(캡처 안 함) — 같은 회기를 필드노트 화면과 회기 화면이 각각 몇 시로 그리는가.
// 시작 URL: 필드노트 상세. 회기 URL은 PROBE_SESSION_URL. 결과는 PROBE_OUT에 쓴다.
import fs from 'node:fs'

const grab = (page) => page.evaluate(() =>
  [...document.querySelectorAll('body *')]
    .filter((n) => n.children.length === 0 && /\d{2}:\d{2}/.test(n.textContent) && n.textContent.length < 60)
    .map((n) => n.textContent.trim()))

export default async function steps(page, h) {
  await h.until('text=C00003', '필드노트')
  const fieldNote = await grab(page)
  await page.goto(process.env.PROBE_SESSION_URL, { waitUntil: 'load' })
  await h.until('text=상담 정보', '회기 상세')
  const session = await grab(page)
  fs.writeFileSync(process.env.PROBE_OUT ?? '/tmp/probe-c44-time.json', JSON.stringify({ fieldNote, session }, null, 2))
  await h.hold(100, '실측 끝')
}
