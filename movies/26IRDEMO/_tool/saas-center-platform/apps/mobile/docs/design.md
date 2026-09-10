# 디자인 시스템 — 구현 가이드

> 목적: Claude Code로 새 페이지를 구현할 때 기존 최신 화면(`♻️ V1 Refactor`)과 이질감이 없도록 하는 단일 기준 문서.
> Figma 파일: `전문가용 앱` (key: IkfJgJxLJmAqulk3p3leon)

---

## 0. 기준 (가장 먼저 읽을 것)

- **Canonical(기준) 소스**: `🎨 Design System v2` 페이지(토큰·컴포넌트 라이브러리) + 번호 컬렉션 `1. Primitives` / `2. Semantic` / `3. Tag` / `4. Spacing`.
- **닮아야 할 화면**: `♻️ V1 Refactor` 페이지(최신 화면). 새 페이지는 이 화면들과 시각적으로 일관돼야 한다.
- **표준 토큰**: **새 `2. Semantic` 체계만 사용**한다.
- **레거시 `Color` 컬렉션(Gray/_, primary/_, Semantic/_, Fieldnote/_)은 deprecated.** 최신 화면이 아직 일부 참조하지만(절반 마이그레이션 상태), **새 페이지에는 절대 쓰지 않는다.** 대응표는 §1.2.
- **플랫폼**: 모바일. 화면 프레임 폭 **375px**.
- **모드**: Light / Dark 양쪽 지원. 색은 항상 시멘틱 토큰으로 적용(하드코딩 금지) — 모드 전환은 토큰이 알아서 처리.

### 핵심 원칙 3줄 요약

1. 색은 시멘틱 토큰만. primitive·legacy 직접 사용 금지(시멘틱이 없는 경우만 예외).
2. 세로 간격은 "단일 책임" — 컨테이너 gap 또는 영역 패딩 중 **하나만** 만든다(둘 다 주면 이중).
3. 텍스트는 leading trim(Cap height) 켠 상태를 표준으로 본다.

---

## 1. Foundations (토큰)

> **코드용 single source = [`src/shared/constants/tokens.js`](../src/shared/constants/tokens.js)** (Figma v2에서 추출, Light 값). 전체 정리본은 [`color-system-v2.md`](color-system-v2.md). theme.ts·tailwind.config.js가 tokens.js에서 생성된다. 아래 표는 구현에 자주 쓰는 핵심값 요약(값이 충돌하면 tokens.js 우선).

### 1.1 컬러 — 아키텍처

`primitive(원시값) → semantic(역할) → component`. **화면에는 semantic만 적용.** primitive(gray/900 등)는 semantic이 참조하는 내부 레이어.

> **원시 램프 메모**: Gray 스케일에 `gray/75 #F0F3F5`(50과 100 사이 — `button/assistive/bg-disabled` Light 배경), Brand에 **Mint 램프**(`mint/300 #8CE0E0` · `mint/400 #59CED8` · `mint/500 #00C3BC` · `mint/600 #009B96` — billing 버튼 계열의 bg/text/icon)가 있다. 전체 원시값은 `tokens.ts` 참조.

#### Text (Light / Dark)

| 토큰                    | Light              | Dark               | 용도                |
| ----------------------- | ------------------ | ------------------ | ------------------- |
| `text/headline`         | gray/900 `#1D2227` | gray/50 `#F5F7F8`  | 최상위 제목         |
| `text/title/default`    | #1D2227            | #F5F7F8            | 섹션 제목           |
| `text/title/subtle`     | gray/600 `#58626C` | gray/400 `#AAB2BE` | 약한 제목           |
| `text/body/strong`      | #1D2227            | #F5F7F8            | 강조 본문           |
| `text/body/default`     | #58626C            | #AAB2BE            | 본문                |
| `text/body/subtle`      | gray/500 `#7D848F` | #7D848F            | 약한 본문           |
| `text/caption/default`  | #7D848F            | #7D848F            | 캡션                |
| `text/caption/subtle`   | gray/400 `#AAB2BE` | gray/600 `#58626C` | 약한 캡션           |
| `text/label/strong`     | #1D2227            | #F5F7F8            | 강조 라벨           |
| `text/label/default`    | #58626C            | #AAB2BE            | 라벨                |
| `text/placeholder`      | #AAB2BE            | #58626C            | 입력 placeholder    |
| `text/state/inverse`    | gray/0 `#FFFFFF`   | gray/900 `#1D2227` | 어두운 배경 위 글자 |
| `text/state/on-primary` | #FFFFFF            | #FFFFFF            | 채움 버튼 위 글자   |
| `text/state/brand`      | blue/500 `#4486FF` | blue/400           | 링크·브랜드 강조    |
| `text/state/disabled`   | #AAB2BE            | #58626C            | 비활성              |

위계: `headline/title/body-strong/label-strong = gray/900` · `body/label/title-subtle = gray/600` · `body-subtle/caption = gray/500`.

#### Icon (Light / Dark)

| 토큰                                     | Light              | Dark               |
| ---------------------------------------- | ------------------ | ------------------ |
| `icon/primary`                           | gray/500 `#7D848F` | gray/400 `#AAB2BE` |
| `icon/secondary`                         | gray/400 `#AAB2BE` | gray/500 `#7D848F` |
| `icon/tertiary`                          | gray/300 `#D1D5DB` | gray/600 `#58626C` |
| `icon/brand`                             | blue/500 `#4486FF` | blue/400           |
| `icon/inverse`                           | #FFFFFF            | gray/900           |
| `icon/on-primary`                        | #FFFFFF            | #FFFFFF            |
| `icon/disabled`                          | #AAB2BE            | #58626C            |
| `icon/info · danger · success · warning` | = status/\*        | = status/\*        |

