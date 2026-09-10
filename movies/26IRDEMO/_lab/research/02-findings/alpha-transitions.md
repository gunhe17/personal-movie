# 배경이 투명한 화면 전환 — 코드로 만드는 법

조사 2026-09-10. 용도는 `motion-stage` 스킬의 다음 단계 — 편집기에 얹을 **투명 전환·오버레이**를 HTML/코드로 만드는 것.
**핵심 주장은 전부 이 머신에서 실측했다.** 실측하지 못한 것은 §10에 따로 적었다. 2차 출처는 그렇게 표시했다.

---

## 0. 한 줄 결론

**HTML → Chrome(CDP, 한 프로세스) → PNG(알파) → `premultiply` → ProRes 4444.**
지금 파이프라인에서 바꿀 것은 둘뿐이다 — 프레임마다 Chrome을 띄우지 말고 **CDP로 한 번 띄워 찍는다**(15배 빠름),
그리고 ProRes로 굽기 전에 **알파를 곱한다**(안 하면 편집기에서 테두리 헤일로).

---

## 1. 실측으로 확인한 것

| 주장 | 결과 | 어떻게 쟀나 |
|---|---|---|
| Chrome 헤드리스 스크린샷이 알파를 남긴다 | **예.** `rgba`, 빈 무대의 알파 평균 1.4/255 | `--default-background-color=00000000` · `alphaextract,signalstats` |
| ffmpeg `prores_ks` 4444가 알파를 실어 나른다 | **예.** `yuva444p12le`, 알파 평균이 PNG와 같다 | 위 PNG를 인코딩 후 재측정 |
| **`prores_ks`가 알파를 곱해 넣는가** | **아니다 — straight 그대로 저장한다.** 50% 흰색(R255·A128) → R255·A128 그대로. `premultiply` 필터를 걸어야 R127·A128이 된다 | `color=white@0.5` 합성 프레임으로 채널별 측정 |
| CDP 단일 프로세스 캡처 속도 | **17.5 fps** (1920×1080 알파, 60프레임 3.4초) | Node 22 내장 `WebSocket`·`fetch`만으로 CDP 구동 |
| 프레임마다 Chrome 스폰 (현행) | **1.2 fps** (같은 60프레임 52초) | `motion-stage` 현행 렌더러 |
| Node 22에 `WebSocket`이 내장돼 있다 | **예** (`typeof WebSocket === 'function'`) | — |

> 검색 결과 중 *"prores_ks가 기본으로 premultiplied를 출력한다"*(HuggingFace 스펙 문서)는 **틀렸다.** 실측으로 반증.

---

## 2. 알파가 어디서 살고 죽나

```
HTML/CSS (straight α)
  → Chrome 스크린샷 PNG (straight α · rgba · 결정적)      ✓ 실측
  → ffmpeg premultiply=inplace=1                            ← 여기서 곱한다 (§4)
  → prores_ks 4444 (yuva444p10le/12le · 곱한 값 그대로 저장) ✓ 실측
  → Premiere / FCP / Resolve (ProRes 4444 = premultiplied로 해석)  2차
```

**Chrome 안에서 투명 배경일 때 안 되는 것**

| 안 되는 것 | 왜 | 대안 |
|---|---|---|
| `backdrop-filter`(유리·블러) | 뒤에 아무것도 없다 | 유리는 **불투명 플레이트 위**에서만. 전환 오버레이에는 유리를 쓰지 않는다 |
| `mix-blend-mode` | 섞을 배경이 없다 | 편집기의 블렌드 모드로 |
| 모션 블러 | Chrome은 프레임을 정지 상태로 그린다 | **시간 슈퍼샘플링** — 4배 fps로 찍고 `tmix=frames=4`로 평균 (§5) |
| 서브픽셀 글자 AA | 투명 위에서 색 프린지 | `--disable-lcd-text` (이미 켜져 있다) |

`filter: drop-shadow`는 알파에 작동한다 — 투명 위에서도 그림자가 나온다.

---

## 3. 알파를 담는 포맷

