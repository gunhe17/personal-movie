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
| 조작 | Playwright 1.58 · Chromium · 헤드 · **창 모드(전체화면 아님)** | 조작을 스크립트로 재현해야 테이크가 같아진다. v3부터 전체화면·`bringToFront`를 쓰지 않는다 — **촬영 중에 사람은 하던 일을 계속한다**. 창이 뒤에 있어도 렌더가 멈추지 않도록 occlusion·백그라운딩 절전 플래그를 끈다 |
| 캡처 | **`sckcap`** (ScreenCaptureKit, Swift · `scripts/sckcap.swift`, 러너가 자동 컴파일) · **창 필터**(`--window-mode display` — 그 창 하나만 그린다) · `showsCursor=false` · 60Hz 타이머로 **CFR 60** · H.264 40Mbps(`--codec prores` 가능) · `.mov` | 그 창만 합성하므로 앞의 다른 창도, **창에 붙는 팝업(번역 풍선 등)도** 안 들어온다. 정지 화면에서도 프레임을 채워 드롭이 0이다. (ffmpeg avfoundation은 커서 옵션이 무시되고 ~1% 드롭이 있었다 — 실측) |
| 크롭 | 창 (0, 크롬 높이) 에서 1600×900pt → 3200×1800px. **크롬 높이는 매 촬영 자동 측정** | 계산으로는 못 얻는다 — `outerHeight-innerHeight`는 7pt 틀리고 `window.screenY`는 뷰포트 에뮬레이션 탓에 0이다. 그래서 페이지 맨 위에 마젠타 2px 띠를 넣고 창 전체를 한 장 찍어 그 줄의 y를 센다(실측 87pt) |
| 웹 뷰포트 | **1600×900 CSS px · DPR 2 → 3200×1800 픽셀 · 16:9** | 최종 프레임과 비율 일치. 1.67×까지 펀치인해도 1080p 이상 |
| 테마 | light 고정 | |
| 커서 | **sckcap이 프레임에 합성** — `NSCursor`의 진짜 커서 이미지(arrow · ibeam · pointer). 좌표는 러너가 stdin `m <x> <y> <shape>`로 흘린다 | v2의 페이지 안 오버레이는 결함이 셋이었다 — 내비게이션마다 좌상단으로 튀고, CSS transition 80ms만큼 늦고, 모양이 화살표 하나로 고정. 캡처러가 그리면 셋 다 없다. 모양은 대상 요소의 `getComputedStyle().cursor`에서 정한다. OS 커서는 여전히 안 건드린다 |
| 오디오 | 없음 | 사운드는 편집에서 |
| 폰 (시뮬레이터) | **`capture-phone.mjs`** — 같은 sckcap을 **창 모드**로: Simulator 창 하나를 잡고 타이틀바 52pt를 뺀다 · iPhone 17 Pro · **베젤 off · 터치 표시 on · Point Accurate(스케일 1.0)** → **804×1748px** · 60fps CFR | 웹과 같은 엔진이라 드롭 0·다른 창 무관. 터치 원이 창 안에 그려져 캡처된다. Pixel Accurate(1206×2622)는 이 모니터 높이(1260pt)를 넘어 불가 — 1080p 프레임 안의 폰엔 804px면 충분 |
| 폰 조작 | **idb** (`brew tap facebook/fb && brew install idb-companion && python3 -m pip install fb-idb`) — 접근성 라벨로 요소를 찾아 탭 · 스와이프 · 입력. 설치 전엔 `--manual`(사람이 조작, 엔진만 녹화) | Playwright가 폰을 못 만진다. Maestro는 Java가 필요해 차선 |
| 폰 타이밍 | preTap 400 · postTap 900 · swipe 500 · afterSwipe 900 · beat 1200 · lead/tail 3000 | 탭은 커서 이동이 없어 웹보다 짧고, RN 화면 전환 애니메이션 뒤를 기다린다 |
| 목 에이전트 | **`--mock _mocks/sNN-*.json`** — 제품의 `mock-capture` 스크립트를 `sessionStorage['agent-mock:v2']`에 걸고 시작. 다음 턴은 `h.key('F9')`, `/agent` 화면이면 사람이 전송할 때 흘러나온다 | LLM을 부르지 않아 크레딧을 안 쓰고 매 테이크의 대사·prefill이 같다. 도구는 제품 배선(`handlePageToolCall`)을 그대로 타므로 화면 동작은 진짜다 |
| 실기기 (s06) | iOS 화면 기록 · AirDrop → raw/ · `capture.mjs --manual`로 meta 등록 | 마이크가 필요한 필드노트만 |

