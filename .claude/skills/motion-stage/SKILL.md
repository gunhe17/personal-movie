---
name: motion-stage
description: HTML 무대를 Chrome 헤드리스로 굽고 ffmpeg으로 잇는다. ① 아이콘 몇 개와 표정 변화로 3~5초 클립을 만들거나, ② 촬영본을 그라디언트 배경 위 리퀴드 글라스 iMac 목업에 끼워 넣을 때 쓴다. "목업으로 만들어줘", "아이콘 애니메이션", "무대 위에 올려줘" 요청에 쓴다. 서비스 화면 촬영은 capture-service가 한다.
---

# motion-stage — HTML 무대를 영상으로

**설치할 것이 없다.** `/Applications/Google Chrome.app`(헤드리스 스크린샷)과 `ffmpeg`만 쓴다.

```bash
node .claude/skills/motion-stage/scripts/render.mjs <spec.json> [--stage icons|imac|cards] [--out x.mp4] [--fps 30]
node .claude/skills/motion-stage/scripts/render.mjs --selftest     # 무대 둘 · 스틸 · 영상 · 합성
```

| 무대 | 무엇 | 예제 |
|---|---|---|
| `icons` | 아이콘이 올라와 흐르다 빠지고, 얼굴이 평온→부담으로 바뀐다 | `examples/icons-s01.json` |
| `imac` | 파란색 중심 그라디언트 + 반투명 도트 위에 글라스 iMac. `screen`에 촬영본을 끼운다 | `movies/26IRDEMO/s01-접수/mockup/s01_web_intake_t08_imac.json` |
| `wipe` | **전환.** 여덟 기하를 **루마 매트**(`matte:true` → mp4) 또는 **RGBA 오버레이**(ProRes 4444)로. `shape`는 도형이 회전·이동·성장해 화면이 된다 | `movies/26IRDEMO/_motion/transitions/*.json` · 데모 `index.html` |
| `logo` | **로고 인트로.** 흰 마크 등장 → 한 번 튐 → 끝없이 커지며 창 안이 배경 무늬로 바뀌어 배경이 된다. `logo`에 SVG 경로. `copy` 한 줄을 앞에 세우려면 `copyAt`·`copyOut`·`logoAt` | `_motion/transitions/logo-intro.json` · 마크 `_motion/brand/mindscope-mark.svg` |
| `cells` | **검은 지면에 칸이 차례로 켜진다.** 목차 컷용. `cells` 이름 배열 · `at` 첫 칸 · `beat` 간격 · `late` 반 박자 미룰 칸(1부터) · `rise` | `movies/26IRDEMO/v2/s00-c1-일곱칸/C0.1.json` |
| `cards` | **로샤 자료를 3D 카드로.** 검사 카드(card-N.png) · 영역 기록지(areas/card-N.json의 D 영역을 카드 열 장 위에) · 점수계열 기록지(표). `assets`·`areas`는 마인드봄 소스의 폴더(spec 기준 상대경로). `marks:4`면 영역 대신 **붉은 동그라미 네 군데**(`markSeed` 고정 — 재렌더해도 같은 자리). `ground:"transparent"`면 배경 없는 PNG, `pose`로 세 장의 기울기를 맞춘다. 카드를 크게 뽑을 땐 `ref`(기준 폭)를 주면 글자·여백이 통째로 확대된다. `duration`이 있으면 카드가 아래에서 떠오른다 | `movies/26IRDEMO/s02-검사실시/mockup/*.json` |
| `steps` | **씬 상단 절차 표시줄.** 단계를 전부 나열하고 현재 단계를 알약으로 채운다(배경 투명). `steps` 이름 배열 · `ground`·`ink`(줄 바탕·글자) · `accent`·`onAccent`(알약·알약 위 글자) · `tag`(비우면 없다) · `from`/`to`(같으면 스틸, k→k+1 이동, 0→1 등장, k→0 퇴장) | `movies/26IRDEMO/v2/_assets/steps/` — `steps.json` 고치고 `build.mjs` |
| `imac` + `pull` | **카메라 풀백.** 풀프레임 UI에서 뒤로 빠지며 iMac과 배경이 드러난다 (container transform 역방향). 프레임마다 화면을 갈아 끼우므로 느리다(1080p 2.2s ≈ 4분) | `s01-접수/mockup/s01_web_intake_t08_pull.json` |

## 언제 Chrome이 몇 번 뜨나 — 이것이 속도를 정한다

