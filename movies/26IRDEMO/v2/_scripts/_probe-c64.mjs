// C6.4 위치 실측 — 리포트가 선 뒤 근거 회기 칩이 어디에 있는지. 캡처하지 않는다.
export default async function steps(page, h) {
  await h.click('button:has-text("AI 경과 분석")', '분석 열기')
  await h.click('button:has-text("경과 분석 실행")', '실행')
  await h.click('button:has-text("분석 실행") >> nth=-1', '확인')
  await h.until('text=전환점', '리포트', 120000)
  const out = await page.evaluate(() => {
    const chips = []
    for (const e of document.querySelectorAll('button')) {
      const t = (e.textContent || '').trim()
      if (t.endsWith('회기') && t.length <= 5) {
        const r = e.getBoundingClientRect()
        chips.push(`${t} @ y${Math.round(r.top)}`)
      }
      if (chips.length >= 10) break
    }
    const heads = []
    for (const e of document.querySelectorAll('h1,h2,h3,p,span,div')) {
      const t = (e.textContent || '').trim()
      if (['변화 흐름', '전환점', '개입과 반응', '슈퍼비전에서 나눠볼 질문', '앞으로'].includes(t)) {
        heads.push(`${t} @ y${Math.round(e.getBoundingClientRect().top)}`)
      }
    }
    return { chips, heads: heads.slice(0, 12) }
  })
  console.log('CHIPS:', JSON.stringify(out.chips))
  console.log('HEADS:', JSON.stringify(out.heads))
}
