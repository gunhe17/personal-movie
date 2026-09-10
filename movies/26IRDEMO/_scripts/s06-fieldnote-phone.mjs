// s06 · 필드노트 — 앱 절반(전문가 앱). 녹음을 켜기 직전까지만 찍는다.
// 시뮬레이터에 마이크 입력이 없어 실시간 전사는 돌지 않는다 — 결과는 웹 절반이 보여준다.
// 전제: 정상담으로 로그인된 상태. p: tap(label|{x,y}) · type · swipe · scrollUp · beat · hold · nocutStart/End
//   (폰 헬퍼에는 `until`이 없다 — SPEC v4의 until 규칙은 웹 헬퍼에만 해당한다)
//
// ⚠️ 라벨 미검증 (2026-09-10). 전문가 앱 **시뮬레이터 빌드가 없고**(DerivedData에 Debug-iphoneos만)
//    idb도 안 깔려 있어 이 스크립트는 돌려 보지 못했다. 아래 라벨은 앞선 세션의 실측이다.
//    게다가 s06-setup.sql이 오늘(2026-09-10 16:00) 윤도현 회기를 하나 더 만들므로
//    `오늘 기록할 일정 1건`은 **2건**이 될 수 있다 — 앱을 세운 뒤 describe-all로 다시 확인한다.
// 이 컷은 사람이 누구인지 화면에 드러내지 않는다(필드노트 홈 · 바로 녹음) — 배역 이동과 무관하다.
export default async function steps(p) {
  await p.beat('홈 — 오늘 1개의 일정')
  await p.hold(1500, '정상담님, 좋은 오후예요')

  p.nocutStart('홈 → 필드노트 홈')
  await p.tap('필드노트 홈 열기', '필드노트 홈')
  await p.beat('오늘 기록할 일정 — 건수는 앱에서 다시 확인')
  await p.hold(2000, '최근 노트 3건 — 지난 회기들이 남아 있다')
  p.nocutEnd()

  // 녹음은 켜지 않는다. 버튼이 거기 있다는 것까지가 이 컷이다.
  await p.tap('바로 녹음', '바로 녹음에 손')
  await p.beat('녹음 화면')
  await p.hold(1500, '끝')
}
