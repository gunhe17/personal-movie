// C4.5 일지 초안 (웹) — 비어 있는 일지 칸이 녹음에서 센터 서식으로 채워진다.
// v1 `_scripts/s07-draft.mjs`의 v2 사본(v1 테이크 meta가 원본의 sha256을 들고 있어 원본은 두었다).
// 바뀐 것: 손으로 잰 `scroll(180)` → **목표 칸까지 한 번에**(SPEC v8 규칙 2-2).
// 배역: 검사 축 — 윤도현 C00003 1회기(C4.4의 그 회기). 계정: counselor1
// 시작 URL: /counseling/status/<caseId>?session=<필드노트가 붙은 sessionId>
// 전제: _scripts/s06-setup.sql → _scripts/s07-setup.sql(일지 비우기 + 초안 본문 고정) · llm-stub(:3599)
//
// 실측(_probe-c45.mjs · 초안 뒤): 일지 스크롤러 263–798(내용 868). 상담 목표 411–519 · 진행 내용 591–735 ·
//   다음 상담 내용 807–915 — 셋째 칸만 아래로 잘린다. 그 칸 아래까지 141px 한 번이면 세 칸이 다 선다.
export default async function steps(page, h) {
  await h.beat('회기 상세 — 녹음은 있고 일지는 비어 있다')
  h.nocutStart('초안 생성 → 빈 칸이 채워진다')
  await h.click('button:has-text("일지 초안 생성")', '일지 초안 생성')
  await h.until('text=초안으로 채웠어요', '전사 분석 중… → 칸이 채워졌다', 60000)
  h.nocutEnd()
  await h.beat('채워진 일지 — 상담 목표 · 진행 내용')
  await h.scrollTo('textarea[placeholder="다음 상담 내용을 작성해주세요"]', '다음 상담 내용까지 한 번에', 'end')
  await h.hold(600, '끝')
}
