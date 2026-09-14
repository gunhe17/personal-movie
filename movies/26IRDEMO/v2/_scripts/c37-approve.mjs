// C3.7 겹침 확인 → 승인 (웹) — C3.6에서 보호자가 보낸 그 요청을 전문가가 확인하고 승인한다.
// v1 `_scripts/s05-approve.mjs`의 v2 사본(v1 테이크 meta가 원본의 sha256을 들고 있어 원본은 두었다).
// 바뀐 것: 요청이 C3.6과 같다 — 14회기 9월 18일(금) 16:00 → **9월 22일(화) 17:00**.
// 배역: 회기 축 — 이하준(C00002 14회기) · 보호자 이수진 · 담당 정상담. 계정: counselor1
// 시작 URL: /schedule/reservations
// 전제: v2/_scripts/c37-approve-setup.sql · _scripts/s05-schedules.sql
export default async function steps(page, h) {
  await h.beat('변경 요청 — 누가 · 언제에서 언제로')

  h.nocutStart('요청 → 스케줄에서 확인 → 승인')
  // 사이드바의 캘린더 링크는 href='/schedule', 라벨은 '일정'이다
  await h.click('a[href="/schedule"]', '스케줄로')
  await h.until('text=요청 날짜 보기', '캘린더 — 요청이 배너로 떠 있다')
  await h.beat('스케줄 — 요청이 배너로 떠 있다')

  await h.click('button:has-text("요청 날짜 보기")', '요청 날짜 보기')
  await h.until('text=2026-09-22', '9/22 일간 뷰 — 요청한 시각의 하루')
  await h.beat('일간 — 17:00이 비어 있다')

  // 세 축척으로 같은 시각을 본다. 월간은 칩이라 그 자리를 상단 배너가 대신한다.
  await h.click('button:has-text("주간")', '주간 — 그 주에 겹치는 것이 없다')
  await h.beat('주간')
  await h.click('button:has-text("월간")', '월간 — 그 달 전체')
  await h.beat('월간 — 넓게 봐도 겹치는 것이 없다')

  await h.click('button:has-text("승인")', '승인')
  await h.modal('요청한 시간으로 일정을 변경할까요?')
  await h.click(page.getByRole('button', { name: '확인' }).last(), '확인')
  await h.until('text=일정을 변경했어요', '회기가 그 자리로 옮겨진다')
  h.nocutEnd()

  await h.hold(600, '끝 — 캘린더에 반영된 회기')
}
