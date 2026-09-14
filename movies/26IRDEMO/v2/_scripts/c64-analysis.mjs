// C6.4 케이스 분석 (웹) — 열두 장이 한 화면이 되고, 판단마다 회기 번호가 달린다.
// 배역: 회기 축 — 이하준 놀이치료 C00002(12회기 완료). 시작 URL: /counseling/status/<caseId>
// 전제: v2/_scripts/c64-analysis-setup.sql (12회기 + 분석 본문 고정) · llm-stub(:3599) · batch 워커.
//
// 실측(_probe-c64.mjs): 리포트가 서면 판단 블록의 근거 칩이 y498~822에 이미 보인다 —
// `7회기`는 스크롤 없이 짚을 수 있다. 리포트 본문은 안쪽 스크롤러(sh 5486 / ch 598)라
// 슈퍼비전 방향(y5506)까지 내리면 한 번의 이징으로 5천 px을 지나 화면이 뭉갠다.
// 12초 컷에서는 "근거가 달린다"까지가 논지다 — 아래로는 한 화면만 내려 길이만 보인다.
export default async function steps(page, h) {
  await h.beat('케이스 — 끝난 회기 열둘')
  await h.click('button:has-text("AI 경과 분석")', 'AI 경과 분석')
  await h.modal('경과 분석 — 아직 없다')
  h.nocutStart('분석 실행 → 리포트가 선다 (생성 소요는 노컷)')
  await h.click('button:has-text("경과 분석 실행")', '경과 분석 실행')
  await h.modal('범위 선택 · 비용 확인')
  await h.click('button:has-text("분석 실행") >> nth=-1', '분석 실행')
  await h.until('text=전환점', '분석 중… → 리포트', 120000)
  h.nocutEnd()
  await h.beat('열두 회기가 한 화면으로')
  // 리포트 안의 칩으로 좁힌다 — `nth=0`만 쓰면 뒤 케이스 화면의 회기 목록 `7회기`가 먼저 걸려 배경이 스크롤된다(2026-09-14 리허설).
  // 리포트는 role=dialog가 아니라(CaseAnalysisPanel) 셀렉터로 못 가른다 — `전환점`이 든 스크롤러 안의 첫 칩에 보이지 않는 표식을 단다.
  await page.evaluate(() => {
    const anchor = [...document.querySelectorAll('body *')].filter((n) => n.children.length === 0 && n.textContent.includes('전환점')).pop()
    let sc = null
    for (let p = anchor?.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) { sc = p; break }
    }
    const chip = sc && [...sc.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('7회기'))
    chip?.setAttribute('data-cap', 'chip7')
  })
  await h.hover('[data-cap="chip7"]', '근거 — 7회기')
  await h.beat('모든 판단에 회기 번호')
  // SPEC v8 규칙 2-2 — 거리가 아니라 목표로. 실측(_probe-c64b.mjs): 리포트 스크롤러 높이 574 · 내용 5486,
  // `개입 기법과 반응` 제목이 465 — 그 제목을 위에 두면(441px) 판단 블록 다음 섹션이 한 화면에 선다.
  await h.scrollTo('text=개입 기법과 반응', '다음 섹션 — 개입 기법과 반응', 'start')
  await h.hold(600, '끝')
}
