// s04 · 바로링크 (웹) — 검사 현황에서 링크를 만들어 보낸다. 폰 파트는 이 스크립트에 없다.
// 배역: 검사 축 — s01이 접수한 햇살지역아동센터 세 아이. 그 케이스의 스마트폰중독검사를 집으로 보낸다.
// 전제: s01을 먼저 돌려 케이스(로르샤흐 + 스마트폰중독검사)가 있어야 '바로링크 전송' 버튼이 뜬다.
// 시작 URL: /assessment/status
//
// 폼 화면의 순서 규칙(v4):
//   ① 도착하면 잠깐 둔다 · ② 맨 위부터 빈 칸을 채운다 · ③ 보이는 걸 다 했으면 그때 내린다.
//   제품을 기다리는 자리는 고정 hold가 아니라 until(조건)이다.
export default async function steps(page, h) {
  await h.beat('검사 현황 — s01이 접수한 세 건')

  await h.click('button:has-text("바로링크 전송")', '바로링크 전송')
  await h.modal('전송 모달')

  // ② 모달 맨 위 — 보낼 검사. 모바일 가능 검사만 뜬다(로르샤흐는 여기 없다)
  await h.click('button:has-text("스마트폰중독검사")', '보낼 검사 — 스마트폰중독검사')

  // ③ 아래쪽 수신자. 관계는 Select이고 기본값이 '엄마'라 건드리지 않는다(입력창이 아니다)
  await h.type('input[placeholder="이름"]', '윤보호', '수신자 이름')
  await h.type('input[placeholder="01012345678"]', '01033360118', '수신자 번호')

  h.nocutStart('전송 → 전송 내역에 남는다')
  // 같은 문구의 버튼이 카드에도 있다 — 앞의 것을 누르면 모달 뒤 카드가 눌려 아무 일도 안 일어난다.
  await h.click(page.getByRole('button', { name: '바로링크 전송' }).last(), '전송')
  // 발송이 끝나면 전송 내역 탭으로 넘어가고 수신인이 '이름 · 번호'로 남는다(SendLinkHistory:167)
  await h.until('text=윤보호', '전송 내역에 수신인이 남는다')
  h.nocutEnd()

  await h.beat('수신인 · 방식 · 상태')
  await h.hold(600, '끝')
}
