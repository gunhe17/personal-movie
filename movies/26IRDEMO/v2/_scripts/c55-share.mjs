// C5.5 공유문 — 검토 · 발행 (웹)
// 배역: 회기 축 — 이하준 놀이치료 C00002 · 2026-09-06 10:00 회기. 보호자는 어머니 이수진.
// 시작 URL: /counseling/status/<caseId>?session=<sessionId>  (회기 상세 = 확정된 일지)
// 전제: v2/_scripts/c55-share-setup.sql (원문에 임상어 심기 + 전달문 본문 고정 + 전달문 비우기)
//       llm-stub.mjs(:3599)가 떠 있어야 한다 — 전달문 생성이 진짜 LLM 1콜을 탄다.
export default async function steps(page, h) {
  await h.beat('회기 상세 — 상담사가 쓴 임상 일지')
  // 원문의 임상어 자리를 먼저 짚는다. 뒤에서 전달문에 그 자리가 비어 있는 것이 논지다.
  await h.hover('textarea[placeholder="진행 내용을 작성해주세요"]', '원문 — K-CBCL T 68 · F93.8 R/O')
  await h.beat('진단 표기와 점수가 원문에는 있다')

  await h.click('button:has-text("내담자에게 전달")', '내담자에게 전달')
  await h.modal('전달문 모달 — 좌 원문 / 우 전달문')

  h.nocutStart('만들기 → 오른쪽이 채워진다')
  await h.click('button:has-text("이 일지로 전달문 만들기")', '이 일지로 전달문 만들기')
  await h.until('text=전달문을 만들었어요', '만드는 중… → 전달문이 섰다', 60000)
  h.nocutEnd()

  // 상담사가 한 줄 더한다 — 발행 주체가 사람이라는 것이 이 컷의 두 번째 논지다.
  //
  // ⚠ `h.type`은 요소 **가운데를 클릭한 뒤** 타이핑한다(human.mjs:79-87). 긴 본문에서는
  //   캐럿이 문단 한가운데 떨어져 문장을 쪼갠다 — t01이 그렇게 찍혔고 앱(C5.6)까지
  //   "…오늘 이야기 안에서 다 궁금한 점은 언제든 말씀 주세요.시 한 번 짚어…"로 나갔다.
  //   `End`도 `Meta+ArrowDown`도 그 클릭 뒤에 실행돼야 의미가 있으므로, 여기서는
  //   클릭(커서를 보여 주는 조작) 다음에 키보드를 직접 쓴다.
  const 본문 = 'textarea[placeholder^="내담자·보호자에게 전할 내용"]'
  await h.click(본문, '전달문 본문')
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('ArrowRight')      // 전체 선택을 끝으로 접는다 = 본문 맨 끝
  await page.keyboard.type(' 궁금한 점은 언제든 말씀 주세요.', { delay: 40 })
  await h.beat('상담사가 한 줄 더한다')

  await h.click('button:has-text("전달하기")', '전달하기')
  await h.until('text=전달했어요', '전달됨 — 앱 알림이 함께 나갔다', 30000)
  await h.hold(600, '끝')
}
