// s04-A · 바로링크로 **들어간다** (폰) — 문자 한 통에서 검사 첫 쪽까지.
// 배역: 검사 축 — 윤도현의 보호자 **윤보호**. s01이 접수하고 s04(보내는 쪽)가 보낸 그 링크다.
// 규격: SPEC v7 `--profile phone` (390×844 @3x → 1170×2532). 폰 목업에 끼울 세로 영상이다.
//
// 시작 URL은 문자 목업(`_mocks/s04-sms.html?id=…&code=…`)이다. 링크가 진짜라서
// **탭 한 번으로 제품 화면으로 넘어간다** — 문자와 서비스가 한 컷으로 이어진다.
//
// 이 테이크가 보여줄 것 둘:
//   ① 계정도 앱도 없이 **문자 → 링크 → 4자리**로 들어간다
//   ② 검사는 폰에서 바로 응시한다 — 문항이 5개씩, 답하면 다음으로 스스로 내려간다
//
// **여기서 끝낸다 — 제출하지 않는다.** 조회(상담 기록·결과지)는 짝이 되는 `s04-view.mjs`가 맡는다.
// 문자에서 들어오는 대목은 **이 테이크에만** 있다(2026-09-10 구성 결정).
//
// 매 판 전에 `_scripts/s04-task-reset.sql` — 검사가 `pending`인 자리에서 출발해야 한다.
const CODE = process.env.S04_CODE ?? '1164'
export default async function steps(page, h) {
  // ① 문자 — 관객이 문면을 읽을 시간(오프닝 도착 = s01 규칙의 beat)
  await h.beat('문자 한 통 — 바로링크와 인증번호')

  h.nocutStart('문자에서 링크 하나로 들어간다')
  await h.click('#barolink', '바로링크를 누른다')
  await h.until('section[aria-label="바로링크 인증"]', '"문자로 받은 번호 네 자리를 입력해주세요"')
  // **처음 보는 화면에는 `beat`를 준다.** 기존 장면의 급이 그렇다 —
  // s01 '에이전트 화면' · s03 '종합보고서 편집기' · s04-web '검사 현황'이 전부 `beat`다.
  // `hold(350)`은 **이미 보이던 화면 안에서** 패널이 갈아끼워질 때 쓰는 짧은 급이고(s01 '폼 도착'),
  // 여기는 문자에서 막 넘어온 새 화면이라 그 급이 아니다. `fill`은 커서 이동도 preClick도 없어
  // `until`의 0.26초 뒤 곧바로 숫자가 찍힌다 — 그래서 청자가 화면을 읽을 틈이 없었다.
  await h.beat('계정도 앱도 없이, 문자에 온 네 자리로 들어간다')

  // ② 인증 — 4칸. 마지막 자리가 차면 자동으로 확인한다(LinkVerification:141). 계정도 앱도 없다
  const box = page.locator('section[aria-label="바로링크 인증"] input')
  for (const [i, d] of [...CODE].entries()) {
    await box.nth(i).fill(d)
    await h.hold(300, `인증번호 ${i + 1}`)
  }
  await h.until('text=나의 검사', '들어왔다 — 나의 검사')
  // 여기도 처음 보는 화면이다 — 센터 이름 · 상담 기록 · 검사 목록이 한 번에 뜬다
  await h.beat('검사와 상담 기록이 한 화면에')
  h.nocutEnd()

  // ③ 검사는 폰에서 바로 응시한다 — 첫 쪽까지
  h.nocutStart('링크 안에서 바로 응시한다')
  await h.click('button:has-text("스마트폰중독검사")', '검사를 연다')
  await h.until('[data-question-number]', '문항이 5개씩')
  // **`h.click`으로 고른다 — 날것의 `locator.click()`이 아니다.**
  //   날것은 커서 이동도 preClick/postClick도 없어 보기가 **즉시** 찍힌다. 화면상 답이 저절로
  //   채워지는 것처럼 보이고 속도도 아홉 장면의 리듬과 어긋난다(실측 문항당 0.3초).
  //   `h.click`은 커서가 그 보기까지 실제로 날아가고 SPEC의 클릭 앞뒤 멈춤을 탄다 — 문항당 약 1초.
  const qs = page.locator('[data-question-number]')
  const n = await qs.count()
  for (let i = 0; i < n; i++) {
    await h.click(qs.nth(i).locator('label').nth(1), `문항 ${i + 1} — 두 번째 보기`)
    await h.hold(220, '답하면 다음 문항으로 스스로 내려간다')
  }
  await h.until('button:has-text("다음"):not([disabled])', '다섯을 채우면 다음이 살아난다')

  h.nocutEnd()

  // 논지가 도착한 순간은 짧게(s01 배치 규칙) — 폰에서 그대로 응시가 된다
  await h.hold(350, '집에서 폰으로 바로 응시한다')
  await h.hold(600, '끝')
}