| 용도 | 포맷 | ffmpeg | 비고 |
|---|---|---|---|
| **편집 중간본 (권장)** | ProRes 4444 `.mov` | `-c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le` | Premiere·FCP·Resolve 전부 읽는다. **크다** — 6초에 65MB급 (Remotion 문서, 2차) |
| 무손실 원본 | PNG 시퀀스 | `f%05d.png` | 편집기가 시퀀스 임포트 지원. 가장 안전 |
| 웹 (Chrome·Firefox) | WebM VP9 | `-c:v libvpx-vp9 -pix_fmt yuva420p` | **Safari는 VP9 알파를 못 읽는다** (2차, 2025-02 · 2026) |
| 웹 (Safari) | HEVC 알파 `.mov` | `-c:v hevc_videotoolbox -require_sw 1 -alpha_quality 0.1 -tag:v hvc1 -vf premultiply=inplace=1` — **macOS 전용** | `libx265`는 알파를 못 넣는다 (2차). 웹은 두 파일을 다 만들어 `<source>` 둘로 |
| 애니 GIF/APNG | — | — | 8비트 알파·색 제한. 쓰지 않는다 |

---

## 4. 프리멀티플라이 — 이 조사의 가장 실용적인 발견

**PNG는 straight 알파, ProRes 4444를 읽는 편집기는 premultiplied를 기대한다.** 그런데 `prores_ks`는 곱하지 않는다(실측).
그대로 넘기면 반투명 가장자리가 편집기에서 **밝게 뜨는 헤일로**가 된다 — Adobe 커뮤니티의 "ProRes 4444 alpha premultiplication problem" 스레드가 정확히 이 증상이다(2차).

```
ffmpeg -framerate 60 -i f%05d.png \
  -vf "premultiply=inplace=1" \
  -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out.mov
```

**규칙:** ProRes 4444로 갈 때는 항상 `premultiply=inplace=1`. PNG 시퀀스로 넘길 때는 곱하지 않는다(편집기가 straight로 읽는다).
Resolve에서 그래도 어긋나면 클립 속성의 **Alpha Mode**를 바꾼다(2차). Premiere는 ProRes 4444를 premultiplied로 고정 해석한다(2차).

> `motion-stage`의 `bg:"transparent"` 경로가 지금 **곱하지 않고** 내보내고 있었다. 이 조사에서 고쳤다.

---

## 5. 전환을 코드로 만드는 두 가지 — 오버레이와 매트

같은 HTML에서 **두 종류의 산출물**이 나온다. 편집기에서의 쓰임이 다르다.

| | A · RGBA 오버레이 | B · 루마 매트 |
|---|---|---|
| 무엇 | 지나가는 **그래픽 자체** (막대·원·아이콘·글자) | 전환의 **모양**만 (흰=보임, 검=가림) |
| 편집기 | 위 트랙에 그냥 얹는다 | **트랙 매트**(Premiere) · **Alpha/Luma Matte**(Resolve) · FCP 컴파운드 — 아래 클립 어느 것에나 적용 |
| 렌더 | `bg: transparent`, 오브젝트만 그린다 | 배경 검정, 모양을 흰색으로. **알파 불필요 → H.264로도 된다** |
| 언제 | 로고 펄스 · 아이콘 지나감 · 자막 등장 | **컷 전환**(와이프 · 아이리스 · 대각선) · 화면 드러내기 |

**B가 더 자주 쓰인다.** 전환의 형태는 한 번 만들면 어느 두 컷 사이에도 걸 수 있고, ffmpeg에서도 `alphamerge`로 바로 쓴다:

```
[next][matte]alphamerge[fg]; [prev][fg]overlay
```

**HTML에서 모양을 만드는 도구**

| 기법 | 쓰임 | 결정적 렌더 |
|---|---|---|
| `clip-path: inset()/circle()/polygon()` | 와이프 · 아이리스 · 대각선 | `render(t)`에서 값을 직접 계산해 넣는다 — CSS 애니메이션에 맡기지 않는다 |
| `mask-image: linear/radial-gradient` | 부드러운 가장자리(페더) | 같음 |
| SVG `<clipPath>` · `<mask>` | 복잡한 모양 · 글자로 뚫기 | 같음 |
| `transform` + 이징 함수 | 막대 · 오브젝트 이동 | `motion-stage/stages/icons.html`의 `easeOut/easeIn/smooth`를 그대로 |

