// C4.4 화자별 전사 (웹) — 앱이 녹음한 회기의 말이 화자·시각과 함께 원본으로 남는다.
// v1 `_scripts/s06-fieldnote-web.mjs`의 v2 사본(v1 테이크 meta가 원본의 sha256을 들고 있어 원본은 두었다).
// 바뀐 것: reveal 다섯 번 → **목표 하나로 한 번에**(SPEC v8 규칙 2-2).
// 배역: 검사 축 — 윤도현 C00003 1회기. 계정: counselor1
// 시작 URL: /schedule/field-notes/<fieldNoteId>  (전제: _scripts/s06-setup.sql — 마지막 select가 id를 뽑는다. s01 접수가 만든 윤도현 필요)
//
// 실측(_probe-c44.mjs · 1600×900): 전사는 안쪽 스크롤러(top 335 · 높이 532 · 내용 2092)다.
//   처음 화면에 0:00 첫 발화(96)와 0:41 13.2초 침묵(324)이 이미 보인다.
//   `잠이 잘 안 와요`(1464)를 가운데로 두면 창이 944–1476이라 2:17(960) · 3:01(1296) · 17:22(1464)가 한 화면에 선다
//   — 3:10 다음 줄이 17:22로 건너뛰는 자리라 "시간 축"이 제일 크게 읽힌다. 26:28(1800)은 넣지 않는다.
export default async function steps(page, h) {
  await h.until('text=C00003', '필드노트 — 30분 · 회기에 연결됨')
  await h.until('text=개인상담', '회기 카드 — 윤도현 · 만 12세')
  await h.beat('누가 언제 남긴 기록인지가 화면에 있다')

  h.nocutStart('화자 · 시각 → 한 번에 회기 후반까지')
  await h.hover('button:has-text("도현아, 지난번 검사 때")', '첫 발화 — 화자가 이름으로 갈린다')
  await h.hover('text=13.2초 침묵', '0:41 — 대답 전 13.2초 침묵까지 남는다')
  await h.scrollTo('text=잠이 잘 안 와요', '2:17 · 3:01 · 17:22가 한 화면에', 'center')
  await h.beat('"그냥 제가 참으면 되니까요" 바로 아래가 17:22')
  h.nocutEnd()

  await h.hold(600, '끝')
}