### 타이밍 (ms) — **흐름을 알아보는 최소 길이** (v5)

| 상수 | 값 | 뜻 |
|---|---|---|
| `lead` / `tail` | 1500 / 1200 | 캡처 시작 후·종료 전 여유. 편집 헤드룸은 이만큼이면 된다 |
| `moveMin` / `movePerPx` / `moveMax` | 180 / 0.30 / 620 | 커서 이동은 **거리에 비례**한다(22 steps, ease-out). 가까운 버튼으로 먼 거리와 같은 시간을 들여 날아가지 않게 |
| `preClick` / `postClick` | 220 / 380 | 클릭 전 멈춤 · 클릭 후 UI 반응 |
| `type` / `afterType` | 40/글자 / 220 | 타이핑 |
| `scrollFrame` / `afterScroll` | 16 / 450 | 스크롤은 **거리를 먼저 정하고** 커서 이동과 같은 시간·ease-out으로 매 프레임 작은 휠 델타를 보낸다(v5). v4의 140px 휠은 CDP에서 smooth scrolling을 안 타 한 프레임 점프였다 — s01 t07에서 364px이 세 번 툭툭 |
| `beat` | 700 | 상태가 바뀐 뒤 시청자가 볼 시간 |
| `modal` | 600 | 모달 열린 뒤 첫 조작까지 |
| `settle` | 260 | `until`이 조건을 만난 뒤 화면이 자리 잡는 시간 |

**대기는 `hold`가 아니라 `until(조건)`으로 한다.** 고정 대기는 제품이 빠르면 빈 화면이 되고 느리면 잘린다.
`until`은 그 요소가 보일 때까지만 기다리고 `settle` 뒤 지나간다 — 걸린 시간은 meta에 `(+N.Ns)`로 남는다.

근거: v3의 s01 t03 실측 — 44.45초 중 **클릭 하나에 2.09초**, 마지막 `hold`+`tail`이 **4.2초 빈 화면**,
`type`만 9.5초였다. 같은 조작을 v4로 다시 재면 **22.7초**이고 클릭 간격은 1.1초다.
75초의 전환이 말한 AFTER 구간 ASL 3.5–6초에는 v4 쪽이 맞는다 — v3는 한 컷이 그보다 길어 편집에서 잘라내야 했다.

### 스크롤이 있는 폼 화면의 순서 (v4)

접힌 폼에서는 **순서가 곧 이해**다. 셋을 지킨다.

1. **도착하면 잠깐 둔다** — 페이지가 바뀌면 `beat` 하나. 관객이 "여기가 어디인지"를 알아볼 시간이다
2. **맨 위부터, 아직 안 채워진 것을 채운다** — 화면이 위에서 아래로 읽히므로 조작도 그 순서다
3. **지금 스크롤에서 보이는 것을 다 전달했으면 그때 내린다** — 반쯤 보여주고 내리면 관객은 놓친 채로 따라간다

내려서 보여줄 때는 `h.reveal(sel, note)` — 그 요소를 뷰포트 가운데로 끌어올리고 `beat`를 둔다.
채워진 값이 화면 밖에 있으면 **관객은 채워진 줄 모른다.**

### v3에서 바뀐 것 (2026-09-09)

v2 테이크와 섞을 수 없다 — 커서 렌더와 크롭 기준이 다르다.

1. **포커스를 뺏지 않는다.** 전체화면 전환도 `bringToFront()`도 없앴다. 창은 뒤에 있어도 되고 다른 Space에 있어도 된다.
2. **커서를 캡처러가 그린다.** 진짜 `NSCursor` 이미지, 지연 0, 내비게이션에도 위치 유지, 요소에 따라 모양이 바뀐다.
3. **크롬 높이 자동 측정.** 상수가 아니라 매 촬영 프레임에서 잰다.
4. **번역 풍선 등 붙는 팝업이 안 들어온다.** 창 필터를 `display` 모드로 — 그 창 하나만 합성한다.

실측(11.13초 테이크): 고유 프레임 639 · 드롭 0 · 복제 48 → **약 57fps**. v2는 같은 조건에서 약 20fps였다.

## 절차

