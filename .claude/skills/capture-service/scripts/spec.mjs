// SPEC — 촬영 규격의 정본. 러너(capture.mjs)와 리허설(scene-prep)이 같은 값을 본다.
// 바꾸면 version을 올리고 .claude/rules/capture.md와 SKILL.md를 같이 고친다.
export const SPEC = {
  version: 4,
  viewport: { width: 1600, height: 900, dpr: 2 },           // CSS px · 16:9 · 캡처 3200×1800
  park: { x: 1576, y: 876 },                                // 커서 대기 위치 — 우하단, 툴팁을 띄우는 요소가 없는 곳
  theme: 'light',
  capture: { tool: 'sckcap (ScreenCaptureKit, 창 필터)', fps: 60, codec: 'h264', bitrate: 40_000_000, cursor: 'sckcap 합성 (NSCursor 이미지 · OS 커서 미사용)', audio: false },
  // v4 — 각 지연은 "사람이 흐름을 알아보는 최소 길이"다. 근거는 s01 t03 실측(44.45초 중 클릭당 2.09초, 끝 4.2초가 빈 화면).
  //   move는 거리에 비례한다(moveMin + 거리×movePerPx, moveMax에서 자른다) — 가까운 버튼으로 0.7초 날아가지 않게.
  //   대기는 hold 대신 until(조건)을 쓴다. 제품이 걸리는 만큼만 기다리고 그 뒤 beat 하나로 인식시킨다.
  timing: {
    lead: 1500, tail: 1200,
    moveMin: 180, movePerPx: 0.30, moveMax: 620, moveSteps: 22,
    move: 420,                       // 거리를 모를 때의 기본값(구 버전 호환)
    preClick: 220, postClick: 380,
    type: 40, afterType: 220,
    scrollStep: 140, scrollEvery: 40, afterScroll: 450,
    beat: 700, modal: 600,
    settle: 260                      // until이 조건을 만난 뒤 화면이 자리를 잡는 시간
  }
}
