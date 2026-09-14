// C1.9 (앞 절반) 서식 발송 (웹) — 링크로 나간다.
// 배역: 이하준 · 보호자 이수진(010-3000-0001). 시작 URL: /center/form-templates/<사전기록지 id>
// 계정: **admin(김원장)** — `발급`은 `write:center`(CENTER_EDIT_RULE)라 상담사에게 안 뜬다.
// 전제: v2/_scripts/c17-form-setup.sql (사전기록지) · API `.env`의 MESSAGING_DRY_RUN=true.
//
// 실측: 수신자 드롭다운 행은 `button`이고 텍스트가 "이 이하준 2016-09-22 남"이다.
//       고른 뒤 `적용`으로 커밋해야 수신자가 담기고, 보내기 버튼의 라벨은 `전송`이다.
export default async function steps(page, h) {
  await h.beat('서식 상세 — 발급 내역')
  await h.click('button:has-text("발급")', '발급')
  await h.modal('작성 요청 — 받는 사람과 문자 내용')
  await h.click('input[placeholder*="검색"]', '받는 사람')
  await h.type('input[placeholder*="검색"]', '이하준', '이하준')
  await h.until('button:has-text("2016-09-22")', '검색 결과')
  await h.click('button:has-text("2016-09-22")', '이하준 선택')
  // 드롭다운은 고른 것을 칩으로 담고 `적용`으로 커밋한다 — 안 누르면 수신자가 비어 전송이 안 된다
  await h.click('button:has-text("적용")', '적용')
  await h.beat('보호자 연락처가 따라붙는다')
  h.nocutStart('전송 → 발급 내역에 한 줄')
  // `has-text`는 부분 일치라 발급 내역 행의 `재전송`이 먼저 잡힌다(목록이 비어 있을 때만 운 좋게 통과한다).
  // `:text-is`도 안 된다 — 라벨이 Typography(<p>) 안이라 버튼의 직계 텍스트 노드가 아니다. 역할+정확 이름으로 간다.
  await h.click(page.getByRole('button', { name: '전송', exact: true }), '전송')
  await h.until('text=작성 요청을 전송했습니다', '전송됨')
  await h.until('text=미작성', '발급 내역 — 아직 미작성')
  h.nocutEnd()
  await h.hold(600, '끝')
}
