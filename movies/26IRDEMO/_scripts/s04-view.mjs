// s04-B · 바로링크로 **조회한다** (폰) — 상담 기록과 검사 결과지를 같은 링크에서 본다.
// 배역: 검사 축 — 보호자 윤보호. A(`s04-enter.mjs`)가 들어가서 응시했고, 여기는 그 뒤다.
// 규격: SPEC v7 `--profile phone`.
//
// 문자에서 들어오는 대목은 **A에만** 있다. 여기는 이미 인증된 상태에서 목록으로 바로 연다 —
// 제품이 원래 그렇게 동작한다(BFF 쿠키 2시간 · `restoreSession()`이 목록을 되살린다).
// 그 상태는 `_scripts/s04-barolink-state.mjs`가 만든다(`--state _state/local-barolink.json`).
//
// 이 테이크가 보여줄 것 둘:
//   ① **상담 기록** — 센터가 보호자에게 발행한 글. 임상 원문이 아니다
//   ② **결과지** — 제출하고 센터가 결과를 전송하면 같은 링크에 도착한다. 다시 오지 않아도 된다
//
// 전제 셋 — 하나라도 빠지면 화면에 그 줄이 없다:
//   ① `_scripts/s04-setup.sql`      상담 기록 공유문(발행)
//   ② 검사 제출                      status=completed · report_document_id
//   ③ `node _scripts/s04-send-result.mjs`  결과 전송 → is_report_visible_to_guardian
export default async function steps(page, h) {
  // 오프닝 도착 — s01 규칙의 0.7초.
  // ⚠️ `text=나의 검사`로 기다리지 않는다 — 검사를 다 마치면 제목이 **검사를 모두 마쳤어요**로 바뀐다
  //    (`allDone`, +page.svelte:1291). 조회 테이크는 늘 그 상태라 그 셀렉터는 영영 안 온다.
  await h.until('section[aria-label="상담 기록"]', '목록 — 인증은 두 시간 살아 있다')
  // 처음 보는 화면이라 `beat` — 기존 장면의 오프닝과 같은 급이다(s01 '에이전트 화면' · s03 '편집기')
  await h.beat('검사와 상담 기록이 한 화면에')

  // ① 결과가 와 있다 — 도착 화면에 이미 `결과 보기 · PDF` 줄이 보인다.
  //    스크롤할 것이 없다(폰 화면에 목록이 통째로 들어온다). `reveal`을 부르면 오히려 화면을 밀어낸다(t09).
  //
  //    ⚠️ **PDF를 여는 데까지 가지 않는다.** 새 탭의 Chromium PDF 뷰어가 폰 폭(390px)에서 판마다
  //    다르게 군다 — 폭에 맞추기도, 가로로 밀려 검은 여백을 남기기도, 흰 화면으로 남기도 했다(t04~t08).
  //    보고서가 가로로 넓은 문서라 좁고 긴 뷰포트에서 뷰어가 어떻게 맞출지가 안 정해진다.
  //    장면이 말할 것("결과가 같은 링크에 와 있다")은 줄이 바뀐 데서 이미 선다.
  h.nocutStart('결과도 같은 링크로 온다')
  await h.until('button:has-text("결과 보기 · PDF")', '완료된 검사에 결과가 붙었다')
  await h.beat('결과가 같은 링크로 왔다 — 다시 오지 않아도 된다')
  h.nocutEnd()

  // ② 상담 기록 — 발행된 글만. **펼친 채로 끝낸다**(접지 않는다).
  //    글이 세 문단이라 읽을 시간이 필요하다 — 여는 동작보다 **읽는 시간**이 이 마디의 본체다.
  h.nocutStart('상담 기록은 발행된 글만 보인다')
  await h.click('section[aria-label="상담 기록"] button', '지난 회기를 연다')
  await h.until('section[aria-label="상담 기록"] p', '보호자에게 쓴 글이 펼쳐진다')
  await h.hold(4200, '임상 원문이 아니라 보호자용으로 발행한 글이다 — 읽을 시간')
  h.nocutEnd()

  await h.hold(600, '끝')
}
