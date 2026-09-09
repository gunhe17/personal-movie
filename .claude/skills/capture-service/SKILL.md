---
name: capture-service
description: 마인드스코프 서비스 화면을 영상으로 촬영한다. 장면(sNN) 촬영, 테이크 추가, 재촬영, 크롭 보정, 폰/실기기 녹화의 meta 등록을 요청받으면 이 스킬을 쓴다. 촬영 도구·뷰포트·타이밍은 이 스킬의 SPEC이 정본이고, 여기 없는 방식으로 서비스 화면을 캡처하지 않는다.
---

# capture-service — 서비스 화면 촬영

산출물은 항상 `movies/26IRDEMO/sNN-이름/raw/*.mov` + 같은 이름의 `.meta.json` + `manifest.csv` 한 줄이다.
러너: `.claude/skills/capture-service/scripts/capture.mjs`. **SPEC 상수는 러너 안에 있고, 장면 스크립트에서 바꿀 수 없다.**

## SPEC (확정)

| 항목 | 값 | 이유 |
|---|---|---|
| 조작 | Playwright 1.58 · Chromium · 헤드 · **네이티브 전체화면** | 조작을 스크립트로 재현해야 테이크가 같아진다. 전체화면은 페이지를 화면 좌상단에 고정해 크롭이 결정적이다 |
| 캡처 | **`sckcap`** (ScreenCaptureKit, Swift · `scripts/sckcap.swift`, 러너가 자동 컴파일) · **Chromium 앱 필터** · `showsCursor=false` · 60Hz 타이머로 **CFR 60** · H.264 40Mbps(`--codec prores` 가능) · `.mov` | 앱 필터라 다른 창이 앞에 있어도 안 잡히고, OS 커서가 구조적으로 제외되며, 정지 화면에서도 프레임을 채워 드롭이 0이다. (ffmpeg avfoundation은 커서 옵션이 무시되고 ~1% 드롭이 있었다 — 실측) |
| 크롭 | 화면 (0, 툴바 높이+1pt) 에서 1600×900pt → 3200×1800px | SCK `sourceRect`로 직접 잘라 후처리 없음. 보정 프레임 픽셀로 검증 |
| 웹 뷰포트 | **1600×900 CSS px · DPR 2 → 3200×1800 픽셀 · 16:9** | 최종 프레임과 비율 일치. 1.67×까지 펀치인해도 1080p 이상 |
| 테마 | light 고정 | |
| 커서 | 페이지 안에 그린 커서(오버레이) · OS 커서는 캡처 안 함 | Playwright 마우스는 OS 커서를 움직이지 않는다. 오버레이가 진짜와 같은 모양으로 따라간다 |
| 오디오 | 없음 | 사운드는 편집에서 |
| 폰 (시뮬레이터) | **`capture-phone.mjs`** — 같은 sckcap을 **창 모드**로: Simulator 창 하나를 잡고 타이틀바 52pt를 뺀다 · iPhone 17 Pro · **베젤 off · 터치 표시 on · Point Accurate(스케일 1.0)** → **804×1748px** · 60fps CFR | 웹과 같은 엔진이라 드롭 0·다른 창 무관. 터치 원이 창 안에 그려져 캡처된다. Pixel Accurate(1206×2622)는 이 모니터 높이(1260pt)를 넘어 불가 — 1080p 프레임 안의 폰엔 804px면 충분 |
| 폰 조작 | **idb** (`brew tap facebook/fb && brew install idb-companion && python3 -m pip install fb-idb`) — 접근성 라벨로 요소를 찾아 탭 · 스와이프 · 입력. 설치 전엔 `--manual`(사람이 조작, 엔진만 녹화) | Playwright가 폰을 못 만진다. Maestro는 Java가 필요해 차선 |
| 폰 타이밍 | preTap 400 · postTap 900 · swipe 500 · afterSwipe 900 · beat 1200 · lead/tail 3000 | 탭은 커서 이동이 없어 웹보다 짧고, RN 화면 전환 애니메이션 뒤를 기다린다 |
| 실기기 (s06) | iOS 화면 기록 · AirDrop → raw/ · `capture.mjs --manual`로 meta 등록 | 마이크가 필요한 필드노트만 |

### 타이밍 (ms) — 사람이 하는 속도

| 상수 | 값 | 뜻 |
|---|---|---|
| `lead` / `tail` | 3000 / 3000 | 캡처 시작 후·종료 전 여유. 편집 헤드룸 |
| `move` (28 steps, ease-out) | 700 | 커서 한 번 이동 |
| `preClick` / `postClick` | 500 / 800 | 클릭 전 멈춤 · 클릭 후 UI 반응 기다림 |
| `type` / `afterType` | 70/글자 / 400 | 타이핑 |
| `scrollStep` / `scrollEvery` / `afterScroll` | 120px / 60 / 1000 | 부드러운 스크롤, 끝나면 1초 정지 |
| `beat` | 1200 | 상태가 바뀐 뒤 시청자가 볼 시간 (networkidle 후) |
| `modal` | 1000 | 모달 열린 뒤 첫 조작까지 |

근거: 75초의 전환 — AFTER 구간 ASL 3.5–6초, 첫 컷 6초 노컷, 커서는 남기되 느리게.

## 절차

