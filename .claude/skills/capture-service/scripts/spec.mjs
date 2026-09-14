// SPEC — 촬영 규격의 정본. 러너(capture.mjs)와 리허설(scene-prep)이 같은 값을 본다.
// 바꾸면 version을 올리고 .claude/rules/capture.md와 SKILL.md를 같이 고친다.
export const SPEC = {
  version: 8,
  viewport: { width: 1600, height: 900, dpr: 2 },           // CSS px · 16:9 · 캡처 3200×1800 (프로파일 web과 같다)
  park: { x: 1576, y: 876 },                                // 커서 대기 위치 — 우하단, 툴팁을 띄우는 요소가 없는 곳
  // v7 — **폰으로 여는 웹 화면**을 위한 프로파일. `--profile phone`으로 고른다.
  //   바로링크(`/verify-link`)처럼 제품이 폰을 상정하고 만든 공개 화면이 있다. 1600×900으로 찍으면
  //   그 페이지는 max-width 440px 가운데 정렬이라 화면의 3/4가 흰 여백이고, 크롭하면 해상도가 준다.
  //   그래서 뷰포트 자체를 폰으로 잡고 세로로 찍은 뒤 motion-stage의 폰 목업에 끼운다.
  //   시뮬레이터(capture-phone.mjs · 804×1748)와는 다른 길이다 — 이건 네이티브 앱이 아니라 웹이다.
  //   기본은 web이라 아홉 장면의 기존 규격은 한 글자도 안 바뀐다.
  profiles: {
    web:   { width: 1600, height: 900, dpr: 2, park: { x: 1576, y: 876 } },   // 16:9 · 3200×1800
    phone: { width: 390, height: 844, dpr: 3, park: { x: 380, y: 830 } }      // iPhone 논리 해상도 · 1170×2532
  },
  theme: 'light',
  capture: { tool: 'sckcap (ScreenCaptureKit, 창 필터)', fps: 60, codec: 'h264', bitrate: 40_000_000, cursor: 'sckcap 합성 (NSCursor 이미지 · OS 커서 미사용)', audio: false },
  // v8 — 커서 이동·클릭 앞뒤를 더 줄였다(v2 C1.7 검사 항목 연속 선택이 답답했다).
  //   스크롤은 커서와 곡선을 분리했다 — 목표까지 한 번, ease-in-out, 거리에 비례한 긴 시간(h.scrollTo).
  // v6 — 클릭 앞뒤 멈춤과 먼 거리 이동 상한을 줄였다(s01의 검사 항목 4연타·등록).
  // v4 — 각 지연은 "사람이 흐름을 알아보는 최소 길이"다. 근거는 s01 t03 실측(44.45초 중 클릭당 2.09초, 끝 4.2초가 빈 화면).
  //   move는 거리에 비례한다(moveMin + 거리×movePerPx, moveMax에서 자른다) — 가까운 버튼으로 0.7초 날아가지 않게.
  //   대기는 hold 대신 until(조건)을 쓴다. 제품이 걸리는 만큼만 기다리고 그 뒤 beat 하나로 인식시킨다.
  timing: {
    lead: 1500, tail: 1200,
    moveMin: 110, movePerPx: 0.18, moveMax: 300, moveSteps: 16,
    move: 280,                       // 거리를 모를 때의 기본값(구 버전 호환)
    preClick: 80, postClick: 170,    // v8 — 버튼을 고를 때 멈춤이 답답했다 (v6 140/240)
    type: 40, afterType: 220,
    scrollMin: 380, scrollPerPx: 0.5, scrollMax: 900,   // v8 — 스크롤 전용. 한 번에 부드럽게(ease-in-out)
    scrollFrame: 16, afterScroll: 400, // v5 — 매 프레임 작은 휠 델타 (휠 140px 점프는 3프레임 툭툭이었다)
    beat: 700, modal: 600,
    settle: 260                      // until이 조건을 만난 뒤 화면이 자리를 잡는 시간
  }
}
