// C6.4 위치 실측(캡처 안 함) — 리포트가 선 뒤 **모달 안** 스크롤러와 제목·근거 칩의 위치. scrollTo 목표를 고르는 근거.
// ⚠ 분석을 실제로 만든다 — 끝나면 v2/_scripts/c64-analysis-setup.sql로 되돌린다. 결과는 PROBE_OUT에 쓴다.
// (1판은 케이스 화면 뒤쪽 회기 목록의 `7회기`를 잡아 엉뚱한 스크롤러를 쟀다 — 기준을 `전환점`이 든 스크롤러로 바꿨다)
import fs from 'node:fs'

export default async function steps(page, h) {
  await h.click('button:has-text("AI 경과 분석")', 'AI 경과 분석')
  await h.modal('모달')
  await h.click('button:has-text("경과 분석 실행")', '경과 분석 실행')
  await h.modal('범위')
  await h.click('button:has-text("분석 실행") >> nth=-1', '분석 실행')
  await h.until('text=전환점', '리포트', 120000)
  const out = await page.evaluate(() => {
    const leaves = (root) => [...root.querySelectorAll('*')].filter((n) => n.children.length === 0)
    const anchor = leaves(document.body).filter((n) => n.textContent.trim() === '전환점' || n.textContent.includes('전환점')).pop()
    let sc = null
    for (let p = anchor?.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) { sc = p; break }
    }
    if (!sc) return { error: '전환점의 스크롤러를 못 찾았다' }
    const sb = sc.getBoundingClientRect()
    const at = (n) => { const r = n.getBoundingClientRect(); return { top: Math.round(r.top - sb.top + sc.scrollTop), h: Math.round(r.height) } }
    const rows = leaves(sc)
      .map((n) => ({ text: n.textContent.trim().slice(0, 40), tag: n.tagName, weight: Number(getComputedStyle(n).fontWeight), ...at(n) }))
      .filter((x) => x.text.length > 1 && (x.weight >= 600 || /^\d+회기$/.test(x.text)))
    return { scroller: { top: Math.round(sb.top), height: sc.clientHeight, scrollHeight: sc.scrollHeight }, rows }
  })
  fs.writeFileSync(process.env.PROBE_OUT ?? '/tmp/probe-c64b.json', JSON.stringify(out, null, 2))
  await h.hold(100, '실측 끝')
}