| 경우 | Chrome | 시간(1080p) |
|---|---|---|
| `icons` · `wipe` 영상 | **한 번** — CDP로 띄워 두고 프레임마다 `render(t)` 평가 + 캡처 | 60프레임 ≈ 3.5초 (스폰 방식의 15배) |
| `imac` 스틸 | 한 번 | 2초 |
| `imac` + `screen` | **두 번**(화면 검정/흰색). 둘의 차이로 정확한 알파를 뽑아 ffmpeg이 영상 위에 얹는다 | 24초 · 1080p ≈ 15초 · 4K60 ≈ 1~2분 |

> 처음엔 `imac`+`screen`도 프레임마다 Chrome을 띄웠다 — 24초에 **22분**. 정지한 무대에 영상을 얹는 일에
> 브라우저를 715번 띄울 이유가 없다. 무대는 한 장, 합성은 ffmpeg 한 번.

## 산출물 자리

`movies/26IRDEMO/sNN-이름/mockup/` — **원본명 + 처리명**(`s01_web_intake_t08_imac.mp4`)으로, spec을 옆에 둔다. `raw/`에는 넣지 않는다(그건 촬영 원본 자리다).

## spec

공통: `size`(기본 1920×1080) · `fps`(30) · `duration`(없으면 스틸 PNG) · `out`.

### icons

```json
{ "stage":"icons", "duration":4.4, "bg":"#E9EAEA", "ink":"#3F5B66", "push":0.03,
  "beats":[{ "icon":"phone", "at":0.6, "x":0.30, "y":0.30, "size":0.20,
             "in":0.6, "drift":[0.055,0.075], "out":3.5, "outDur":0.7 }],
  "face":{ "x":0.5, "y":0.66, "size":0.36, "at":0.2, "change":2.3, "changeIn":1.0 } }
```
`at`/`in` 등장 · `out`/`outDur` 퇴장 · `drift` 체류 중 흐름 · `float` 미세 부유 · `pop` 튀는 등장.
글리프: `phone · person · chat · monitor · doc · clock · bell` — **상표 없는 도형만.** `bg:"transparent"`면 알파 ProRes.

**얼굴 — 부담과 분노를 가르는 한 줄:** 눈썹 **안쪽 끝이 올라가면 곤란, 내려가면 분노**다.
`stages/icons.html`의 `faceSVG()` `inner`가 `p`에 따라 작아져야(위로) 한다. 처음 버전이 여기서 화난 얼굴을 만들었다.

### wipe

```json
{ "stage":"wipe", "preset":"wipe", "dir":"right", "feather":0.08, "ease":"inout",
  "duration":0.8, "fps":60, "shutter":4, "size":[1920,1080], "matte":true }
```
| 필드 | 뜻 |
|---|---|
| `preset` | **`shape`**(도형이 회전하며 날아와 화면이 된다 — `shape` rect·circle·hex·tri · `spin` · `size0` · `from` · `cover:true`면 덮고 빠짐) · `wipe`(한 방향) · `iris`(한 점에서, `center`) · `band`(띠가 지나감, `width`) · **`dots`**(도트가 자란다, `cell` `stagger`) · **`slices`**(시차 띠, `slices` `stagger` `alternate`) · **`liquid`**(노이즈 변위 가장자리, `scale` `freq` `seed`) · **`ink`**(잉크 번짐, `freq` `seed`) — 왜 이 일곱인지는 `_lab/research/02-findings/creative-transitions.md` |
| `dir` | `right left down up down-right down-left up-right up-left` — 대각선은 dir로 |
| `feather` | 가장자리 부드러움. 0이면 하드 엣지 |
| `invert` | 덮기 ↔ 드러내기 |
| `matte` | `true` → 검정/흰 mp4(트랙 매트용). 없으면 `color`의 RGBA ProRes 4444 |
| `shutter` | 4 → 240fps로 찍고 4프레임 평균. **Chrome엔 모션 블러가 없어** 빠른 와이프는 이것 없이 뚝뚝 끊긴다 |

브라우저에서 미리 보는 데모: `movies/26IRDEMO/_motion/transitions/index.html` — 같은 기하 함수라 거기서 맞으면 렌더에서도 맞는다.

### imac

```json
{ "stage":"imac", "screen":"../../../../movies/26IRDEMO/s01-접수/raw/s01_web_intake_t08.mov",
  "duration":6, "macW":1.32, "sheen":112, "dots":1.5,
  "copy":{ "eyebrow":"S01 · 접수", "h":"통화 한 마디가<br>세 명의 접수가 된다", "p":"…" },
  "tag":"26IRDEMO · s01_web_intake_t08" }
```

