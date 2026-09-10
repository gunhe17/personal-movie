// 탐사 — 바로링크를 **받는 쪽** 화면(/verify-link)을 눈으로 보기 위한 것. 촬영용이 아니다.
// 제출은 하지 않는다: 제출하면 task가 completed로 바뀌고 보고서가 생겨 s04 재촬영 상태가 깨진다.
const CODE = process.env.PROBE_CODE ?? '1164'
export default async function steps(page, h) {
  // ① 인증 — 4칸. 마지막 자리가 차면 자동 제출된다(LinkVerification:141)
  await h.until('section[aria-label="바로링크 인증"]', '인증 화면 — "인증번호를 확인해주세요"')
  const box = page.locator('section[aria-label="바로링크 인증"] input')
  for (const [i, d] of [...CODE].entries()) {
    await box.nth(i).fill(d)
    await h.hold(260, `인증번호 ${i + 1}번째`)
  }

  // ② 목록 — 센터명 + 나의 검사 + 방문 일정
  await h.until('text=나의 검사', '목록 — 진행할 검사를 고른다')
  await h.hold(1200, '검사 · 상담 기록이 한 화면에')

  // ②-1 상담 기록 — 센터가 발행한 공유문(2026-09-10 밤에 제품에 더한 것)
  await h.click('section[aria-label="상담 기록"] button', '상담 기록 1회기를 편다')
  await h.hold(2200, '보호자용으로 발행된 글만 보인다')

  // ③ 응시 — 문항 5개씩
  await h.click('button:has-text("스마트폰중독검사")', '스마트폰중독검사 시작')
  await h.until('[data-question-number]', '문항이 5개씩 나온다')
  const qs = page.locator('[data-question-number]')
  const n = await qs.count()
  for (let i = 0; i < n; i++) {
    await qs.nth(i).locator('label').nth(1).click()   // 두 번째 보기
    await h.hold(420, `문항 ${i + 1} — 답하면 다음 문항으로 스스로 내려간다`)
  }
  await h.hold(900, '5개를 다 채우면 다음이 살아난다')
  await h.click('button:has-text("다음")', '다음 쪽')
  await h.until('[data-question-number]', '2쪽')
  await h.hold(1400, '2쪽 — 제출은 하지 않는다')

  // ④ 목록으로 되돌아온다 — 임시 응답은 sessionStorage에 남는다
  await h.click('button[aria-label="검사 목록으로"], button:has-text("나가기")', '목록으로').catch(() => {})
  await h.hold(1200, '끝')
}
