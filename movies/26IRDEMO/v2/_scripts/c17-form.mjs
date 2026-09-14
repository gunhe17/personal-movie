// C1.7 필드가 잡힌 서식 (웹) — 쓰던 서식 그대로.
// 배역: 이하준(보호자 이수진). 시작 URL: /clients/<clientId>
// 전제: v2/_scripts/c17-form-setup.sql — 스캔 원본 PNG가 붙은 `사전기록지` 서식.
//       (좌표의 정본은 v2/_scripts/c17-form-asset.mjs. 종이와 필드를 같은 표에서 뽑는다)
//
// 화면 계보: 내담자 상세 좌측 `사전기록지` → 미리보기 패널 → `템플릿으로 작성`
//   → PreAdminssionModal → FormFillBody의 **원본 위에 보기**(pages[0].image + elements 오버레이).
// 추출 과정(운영자 화면)은 찍지 않는다 — cuts.json C1.7 check.
//
// ⚠ 케어보드 도크를 먼저 접는다. 상세 페이지는 **유효 폭**으로 반응형을 판정하는데
//   (+page.svelte:287 `responsive.width - (careBoardOpen ? 400 : 0) < BREAKPOINTS.xl`)
//   1600 − 400 = 1200 < 1280이라 도크가 열려 있으면 좌측 프로필이 통째로 오버레이로 숨는다.
//   그 안에 `사전기록지` 버튼이 있다.
export default async function steps(page, h) {
  await h.beat('내담자 상세')
  await h.click('button[aria-label="케어보드 접기"]', '케어보드를 접는다')
  await h.until('button:has-text("사전기록지")', '좌측 프로필이 선다')
  await h.click('button:has-text("사전기록지")', '사전기록지')
  await h.until('text=템플릿으로 작성', '아직 등록된 것이 없다')
  await h.click('button:has-text("템플릿으로 작성")', '템플릿으로 작성')
  await h.modal('스캔한 그 서식이 열린다')
  h.nocutStart('종이 위에 입력 칸이 잡혀 있다')
  await h.until('img[alt="서식 1쪽"]', '원본 스캔')
  await h.hover('[title="아동 성명"]', '아동 성명')
  await h.hover('[title="생년월일"]', '생년월일')
  await h.hover('[title="주호소 (오시게 된 이유)"]', '주호소')
  h.nocutEnd()
  await h.reveal('[title="보호자 서명"]', '서명란까지')
  await h.hold(600, '끝')
}
