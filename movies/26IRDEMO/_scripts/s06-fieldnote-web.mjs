// s06 · 필드노트 — 웹 절반. 앱이 녹음한 것이 여기서 전사·화자·시간 축으로 열린다.
// 배역: 회기 축 — 이하준 C00002. 전사는 준비 단계(_scripts/s06-setup.sql)에서 넣는다.
// 시작 URL: /schedule/field-notes/<이하준 fieldNoteId>
export default async function steps(page, h) {
  await h.beat('필드노트 — 30분 · 회기에 연결됨')
  await h.hold(2000, '누가 언제 남겼는지가 머리에 있다')

  h.nocutStart('시간 축을 따라 — 머릿속에 있던 것이 남는다')
  await h.scroll(500, '전사로')
  await h.beat('화자별 대화 — 상담사 / 내담자')
  await h.hold(2500, '분 단위 타임스탬프가 붙어 있다')
  await h.scroll(500, '더 아래로')
  // 이 화면에 요약 카드는 없다 — /schedule/field-notes/[id]는 FieldNoteCompleted를
  // activeTab='transcript' 기본값으로만 쓴다(탭 UI는 FieldNoteView 쪽이고 이 라우트는
  // 쓰지 않는다). 요약·일지는 s07의 회기 상세가 받는다.
  await h.beat('회기 후반 — 다음 주 과제까지 남아 있다')
  h.nocutEnd()

  await h.hold(1500, '끝')
}
