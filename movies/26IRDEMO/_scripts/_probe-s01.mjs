// reveal 하나로 '총 3명'과 기관이 한 화면에 들어오는지 실측한다 (캡처 없음 — DOM rect만).
// s01-intake.mjs와 같은 흐름을 타되, reveal 뒤에 두 요소의 뷰포트 y를 찍는다.
export default async function steps(page, h) {
  await h.beat('에이전트 화면')
  await h.type('textarea[placeholder="무엇이든 물어보세요"]',
    '전화 하고 있는데, 햇살지역아동센터 아이 셋 검사 접수해줘. 윤도현 2014-05-08, 장서아 2015-11-21, 홍시우 2016-02-13이야.', '요청')
  await h.key('Enter', '전송')
  await h.until('text=접수 진행', '폼')
  for (const s of ['로르샤흐', '집-나무-사람', '문장완성검사', '스마트폰중독검사'])
    await h.click(`button:has-text("${s}")`, s)
  await h.beat('3/3')
  await h.reveal('text=총 3명', '명단 총 3명')

  const scroller = await page.locator('text=햇살지역아동센터').first().evaluate((n) => {
    for (let el = n.parentElement; el; el = el.parentElement) {
      const o = getComputedStyle(el).overflowY
      if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 4)
        return { tag: el.tagName, cls: el.className.slice(0, 90),
                 scrollTop: Math.round(el.scrollTop), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
                 남은거리: Math.round(el.scrollHeight - el.clientHeight - el.scrollTop) }
    }
    return null
  })
  console.log('\n스크롤러:', JSON.stringify(scroller, null, 1))

  const rect = async (sel) => page.locator(sel).first().evaluate((n) => {
    const r = n.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
  })
  const list = await rect('text=총 3명')
  const inst = await rect('text=햇살지역아동센터')
  const vh = page.viewportSize().height
  console.log(`\n실측 · 뷰포트 ${vh}px`)
  console.log(`  총 3명       top=${list.top} bottom=${list.bottom}`)
  console.log(`  햇살지역아동센터 top=${inst.top} bottom=${inst.bottom}`)
  const ok = (r) => r.top >= 0 && r.bottom <= vh
  console.log(`  한 화면에 둘 다: ${ok(list) && ok(inst) ? '예' : '아니오'}`)
  await h.hold(300, '끝')
}
