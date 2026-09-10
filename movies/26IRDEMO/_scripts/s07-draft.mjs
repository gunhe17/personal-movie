// s07 · 자동 상담 일지 (웹) — 비어 있는 일지 칸이 필드노트 초안으로 채워진다.
// 배역: 검사 축 — 윤도현 개인상담 C00003 1회기(s06이 전사를 남긴 바로 그 회기).
// 시작 URL: /counseling/status/<caseId>?session=<필드노트가 붙은 sessionId>
//   ?session= 딥링크로 회기 상세를 바로 연다(page.svelte:538).
// 전제: _scripts/s06-setup.sql(케이스·회기·전사) → _scripts/s07-setup.sql(일지 비우기 + 초안 본문 고정).
export default async function steps(page, h) {
  await h.beat('회기 상세 — 녹음은 있고 일지는 비어 있다')
  h.nocutStart('초안 생성 → 빈 칸이 채워진다')
  await h.click('button:has-text("일지 초안 생성")', '일지 초안 생성')
  // 고정 hold가 아니라 조건으로 기다린다(SPEC v4) — 생성이 끝나면 스낵바가 뜨고
  // 그 순간 세 칸이 동시에 채워진다. hold(8000)이던 옛 스크립트는 아직 돌고 있는
  // 스피너를 "완료"로 착각해 통과했다(제품 버그를 두 번 놓친 자리).
  await h.until('text=초안으로 채웠어요', '전사 분석 중… → 칸이 채워졌다', 60000)
  h.nocutEnd()
  await h.beat('채워진 일지 — 상담 목표 · 진행 내용')
  // 세 칸은 한 화면에 다 안 들어온다(빈 칸 최소 높이 108 + 진행 내용 증가분).
  // 실측: 일지 스크롤 영역은 263~798, 다음 상담 내용은 스크롤 전 843부터 시작한다.
  // 그래서 커서를 일지 안에 두고(hover) 한 번만 내려 세 번째 칸까지 보여준다.
  await h.hover('textarea[placeholder="진행 내용을 작성해주세요"]', '초안이 들어온 진행 내용')
  await h.scroll(180, '다음 상담 내용까지 내려 본다')
  await h.hold(600, '끝')
}
