// C7.3 노쇼 → 차감 (웹) — 노쇼를 표시하면 사유와 차감이 회기 기록에 함께 선다.
// v1 `_scripts/s09-noshow.mjs`의 v2 사본(v1 테이크 meta가 원본의 sha256을 들고 있어 원본은 두었다).
// 바뀐 것: 회기가 12회기 축을 따른다 — 이하준 C00002 **13회기(9/13, 어제)**.
// 계정: counselor1 · 시작 URL: /counseling/status/<caseId>?session=<13회기 sessionId>
// 전제: v2/_scripts/c73-noshow-setup.sql (마지막 select가 URL의 id를 뽑는다. 되돌리기도 그 파일)
export default async function steps(page, h) {
  await h.beat('회기 상세 — 어제 13회기, 출결 미확인')

  await h.click('button:has-text("노쇼했어요")', '노쇼로 표시')
  await h.until('textarea[placeholder="사유를 입력해주세요"]', '노쇼 모달 — 사유 + 회기 차감')
  await h.modal('사유와 차감이 한 자리에')

  await h.type(
    'textarea[placeholder="사유를 입력해주세요"]',
    '연락 없이 미참석. 보호자 통화 안 됨. 다음 회기 전 재확인.',
    '노쇼 사유 입력'
  )

  // 모달이 뷰포트에 다 들어와 있어 스크롤하지 않는다 — 커서가 사유에서 스위치로 건너가는 이동이 읽는 박자다.
  await h.hover('[aria-label="회기 차감 여부"]', '회기 차감 — 이번 노쇼를 남은 회기 1회 사용으로 처리해요')
  await h.click('[aria-label="회기 차감 여부"]', '회기 차감 켜기')

  h.nocutStart('사유 + 차감 → 변경 → 회기 기록에 남는다')
  await h.click(page.getByRole('button', { name: '변경' }).last(), '변경')
  await h.until('text=연락 없이 미참석', '노쇼 사유가 회기 기록에 남았다')
  await h.until('text=회기 차감', '회기 차감 배지')
  h.nocutEnd()

  await h.hold(600, '끝 — 잠긴 회기에 사유와 차감이 함께 남아 있다')
}