0. **로그인 상태** — `_state/local-<key>.json`이 있어야 보호 페이지가 열린다. 계정 목록은 `_state/accounts.json`, 생성은 `scripts/login.mjs`(자격증명은 `CAP_EMAIL`·`CAP_PASSWORD` 환경변수로만). 촬영 명령에 `--state _state/local-admin.json`.
1. **시드 박제** — `movies/26IRDEMO/_seed/<날짜>.json`이 없으면 촬영하지 않는다(`--dry`는 시험용). 촬영 환경은 **로컬 develop 시드** — 마인드스코프 아동심리상담센터, 계정은 `_state/accounts.json`(공통 비번 `test1234`). 백엔드를 재시드하면 이전 테이크와 화면 데이터가 달라지므로, 시드 스냅샷의 sha256이 meta에 남는다.
2. **장면 스크립트** — `movies/26IRDEMO/_scripts/sNN-<action>.mjs`. 두 가지 방법:
   - 손으로: `_template.mjs`를 복사한다.
   - 기록으로: `CAP_PASSWORD=… node scripts/record.mjs --scene s01 --account staff --url <URL>` → 헤드 브라우저에서 직접 조작하고 창을 닫으면 `_scripts/<scene>-draft.mjs`가 생긴다. 그 초안에 `note`·`beat`·`modal`·`nocut`을 채우고 불필요한 클릭을 지운다. (codegen 기록이 있으면 `rec2steps.mjs`로 변환)
   스크립트는 `export default async function steps(page, h)` 하나. `h` — `click(sel, note)` `type(sel, text, note)` `scroll(dy, note)` `hover(sel, note)` `beat(note)` `modal(note)` `hold(ms, note)` `nocutStart(note)`/`nocutEnd()`. `sel`은 문자열 셀렉터나 Locator.
3. **보정** — `node capture.mjs --scene s05-일정 --device web --action approve --url <URL> --script _scripts/s05-approve.mjs --seed _seed/x.json --calibrate` → `stills/calibrate.png`. 크롭이 브라우저 크롬 없이 페이지만 담는지 눈으로 확인한다.
4. **촬영** — 같은 명령에서 `--calibrate`를 뺀다. 테이크 번호는 자동(기존 최대 +1). 결과: `raw/s05_web_approve_t01.mov` + `.meta.json` + manifest 행.
5. **검토** — meta의 `steps[].t`로 순간을 찾아 본다. 재촬영은 스크립트를 고치고 다시 4 — 이전 테이크는 지우지 않는다. `--retake-of t01 --reason "…"`로 사유를 남긴다.
6. **폰(시뮬레이터)** — 전제: 내담자 앱 dev 빌드가 시뮬레이터에 설치돼 있고(`kr.mindscope.client.dev`, `npx expo run:ios` — `ios/`가 없어 prebuild부터), Simulator 설정이 SPEC(베젤 off · 터치 표시 · 스케일 1.0)이다. 러너가 설정을 검사해 다르면 경고한다.
   - 보정: `node capture-phone.mjs --scene s05-일정 --action request --udid booted --app kr.mindscope.client.dev --calibrate` → `stills/calibrate-phone.png`, 캡처/기기 비율 일치 확인.
   - 촬영: `--script _scripts/s05-phone-request.mjs`(템플릿 `_template-phone.mjs`, idb 필요) 또는 `--manual --seconds 25`(사람이 조작). 결과는 웹과 같은 meta·manifest.
   - s04·s05처럼 웹과 폰이 오가는 장면은 두 러너를 **동시에** 시작한다 — 각 meta의 `captured_at`과 첫 조작 `t`로 정렬한다.
7. **실기기 (s06)** — iOS 화면 기록 → AirDrop → `raw/`에 넣고 `node capture.mjs --manual raw/s06_device_fieldnote_t01.mov --scene s06-필드노트 --device device --action fieldnote --seed _seed/x.json` → meta + manifest.

## meta.json이 담는 것 (수정본 제작용)

`id` · `scene/device/action/take` · `captured_at` · `app{url, env, commit}` — 어느 UI 버전이었나 · `viewport` · `capture{tool, fps, codec, rect_pt, stats{received, appended, dupped, notReady}}` — `appended`가 `ticks`와 같고 `notReady`가 0이면 드롭 없음 · `timing` — 그 테이크에 실제 적용된 상수 · `seed` · `script{file, sha256}` — 같은 조작을 다시 돌릴 수 있게 · `steps[]{t, kind, target, note}` — 캡처 시작 기준 초 단위, 편집자가 순간을 찾는 색인 · `nocut[]` · `retake_of/reason` · `result{file, duration}`.

같은 `script.sha256` + 같은 `seed` + 같은 `app.commit`이면 테이크는 교체 가능하다. 셋 중 하나라도 다르면 수정본이다.

## 하지 않는 것

- Playwright `recordVideo` · `page.screenshot` · ffmpeg 화면 캡처 · OBS를 최종 산출물로 쓰지 않는다 (보정용 `calibrate.png`만 예외). ffmpeg avfoundation은 커서 옵션이 무시되고 드롭이 있어 v2에서 sckcap으로 교체했다.
- 촬영 중 Chromium 창을 옮기거나 전체화면을 풀지 않는다 — 크롭 좌표가 시작 시점 기준이다. (마우스를 건드리는 건 괜찮다 — OS 커서는 캡처되지 않는다)
- 뷰포트·타이밍을 장면 스크립트에서 바꾸지 않는다. 바꿔야 하면 SPEC을 고치고 `version`을 올린다.
- 실명 데이터가 화면에 있으면 촬영하지 않는다.
- `raw/`의 파일을 덮어쓰거나 지우지 않는다.
- 주 디스플레이 외의 화면에서 촬영하지 않는다 (크롭 좌표가 주 디스플레이 기준).
