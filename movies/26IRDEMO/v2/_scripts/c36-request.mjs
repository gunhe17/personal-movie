// C3.6 앱에서 변경 요청 (내담자 앱 · 시뮬레이터) — 보호자가 요청하고.
// 배역: 보호자 이수진 · 아이 이하준. 전제:
//   ① v2/_scripts/phone-link.mjs — 앱 계정 · 센터 연결 · 토큰 주입
//   ② v2/_scripts/c36-phone-setup.sql — 2026-09-18(금) 16:00 회기 + 앞 판의 변경 요청 삭제
//   ③ idb (PATH에 ~/Library/Python/3.9/bin)
//
// 실측 흐름: 일정 탭 → 달력에서 18일 → 그 회기 → `일정 변경 요청`
//   → 22일 선택 → (시트를 밀어 올려) 17:00 → `변경 요청` → 확인 시트 `이 시간으로 요청하기`.
// ⚠ 브리프의 "사유" 단계는 제품에 없다 — 자유 입력 대신 **변경 내용 확인 시트**가 그 자리다.
export default async function steps(p) {
  await p.beat('앱 홈 — 다가오는 회기')
  await p.tap('일정', '일정 탭')
  await p.beat('9월 달력')
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
  await p.hold(1500, '끝')
}
