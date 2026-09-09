// 폰 장면 스크립트 템플릿 — 복사해서 sNN-phone-<action>.mjs 로 저장한다. (idb 필요)
// p: tap(label | {x,y}, note) · type(text, note) · swipe(x1,y1,x2,y2, note) · scrollUp(note) · home(note)
//    beat(note) · hold(ms, note) · nocutStart(note) / nocutEnd()
// label은 접근성 라벨(AXLabel)과 정확히 일치해야 한다. 정규식도 된다: /^변경 요청/
// 좌표는 points (iPhone 17 Pro: 402×874)

export default async function steps(p) {
  await p.beat('첫 화면')
  // await p.tap('일정', '일정 탭')
  // await p.tap(/^변경 요청/, '변경 요청 열기')
  // p.nocutStart('시간 선택 → 요청')
  // await p.tap('이 시간으로 요청하기', '요청')
  // await p.beat('요청 완료')
  // p.nocutEnd()
  await p.hold(1000, '끝')
}