| 필드 | 뜻 |
|---|---|
| `screen` | 화면에 끼울 영상 또는 이미지. **spec 파일 기준 상대경로.** 없으면 자리표시 UI로 스틸 |
| `duration` | 없으면 영상 길이 그대로. **쓸 구간만 잘라 넣는 편이 낫다** — 편집에서 어차피 인아웃을 잡는다 |
| `start` | 촬영본의 이 초부터 쓴다(`duration`과 같이 구간을 잡는다). 잘라 둔 사본을 따로 만들지 않는다 |
| `steps` | **절차 표시줄을 맨 위에 얹는다** — `{dir, head, hold, tail}`(dir은 spec 기준). head는 0초부터, hold PNG는 그 뒤로 tail 앞까지, tail은 끝에. 파일은 `steps` 무대 산출물(`v2/_assets/steps/SN-흐름/`) 그대로 — cuts.json의 `steps.head/hold/tail`과 같은 이름. `imac`·`phone` 공통 |
| `copy` | 오른쪽 카피. 없으면 iMac이 가운데로 온다 |
| `macW` | 카피가 있을 때 iMac 열의 비율 (`1.32fr : 1fr`) |
| `right` | **우측을 이만큼 비운다**(무대 폭 비율, 예 `0.25`). iMac이 왼쪽으로 밀린다 — 오른쪽에 카피·로고를 편집에서 얹을 자리. 없으면 가운데. `copy`가 있으면 그 열이 우선이라 무시된다 |
| `width` | iMac 폭(무대 폭 비율). 기본 0.66 |
| `top` | iMac 윗변을 여기(cqw)에 박는다 — 넘친 아래는 잘린다. 없으면 세로 가운데. **`phone` 무대도 같은 뜻(단위 cqh)** — 절차 표시줄 아래로 내릴 때 `9.5` |
| `shade` | `[중간색, 끝색]` — `right` 칸에 그라디언트를 깐다(흰 텍스트용). 배경 레이어라 매트에 안 섞인다 |
| `bezel` · `chin` | 베젤 두께 · 턱 높이(cqw). 기본 1.05 · 4.6 |
| `screenRadius` | **phone 무대** — 화면 모서리 반경(cqh, 기본 4.7). 프레임 바깥 반경이 따라온다. **시뮬레이터 촬영본(804×1748)은 `6.8`** — 촬영본 자체의 검게 둥근 모서리(대각선 36px ≈ 반경 6cqh)가 기본 반경에서는 초승달로 보인다(C3.6 실측). 폰-웹 촬영본(C1.9)은 모서리가 없어 기본값. **시뮬레이터 촬영본은 `screenBg:"transparent"`도 같이** — 검정이면 둥근 가장자리 안티에일리어싱이 그 검정을 섞어 화면 둘레에 **어두운 실선**이 생긴다(C3.6 실측, 투명이면 유리 테와 섞여 사라진다). 프레임 바깥 반경은 화면 반경 + .76(패딩 .62 + 테두리 .14)이라 동심이다 |
| `phoneH` · `shotRatio` | **phone 무대 — 촬영본을 깨뜨리지 않는 규격.** 슬롯 = 폰 높이 − 프레임 안쪽 1.52cqh(패딩 .62×2 · 테두리 .14×2), 폭은 `shotRatio`(촬영본 폭/높이 **정확히**, 반올림 금지 — 0.46이면 cover가 또 잘라 먹는다). **시뮬레이터(804×1748)는 `size [3840,2160]` · `phoneH 82.446`** → 화면 804×1748 = 원본 1:1, 리샘플 없음(C3.6 실측 PSNR 43.7dB = 인코딩 상한). 1080 무대에서는 0.52배 축소라 글자가 뭉갠다. 촬영본 크기가 슬롯과 같으면 합성의 가장자리용 1px 확대를 끈다(`render.mjs` `ov=0`) |
| `stand` | `false`면 받침대를 뺀다 · 숫자면 배율(1 = 원래 크기) |
| `blobs` | 배경 색 덩어리 6개 `{c,o,w,x,y,from}`. 파랑이 첫 번째 |
| `sheen` | 유리 반사 띠 각도 · `dots` 도트 간격(cqw) · `ground` 바닥색 |

**v2 규격 (`movies/26IRDEMO/v2/_mockups/spec/`)** — 우측 1/5은 편집에서 흰 텍스트를 얹을 칸, 화면은 그 나머지에서 최대(1920 기준 1474px).
위의 절차 표시줄(`steps`, 윗변 ≈ 4.6cqw)을 피해 윗변을 5.6에 둔다. 좌우는 자르지 않는다.

```json
"right":0.2, "width":0.78, "top":5.6, "bezel":0.55, "chin":3.4, "stand":0.45,
"shade":["rgba(47,107,255,.22)","rgba(38,86,222,.55)"]
```

