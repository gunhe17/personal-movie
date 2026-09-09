// 마인드봄 촬영 시험 — 렌더와 캡처만 본다. 데이터를 만들지 않는다(클릭은 이동뿐).
// 계정: counselor1(정상담) — 마인드봄 clinician은 본인이 검사자인 건만 보인다
export default async function steps(page, h) {
  await h.beat('대시보드')
  await h.scroll(400, '대시보드 아래로')
  await h.scroll(-400, '위로 복귀')
  await h.click('a[href="/examinations"], nav a:has-text("검사")', '검사 목록으로')
  await h.beat('검사 목록 — 시드 12건')
  await h.scroll(300, '목록 훑기')
  await h.hold(1500, '끝')
}
