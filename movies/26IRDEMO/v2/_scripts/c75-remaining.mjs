// C7.5 잔여 (내담자 앱 · 시뮬레이터) — 보호자 쪽에서도 같은 숫자.
// 배역: 보호자 이수진 · 아이 이하준. 전제: v2/_scripts/phone-link.mjs · idb.
// 화면: 마이 → 바우처 → `이하준님의 바우처` 카드(9/12회 · 9회 남았어요).
// 웹의 회기 차감(C7.4)이 만든 숫자가 보호자 화면에 그대로 선다 — 옮겨 적는 사람이 없다.
export default async function steps(p) {
  await p.beat('앱 홈')
  await p.tap('마이', '마이 탭')
  await p.beat('이수진님 · 자녀 이하준')
  p.nocutStart('바우처 → 잔여 회기')
  await p.tap('바우처', '바우처')
  await p.beat('9 / 12회 — 9회 남았어요')
  p.nocutEnd()
  await p.hold(1500, '끝')
}
