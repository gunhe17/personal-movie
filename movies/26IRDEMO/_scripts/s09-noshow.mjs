// s09 · 회기 관리 · 정산 (웹) — 노쇼를 표시하면 차감과 청구의 근거가 자동으로 선다.
// 배역: 회기 축 — 이하준 C00002 5회기(어제). 준비 단계(_scripts/s09-setup.sql)에서 예정 상태로 만든다.
// 시작 URL: /counseling/status/<caseId>?session=<5회기 sessionId>
//
// 논지(scenes9 §09): 아날로그에서는 "사전 취소와 당일 노쇼가 페이가 다른데 구분되지 않는다",
// 그리고 "노쇼 환불은 센터 정책에 맞춰 손으로 기록한다". 화면에서는 그 둘이 한 모달에 함께 있다 —
// **사유(사람 말로 된 근거)** 와 **회기 차감(정책 선택)**. 저장하면 회기 기록에 그대로 남는다.
export default async function steps(page, h) {
  await h.beat('회기 상세 — 어제 5회기, 출결 미확인')

  await h.click('button:has-text("노쇼했어요")', '노쇼로 표시')
  await h.until('textarea[placeholder="사유를 입력해주세요"]', '노쇼 모달 — 사유 + 회기 차감')

  // 사유 = 차감·청구의 근거를 사람 말로 만드는 자리. 500자 제한, 저장되면 회기 기록에 남는다.
  await h.type(
    'textarea[placeholder="사유를 입력해주세요"]',
    '연락 없이 미참석. 보호자 통화 안 됨. 다음 회기 전 재확인.',
    '노쇼 사유 입력'
  )

  // 차감 여부는 센터 정책이라 사람이 고른다(scenes9 §09). 기본은 꺼짐 — 켜야 차감으로 기록된다.
  // reveal은 쓰지 않는다 — 모달(420px)이 뷰포트에 다 들어와 있어 배경만 67px 밀렸다(실측).
  // 커서가 사유에서 스위치로 건너가는 이동 자체가 읽는 박자다.
  await h.hover('[aria-label="회기 차감 여부"]', '회기 차감 — 이번 노쇼를 남은 회기 1회 사용으로 처리해요')
  await h.click('[aria-label="회기 차감 여부"]', '회기 차감 켜기')

  h.nocutStart('사유 + 차감 → 변경 → 회기 기록에 남는다')
  await h.click(page.getByRole('button', { name: '변경' }).last(), '변경')

  // 저장된 사유가 회기 기록에 그대로 서는 지점 — 노쇼 사유 카드 + 회기 차감 배지.
  await h.until('text=연락 없이 미참석', '노쇼 사유가 회기 기록에 남았다')
  await h.until('text=회기 차감', '회기 차감 배지')
  h.nocutEnd()

  await h.hold(2000, '끝 — 잠긴 회기에 사유와 차감이 함께 남아 있다')
}
