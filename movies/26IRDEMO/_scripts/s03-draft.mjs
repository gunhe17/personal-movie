// s03-A · 종합보고서 AI 초안 (마인드봄 뷰어 화면) — 8시간이 다듬는 일로.
// 배역: 검사 축(무대는 마인드봄). 박지우 배터리 3종 확정 → 종합보고서.
// 시작 URL: /clients/<clientId>/reports/<reportId>
//
// **이 테이크의 AI는 전부 진짜다.** 버튼이 서버를 부르고(POST …/generate-draft),
// 서버가 링크된 검사 3종의 signals를 모아 문장을 만들고, 상태머신이 draft → ai_generated로
// 옮기고, 섹션에 `source='ai'`가 박힌다. 화면의 보라 `AI` 배지가 그 값이다.
// (모델 URL이 없는 로컬에서는 서버의 룰베이스 폴백이 돈다 — 문장 출처가 서버라는 사실은 같다)
//
// 장면의 논지는 "AI가 보고서를 써준다"가 아니라 **누가 썼는지가 갈려 있다**는 것이다.
// 임상가가 쓴 섹션은 AI가 건드리지 못하고(services.py:129-130), 문서가 스스로
// 모델명과 "최종 해석·확정은 임상가 책임(CDSS)"을 밝힌다.
export default async function steps(page, h) {
  await h.beat('종합보고서 — 검사 3종이 한 문서로')

  // 임상가가 쓴 곳과 자동으로 모인 곳
  await h.reveal('text=평가 사유', '평가 사유 — 임상가가 쓴 곳')
  await h.reveal('text=실시 검사', '실시 검사 3종 — 로르샤하 · HTP · SCT')

  // 검사별 결과가 한 문서에 모여 있다. 메일 왕복이 사라지는 자리
  await h.reveal('text=검사 결과 — 로르샤하', '로르샤하 결과')
  await h.reveal('text=검사 결과 — SCT (문장완성검사)', 'SCT 결과')

  // 그런데 종합 소견과 제언은 비어 있다 — 여기가 8시간이 들던 자리다
  await h.reveal('text=종합 소견', '종합 소견 — 아직 비어 있다')
  await h.beat('제언도 비어 있다')

  h.nocutStart('빈 칸이 채워진다 — 검사 3종을 읽고')
  await h.click(page.getByRole('button', { name: 'AI 초안 생성', exact: true }), 'AI 초안 생성')
  await h.modal('무엇을 채우는지 먼저 말한다 — 비어 있는 섹션만')
  // ⚠️ `초안 생성`은 헤더의 `AI 초안 생성`에도 들어 있다 — exact가 아니면 모달 뒤의 그 버튼을 누른다
  await h.click(page.getByRole('button', { name: '초안 생성', exact: true }), '초안 생성')

  // 서버가 검사 signals를 읽고 문장을 만든다. 걸리는 만큼만 기다린다
  await h.until('text=AI 초안이 생성되었습니다', '서버가 답했다')
  await h.reveal('text=종합 소견', '종합 소견이 채워졌다')
  await h.beat('보라색 AI 배지 — 이 문단은 초안이다')
  await h.reveal('text=제언', '제언도 채워졌다')
  h.nocutEnd()

  // 문서가 스스로 밝히는 출처와 책임
  await h.reveal('text=최종 해석·확정은 임상가 책임', 'CDSS — 모델명과 책임 소재가 문서에 박힌다')
  await h.beat('"최종 해석·확정은 임상가 책임"')

  await h.hold(600, '끝')
}
