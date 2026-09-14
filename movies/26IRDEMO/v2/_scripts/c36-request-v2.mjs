// C3.6 앱에서 변경 요청 (내담자 앱 · 시뮬레이터) — c36-request.mjs의 v2 판(SPEC_PHONE v2).
// 옛 판은 t02 meta가 sha256을 들고 있어 그대로 둔다. 바뀐 것: 목업이 쓰는 구간(확정된 일정 → 요청 보냄)의
// 쉼을 줄였다 — 달력 앞 beat 제거 · 확인 시트 beat는 SPEC beat 한 번. 흐름은 같다.
// 배역: 보호자 이수진 · 아이 이하준. 전제:
//   ① 앱 로그인(v2/_scripts/phone-link.mjs, CAP_GUARDIAN_EMAIL=guardian.leesujin@mindscope.com)
//   ② v2/_scripts/c37-approve-setup.sql → c36-phone-setup.sql — 14회기 9/18(금) 16:00 · 변경 요청 없음
//   ③ 앱을 종료해 두고(simctl terminate) 러너가 새로 띄운다 — 앱 홈에서 출발
export default async function steps(p) {
  await p.beat('앱 홈 — 다가오는 회기')
  await p.tap('일정', '일정 탭')
  await p.tap('9월 18일', '회기가 있는 날')
  await p.tap(/^마인드스코프 아동심리상담센터, 이하준/, '그 회기')
  await p.beat('확정된 일정')
  p.nocutStart('변경 요청 → 확인까지')
  await p.tap('일정 변경 요청', '일정 변경 요청')
  await p.tap('9월 22일', '화요일로')
  // 시간 목록이 시트 아래로 잘려 있다 — 17:00은 밀어 올려야 닿는다
  await p.swipe(200, 700, 200, 450, '시간 목록을 올린다')
  await p.tap('17:00', '오후 5시')
  await p.tap('변경 요청', '변경 요청')
  await p.beat('기존 9월 18일 16:00 → 변경 9월 22일 17:00')
  await p.tap('이 시간으로 요청하기', '요청 보냄')
  p.nocutEnd()
  await p.hold(1200, '끝')
}
