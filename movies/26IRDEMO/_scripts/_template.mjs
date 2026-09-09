// 장면 스크립트 템플릿 — 복사해서 sNN-<action>.mjs 로 저장한다.
// 뷰포트·타이밍은 여기서 바꾸지 않는다 (capture.mjs SPEC이 정본).
// h: click(sel, note) · type(sel, text, note) · scroll(dy, note) · hover(sel, note)
//    beat(note) — 상태가 바뀐 뒤 시청자가 볼 시간 · modal(note) · hold(ms, note)
//    nocutStart(note) / nocutEnd() — 6초 노컷 후보 구간 표시
// 셀렉터는 텍스트 기반을 우선한다: 'text=승인', 'role=button[name="저장"]', '[data-testid=...]'

export default async function steps(page, h) {
  await h.beat('첫 화면')                       // lead 3초 뒤 첫 프레임
  // await h.click('text=변경 요청', '요청 열기')
  // await h.modal('요청 상세')
  // h.nocutStart('승인 → 캘린더 반영')
  // await h.click('role=button[name="승인"]', '승인')
  // await h.beat('캘린더 반영')
  // h.nocutEnd()
  await h.hold(1500, '끝')
}
