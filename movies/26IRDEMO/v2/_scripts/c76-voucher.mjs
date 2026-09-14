// C7.6 "이 바우처 단가가 얼마죠?" (웹) — 공고는 AI가 읽고, 물어보면 답한다.
// 목 대본: --mock _mocks/c76-voucher.json (1턴) · 시작 URL: /agent
// 계정: **admin(김원장)**. 배역이 맞다 — A면(C7.3)에서 공고 네 종을 형광펜으로 읽던 사람이 원장이고,
// 제품도 `바우처 관리`를 상담사에게 열지 않는다(settings/vouchers/+layout.svelte `MenuAccessGuard menuId="voucherManage"` — 상담사 제외).
// 답 도착은 노컷. 추출(운영자 화면)은 찍지 않는다 — 시드의 `vouchers` 행이 이미 공고에서 뽑힌 값이다
// (단가·본인부담·정부지원·대상 연령·소득 기준).
export default async function steps(page, h) {
  await h.beat('에이전트 화면')
  await h.type('textarea[placeholder="무엇이든 물어보세요"]',
    '우리아이심리지원서비스 단가가 얼마죠? 회기수도 알려줘',
    '한 줄 질문')
  await h.key('Enter', '전송')
  h.nocutStart('질문 → 단가 · 회기수 → 바우처 화면')
  await h.until('text=바우처 관리', '답이 끝나고 화면이 바뀐다', 60000)
  h.nocutEnd()
  await h.beat('바우처 관리 — 센터가 취급하는 것')
  await h.click('text=우리아이심리지원서비스 >> nth=0', '그 바우처')
  await h.until('text=160,000원', '단가 160,000원 · 기본 회기 12회', 30000)
  await h.hold(600, '끝')
}