**모션 블러 — 빠른 와이프는 이것 없이는 뚝뚝 끊긴다.**
Chrome은 프레임을 정지 상태로 그리므로 셔터가 없다. 해법은 **시간 슈퍼샘플링**: 4배 fps로 찍고 4프레임씩 평균한다.

```
# 240fps로 찍은 시퀀스 → 60fps로 4프레임 평균 (180° 셔터와 비슷)
ffmpeg -framerate 240 -i f%05d.png -vf "tmix=frames=4:weights='1 1 1 1',select='not(mod(n\,4))',setpts=N/60/TB" ...
```
전환은 1~2초라 4배를 찍어도 240~480프레임 — CDP 캡처(§6)면 30초 안이다.

---

## 6. 렌더 속도 — CDP 한 프로세스 (실측 15배)

현행 `motion-stage`는 프레임마다 Chrome을 새로 띄운다. 무대가 정지면 그 방식이 맞지만(한 장이면 되니까), **전환은 프레임마다 그림이 바뀐다.**

| 방식 | 60프레임 · 1080p 알파 | 의존성 |
|---|---|---|
| 프레임마다 스폰 (현행) | 52초 · **1.2 fps** | 없음 |
| **CDP 한 프로세스** | 3.4초 · **17.5 fps** | **없음** — Node 22 내장 `WebSocket` · `fetch` |
| Playwright/Puppeteer | 비슷 (같은 CDP) | npm 패키지 + 브라우저 바이너리 |

**구현 요점** (실험 코드 `motion-stage/scripts/_cdp-probe.mjs`, 돌아가는 것 확인):

1. `chrome --headless=new --remote-debugging-port=0 --remote-allow-origins=*` → stderr의 `ws://…` 줄에서 포트를 읽는다
2. `PUT http://127.0.0.1:{port}/json/new?file:///stage.html` → `webSocketDebuggerUrl` (GET은 새 Chrome이 거부한다)
3. `Emulation.setDeviceMetricsOverride` (크기·DSF) · **`Emulation.setDefaultBackgroundColorOverride({color:{r:0,g:0,b:0,a:0}})`** — 이게 없으면 흰 배경
4. 프레임마다 `Runtime.evaluate("render(t)")` → `Page.captureScreenshot({format:'png', fromSurface:true})` → base64 → 파일
5. 페이지를 **다시 로드하지 않는다** — 그래서 빠르다

