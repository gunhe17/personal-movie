// s03-B · AI 종합 리뷰 (마인드봄 보고서 편집기) — 초안을 받은 뒤가 진짜 일이다.
// 시작 URL: /examinations/<examId>/report?ids=<로르샤하>,<HTP>,<SCT>
//
// ⚠️ **이 화면의 AI는 시연용이다.** 백엔드가 없고, 지적은 정규식 규칙이 만들고
// 진행 4단계는 타이머다(`overall-review.ts:3-5`가 스스로 그렇게 밝힌다).
// 진짜로 서버가 도는 AI는 s03-A(`s03-draft.mjs`)의 초안 생성이다. 편집에서 두 테이크를
// 섞어 "전부 진짜"로 읽히게 만들지 않는다 — 그래서 action을 나눠 찍는다.
//
// 보여주는 것: 초안이 선 뒤 **누락·모순·표현을 문서 단위로 잡아내고, 고칠 문장을
// 먼저 보여주고, 임상가가 승인해야 본문이 바뀐다.** CDSS가 화면 동작으로 드러나는 자리.
export default async function steps(page, h) {
  await h.beat('종합보고서 편집기 — A4 지면 그대로')

  h.nocutStart('AI가 문서를 통째로 검토한다')
  await h.click(page.getByRole('button', { name: 'AI 종합 리뷰' }), 'AI 종합 리뷰')
  await h.until('text=보고서를 분석하고 있습니다', '네 단계로 훑는다')
  await h.beat('문서 구조 → 검사 결과 대조 → 서술 일관성 → 표현·문체')

  // 결과: 완성도 점수 · 검토사항 목록 · 작성 체크리스트
  await h.until('aside[aria-label="AI 종합 리뷰"] h4:has-text("검토사항")', '완성도 점수와 검토사항')
  await h.beat('무엇이 비었고 무엇이 어긋나는지')
  h.nocutEnd()

  // ① 섹션 누락 — 비어 있는 Ⅲ. 행동 관찰
  h.nocutStart('고칠 문장을 먼저 보여주고, 임상가가 승인한다')
  await h.reveal('button:has-text("초안 작성")', '섹션 누락 — Ⅲ 행동 관찰이 비었다')
  await h.click('button:has-text("초안 작성")', '초안 작성')
  await h.modal('바뀔 문장을 지면 그대로 보여준다')
  await h.click('button:has-text("본문에 적용")', '본문에 적용')
  await h.beat('지적이 사라지고 완성도가 오른다')
  h.nocutEnd()

  // ② 서술 모순 — 같은 문서 안에서 '중등도'와 '경미'가 엇갈린다
  await h.reveal('button:has-text("통일")', '서술 모순 — 중등도 vs 경미')
  await h.click('button:has-text("통일")', '한쪽으로 통일')
  await h.modal('같은 표현이 몇 곳인지까지 말한다')
  await h.click('button:has-text("본문에 적용")', '본문에 적용')
  await h.beat('점수가 다시 오른다')

  // ③ 구간 리뷰 — 문서 전체가 아니라 **긋는 문장 하나**를 본다
  h.nocutStart('문장 하나를 그으면 그 문장만 본다')
  await h.reveal('.para:has-text("해석되어진")', '문제가 있는 문장으로')
  await h.selectText('.para:has-text("해석되어진")', '문장을 긋는다')
  await h.click('[data-ai-review] button', 'AI 분석')
  await h.until('[role="dialog"][aria-label="AI 리뷰"]', '그 문장에 대한 지적')
  await h.beat('맞춤법 · 표현 · 근거 연결이 갈려서 나온다')
  await h.reveal('text=수정 후 미리보기', '수정 후 미리보기 — 바뀔 곳만 형광')
  await h.click('button:has-text("곳 모두 적용")', '모두 적용')
  await h.beat('본문이 바뀐다')
  h.nocutEnd()

  await h.hold(600, '끝')
}
