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
  await h.hover('button:has-text("7회기") >> nth=0', '근거 — 7회기')
  await h.beat('모든 판단에 회기 번호')
  await h.scroll(560, '아래로 이어지는 리포트')
  await h.hold(600, '끝')
}
