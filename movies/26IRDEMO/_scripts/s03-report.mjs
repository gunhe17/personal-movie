// s03 · 채점 · 보고서 (마인드봄) — 8시간에서 다듬는 일로.
// 배역: 검사 축(무대는 마인드봄). 박지우 배터리 3종 확정 → 종합보고서.
// 시작 URL: /clients/<clientId>/reports/<reportId>
//
// 이 장면이 보여주는 것은 "AI가 보고서를 써준다"가 아니라 **누가 썼는지가 갈려 있다**는 것이다.
// 섹션마다 `임상가` / `AI` 배지가 붙고, 하단에 모델명과 "최종 해석·확정은 임상가 책임(CDSS)"이 박혀 있다.
export default async function steps(page, h) {
  await h.beat('종합보고서 — 검사 3종이 한 문서로')

  // 맨 위부터: 인적사항 · 평가 사유(임상가) · 행동관찰(임상가)
  await h.reveal('text=평가 사유', '평가 사유 — 임상가가 쓴 곳')
  await h.reveal('text=실시 검사', '실시 검사 3종 — 로르샤하 · HTP · SCT')

  // 검사별 결과가 한 문서에 모인다. 메일 왕복이 사라지는 자리
  h.nocutStart('검사 3종의 결과가 한 문서에')
  await h.reveal('text=검사 결과 — 로르샤하', '로르샤하 결과')
  await h.hold(900, '수치가 표로 들어와 있다')
  await h.reveal('text=검사 결과 — HTP (집-나무-사람)', 'HTP 결과')
  await h.reveal('text=검사 결과 — SCT (문장완성검사)', 'SCT 결과')
  h.nocutEnd()

  // 종합 소견·제언에는 AI 배지가 붙는다 — 초안이라는 표시
  h.nocutStart('종합 소견 · 제언 — AI 배지')
  await h.reveal('text=종합 소견', '종합 소견 — AI 초안')
  await h.hold(1400, 'AI 배지 — 이 문단은 초안이다')
  await h.reveal('text=제언', '제언 — AI 초안')
  await h.hold(1200, '여기도 AI')
  h.nocutEnd()

  // 문서가 스스로 밝히는 출처
  await h.reveal('text=최종 해석·확정은 임상가 책임', 'CDSS — 모델명과 책임 소재가 문서에 박힌다')
  await h.hold(1400, '"최종 해석·확정은 임상가 책임"')
  await h.hold(600, '끝')
}