주의: `Page.startScreencast`는 알파를 못 남긴다(2차, DevTools 이슈 #162). 캡처는 `captureScreenshot`으로.

---

## 7. 대안 도구 — 언제 무엇을

| 도구 | 투명 출력 | 전환 | 판단 |
|---|---|---|---|
| **motion-stage (우리)** | PNG → ProRes 4444 | 직접 만든다 (`render(t)`) | 의존성 0. 무대·아이콘·iMac이 이미 있다. **CDP만 붙이면 전환에도 충분** |
| **Remotion** (ir-demo에 설치돼 있음) | `--codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le` | **`@remotion/transitions`**: `fade · pushCut · slide · wipe · flip · clockWipe · iris · zoomBlur` + `linearTiming/springTiming`, `<TransitionSeries>`가 겹침을 자동 처리 | 두 **장면 사이** 전환을 React로 짤 때. 오버레이/매트만 필요하면 과하다 |
| Motion Canvas | 배경 비우면 투명 PNG 시퀀스 | TypeScript 제너레이터로 타임라인 | 별도 설치·학습. 우리 무대와 겹침 |
| Lottie (AE → JSON → lottie-web) | 헤드리스 브라우저에서 같은 방식으로 캡처 | AE에서 디자인 | 디자이너가 AE로 만들 때의 다리. 우리 파이프라인에 그대로 얹힌다 |
| ffmpeg `xfade` | **불투명** — 두 클립 사이 | `wipeleft · circleopen · diagtl …` 40여 종 + `custom` 식 | 알파 오버레이가 아니라 **최종 편집에서 두 컷을 잇는** 용도. 편집기 없이 ffmpeg으로 조립할 때 |

---

## 8. 편집기별 임포트 (2차 출처 — 넣어 보고 확인할 것)

| 편집기 | 권장 | 알파 해석 |
|---|---|---|
| Premiere Pro | ProRes 4444 `.mov` | premultiplied 고정. straight를 넣으면 헤일로 → **§4 규칙 적용** |
| Final Cut Pro | ProRes 4444 | 자동 |
| DaVinci Resolve (Mac) | ProRes 4444 | 클립 속성 **Alpha Mode**로 straight/premultiplied 전환 가능 |
| DaVinci Resolve (Windows) | PNG 시퀀스 | ProRes 인코딩 불가 환경 대비 |
| 웹 | WebM VP9 + HEVC 알파 두 파일 | Safari가 VP9 알파를 못 읽는다 |

---

## 9. 이 프로젝트에 붙이면

1. **`motion-stage`에 CDP 캡처를 넣는다** — `icons`처럼 프레임이 바뀌는 무대용. `imac`+`screen`은 지금 방식(한 장 + ffmpeg)이 맞다
2. **`premultiply=inplace=1`을 ProRes 경로에** — 이 조사에서 적용
3. **전환 무대 `wipe.html`** — `render(t)`가 `clip-path`를 계산. 같은 무대를 `?matte=1`로 찍으면 루마 매트(흰/검), 아니면 RGBA 오버레이
4. **4배 fps + `tmix`** 옵션 — 전환에만 켠다
5. 편집기에 첫 ProRes를 넣을 때 **헤일로 유무를 눈으로 확인**한다. 있으면 §4, 없으면 끝

전환의 **연출**은 이 문서 밖이다 — `STORY.md`의 규칙(큰 피벗은 전체에 한 번, 나머지는 작은 이음매)이 정본이다.

---

## 10. 확인하지 못한 것

- **편집기 실제 임포트** — Premiere·Resolve에 넣어 헤일로를 눈으로 본 것은 아니다. §4의 논리와 커뮤니티 증상으로 추정
- `hevc_videotoolbox` 알파 인코딩 — 이 머신에서 돌려 보지 않았다
- Remotion `@remotion/transitions`의 현재 버전 API 세부 — 문서 요약(2차)
- `tmix` 셔터 근사의 시각적 품질 — 명령은 맞지만 결과를 보지 않았다
- Chrome DSF 2로 찍을 때 CDP 속도 — 1080p·DSF 1만 쟀다

## 출처

실측 — 이 문서 §1 (2026-09-10, macOS 26.6 · Chrome 152 · ffmpeg · Node 22.19)
2차 — [Chromium headless-dev: Page.captureScreenshot transparent](https://groups.google.com/a/chromium.org/g/headless-dev/c/0raEy5mDfkM) · [DevTools issue #162 (screencast alpha)](https://github.com/ChromeDevTools/devtools-protocol/issues/162) · [Adobe: ProRes 4444 alpha premultiplication problem](https://community.adobe.com/t5/premiere-pro-discussions/alpha-premultiplication-problem-with-prores-4444-footage/m-p/12322434) · [Remotion: transparent videos](https://www.remotion.dev/docs/transparent-videos) · [Remotion: @remotion/transitions](https://www.remotion.dev/docs/transitions/) · [Remotion: presentations](https://www.remotion.dev/docs/transitions/presentations) · [Terhechte: transparent video Safari/Chrome/Firefox (2025-02)](http://terhech.de/posts/2025-02-02-transparent-video-safari.html) · [Jake Archibald: video with transparency (2024)](https://jakearchibald.com/2024/video-with-transparency/) · [Rotato: transparent videos for the web 2026](https://rotato.app/blog/transparent-videos-for-the-web) · [Motion Canvas: rendering](https://motioncanvas.io/docs/rendering/) · [avpres.net: image sequence → ProRes](https://avpres.net/FFmpeg/sq_ProRes.html)