#### Background (Light / Dark)

| 토큰                 | Light              | Dark               | 용도                                               |
| -------------------- | ------------------ | ------------------ | -------------------------------------------------- |
| `bg/base`            | gray/50 `#F5F7F8`  | gray/950 `#171717` | 페이지 배경                                        |
| `bg/surface`         | gray/0 `#FFFFFF`   | gray/900 `#1D2227` | 기본 표면(카드)                                    |
| `bg/surface-raised`  | #FFFFFF            | gray/800 `#2D333B` | 떠 있는 표면                                       |
| `bg/surface-sunken`  | #F5F7F8            | #2D333B            | 가라앉은 표면                                      |
| `bg/overlay`         | alpha black 50%    | alpha black 60%    | 오버레이/딤                                        |
| `bg/selected`        | blue/500 @ 8%      | blue/400 @ 12%     | 선택/활성 항목 배경 (active 선택 박스·탭)          |
| `bg/emphasis`        | gray/800 `#2D333B` | gray/100 `#E9EEF0` | 진한 채움 칩(inverse) · **세그먼트 활성 배경** — v2: 한 단계 부드럽게 |
| `bg/emphasis-subtle` | gray/100 `#E9EEF0` | gray/700 `#464F58` | 연한 칩                                            |

> **활성 선택(active selection) 세트**: 선택 박스·세그먼트·탭의 active 상태는 세 토큰을 함께 — `bg/selected`(옅은 블루 채움) + `border/active`(블루 테두리) + `text/state/brand`(블루 글자). 비활성은 채움 없음 + `border/default`.

#### Border

| 토큰             | Light              | 용도        |
| ---------------- | ------------------ | ----------- |
| `border/subtle`  | gray/100 `#E9EEF0` | 약한 구분선 |
| `border/default` | gray/200 `#E3EAEF` | 기본 테두리 |
| `border/strong`  | gray/300 `#D1D5DB` | 강조 테두리 |
| `border/active`  | blue/500 `#4486FF` | 활성/포커스 |

#### Action / Status / Accent

| 토큰                    | 값                                                                        |
| ----------------------- | ------------------------------------------------------------------------- |
| `action/primary`        | blue/500 `#4486FF`                                                        |
| `action/primary-hover`  | blue/600 `#2566DD`                                                        |
| `action/primary-subtle` | blue/100 `#E5EEFF`                                                        |
| `action/disabled`       | gray/200 `#E3EAEF`                                                        |
| `status/info`           | sky/500 `#0E9BFF`                                                         |
| `status/danger`         | red/500 `#FF4242`                                                         |
| `status/warning`        | orange/500 `#FF9200`                                                      |
| `status/success`        | green/500 `#00BF40`                                                       |
| `status/*-bg` (틴트)    | info `#E5F4FF` · danger `#FFECEC` · warning `#FFF3E5` · success `#E5F8EC` |
| `accent/fieldnote`      | purple/500 `#9B5DFF`                                                      |

#### Button (64 토큰)

패턴: `button/{color}/{role}-{state}`

