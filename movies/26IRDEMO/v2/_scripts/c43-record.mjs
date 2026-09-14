// C4.3 녹음 (전문가 앱 · 시뮬레이터) — 회기 사이 그 10분에, 수첩 대신 녹음 버튼.
// 배역: 정상담 · 오늘(촬영일) 16:00 윤도현 개인상담 C00003 1회기 — C4.4 필드노트 · C4.5 일지의 바로 그 회기.
// 전제: `v2/_scripts/c44-time-fix.sql`(회기를 오늘 16:00으로 · 오늘 채움 일정 제거) · phone-stage `login`(counselor1) · idb
//
// 라벨은 제품 코드에서 확인했다(apps/mobile):
//   `필드노트 홈 열기` — FieldNoteFab.tsx:67 · `바로 녹음` — field-note/home.tsx:1062
//   `바로 녹음`은 RecordTargetSheet("기록할 상담이나 검사를 선택해주세요")를 연다 — 오늘 회기가 그 안에 선다.
// 시트에서 회기를 누르지 않는다 — 시뮬레이터 시계는 실제 시각이라 "지금 녹음을 시작할까요? … 뒤에 시작해요" 확인창이 뜬다.
export default async function steps(p) {
  await p.beat('홈 — 정상담님 · 다음 일정 16:00 윤도현')
  p.nocutStart('필드노트 → 오늘 그 회기 → 녹음')
  await p.tap('필드노트 홈 열기', '필드노트 홈')
  await p.beat('오늘 기록할 일정 1건 — 윤도현 16:00')
  await p.tap('바로 녹음', '바로 녹음')
  await p.beat('기록할 상담 — 윤도현 개인상담')
  p.nocutEnd()
  await p.hold(1200, '끝')
}
