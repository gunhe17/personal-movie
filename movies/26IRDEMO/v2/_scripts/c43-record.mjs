// C4.3 녹음 (전문가 앱 · 시뮬레이터) — 회기 사이 그 10분에, 수첩 대신 녹음 버튼.
//   녹음에서 멈추지 않는다: 말이 그 자리에서 글이 되고, 끝내면 센터 서식으로 넘어갈 정리가 돈다.
// 배역: 정상담 · 오늘(촬영일) 16:00 윤도현 개인상담 C00003 1회기 — C4.4 필드노트 · C4.5 일지의 바로 그 회기.
//
// 전제(순서대로):
//   v2/_scripts/c43-client.sql  (재시드 뒤 윤도현 되살리기)
//   _scripts/s06-setup.sql · v2/_scripts/c44-time-fix.sql (오늘 16:00) · v2/_scripts/c43-pre-record.sql (녹음 전 상태)
//   phone-stage `EXPO_PUBLIC_FIELDNOTE_DEMO=1 node stage.mjs build && node stage.mjs install && … login` · idb
//
// 라벨은 제품 코드에서 확인했다(apps/mobile):
//   `필드노트 홈 열기` FieldNoteFab.tsx:67 · `바로 녹음` field-note/home.tsx:1062
//   `기록할 상담이나 검사를 선택해주세요` · `윤도현 회기 녹음` RecordTargetSheet.tsx:112(accessibilityLabel)
//   `녹음 멈춤` RecordingScreen.tsx(stop 버튼 accessibilityLabel) · `녹음을 종료하고 분석을 시작합니다` StopRecordingSheet.tsx:36
//   `음성 전사 중` `AI 보정 중` field-note/constants.ts:30-35 (PROCESSING_STEP_LABELS)
//
// ⚠ 전사는 목이다 — 진짜 STT·LLM을 부르지 않는다. 회기를 고르면 촬영용 데모 라우트
//   `app/(main)/field-note/demo.tsx`가 제품의 RecordingScreen · ProcessingScreen을 **그대로** 렌더하고
//   전사 줄과 파이프라인 단계만 대본으로 흘린다(`EXPO_PUBLIC_FIELDNOTE_DEMO=1` 빌드에서만 열리는 길).
// ⚠ 대기는 전부 until이다(SPEC_PHONE v3) — 제품이 걸리는 만큼만 기다린다.
export default async function steps(p) {
  await p.beat('홈 — 정상담님 · 오늘 16:00 윤도현')

  p.nocutStart('필드노트 → 그 회기 → 말이 글이 된다')
  await p.tap('필드노트 홈 열기', '필드노트 홈')
  await p.until('바로 녹음', '오늘 기록할 일정 1건 — 윤도현 16:00')
  await p.tap('바로 녹음', '바로 녹음')
  await p.until('기록할 상담이나 검사를 선택해주세요', '연결 선택 시트')
  await p.tap('윤도현 회기 녹음', '윤도현 개인상담 1회기')
  await p.until(/별로 안 해요/, '첫 전사 버블 — 0:41')
  await p.until(/말해도 돼요/, '2:17')
  await p.until(/참으면 되니까요/, '3:01')
  p.nocutEnd()

  p.nocutStart('종료 → 음성 전사 → AI 보정 → 정리 끝')
  await p.tap('녹음 멈춤', '녹음 종료')
  await p.until(/녹음을 종료하고 분석을 시작합니다/, '종료 시트')
  await p.tap(/녹음을 종료하고 분석을 시작합니다/, '종료하고 분석')
  await p.until(/음성 전사 중/, '파이프라인 1 — 음성 전사')
  await p.until(/AI 보정 중/, '파이프라인 2 — AI 보정')
  await p.until('정리가 완료되었어요', '정리 끝 — 일지로 간다')
  p.nocutEnd()

  await p.hold(800, '끝')
}
