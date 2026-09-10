// s03 · AI 종합 리뷰 (마인드봄 보고서 편집기) — 초안을 받은 뒤가 진짜 일이다.
// 시작 URL: /examinations/<examId>/report?ids=<로르샤하>,<HTP>,<SCT>
//
// 흐름 (2026-09-10 재구성): AI 분석 → 사이드바 자료를 본문에 드래그 앤 드롭 → AI 지적 하나를 승인해 적용.
//
// ⚠️ **AI 종합 리뷰 부분은 시연용이다.** 백엔드가 없고, 지적은 정규식 규칙이 만들고
// 진행 4단계는 타이머다(`overall-review.ts:3-5`가 스스로 그렇게 밝힌다). 저장도 없다.
// "개발 예정" 라벨은 편집에서 얹는다(2026-09-10 결정).
//
// 드래그 앤 드롭은 **실기능**이다 — 왼쪽 자료는 윤도현의 실제 검사 결과이고, 놓은 자리에
// 제품 코드(`placeCaretAtPoint` → `insertMaterial`)가 표를 넣는다. 클릭 삽입과 같은 경로다.
// 표를 고른 이유: HTP 그림은 666×942px라 900px 뷰포트에 안 잡혔다(t05~t07). SCT '영역별 점수 요약'은 5행이라 한 화면에 앉고, 4) 자기개념이 인용하는 바로 그 점수다.
export default async function steps(page, h) {
  await h.beat('종합보고서 편집기 — A4 지면 그대로')

  // ① AI 분석 — 문서를 통째로 검토한다
  h.nocutStart('AI가 문서를 통째로 검토한다')
  await h.click(page.getByRole('button', { name: 'AI 종합 리뷰' }), 'AI 종합 리뷰')
  await h.until('text=보고서를 분석하고 있습니다', '네 단계로 훑는다')
  await h.beat('문서 구조 → 검사 결과 대조 → 서술 일관성 → 표현·문체')
  await h.until('aside[aria-label="AI 종합 리뷰"] h4:has-text("검토사항")', '완성도 점수와 검토사항')
  await h.beat('무엇이 비었고 무엇이 어긋나는지')
  h.nocutEnd()

  // ② 검사 자료를 본문에 끌어다 놓는다 — 로샤 결과가 그대로 문서가 된다
  h.nocutStart('검사 자료를 끌어다 놓으면 문서가 된다')
  await h.drag('aside button:has-text("영역별 점수 요약")',
    { sel: '.para:has-text("4) 자기개념") + .para', fx: 0.5, fy: 0.5 },
    'SCT 영역별 점수 표를 자기개념 문단 아래로')
  await h.until('.rpt-table', '놓은 자리에 표가 앉는다')
  await h.reveal('.rpt-table', '표가 지면에 들어왔다')
  await h.beat('사이드바 자료에는 첨부됨 표시가 붙는다')
  h.nocutEnd()

  // ③ AI 지적 하나를 쓴다 — 비어 있는 Ⅲ. 행동 관찰
  h.nocutStart('고칠 문장을 먼저 보여주고, 임상가가 승인한다')
  await h.reveal('button:has-text("초안 작성")', '섹션 누락 — Ⅲ 행동 관찰이 비었다')
  await h.click('button:has-text("초안 작성")', '초안 작성')
  await h.modal('바뀔 문장을 지면 그대로 보여준다')
  await h.click('button:has-text("본문에 적용")', '본문에 적용')
  await h.beat('지적이 사라지고 완성도가 오른다')
  h.nocutEnd()

  await h.hold(600, '끝')
}
