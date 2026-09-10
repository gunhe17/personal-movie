# 창의적인 전환은 어떻게 만드나 — 원칙에서 기법으로

조사 2026-09-10. `alpha-transitions.md`(어떻게 굽나)의 다음 — **무엇을 왜 만드나.**
디자인 쪽 자료(모션 원칙 · 편집 기법 · SVG 효과)에서 판단 기준을 뽑고, 그 기준으로 일곱 전환을 `motion-stage/stages/wipe.html`에 구현했다.
등급: **C** 실무 합의 · **D** 통설. 이 주제엔 동료심사 문헌이 사실상 없다 — 근거는 "누가 그렇게 해서 통했나"다.

---

## 0. 한 줄

**창의적인 전환은 화려한 전환이 아니라 관계를 말하는 전환이다.** 두 컷이 무슨 사이인지(같은 축 · 같은 물건 · 같은 재료)를
모양이 말하면 창의적으로 읽히고, 모양이 그 자체로 튀면 기법이 인식되어 몰입이 끊긴다(Friestad & Wright — 우리 조사 `video-craft.md`).

---

## 1. 판단 기준 — 세 자료에서 뽑았다

| 자료 | 무엇을 주나 | 등급 |
|---|---|---|
| **Willenskomer, UX in Motion 12원칙 (2017)** — easing · offset & delay · parenting · transformation · value change · masking · overlay · cloning · obscuration · parallax · dimensionality · dolly & zoom | 전환이 **무엇을 해야 하는가**의 어휘. "모션은 UI 애니메이션이 아니라 사용성"이라는 태도 | C |
| **Material Design 모션 4패턴** — container transform · shared axis · fade through · fade | 두 요소의 **관계에 따라** 전환을 고르는 규칙: 컨테이너가 된다 / 같은 축 / 관계 없음 / 그냥 페이드 | C |
| **편집 기법** — match cut · whip pan · object(mask) wipe · invisible cut | 전환이 **컷 자체에 있을 때**. 매트가 아니라 촬영과 컷 설계로 푸는 것 | C |
| **SVG 필터 효과** — feTurbulence + feDisplacementMap(변위·액체), 노이즈 문턱값(잉크·번짐) | 코드로 만들 수 있는 **유기적 가장자리**. 캔버스·WebGL 없이 마스크 한 장으로 | C |

여기에 **우리 조사의 규칙**이 위에 얹힌다 — `STORY.md` §2: 큰 피벗(무음 1.2초 · 명도 리프트 · 음악 진입)은 **전체에 한 번, 하드컷**.
나머지는 작은 이음매. 역상(실물→화면 대응)은 **셋만**. 애스펙트 전환 금지.

### 그래서 기준 넷

1. **관계를 말하나** — 같은 축(shared axis) · 같은 물건(object wipe / container transform) · 같은 재료(텍스처)
2. **방향이 일관되나** — AFTER 안에서는 항상 같은 방향으로. 방향이 바뀌면 관계가 바뀐 것으로 읽힌다
3. **리듬이 있나** — 한 동작을 시차로 나누면(offset & delay) 위계가 생긴다. 균일하면 기계적이다
4. **이 브랜드만의 것인가** — 무대의 도트, 종이의 잉크, 유리의 반사. 어디서나 쓰는 와이프가 아니라 **이 영상의 재료**가 전환이 된다

---

## 1-1. 정정 — 표면이 아니라 물건이 움직여야 한다