0. **로그인 상태** — `_state/local-<key>.json`이 있어야 보호 페이지가 열린다. **러너가 캡처 전에 그 상태가 살아 있는지 직접 묻는다**(`auth-check.mjs` — 마인드봄 `/api/auth/check`, saas `/api/proxy/auth/me`). 죽었으면 촬영을 시작하지 않고 재로그인 명령을 찍어 준다. 파일이 있다는 것과 유효하다는 것은 다르고, **죽은 토큰의 증상은 401이 아니라 셀렉터 타임아웃**이라 30초를 버린 뒤에야 실패한다(s02에서 테이크 둘을 이렇게 잃었다). 쿠키의 `expires`는 토큰 수명이 아니므로 그걸 보고 판단하지 않는다. 계정 목록은 `_state/accounts.json`, 생성은 `scripts/login.mjs`(자격증명은 `CAP_EMAIL`·`CAP_PASSWORD` 환경변수로만). 촬영 명령에 `--state _state/local-admin.json`.
1. **시드 박제** — 촬영 환경은 **로컬 develop 시드 하나뿐**이다(`scripts.seed.develop` — 마인드스코프 아동심리상담센터, 계정은 `_state/accounts.json`, 공통 비번 `test1234`). 마인드봄(`_tool/mindbom`)도 같은 배역을 쓴다 — `scripts/cast.py`, 정본은 saas 쪽이고 `_scripts/check-cast.py`가 일치를 지킨다. `movies/26IRDEMO/_scripts/seed-snapshot.sh <saas|mindbom>`으로 `_seed/<앱>-<날짜>.json`을 만든다. 없으면 촬영하지 않는다(`--dry`는 시험용). 두 시드 다 자연키로 멱등해서 재실행만으로는 id가 살아 있지만, DB를 지우고 다시 만들면 전부 바뀐다 — 그래서 스냅샷의 sha256이 meta에 남는다. 마인드봄은 재실행할 때 검사 시각이 지금 기준으로 다시 맞춰진다(시간선 화면 때문). 스냅샷에 시각을 담지 않는 이유다.
2. **장면 스크립트** — `movies/26IRDEMO/_scripts/sNN-<action>.mjs`. 두 가지 방법:
   - 손으로: `_template.mjs`를 복사한다.
   - 기록으로: `CAP_PASSWORD=… node scripts/record.mjs --scene s01 --account staff --url <URL>` → 헤드 브라우저에서 직접 조작하고 창을 닫으면 `_scripts/<scene>-draft.mjs`가 생긴다. 그 초안에 `note`·`beat`·`modal`·`nocut`을 채우고 불필요한 클릭을 지운다. (codegen 기록이 있으면 `rec2steps.mjs`로 변환)
   스크립트는 `export default async function steps(page, h)` 하나. `h` — `click(sel, note)` `type(sel, text, note)` `scroll(dy, note)` `hover(sel, note)` `key(k, note)` **`until(sel, note[, timeout])`** **`reveal(sel, note)`** `beat(note)` `modal(note)` `hold(ms, note)` `nocutStart(note)`/`nocutEnd()`. `sel`은 문자열 셀렉터나 Locator.
   **`hold`는 마지막 끝맺음(≤600ms) 말고는 쓰지 않는다** — 제품을 기다릴 때는 `until`이다.
3. **목 에이전트 (에이전트가 나오는 장면만)** — 제품의 `mock-capture` 스킬(`_tool/saas-center-platform/.claude/skills/mock-capture/SKILL.md`)이 스크립트 형식과 채울 수 있는 필드의 정본이다. 스크립트는 `movies/26IRDEMO/_mocks/sNN-<action>.json`에 두고 촬영 명령에 `--mock _mocks/s01-intake.json`을 더한다. 러너가 sessionStorage에 직접 걸므로 `/lab/agent-mock` 편집기는 열지 않는다.
   - 채팅 재생(`/agent`에서 시작): 턴에 `progress`·`question`·`reply`를 쓰고, 장면 스크립트는 `h.type(...)` + `h.key('Enter')`로 전송한다. 되물음 턴 다음은 사용자의 답변이 연다.
   - 단축키 재생(에이전트 없이 화면만 세팅): 턴에 `tools`만 쓰고 장면 스크립트에서 `h.key('F9', '…')`로 넘긴다. 화면에 흔적이 남지 않는다.
   - 함정 셋 — `start_time`은 `end_time`과 같이 넣는다(안 그러면 기본 시간대로 밀린다) · 담당자를 대표로 세우려면 `id`가 필요하다(`_seed/<날짜>.json`에서 꺼낸다) · 날짜는 미래로 둔다. 저장은 사람이 누른다.
