// C4.4 위치 실측(캡처 안 함) — 전사 스크롤러와 대사 줄의 위치. scrollTo 목표를 고르는 근거.
// 결과는 PROBE_OUT(없으면 /tmp/probe-c44.json)에 쓴다.
import fs from 'node:fs'

const LINES = ['도현아, 지난번 검사 때', '13.2초 침묵', '이런 것도 말해도 돼요', '그냥 제가 참으면 되니까요', '잠이 잘 안 와요', '한 단어로만 적어보는 거야']

export default async function steps(page, h) {
  await h.until('text=C00003', '필드노트')
  const out = await page.evaluate((lines) => {
    const find = (t) => [...document.querySelectorAll('body *')].find((n) => n.children.length === 0 && n.textContent.includes(t))
    const first = find(lines[0])
    let sc = null
    for (let p = first?.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) { sc = p; break }
    }
    const sb = sc?.getBoundingClientRect()
    return {
      viewport: [innerWidth, innerHeight],
      scroller: sc && { top: sb.top, height: sc.clientHeight, scrollHeight: sc.scrollHeight, scrollTop: sc.scrollTop },
      lines: lines.map((t) => {
        const n = find(t); if (!n) return { t, missing: true }
        const r = n.getBoundingClientRect()
        return { t, viewportTop: Math.round(r.top), contentTop: sc ? Math.round(r.top - sb.top + sc.scrollTop) : null, h: Math.round(r.height) }
      })
    }
  }, LINES)
  fs.writeFileSync(process.env.PROBE_OUT ?? '/tmp/probe-c44.json', JSON.stringify(out, null, 2))
  await h.hold(100, '실측 끝')
}