첫 구현(dots · slices · liquid · ink)을 보고 받은 피드백: **"별로 창의적이지 않다. 어떤 도형이 회전하면서 이동해서 커져서 전체 화면이 전환된다, 목업 배경이 뒤에서 서서히 드러난다 — 이런 게 창의적이다."**
맞는 지적이다. 앞의 넷은 **표면**(마스크의 모양)만 바꾼 것이고, 창의적으로 읽히는 것은 **물건이 움직여서** 전환이 되는 쪽이다 —
12원칙으로 말하면 masking(#6)보다 **transformation(#4) · dimensionality(#11) · dolly & zoom(#12)**, Material로 말하면 **container transform**.
그래서 셋을 더했다:

| 이름 | 무엇 | 원칙 | 구현 |
|---|---|---|---|
| **shape** | 도형이 한 점에서 출발해 **회전·이동·성장**하며 화면이 된다. 매트면 창, `cover`면 덮었다가(컷은 아래에서) 반대편으로 빠진다. 16:9 사각형이면 iMac 화면과 운을 맞춘다 | transformation · container transform | `wipe.html` preset `shape` |
| **logo** | 흰 마크가 가운데 등장 → **한 번 튐** → 끝없이 커지며 창 안이 흰색에서 배경 무늬로 바뀌고, 창이 화면을 넘어서면 **배경이 곧 그 무늬**가 된다 | container transform (로고 → 배경) · anticipation/overshoot | `logo.html` — 실제 마크 SVG |
| **pull** | 풀프레임 UI에서 **카메라가 뒤로 빠지며** iMac과 배경이 서서히 드러난다 | dolly & zoom · container transform 역방향 | `imac.html` + `pull` |

세 개의 공통점: **화면 안에 실제로 있는 것**(마크 · 화면 · 도형)이 이동한다. 마스크 넷은 그것이 없었다.

## 2. 기법 카탈로그

| 기법 | 원리 | 어디서 | 코드로 | 구현 | 자리 |
|---|---|---|---|---|---|
| **dots** 도트 성장 | 브랜드 텍스처가 자라 다음 컷을 연다 | container transform의 정신 | SVG 원 격자, 반지름 = f(p, dir 위치) | ✅ `wipe.html` | iMac 무대 → 풀프레임 UI 진입 |
| **slices** 시차 띠 | offset & delay | 12원칙 #2 | SVG 사각형 n개, 띠 i의 지연 = stagger·i/(n−1) | ✅ | **B4 8분할 뒤** — 여덟 줄이 시차로 닦인다 |
| **liquid** 액체 가장자리 | transformation | 12원칙 #4 · Smashing 2021 변위 | feTurbulence → feDisplacementMap이 와이프 경계를 민다 | ✅ | B5 대기실 → B6 밤. 시간이 흐른다 |
| **ink** 잉크 번짐 | 재료가 전환이 된다 — 이 영상의 고통은 **기록** | ink transition(2026) · 노이즈 문턱값 | feTurbulence → luminanceToAlpha → 문턱값이 내려간다 | ✅ | **B8 파일철 → 케어보드**. 종이가 번져 화면이 된다 |
| **band** 오브젝트 와이프 | obscuration — 물건이 컷을 가린다 | 12원칙 #9 · mask transition | 띠 마스크(RGBA 오버레이). 컷은 띠 아래에서 | ✅ | **역상 ①** 메모지 → 에이전트. 띠 = 메모지 색 |
| **wipe** | shared axis | Material | 선형 그라디언트 마스크 | ✅ | AFTER 컷 사이 — 항상 → |
| **iris** | dolly & zoom — 한 점으로 | 12원칙 #12 | 원형 그라디언트 마스크 | ✅ | 엔드 직전, 문 한 점에서 |
| match cut 매치컷 | 모양 · 움직임이 두 컷에서 운을 맞춘다 | 편집 | **매트 아님** — 촬영과 컷 위치 | 편집기 | **역상 ③** 22:47 책상 → 밝은 책상 (같은 앵글) |
| whip pan 휩팬 | 빠른 팬의 블러가 컷을 숨긴다 | 편집 · SNS | 촬영(또는 두 컷에 방향 블러) | 편집기 | B3 복도(따라가는 카메라) 끝 |
| zoom-through 줌스루 | 화면 속 요소로 들어가 다음 공간이 된다 | dolly & zoom · Apple Fluid Interfaces | 푸티지 스케일 — 매트가 아니다 | 편집기 | **오버숄더 → 풀프레임** (STORY §5 구도 규칙 그 자체) |
| sheen 반사 스윕 | 유리 위를 빛이 지나며 컷을 가린다 | 이 무대의 liquid glass | `band`에 흰색·낮은 불투명도·큰 feather | ✅ (band 설정) | iMac 무대 안에서 |
| shape morph 형태 변형 | 한 도형이 다른 도형이 된다 | container transform | `clip-path: polygon()` 꼭짓점 보간 | ✗ 미구현 | 필요해지면 |

**구현한 일곱은 전부 `maskFor()` 하나에서 나온다.** CSS 그라디언트(wipe · iris · band)와 SVG 데이터 URL(dots · slices · liquid · ink) — 둘 다 `mask-image` 한 줄이라 렌더러 쪽은 바꿀 것이 없었다.

---

## 3. 구현 메모 — 걸린 것

- **SVG 필터를 `mask-image` 데이터 URL 안에서 쓴다.** Chrome이 이미지로 렌더한 SVG에 `feTurbulence`·`feDisplacementMap`을 적용한다 — 캔버스 없이 유기적 가장자리가 나온다
- **결정적 렌더** — `seed` 고정, 모든 값은 `render(t)`에서 계산. CSS 애니메이션·transition을 쓰지 않는다
- **invert는 기하로** — `mask-mode`가 알파를 쓰므로 색을 뒤집어선 안 된다. SVG `<mask>`(휘도)로 전체 사각형에서 모양을 뺀다
- **liquid의 범위** — 변위가 가장자리를 `scale`만큼 되밀 수 있어 진행 범위를 양쪽으로 `scale`씩 늘렸다. 안 그러면 p=1에서 덜 덮인다
- **ink의 문턱값** — fractalNoise 휘도가 대략 0.3~0.7에 몰려 있어 문턱을 0.85→−0.05로 쓸어야 0%→100%가 된다. 진행이 선형이 아니라 `ease:linear`를 기본으로
- **dots는 1920×1080에 ~900개 원** — 데이터 URL 40KB. CDP 캡처에서 문제없다
- **모션 블러는 여전히 셔터(`shutter:4`)로** — 필터가 무거워도 60프레임 몇 초

---

## 4. 이 영상의 이음매 배정 — 제안

`STORY.md`의 아홉 섹션과 큰 피벗을 기준으로. **전환이 그 자리의 논지를 말하도록** 골랐다.

| 자리 | 전환 | 왜 |
|---|---|---|
| 후크 → B1 | 하드컷 | 아이가 나가고 소리가 무너진다 — 소리가 전환이다 |
| B1 → B2 | `band` (메모지 색) | 메모지가 지나가며 가린다. 역상 ①의 예고 |
| B3 → B4 | `slices` 8 | 여덟 줄로 갈라지며 8분할이 시작된다 |
| B4 → B5 | `slices` 8, invert | 여덟 줄이 닫히며 8분할이 끝난다 |
| B5 → B6 | `liquid` down | 대기실 → 밤. 시간이 흘러내린다 |
| **정점 → 피벗** | **하드컷 + 무음 1.2초** | 조사가 정한 유일한 큰 전환. 이 무대의 일이 아니다 |
| 선취 → A1 | `dots` (무대 도트) | iMac 무대의 도트가 자라 풀프레임 UI가 된다 |
| A1~A10 사이 | `wipe` → 항상 오른쪽 | 같은 축 = 같은 하루 |
| A7 → A8 (파일철→케어보드) | `ink` | 역상 ②. 종이가 번져 화면이 된다 |
| A10 → 엔드 | `iris` (문 위치) | 아이가 들어오는 문 한 점으로 |

**셋만 튄다** — band · ink · dots. 나머지는 wipe/slices처럼 방향과 리듬만 있는 것이라 기법으로 인식되지 않는다. 기준 4(브랜드의 재료)를 채우는 셋이 곧 역상 셋이다.

---

## 5. 확인하지 못한 것

- 일곱 전환의 **실제 관객 반응** — 러프컷을 상담센터에서 일해본 적 없는 사람에게 보이는 절차(`STORY.md` §10-12)에 포함시킨다
- `liquid`·`ink`의 **4K 렌더 속도** — 1080p만 쟀다. SVG 필터는 면적에 비례해 느려진다
- 편집기에서 **매트 8개를 트랙에 거는 실제 작업량** — ffmpeg 조립이 더 빠를 수 있다
- shape morph — 미구현

## 출처

[Willenskomer — UX in Motion Manifesto (Medium, 2017)](https://medium.com/ux-in-motion/creating-usability-with-motion-the-ux-in-motion-manifesto-a87a4584ddc) · [Creative Bloq — 12 principles cheatsheet](https://www.creativebloq.com/news/principles-of-ux-motion) · [Google Design — Implementing Motion (Naimark)](https://medium.com/google-design/implementing-motion-9f2839002016) · [Material Motion codelab](https://developer.android.com/codelabs/material-motion-android) · [StudioBinder — Types of editing transitions](https://www.studiobinder.com/blog/types-of-editing-transitions-in-film/) · [Smashing — SVG displacement filtering (2021)](https://www.smashingmagazine.com/2021/09/deep-dive-wonderful-world-svg-displacement-filtering/) · [Codrops — feTurbulence texture (2019)](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/) · [freefrontend — Ink transition (2026-01)](https://freefrontend.com/code/ink-transition-scroll-effect-2026-01-18/) · [ekino — Liquid Glass in CSS/SVG](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
