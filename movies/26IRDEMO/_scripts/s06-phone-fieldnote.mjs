// s06 · 전문가 앱 필드노트 — **탭으로 가는 흐름** (idb).
// 필드노트 홈 → `바로 녹음` → 회기 선택 시트 → 그 회기로 녹음 시작.
// 전부 실제 탭이고 실제 화면이다. 시작 자리는 phone-stage가 딥링크로 세운다(/field-note/home).
//
// `바로 녹음`은 **데모 녹음 화면**으로 간다 — `EXPO_PUBLIC_FIELDNOTE_DEMO=1`로 빌드했을 때만 열리는 길이다
// (home.tsx의 onRecord). 진짜 경로로 가면 시뮬레이터에 사람의 말이 없어 화면이 `전사 중…`에서 멈춘다:
// 모델은 대역으로 갈아 끼웠지만(`_scripts/llm-stub.mjs`) 서버가 그 전사를 저장하는 데서 실패한다
// (`field_note_audio/repository.py:56` assert · 제품/환경 쪽 문제). 그래서 이 길로 찍는다.
//
// 좌표는 points(iPhone 17 Pro 402×874). 라벨로 잡히는 것은 라벨로 쓴다.
export default async function steps(p) {
  await p.beat('필드노트 홈 — 오늘 기록할 일정과 최근 노트')

  p.nocutStart('누르면 회기를 고르고, 고르면 녹음이 선다')
  await p.tap('바로 녹음', '바로 녹음')
  await p.hold(1400, '녹음이 선다 — 00:35')
  await p.hold(4200, '아이의 말이 시각과 함께 쌓인다')
  await p.hold(4200, '"말하면 걱정하잖아요. 그냥 제가 참으면 되니까요."')
  p.nocutEnd()

  await p.hold(1200, '끝')
}
