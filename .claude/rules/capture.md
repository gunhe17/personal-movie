# 서비스 화면 촬영 규칙

1. 마인드스코프 서비스 화면(web · mobile · mobile-client)의 영상·이미지 캡처는 **`capture-service` 스킬로만** 한다. 캡처 엔진은 러너가 띄우는 `sckcap`(ScreenCaptureKit) 하나다. 러너 `.claude/skills/capture-service/scripts/capture.mjs` 밖에서 Playwright `recordVideo` · `page.screenshot` · ffmpeg 화면 캡처 · `screencapture` · OBS를 서비스 화면에 쓰지 않는다. 유일한 예외는 러너의 `--calibrate`가 만드는 `stills/calibrate.png`.
2. 뷰포트 1600×900 @2x · 60fps · light 테마 · 타이밍 상수는 러너 `SPEC`이 정본이다. 장면 스크립트나 명령줄에서 바꾸지 않는다. 바꿔야 하면 `SPEC.version`을 올리고 이 파일과 SKILL.md를 같이 고친다.
3. 산출물은 `movies/26IRDEMO/sNN-이름/raw/` 에만 둔다. 파일명 `sNN_<device>_<action>_tNN.mov`, 같은 이름의 `.meta.json` 필수, `manifest.csv` 한 줄 필수. 셋 중 하나라도 없으면 그 테이크는 없는 것이다.
4. `raw/`는 덮어쓰지도 지우지도 않는다. 재촬영은 테이크 번호를 올리고 `--retake-of` · `--reason`을 남긴다.
5. `_seed/` 스냅샷이 없으면 촬영하지 않는다 (`--dry`는 시험 촬영 전용, 본 촬영에 쓰지 않는다). 실명·실제 내담자 데이터가 화면에 보이면 촬영하지 않는다. 로그인은 `_state/accounts.json`의 시드 계정으로만 하고, 자격증명은 파일·meta·manifest 어디에도 적지 않는다.
6. 폰(시뮬레이터)은 `capture-phone.mjs`로만 찍는다 — `simctl recordVideo`·QuickTime 녹화를 쓰지 않는다. 조작은 idb 스크립트가 원칙이고 `--manual`은 idb가 없을 때의 예외다. 실기기 녹화(s06)만 iOS 화면 기록을 쓰되, 파일을 `raw/`에 넣은 뒤 반드시 `capture.mjs --manual`로 meta와 manifest를 등록한다.
7. 정지 이미지는 영상에서 뽑는다. 이름은 원본명 + 타임코드(`…_t02_00-07-12.png`), 위치는 `stills/`.