4. **보정** — `node capture.mjs --scene s05-일정 --device web --action approve --url <URL> --script _scripts/s05-approve.mjs --seed _seed/x.json --calibrate` → `stills/calibrate.png`. 크롭이 브라우저 크롬 없이 페이지만 담는지 눈으로 확인한다.
5. **촬영** — 같은 명령에서 `--calibrate`를 뺀다. 테이크 번호는 자동(기존 최대 +1). 결과: `raw/s05_web_approve_t01.mov` + `.meta.json` + manifest 행.
6. **검토** — meta의 `steps[].t`로 순간을 찾아 본다. 재촬영은 스크립트를 고치고 다시 5 — 이전 테이크는 지우지 않는다. `--retake-of t01 --reason "…"`로 사유를 남긴다.
7. **폰(시뮬레이터)** — 전제: 내담자 앱 dev 빌드가 시뮬레이터에 설치돼 있고(`kr.mindscope.client.dev`, `npx expo run:ios` — `ios/`가 없어 prebuild부터), Simulator 설정이 SPEC(베젤 off · 터치 표시 · 스케일 1.0)이다. 러너가 설정을 검사해 다르면 경고한다.
   - 보정: `node capture-phone.mjs --scene s05-일정 --action request --udid booted --app kr.mindscope.client.dev --calibrate` → `stills/calibrate-phone.png`, 캡처/기기 비율 일치 확인.
     `--out <경로>`를 주면 그 파일로 나간다 — 기존 보정본을 안 덮는다. 무대가 어느 화면에 섰는지 볼 때 쓴다(`--url`로 딥링크를 같이 주면 이동 후 한 장).
   - 촬영: `--script _scripts/s05-phone-request.mjs`(템플릿 `_template-phone.mjs`, idb 필요) 또는 `--manual --seconds 25`(사람이 조작). 결과는 웹과 같은 meta·manifest.
   - s04·s05처럼 웹과 폰이 오가는 장면은 두 러너를 **동시에** 시작한다 — 각 meta의 `captured_at`과 첫 조작 `t`로 정렬한다.
8. **실기기 (s06)** — iOS 화면 기록 → AirDrop → `raw/`에 넣고 `node capture.mjs --manual raw/s06_device_fieldnote_t01.mov --scene s06-필드노트 --device device --action fieldnote --seed _seed/x.json` → meta + manifest.

## meta.json이 담는 것 (수정본 제작용)

`id` · `scene/device/action/take` · `captured_at` · `app{url, env, commit}` — 어느 UI 버전이었나 · `viewport` · `capture{tool, fps, codec, rect_pt, stats{received, appended, dupped, notReady}}` — `appended`가 `ticks`와 같고 `notReady`가 0이면 드롭 없음 · `timing` — 그 테이크에 실제 적용된 상수 · `seed` · `script{file, sha256}` — 같은 조작을 다시 돌릴 수 있게 · `mock{file, sha256, title, turns}` — 목 에이전트를 썼다면 어느 대본이었나 · `steps[]{t, kind, target, note}` — 캡처 시작 기준 초 단위, 편집자가 순간을 찾는 색인 · `nocut[]` · `retake_of/reason` · `result{file, duration}`.

같은 `script.sha256` + 같은 `seed` + 같은 `app.commit`(+ 목을 썼다면 같은 `mock.sha256`)이면 테이크는 교체 가능하다. 셋 중 하나라도 다르면 수정본이다.

## 하지 않는 것

- Playwright `recordVideo` · `page.screenshot` · ffmpeg 화면 캡처 · OBS를 최종 산출물로 쓰지 않는다 (보정용 `calibrate.png`만 예외). ffmpeg avfoundation은 커서 옵션이 무시되고 드롭이 있어 v2에서 sckcap으로 교체했다.
- 촬영 중 Chromium 창을 옮기거나 크기를 바꾸지 않는다 — 크롭 좌표가 시작 시점의 창 위치 기준이다. **다른 앱을 쓰는 것·그 창을 Chromium 앞에 두는 것·마우스를 쓰는 것은 괜찮다** (그 창만 합성하고, OS 커서는 캡처되지 않는다).
- 뷰포트·타이밍을 장면 스크립트에서 바꾸지 않는다. 바꿔야 하면 SPEC을 고치고 `version`을 올린다.
- 실명 데이터가 화면에 있으면 촬영하지 않는다.
- `raw/`의 파일을 덮어쓰거나 지우지 않는다.
- 촬영 중에 진짜 에이전트(LLM)를 부르지 않는다 — 대사가 테이크마다 달라져 컷이 안 맞는다. 에이전트 장면은 `--mock`으로만 찍는다.
- 주 디스플레이 외의 화면에서 촬영하지 않는다 (크롭 좌표가 주 디스플레이 기준).