- color: `primary` · `secondary` · `assistive` · `white` · `outline` · `danger` · `billing`(청구, mint/500 teal #00C3BC — bg/text/icon은 mint 램프 300~600 사용)
- role: `bg` · `text` · `border` (billing은 `icon` 도 있음)
- state: `default` · `hover` · `pressed` · `disabled`

예: `button/primary/bg-default` = blue/500, `button/primary/text-default` = #FFFFFF, `button/outline/border-default` = gray/200. 전체값은 Figma 문서 참조. 버튼 구현 시 색은 이 토큰만 사용.

#### Tag (10색 × bg/fg/outline, Light / Dark)

- `tag/{color}/fg` — 글자색(100%, 브랜드 hue). **bg·outline의 기준 색**(fg를 정하면 bg·outline은 같은 hue에서 파생).
- `tag/{color}/bg` — 채움 배경. fg와 **같은 hue를 낮은 불투명도로**. Light **6~8%** / Dark **14~27%** (색마다 명도 균일화).
- `tag/{color}/outline` — 테두리. fg와 같은 hue. Light **26~36%** / Dark **30~60%** (명도 균일화).
- 색: gray · blue · indigo · purple · pink · red · orange · amber · green · teal.
- 규칙: **Filled 태그는 outline 없음, Outline 태그는 배경(fill) 없음.**
- ⚠️ fg(hue)를 바꾸면 bg·outline 불투명도를 **새 hue 기준으로 다시 명도 균일화**해야 한다. 색별 정확한 값은 Figma `🎨 Color tokens — 현행`이 source of truth.

#### Trend (통계 — 상승/하강)

방향 전용 색. **status(성공/위험)와 의미가 달라 절대 재사용 금지.** 한국식 컨벤션(상승=빨강 / 하강=블루).

| 토큰            | Light              | Dark               | 용도                |
| --------------- | ------------------ | ------------------ | ------------------- |
| `trend/up`      | red/500 `#FF4242`  | red/400 `#FF6B6B`  | 상승 ↑              |
| `trend/down`    | blue/500 `#4486FF` | blue/400 `#689DFF` | 하강 ↓              |
| `trend/flat`    | gray/500 `#7D848F` | gray/400 `#AAB2BE` | 보합 →              |
| `trend/up-bg`   | red @ 8%           | red @ 16%          | 상승 차트 영역 채움 |
| `trend/down-bg` | blue @ 8%          | blue @ 16%         | 하강 차트 영역 채움 |

> **통계 색 규칙 (중요)**: 데이터 카테고리(상담·검사·노쇼 등)는 **전부 중립**(text/icon 토큰, 블랙/그레이)으로 두고 색은 라벨·위치로 구분. 색이 의미를 갖는 건 **trend(방향)뿐** — "한 화면에서 한 색 = 한 의미". 노쇼도 빨강 대신 블랙. 노쇼가 늘면 추세 화살표가 `trend/up`(빨강)으로 자연스럽게 경고처럼 읽힌다.

### 1.2 레거시 Color → 새 토큰 매핑 (deprecated)

새 페이지에서 아래 좌측(레거시)을 보면 우측(새 토큰)으로 대체한다. 값은 1:1 일치.

| 레거시                 | 값          | → 새 토큰(권장)                                                  |
| ---------------------- | ----------- | ---------------------------------------------------------------- |
| `Gray/White`           | #FFFFFF     | `bg/surface` (배경) / `text/state/inverse`·`icon/inverse` (전경) |
| `Gray/50`              | #F5F7F8     | `bg/base` · `bg/surface-sunken`                                  |
| `Gray/100`             | #E9EEF0     | `border/subtle` · `bg/emphasis-subtle`                           |
| `Gray/200`             | #E3EAEF     | `border/default`                                                 |
| `Gray/300`             | #D1D5DB     | `border/strong` · `icon/tertiary`                                |
| `Gray/400`             | #AAB2BE     | `text/placeholder` · `icon/secondary` · `text/state/disabled`    |
| `Gray/500`             | #7D848F     | `icon/primary` · `text/caption/default` · `text/body/subtle`     |
| `Gray/600`             | #58626C     | `text/body/default` · `text/label/default` · `text/title/subtle` |
| `Gray/700`             | #464F58     | (assistive/outline 버튼 텍스트) · `bg/emphasis-subtle`(dark)     |
| `Gray/800`             | #2D333B     | `bg/emphasis` · `bg/surface-raised`(dark) · `bg/surface-sunken`(dark) |
| `Gray/900`             | #1D2227     | `text/title/default` · `text/body/strong` · `bg/surface`(dark)   |
| `Gray/Black`           | #191919     | ⚠️ 정확한 대응 없음 — 가장 가까운 `gray/950 #171717` 사용        |
| `primary/50~900`       | blue/50~900 | `action/primary*` · `button/*` (gray/blue 스케일)                |
| `primary/500`          | #4486FF     | `action/primary` · `text/state/brand` · `icon/brand`             |
| `Semantic/Information` | #0E9BFF     | `status/info`                                                    |
| `Semantic/Negative`    | #FF4242     | `status/danger`                                                  |
| `Semantic/Notice`      | #FF9200     | `status/warning`                                                 |
| `Semantic/Positive`    | #00BF40     | `status/success`                                                 |
| `Fieldnote/purple`     | #9B5DFF     | `accent/fieldnote`                                               |

### 1.3 타이포그래피

폰트: **Pretendard**. letter-spacing 공통 **-0.41**. 스타일 = 타이포(아래) + 컬러 토큰(§1.1)을 함께 적용.

| 스타일          | 크기 / 행간          | weight                       |
| --------------- | -------------------- | ---------------------------- |
| Headline        | 28 / 36              | SemiBold                     |
| Headline        | 24 / 36              | SemiBold                     |
| Title_01        | 20 / 28              | Medium·SemiBold              |
| Title_01 (대형) | 48 / 52              | Light — 대형 디스플레이 전용 |
| Title_02        | 18 / 26              | SemiBold·Bold                |
| Body_01         | 16 / 24 (Reading 26) | Regular·Medium·SemiBold      |
| Body_02         | 15 / 22 (Reading 24) | Regular·Medium·SemiBold      |
| Body_03         | 14 / 20              | Regular·Medium·SemiBold      |
| Label_01        | 13 / 20              | Regular·Medium·SemiBold      |
| Label_02        | 12 / 16              | Regular·Medium               |
| Caption_01      | 11 / 14              | Regular                      |

**Leading trim 규칙**: 행간(line-height)은 가독성을 위해 유지하되, 모든 텍스트 스타일에 **Vertical trim = "Cap height to baseline"(leadingTrim)** 을 표준으로 켠다. 그래야 텍스트 박스 위아래 유령 여백이 사라져 spacing 토큰이 정확히 적용된다. CSS로는 `text-box-trim: trim-both`.

- 예외(트림 OFF): 고정 높이 컨테이너 안에서 한 줄 텍스트가 자기 행간으로 수직 중앙 정렬되고 center 정렬로 못 바꾸는 레거시 요소만.

### 1.4 스페이싱

primitive 스케일: `space/2 4 8 12 16 20 24 28 32 36 40 48`.

| 토큰                    | 값  | 용도                      |
| ----------------------- | --- | ------------------------- |
| `layout/screen-x`       | 16  | 화면 좌우 마진            |
| `layout/screen-top`     | 16  | 헤더와 첫 섹션 사이       |
| `layout/screen-bottom`  | 48  | 화면 최하단 여유(넉넉)    |
| `layout/section-gap`    | 24  | 같은 표면 내 섹션 사이    |
| `layout/region-gap`     | 36  | 배경색이 바뀌는 영역 경계 |
| `layout/content-gap`    | 12  | 섹션 내부 요소 사이       |
| `card/padding`          | 16  | 카드 내부 패딩(기본)      |
| `card/padding-emphasis` | 20  | 메인·강조 카드 내부 패딩  |
| `card/gap`              | 12  | 리스트 형제 카드 사이     |

간격 위계: `card/gap 12 < card/padding 16 ≤ 20 < section-gap 24 < region-gap 36`.

### 1.5 Radius

**v2 스케일** (코드: `RADIUS` / tailwind `rounded-*`): `sm` 8 · `md` 10 · `lg` 12 · `xl` 16 · `2xl` 20 · `3xl` 24 · `full` 9999.

| 대상             | radius                       |
| ---------------- | ---------------------------- |
| 카드(inset)      | 12 (`lg`)                    |
| 카드(full-bleed) | 0                            |
| 버튼 S/M/L       | 10 (`md`)                    |
| 버튼 XL          | 12 (`lg`)                    |
| 바텀시트/모달    | 16~20 (`xl`/`2xl`)           |
| 배지 Round       | pill(9999)                   |
| 배지 Rectangle   | 4                            |
| 칩/입력          | 컴포넌트별 — Figma 확인      |

### 1.6 Elevation (drop shadow)

| 스타일         | offset | blur | color          |
| -------------- | ------ | ---- | -------------- |
| `shadow-card`  | 0, -1  | 12.7 | `#021C33` 6%   |
| `shadow-sheet` | 0, -1  | 15.8 | `#000000` 6%   |
| `shadow-bar`   | 0, -1  | 7.9  | `#000000` 6%   |
| `shadow-brand` | 0, 2   | 5    | `#5B12FF` 18% (퍼플 글로우) |

---

## 2. 레이아웃 & 간격 규칙 (이질감 방지 핵심)

### 2.1 화면 구조 / 컨테이너 모델

- 화면 폭 **375**. 콘텐츠 섹션을 **하나의 세로 오토레이아웃 컨테이너**로 묶고, 그 컨테이너의 padding·gap만 스페이싱 토큰으로 제어한다.
- 컨테이너: `paddingTop = screen-top(16)`, `paddingBottom = screen-bottom(48)`, 좌우 `screen-x(16)`, `gap = section-gap(24)`.
- 위치(상/중/하)별로 섹션 마진을 따로 주지 않는다 — 구조(컨테이너 padding + 균일 gap)가 해결.

### 2.2 간격의 단일 책임 (single source of truth)

한 간격은 정확히 한 주체만 만든다. **컨테이너 gap/padding** 또는 **섹션/영역 자기 마진** 중 하나. 둘 다 주면 이중으로 쌓여 어긋난다.

- 투명 래퍼(배경 없이 패딩만 있는 섹션)가 자체 상하 패딩을 들고 있으면 → 0으로 비우고 컨테이너 gap에 위임.
- 카드 내부 패딩(보이는 카드 박스 안쪽)은 유지(컨테이너 gap과 안 겹침).

### 2.3 뎁스 기반 간격 — 모델 A vs B

**판단 기준: "섹션 사이 빈 공간이 무슨 색이어야 하나?"**

- **모델 A — 컨테이너가 소유**: 빈 공간이 배경색이어도 되는 경우(배경 위에 떠 있는 카드). 섹션 외부 마진 0, 컨테이너 gap이 간격을 만든다. → 떠 있는 카드 레이아웃의 기본.
- **모델 B — 영역이 소유**: 빈 공간이 그 영역의 색이어야 하는 경우(가장자리까지 꽉 찬 **풀블리드 색상 밴드**). 컨테이너 gap = 0, 각 밴드가 자기 패딩으로 간격을 만든다. 밴드 사이를 컨테이너 gap으로 띄우면 그 공간에 페이지색이 끼어 이중/오색이 된다.

간격값 분기:

- 인접 섹션의 **배경색이 바뀌면**(예: 회색 영역 → 흰색 영역) = 뎁스 경계 → **region-gap 36** (끝나는 상단 영역의 하단 마진).
- **배경색이 같으면**(떠 있는 카드 둘이든, 흰 카드 내부 섹션이든) → **section-gap 24**.
- 한 페이지에 두 경우가 섞이면 오토레이아웃을 **중첩**: 바깥 컨테이너 gap = region-gap, 안쪽 = section-gap.

### 2.4 풀블리드 vs 떠 있는 카드

- **풀블리드 밴드**: 배경이 화면 좌우 끝까지 닿음(좌우 마진 0). → 모델 B.
- **떠 있는 카드(inset)**: 좌우 `screen-x(16)` 마진 두고 떠 있음, radius 12. → 모델 A.

---

## 3. 컴포넌트 계약

### Button (`btn`)

- variant 축: `type`(solid/outline) × `color`(primary/secondary/assistive/white/danger) × `state`(default/hover/pressed/disabled) × `size`(S/M/L/XL).
- **폭은 hug(콘텐츠+좌우패딩)**, 텍스트 center, 아이콘+텍스트 gap.

| size | height | 좌우 padding | 상하 | radius | gap |
| ---- | ------ | ------------ | ---- | ------ | --- |
| S    | 36     | 12           | 10   | 10     | 6   |
| M    | 40     | 14           | 10   | 10     | 6   |
| L    | 44     | 16           | 10   | 10     | 4   |
| XL   | 52     | 24           | 10   | 12     | 6   |

- **레이블 타이포(size별)**: 모두 Medium.

  | 버튼 size | 레이블             |
  | --------- | ------------------ |
  | S         | Lable_01/Medium    |
  | M         | Body_03/Medium     |
  | L         | Body_02/Medium     |
  | XL        | Body_02/Medium (L) |

  → **XL·L은 L 레이블(Body_02/Medium)**, M·S는 버튼 크기와 동일(M=Body_03/Medium, S=Lable_01/Medium).

색은 `button/{color}/{bg|text|border}-{state}` 토큰만 사용.

### Badge

| 타입          | height | 좌우   | 상하 | radius | text | gap |
| ------------- | ------ | ------ | ---- | ------ | ---- | --- |
| Round (pill)  | 28     | 6      | 4    | pill   | 13   | 10  |
| Rectangle S   | 22     | 6      | 3    | 4      | 12   | 10  |
| Rectangle M   | 26     | 6      | 3    | 4      | 13   | 10  |
| Round (state) | 32     | 10 / 8 | 6    | pill   | 14   | 4   |

색: `tag/{color}/{bg|fg|outline}`. Filled = bg+fg(테두리 없음), Outline = outline+fg(배경 없음).

### Card

| 종류            | radius | padding              | 비고                                               |
| --------------- | ------ | -------------------- | -------------------------------------------------- |
| inset 카드      | 12     | 12~16 (메인 카드 20) | 좌우 screen-x 16 마진, `bg/surface`, shadow `card` |
| full-bleed 카드 | 0      | 16                   | 화면 폭 꽉 참(모델 B)                              |

### 기타 컴포넌트 (Design System v2)

Input · Textarea · Searchfield · Header · Title · Tab · Segment · Calendar(monthly/weekly) · FAB · Toggle · Progressbar · Icon(16/20/24/28/44). 사용 시 해당 컴포넌트 인스턴스를 그대로 쓰고, 색·간격은 위 토큰을 따른다. (이 목록은 이름만 등록 — 인스턴스 재사용이 기본이고, 새로 그릴 땐 Figma 컴포넌트에서 사이즈·패딩 스펙을 직접 확인한다.)

### 화면 chrome

- **Statusbar**: 높이 47. 시스템 상태바.
- **Header** (`Header`): 높이 **48**, 좌우 **16** / 상하 **10**. variants: `main` · `title` · `calendar_sub` · `button`. 타이틀 = Title_01/SemiBold(18/26), 뒤로가기·액션 아이콘 포함.

### 섹션 타이틀 (`Title`)

사이즈 L/M/S + 선택적 보조문(Body_03/Regular), 둘 사이 gap 2. 좌우 패딩 없음(컨테이너 screen-x를 따름). 필드노트·상담일지 등 섹션 머리, **인풋 위 레이블**.

| size | 타이포               | 컬러            | 용도                    |
| ---- | -------------------- | --------------- | ----------------------- |
| L    | Title_01/SemiBold (18/26) | `title/default` | 섹션 헤딩               |
| M    | Body_01/SemiBold (16/24)  | `title/default` | 서브 헤딩               |
| S    | Body_03/Medium (14/20)    | `title/subtle`  | 캡션·라벨 · **인풋 위 레이블** |

→ 인풋(텍스트필드·단가·금액 등) 위 레이블은 **S(Body_03/Medium · title/subtle)** 사용.

### Segment (`Sagment` → Segment)

on/off. 높이 **32**, 좌우 12 / 상하 4, radius pill, gap 10. 텍스트 Body_03/Medium.

### Label chip (`Lable` → Label)

사이즈 XL/M/S, 높이 22, gap 4, Body_02/Medium. (배지와 별개의 인라인 라벨)

### 정보 행 패턴 (아이콘 + 라벨 + 값)

일정·장소·메모처럼 "아이콘(20/16) + 라벨 + 값"을 가로로 배치하는 반복 패턴. **컴포넌트가 아니라 레이아웃 패턴**. 아이콘 = icon/secondary·tertiary, 라벨·값 = text/label·body 토큰. 행 사이 간격은 카드 내부라 content-gap(12) 이하.

### 통계 / 차트

- 데이터 카테고리(상담·검사·노쇼 등)는 **전부 중립색**(text/icon 토큰). 색이 의미를 갖는 건 trend(방향)뿐 — §1.1 통계 색 규칙.
- 차트에서 분류를 나눌 때 **색(hue)으로 나누지 않는다.** 세그먼트 토글(전체/상담/검사) 또는 **명도**(진한/옅은 회색)로 구분. 색으로 쪼개면 "한 색 = 한 의미" 규칙이 깨진다.
- 막대 = 중립 회색(`text/body/default`), 최저값·특수 막대만 옅은 회색(`border/default`). 강조 막대 툴팁 = `bg/emphasis` 다크 버블 + `text/state/inverse` 글자(아래 포인터 포함).
- **추이 표시**: `지난달 대비 N건` + 방향 표시. 상승 ↑ `trend/up`(빨강) · 하강 ↓ `trend/down`(블루) · 보합 — `지난달과 동일`(숫자 생략) `trend/flat`(그레이). 화살표(↑↓)는 방향이 있을 때만, 보합은 대시(—).
- 요일 차트의 **주말 라벨(일)** 빨강은 캘린더 관례로 허용(데이터값이 아닌 라벨이라 trend 빨강과 충돌 아님).

### Bottom sheet (바텀시트)

보조 입력·작업(예: 검사 소견 작성)을 **풀스크린 전환 없이** 현재 컨텍스트 위에서 처리할 때 사용.

구성: **딤(scrim) → 시트 컨테이너 → 핸들 → 헤더 → 콘텐츠**

- **scrim(딤)**: 화면 전체 `bg/overlay`(검정 반투명). ⚠️ 현재 인스턴스는 40% 고정 → `bg/overlay`(Light 50%)로 정렬 권장.
- **시트 컨테이너**: 폭 375, **상단 모서리만 radius 16**(하단 0), 배경 `bg/surface`(현재 레거시 `Gray/White` → 마이그레이션), 그림자 effect `bottomsheet`(0/-1, blur 15.8, #000 6%).
- **핸들**: 상단 드래그 핸들, 높이 20.
- **헤더**: 높이 48 = 타이틀(Title_01/SemiBold) + 닫기(X) 아이콘. (핸들+헤더 합 **68**)
- **콘텐츠**: 패딩 t8 / b40 / l16 / r16, gap 16. 하단 40은 safe-area 여유.

높이: 콘텐츠에 따라 가변(hug), 화면 대부분까지. 길면 콘텐츠 영역만 스크롤.
언제 쓰나: 짧은 보조 입력/선택, 흐름을 끊지 않고 컨텍스트 유지가 필요할 때. **복잡하거나 단계가 많은 작업은 풀페이지로** 전환(예: 검사 상세는 페이지, 소견 작성은 바텀시트).

### 컴포넌트 내부 간격

섹션 간격(layout/_·card/_)과 별개로, 컴포넌트 안쪽 작은 간격은 space 스케일 **4 · 8 · 12**를 쓴다(아이콘–텍스트 4~8, 묶음 12). ⚠️ 현재 화면엔 `10`이 자주 쓰이는데 space 스케일에 없는 값 → 8 또는 12로 수렴 권장(§9 백로그).

---

## 4. 네이밍 / 주의

- 토큰 경로는 `group/role/variant` 형태(`text/body/default`, `button/primary/bg-default`).
- ⚠️ Figma 컴포넌트/스타일 이름에 오타가 있다: `Lable`→Label, `Sagment`→Segment, `Ractangle`→Rectangle, `montly`→monthly, `Thumnail`→Thumbnail. **코드에서는 올바른 철자(Label, Segment, Rectangle)를 사용**하고 Figma 이름과의 매핑만 기억한다.

## 5. Light / Dark

- 모든 색은 시멘틱 토큰으로 적용 → 모드별 값은 토큰이 처리(하드코딩 금지).
- 원시값은 **모드 공통 한 벌**(다크 전용 원시 세트 없음). 시멘틱이 모드별로 다른 원시 스텝을 가리킴. **Dark는 Light의 단순 반전이 아니라 토큰별 의도된 매핑.**
- **다크 튜닝 원칙 (채도 튐 방지)**:
  - 채도 높은 텍스트·아이콘(status·브랜드·버튼 텍스트)은 다크에서 **한 스텝 부드럽게**(예: 500 → 400).
  - 연한 채움(secondary 버튼 등 50·100·200)은 다크에서 **어두운 채움으로 뒤집음**(예: blue/100 → blue/900). 라이트 채움을 그대로 두면 다크 배경에서 튄다.
  - **primary CTA 채움은 다크에서도 vivid 유지**(의도적 강조).
  - 필요한 다크 톤이 스케일에 없으면 그 색만 **원시값 추가**(별도 다크 세트 만들지 않기).

## 6. Claude Code 구현 체크리스트

- [ ] 색: 시멘틱 토큰만 사용(legacy `Color/*`·primitive 직접 사용 금지). 레거시를 보면 §1.2로 대체.
- [ ] 텍스트: Pretendard + 적절한 텍스트 스타일 + 텍스트 컬러 토큰, leading trim ON.
- [ ] 스페이싱: 컨테이너 모델 + 단일 책임 + 모델 A/B 판단(배경색 경계 = region-gap 36 / 같은 배경 = section-gap 24).
- [ ] 화면 폭 375, 좌우 screen-x 16, 하단 screen-bottom 48.
- [ ] 컴포넌트는 기존 인스턴스 재사용(버튼/배지/카드/인풋), 스펙은 §3.
- [ ] 코드 토큰명이 위 토큰명과 1:1로 매칭되는지 확인.

---

## 7. 비주얼 언어 (디자인 원칙)

> 토큰·컴포넌트가 "무엇을 쓸지"라면, 이 절은 **"전체적으로 어떤 인상이어야 하는지"**. 새 페이지가 기존 화면과 "같은 앱"으로 느껴지게 하는 기준. 토큰이 맞아도 이 톤이 어긋나면 이질감이 난다.

### 7.1 브랜드 성격

**차분함 · 신뢰감(전문적) · 깔끔·절제 · 따뜻·친근 · 똑똑함.**
한 줄: "전문가가 안심하고 쓰는, 조용하고 단정하지만 따뜻한 도구. 핵심 AI 기능은 똑똑하고 프리미엄하게."

### 7.2 두 개의 톤 (가장 중요)

이 앱은 의도적으로 **톤을 둘로** 나눠 쓴다.

- **기본 톤 — 일반 페이지 (거의 모든 화면)**: 차분·깔끔·친근. 라이트, 회색 지배, 절제된 색, 아주 옅은 그림자, 카드 중심. **일관성이 최우선** — 튀지 않게.
- **차별화 톤 — 필드노트 (핵심 기능)**: 서비스 대표 기능이라 일부러 다르게 준다. 다크 배경 + 글래시한 3D 일러스트 + 은은한 글로우로 "똑똑하고 프리미엄"한 인상. **이 톤은 필드노트(및 그에 준하는 핵심 AI 기능)에만** 쓰고, 일반 페이지로 가져오지 않는다.

> 새 페이지 판단: **핵심 AI/필드노트 계열인가? → 차별화 톤. 그 외 전부 → 기본 톤.**

### 7.3 여백·밀도

넉넉한 여백, 잔잔한 리듬. 관련 정보는 카드로 묶어 시각적으로 그룹화. 한 화면에 욱여넣지 않는다(여유 있는 밀도). 섹션 간격은 §2 규칙을 따른다.

### 7.4 형태 언어

부드러운 라운드를 일관 적용 — 카드 12, 버튼 10~12, 배지 pill/4. 날카로운 직각·뾰족한 형태는 지양. 친근하고 안정적인 인상.

### 7.5 색 철학

중립 회색이 화면의 바탕. **색은 의미가 있을 때만** 절제해서 쓴다: 액션·링크 = 브랜드 블루, 위험·취소 = red, 완료 = green, 경고 = orange, 정보 = info. 장식 목적의 컬러 남용 금지. 브랜드 블루가 강조의 핵심 한 색.

- **은은한 그라디언트**: 밋밋함을 덜기 위해 **약하게** 사용 가능(카드/배경의 미묘한 톤 변화 등). 핵심은 "은은하게" — 채도·대비를 낮게. 눈에 띄게 화려하면 차분함이 깨진다.

### 7.6 뎁스 (그림자)

아주 옅은 그림자(4~6%, §1.6)로 거의 평평하게. 요소가 살짝만 떠 보이게 — calm. 필드노트 다크 톤은 글로우/글래스로 깊이감을 준다.

### 7.7 타이포·아이콘 인상

Pretendard + 좁은 자간(-0.41)으로 단정·모던. 명확한 위계(제목 진하게 → 본문 → 캡션 점점 연하게). 아이콘은 가는 선, muted 회색, 라벨과 짝지어 조용히. 아이콘만으로 강하게 강조하지 않는다.

### 7.8 일러스트·이미지

일러스트는 절제해서 포인트로만. 핵심 기능 인트로(필드노트)는 글래시·반투명 3D + 은은한 글로우로 프리미엄. 일반 화면은 일러스트 최소화, 필요하면 단순·중립적으로.

### 7.9 콘텐츠 톤·말투

친근하고 안심시키는 존댓말("~해요 / ~할 수 있어요"). 빈/비활성 상태도 부드럽게 설명한다("취소된 상담은 일지를 작성할 수 없어요"). 명령조·딱딱한 표현 지양, 전문 용어는 필요한 만큼만.

### 7.10 do / don't

**Do**

- 회색 바탕 + 절제된 의미색 + 브랜드 블루 강조.
- 부드러운 라운드, 옅은 그림자, 넉넉한 여백.
- 밋밋하면 **은은한** 그라디언트로 살짝 변화.
- 필드노트/핵심 AI는 다크·프리미엄 톤으로 차별화.
- 친근한 존댓말 카피.

**Don't**

- 일반 페이지에 강한 색·진한 그림자·화려한 그라디언트.
- 필드노트의 다크·글래시 톤을 일반 페이지에 적용.
- 장식용 컬러 남발, 날카로운 직각, 빽빽한 밀도.
- 딱딱한 명령조 카피.

---

## 8. 코드 매핑 (Expo · NativeWind · styled-components)

스택: **Expo (React Native)** + **NativeWind**(RN용 Tailwind) + **styled-components/native**.

### 8.1 원칙 — 토큰 단일 소스

색·간격·radius·타이포 값을 한 파일(`theme/tokens.ts`)에 정의하고, 거기서 **NativeWind config**와 **styled-components theme**를 **둘 다 생성**한다. 두 곳에 값을 따로 적으면 어긋난다(= 이질감의 코드 버전). Figma 변수가 바뀌면 이 토큰 파일만 갱신하면 양쪽에 반영된다.

### 8.2 네이밍 변환 규칙

Figma 경로 `group/role/variant` →

- **NativeWind**: kebab 클래스. `text/body/default` → `text-body-default`, `bg/surface` → `bg-surface`, `layout/section-gap` → spacing 키 `section-gap`.
- **styled-components**: 객체 경로(camelCase). `theme.color.text.body.default`, `theme.spacing.sectionGap`, `theme.radius.card`.

### 8.3 색 — Light/Dark

시멘틱 토큰은 모드별 값이 다르므로 모드별 팔레트(light/dark)를 두고 런타임에 스왑한다. **컴포넌트에서 hex 하드코딩 금지** — 항상 토큰 클래스/테마 경로 사용.

- NativeWind: `darkMode` + `useColorScheme()` 기반 전환.
- styled-components: `<ThemeProvider theme={scheme === 'dark' ? darkTheme : lightTheme}>`.

### 8.4 매핑 예시

| Figma 토큰            | NativeWind                        | styled-components                      |
| --------------------- | --------------------------------- | -------------------------------------- |
| text/body/default     | `text-body-default`               | `theme.color.text.body.default`        |
| text/state/brand      | `text-state-brand`                | `theme.color.text.state.brand`         |
| bg/surface            | `bg-surface`                      | `theme.color.bg.surface`               |
| border/default        | `border-default`                  | `theme.color.border.default`           |
| action/primary        | `bg-action-primary`               | `theme.color.action.primary`           |
| status/danger         | `text-status-danger`              | `theme.color.status.danger`            |
| tag/blue/bg · outline | `bg-tag-blue` · `border-tag-blue` | `theme.color.tag.blue.bg` / `.outline` |
| layout/screen-x       | `px-screen-x`                     | `theme.spacing.screenX`                |
| layout/section-gap    | `gap-section-gap`                 | `theme.spacing.sectionGap`             |
| layout/region-gap     | `gap-region-gap`                  | `theme.spacing.regionGap`              |
| card/padding          | `p-card`                          | `theme.spacing.cardPadding`            |
| radius card(12)       | `rounded-card`                    | `theme.radius.card`                    |
| Body_02 (15/22)       | `text-body-02`                    | `theme.typography.body02`              |

### 8.5 tailwind.config 발췌

```js
// theme/tokens.ts 의 값을 import 해서 채운다
extend: {
  colors: {
    'bg-surface': colors.bg.surface,
    'text-body-default': colors.text.body.default,
    'action-primary': colors.action.primary,
    // ...semantic 토큰 전부
  },
  spacing: {
    'screen-x': 16, 'screen-top': 16, 'screen-bottom': 48,
    'section-gap': 24, 'region-gap': 36, 'content-gap': 12,
    'card': 16, 'card-emphasis': 20, 'card-gap': 12,
  },
  borderRadius: { card: 12, 'btn-s': 10, 'btn-m': 10, 'btn-l': 10, 'btn-xl': 12 },
}
```

### 8.6 폰트·트림 (RN 주의)

- Pretendard를 `expo-font`로 로드. letter-spacing **-0.41**.
- RN엔 CSS `text-box-trim`이 없다. leading trim 대응: 텍스트 스타일별 line-height를 명시하고, Android는 `includeFontPadding: false`로 유령 여백 제거. 세로 간격은 §2 규칙대로 **레이아웃(flex `gap`/`padding`)**으로 만든다(텍스트 자체 여백에 의존하지 않기).

### 8.7 RN 구현 매핑

- **그림자**: RN은 iOS(`shadowColor/Opacity/Radius/Offset`) + Android(`elevation`)로 분리. §1.6 값을 두 플랫폼에 맞춰 변환.
- **컨테이너 모델(§2.1)**: `flexDirection: column` + `gap`(=section-gap/region-gap 토큰) + `padding`(=screen-x/top/bottom)으로 구현. 모델 B(풀블리드 밴드)는 밴드 컴포넌트 자체 padding, 컨테이너 gap 0.
- **버튼 hug**: RN에선 기본이 콘텐츠 크기(hug)라 별도 width 없이 padding(좌우 12~24)으로 폭 결정 — §3 버튼 스펙 그대로.

---

## 9. 마이그레이션 백로그 (화면 → 시스템)

> 이 MD는 도달해야 할 **기준(north star)**. 최신 화면(`♻️ V1 Refactor`)도 아직 시스템이 완전히 반영되지 않은 마이그레이션 중이다. 아래는 화면을 기준에 맞추기 위한 정리 항목 — **MD를 고치는 게 아니라 화면/시스템을 정리**하는 작업.
>
> **처리 현황**: 안전 항목(이름 오타 · 바텀시트 토큰화 · 버튼 M radius) ✅ 완료. 텍스트 끊김은 안전한 970개 복원 완료, 잔여 ~180개(inverse·button·status·legacy)는 토큰 모호로 보류. 나머지(레거시 Color 일괄 · 간격 토큰화 · 컨테이너 모델 · space/10 · 화면 radius)는 **실제 화면을 대량 변경**하는 작업이라 깨질 위험이 있어 신중히 별도 진행. **행간 trim**은 이 환경에서 Pretendard 로드 불가 → Figma 데스크톱에서 텍스트 스타일에 적용.

- [ ] **레거시 Color 제거**: 화면의 `Color/*` 참조(약 710회)를 §1.2 매핑대로 새 시멘틱 토큰으로 교체.
- [ ] **간격 토큰화**: off-scale 간격(섹션 12/20/28, 헤더 패딩 10 등)을 토큰 스케일(screen-top 16 / section-gap 24 / region-gap 36 / content-gap 12)로 정렬.
- [ ] **컨테이너 모델 적용**: 루트 수동 배치 → §2.1 세로 오토레이아웃 컨테이너로 전환(단일 책임·모델 A/B).
- [ ] **space/10 정리**: 스케일에 없는 `10`(gap·padding 다수) → 8 또는 12로 수렴, 또는 토큰으로 정식 추가 결정.
- [~] **radius 정리**: 버튼 M radius 9→10 **✅ 완료**(M 변형 28개). 화면에 산재한 16·24는 남음 → radius 체계로 수렴.
- [ ] **행간 trim 적용**: 텍스트 스타일에 leading trim(Cap height) 표준 적용(§1.3) / RN은 line-height + `includeFontPadding:false`.
- [x] **이름 오타 정리 ✅ 완료**: Lable→Label · Sagment→Segment · Badge/Ractangle→Badge/Rectangle · Calendar/montly→Calendar/monthly · 페이지 Thumnail→Thumbnail.
- [x] **바텀시트 정렬 ✅ 완료**: scrim → `bg/overlay`, 시트 배경 → `bg/surface` 토큰 바인딩 (시트 34 · 딤 48).
- [ ] **텍스트 끊김 잔여 재바인딩**: V1 Refactor 본문 텍스트 970개는 최종 토큰(text/title·body·caption·label)으로 복원 완료. 남은 ~180개(inverse·button·status·legacy black 계열)는 각 토큰(`text/state/inverse`·`button/*`·`status/*`)으로 마저 재바인딩. 다른 페이지(전문가 앱·내담자 앱)도 동일 작업 필요.

> 신규 페이지는 위 항목을 처음부터 지켜서 만들면 된다. 기존 화면 마이그레이션은 별도 작업으로 점진 적용.
