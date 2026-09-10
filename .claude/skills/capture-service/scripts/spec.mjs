// SPEC — 촬영 규격의 정본. 러너(capture.mjs)와 리허설(scene-prep)이 같은 값을 본다.
// 바꾸면 version을 올리고 .claude/rules/capture.md와 SKILL.md를 같이 고친다.
export const SPEC = {
  version: 7,
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
  // v6 — 클릭 앞뒤 멈춤과 먼 거리 이동 상한을 줄였다(s01의 검사 항목 4연타·등록). 나머지는 v5 그대로.
  // v4 — 각 지연은 "사람이 흐름을 알아보는 최소 길이"다. 근거는 s01 t03 실측(44.45초 중 클릭당 2.09초, 끝 4.2초가 빈 화면).
  //   move는 거리에 비례한다(moveMin + 거리×movePerPx, moveMax에서 자른다) — 가까운 버튼으로 0.7초 날아가지 않게.
  //   대기는 hold 대신 until(조건)을 쓴다. 제품이 걸리는 만큼만 기다리고 그 뒤 beat 하나로 인식시킨다.
  timing: {
    lead: 1500, tail: 1200,
    moveMin: 180, movePerPx: 0.30, moveMax: 460, moveSteps: 22,
    move: 420,                       // 거리를 모를 때의 기본값(구 버전 호환)
    preClick: 140, postClick: 240,   // v6 — 같은 목록의 버튼을 연달아 누를 때 클릭당 0.6초가 멈춤이었다
    type: 40, afterType: 220,
    scrollFrame: 16, afterScroll: 450, // v5 — 스크롤은 거리를 정해두고 move와 같은 시간·곡선으로 매 프레임 조금씩 (휠 140px 점프는 3프레임 툭툭이었다)
    beat: 700, modal: 600,
    settle: 260                      // until이 조건을 만난 뒤 화면이 자리를 잡는 시간
  }
}
