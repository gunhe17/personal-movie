# 서비스 화면 촬영 규칙

0. 촬영 **준비**(기능 흐름 확정 · 목 대사 · 조작 스크립트 · 리허설)는 **`scene-prep` 스킬**이 맡고, **촬영**은 `capture-service`가 맡는다. 준비 단계에서는 캡처하지 않는다. 장면은 **리허설(헤드리스)이 종료 코드 0으로 끝나고 브라우저 시뮬레이션까지 눈으로 확인한 뒤에만** 촬영에 들어간다. 매 사이클은 `reset-seed.sh`로 되돌린 시드에서 출발한다.
1. 마인드스코프 서비스 화면(web · mobile · mobile-client)의 영상·이미지 캡처는 **`capture-service` 스킬로만** 한다. 캡처 엔진은 러너가 띄우는 `sckcap`(ScreenCaptureKit) 하나다. 러너 `.claude/skills/capture-service/scripts/capture.mjs` 밖에서 Playwright `recordVideo` · `page.screenshot` · ffmpeg 화면 캡처 · `screencapture` · OBS를 서비스 화면에 쓰지 않는다. 유일한 예외는 러너의 `--calibrate`가 만드는 `stills/calibrate.png`.
2. 뷰포트 1600×900 @2x · 60fps · light 테마 · 타이밍 상수는 러너 `SPEC`이 정본이다(현재 **v7**). 지연은 **흐름을 알아보는 최소 길이**로 잡는다 — 제품을 기다릴 때는 고정 `hold`가 아니라 `until(조건)`을 쓰고, 입력 폼은 `reveal`로 아래쪽 요소까지 보여준다. 장면 스크립트나 명령줄에서 바꾸지 않는다. 바꿔야 하면 `SPEC.version`을 올리고 이 파일과 SKILL.md를 같이 고친다.
2-0. **폰으로 여는 웹 화면만 `--profile phone`**(390×844 @3x → 1170×2532 · v7). 바로링크(`/verify-link`)처럼 제품이 폰을 상정하고 만든 공개 화면이 여기 해당한다 — 1600×900으로 찍으면 화면의 3/4가 흰 여백이고 크롭하면 해상도가 준다. 기본은 `web`이라 **아홉 장면의 기존 규격은 그대로다.** 네이티브 앱은 여전히 `capture-phone.mjs`(시뮬레이터 · 804×1748)다.
2-1. 촬영은 **포커스를 뺏지 않는다** — 전체화면·`bringToFront`를 쓰지 않고 창 필터로 그 창만 잡는다. 커서는 캡처러가 `NSCursor` 이미지로 프레임에 그린다(페이지 안 오버레이 금지). 촬영 중 그 창을 옮기거나 크기를 바꾸지 않는 것만 지키면, 사람은 다른 일을 계속해도 된다.
3. 산출물은 `movies/26IRDEMO/sNN-이름/raw/` 에만 둔다. 파일명 `sNN_<device>_<action>_tNN.mov`, 같은 이름의 `.meta.json` 필수, `manifest.csv` 한 줄 필수. 셋 중 하나라도 없으면 그 테이크는 없는 것이다.
4. `raw/`는 덮어쓰지도 지우지도 않는다. 재촬영은 테이크 번호를 올리고 `--retake-of` · `--reason`을 남긴다.
5. 에이전트가 화면에 나오는 장면은 **목 에이전트로만** 찍는다 — 촬영 중 진짜 LLM을 부르지 않는다. 대본은 `movies/26IRDEMO/_mocks/sNN-*.json`에 두고 러너 `--mock`으로 싣는다(형식의 정본은 제품의 `mock-capture` 스킬). 다음 턴은 `h.key('F9')`, `/agent` 채팅은 사람의 전송이 연다.
6. 시드는 로컬 **develop 시드**(마인드스코프 아동심리상담센터) 하나만 쓴다 — 마인드봄도 같은 배역이다(`_tool/mindbom/apps/api/scripts/cast.py`, 정본은 saas). 배역이 어긋나면 `_scripts/check-cast.py`가 깨진다. 시드 밖의 인물은 `_mocks/`에서 지어낸 이름으로만 넣는다.
7. `_seed/` 스냅샷이 없으면 촬영하지 않는다 (`--dry`는 시험 촬영 전용, 본 촬영에 쓰지 않는다). 실명·실제 내담자 데이터가 화면에 보이면 촬영하지 않는다. 로그인은 `_state/accounts.json`의 시드 계정으로만 하고, 자격증명은 파일·meta·manifest 어디에도 적지 않는다.
8. 폰(시뮬레이터)은 `capture-phone.mjs`로만 찍는다 — `simctl recordVideo`·QuickTime 녹화를 쓰지 않는다. 조작은 idb 스크립트가 원칙이고 `--manual`은 idb가 없을 때의 예외다. 실기기 녹화(s06)만 iOS 화면 기록을 쓰되, 파일을 `raw/`에 넣은 뒤 반드시 `capture.mjs --manual`로 meta와 manifest를 등록한다.
9. 정지 이미지는 영상에서 뽑는다. 이름은 원본명 + 타임코드(`…_t02_00-07-12.png`), 위치는 `stills/`.
