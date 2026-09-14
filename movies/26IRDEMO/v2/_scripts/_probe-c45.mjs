// C4.5 위치 실측(캡처 안 함) — 초안 생성 뒤 일지 칸들과 그 스크롤러. scrollTo 목표를 고르는 근거.
// ⚠ 초안을 실제로 만든다 — 끝나면 _scripts/s07-setup.sql로 되돌린다. 결과는 PROBE_OUT에 쓴다.
import fs from 'node:fs'

export default async function steps(page, h) {
  await h.click('button:has-text("일지 초안 생성")', '일지 초안 생성')
  await h.until('text=초안으로 채웠어요', '채워졌다', 60000)
  const out = await page.evaluate(() => {
    const areas = [...document.querySelectorAll('textarea')]
    const scrollerOf = (n) => {
      for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p
      }
      return null
    }
    const sc = areas.length ? scrollerOf(areas[0]) : null
    const sb = sc?.getBoundingClientRect()
    return {
      viewport: [innerWidth, innerHeight],
      scroller: sc && { top: Math.round(sb.top), bottom: Math.round(sb.bottom), height: sc.clientHeight, scrollHeight: sc.scrollHeight },
      fields: areas.map((a) => {
        const r = a.getBoundingClientRect()
        return { placeholder: a.placeholder, top: Math.round(r.top), bottom: Math.round(r.bottom), filled: a.value.length > 0 }
      })
    }
  })
  fs.writeFileSync(process.env.PROBE_OUT ?? '/tmp/probe-c45.json', JSON.stringify(out, null, 2))
  await h.hold(100, '실측 끝')
}