**v2는 전부 `size [3840,2160]`로 굽는다**(2026-09-14). 1080 무대에서 iMac 화면은 1474px — 촬영본 3200px을 0.46배로 줄여 글자가 뭉갰다. 4K면 약 2948px(0.92배)라 거의 원본이다. 폰은 4K에서 1:1(`phoneH 82.446`). 절차 표시줄 자산(1920×1080)은 `render.mjs`가 무대 크기로 늘려 얹는다.

> 우측 칸을 비우면 화면은 **폭**에 묶인다 — 받침대를 빼거나 아래를 잘라도 거의 안 커진다(1/4 칸에서 1397px).
> 크기를 더 원하면 칸을 줄이는 것이 유일한 손잡이다.

화면 슬롯은 **16:9** — iMac 24"가 실제로 16:9이고 촬영본(3200×1800)도 16:9라 잘림이 없다.
무대 안의 치수는 전부 `cqw`(무대 폭 비율)라 어느 크기로 뽑아도 같은 그림이다.

## 합성 원리 (imac + screen) — 디퍼런스 매트

1. 무대를 `?fill=black`과 `?fill=white`로 두 장 굽는다 (화면만 검정/흰색, 나머지는 같다)
2. **알파 = 1 − |흰 − 검|.** 모서리 안티에일리어싱까지 정확하다 — 크로마 키잉은 분홍 프린지를 남겼다
3. 검정판은 이미 알파가 곱해진 색이라 `unpremultiply`로 되돌린 뒤 영상 위에 얹는다
4. 화면 사각형도 **같은 두 장의 차이**에서 `bbox`로 읽는다 — 좌표를 다른 실행에서 재면 폰트 로딩 타이밍으로 44px 어긋난 적이 있다

## 화질

`size:[3840,2160]` · `fps:60`이 기본 권장이다. 무대는 비율 단위라 크기만 바꾸면 되고, 촬영본(3200×1800·60fps)이
4K 슬롯(≈2530px)에 들어가며 **거의 축소되지 않는다.** 스케일은 lanczos, 인코딩은 `crf 14 · slow · high`.
편집 중간본으로 더 필요하면 `crf` 값을 낮춘다(10 이하는 파일만 커진다).

## 걸려 넘어진 것 (다시 넘어지지 말 것)

- **Chrome stderr를 파이프로 받지 않는다.** macOS 디스플레이 경고 + 구글 업데이터 로그가 버퍼(1MB)를 넘겨 40프레임쯤에서 죽는다. `spawn` + `stdio:'ignore'`
- **정리 코드가 진짜 에러를 덮는다.** 프레임 하나가 실패하면 `finally`의 `rm`이 먼저 돌아 `ENOTEMPTY`만 남는다. 정리 실패는 삼키고 원인을 던진다
- **병렬로 돌리면 Chrome이 이따금 스크린샷을 안 남긴다.** 한 번 재시도한다
- **스크린샷 PNG는 rgb24다.** 알파를 다루는 필터 앞에는 `format`을 명시한다 — 없으면 ffmpeg이 조용히 죽는다
- **크로마 키는 모서리에 프린지를 남긴다.** 무대처럼 두 번 구울 수 있는 정적 화면은 디퍼런스 매트가 항상 낫다
- 웹폰트 대신 **시스템 폰트(Apple SD Gothic Neo)를 앞에** 둔다 — 네트워크 없이 결정적
- **ProRes 4444 알파는 `premultiply=inplace=1`을 거쳐 굽는다.** `prores_ks`는 곱하지 않고(실측) 편집기는 곱한 값을 기대한다 — 안 하면 테두리 헤일로. 근거와 실험은 `_lab/research/02-findings/alpha-transitions.md`
- 프레임이 바뀌는 무대는 **CDP 한 프로세스 캡처**(실측 15배, 의존성 0 — Node 22 `WebSocket`·`fetch`). `captureCDP()`. 무대는 전역 `render(t)`를 정의해야 한다
- 셔터(`tmix`)는 **`premultiply` 뒤에** 건다 — straight 알파를 평균하면 가장자리 색이 어긋난다

## 연출 주의

**기호가 화면에 등장하는 것은 장면이 아니라 논증이다**(Deighton 1989). `movies/26IRDEMO` 구성 규칙상 BEFORE 구간에 처리 지시를 넣지 않는다.
`icons` 클립의 자리는 셋 — 양식화가 선언된 오프닝·엔드, 실사가 안 나오는 컷의 **콘티 대역**, 별도 소셜 컷.
`imac` 목업은 AFTER 본편이 아니라 **오버숄더 진입 · 표지 · 엔드**에 쓴다 — 조작 구간은 풀프레임이 원칙이다(화면이 작아지면 판독성이 떨어진다).

## 확인

`--selftest`가 아이콘 영상 · iMac 스틸 · iMac 합성 셋을 480×270으로 돌려 **프레임 수와 결과 길이를 assert**한다.
