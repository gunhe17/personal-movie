// C1.9 (꼬리) 돌아온 서식 — 발급 내역의 그 줄이 `작성완료`로 바뀌어 있다.
// 보호자가 폰에서 제출한 뒤에 찍는다(c19-formfill.mjs 다음). 시작 URL은 앞 절반과 같은 서식 상세.
// 계정: admin(김원장).
//
// 브리프의 "회수됨"은 제품에 없는 말이다 — 제품의 배지는 `작성완료`다(view-model.ts issuanceStatus).
// 작성된 답변을 여는 화면은 아직 없다(forms 테이블에 client_id가 없어 내담자 상세에도 안 붙는다).
// 그래서 이 컷의 끝은 배지 하나다 — "작성까지 돌아온다".
export default async function steps(page, h) {
  await h.beat('서식 상세')
  await h.reveal('text=발급 내역', '발급 내역')
  await h.until('text=작성완료', '돌아왔다')
  await h.hover('text=작성완료', '그 줄')
  await h.hold(1200, '끝')
}
