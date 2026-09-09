// s02 · 검사 실시 — 시험 촬영: 대시보드 → 사이드바 '검사' → 검사 현황 → '검사 접수' 버튼 클릭까지
// 시작 URL: /dashboard
export default async function steps(page, h) {
  await h.beat('대시보드')
  await h.click('aside button:has-text("검사"), nav button:has-text("검사")', '사이드바 검사')   // 누르면 검사 현황으로 이동 + 하위 메뉴 펼침
  await h.beat('검사 현황 목록')
  await h.hover('role=button[name="검사 접수"]', '접수 버튼에 손')
  await h.hold(600, '버튼 위 멈춤')
  h.nocutStart('검사 접수 버튼 → 접수 화면')
  await h.click('role=button[name="검사 접수"]', '검사 접수 클릭')
  await h.beat('접수 화면 열림')
  h.nocutEnd()
}
