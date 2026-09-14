// C5.6 도착 (내담자 앱 · 시뮬레이터) — 받아본 적 없던 것이 도착한다.
// 배역: 보호자 이수진 · 아이 이하준. 전제:
//   ① v2/_scripts/phone-link.mjs (앱 계정 · 센터 연결 · 토큰)
//   ② C5.5가 이미 **전달**한 공유문이 있어야 한다 (counseling_note_shares.status='published')
//   ③ idb
//
// ⚠ 브리프의 "알림 → 기록 탭"은 제품 경로가 아니다. `기록` 탭은 보호자가 쓰는 일기이고,
//   센터가 전한 글은 **케어보드 → 진행중인 활동 → 자세히 보기 → 상담 기록**에 붙는다
//   (app/(main)/counseling-case/[caseId].tsx:490 `hasShare`).
export default async function steps(p) {
  await p.beat('앱 홈')
  await p.tap('케어보드', '케어보드 탭')
  await p.tap('진행중인 활동', '진행중인 활동')
  await p.beat('놀이치료 12/16회')
  // `자세히 보기`는 카드 안에 묻혀 접근성 트리에 따로 안 뜬다 — 실측 좌표(402×874 points)
  await p.tap({ x: 200, y: 441 }, '자세히 보기')
  await p.beat('상담 기록 목록')
  p.nocutStart('그 회기의 글이 열린다')
  await p.tap(/^12회기/, '12회기 — 상담 내용 보기')
  await p.beat('센터가 전해온 글')
  await p.swipe(200, 700, 200, 430, '끝까지 읽는다')
  p.nocutEnd()
  await p.hold(1500, '끝')
}
