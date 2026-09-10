# 🎨 컬러 시스템 v2 — Figma 정리본

> ✅ **코드 반영 완료 (2026.06.23)**. 토큰 단일 소스 = [tokens.js](../src/shared/constants/tokens.js) → [theme.ts](../src/shared/constants/theme.ts)(`COLORS`) + [tailwind.config.js](../tailwind.config.js)(className)가 여기서 생성됨. 값 수정은 tokens.js에서만.
> 적용 범위: **Light 전용**(앱 전역 다크 미지원, 필드노트 스킨만 별도). 모드는 Light 값만 코드화.
> 기존 화면은 `fg`/`stroke` 등 전환용 alias로 동작 중 — v2 role 재분류 이전 진행 중. **신규 코드는 v2 토큰만 사용**.
>
> 출처: Figma `전문가용 앱` › **🎨 Design System v2** (`IkfJgJxLJmAqulk3p3leon`, node `2744-2905`)
> 추출일: 2026.06.23 · Primitive는 변수 바인딩, Semantic/Tag/Button은 Light/Dark 텍스트 정의에서 추출.
> 아키텍처: **Primitive(원시값) → Semantic(역할) 2계층**. 화면에는 **semantic만** 적용, primitive 직접 사용 금지.
> 브랜드 기준색: **blue/500 `#4486FF`** (cyan 아님 — [docs/design.md](design.md) 기준 확정).

---

## 📌 현행 [design.md](design.md) 대비 주요 변경점

| # | 토큰 | 기존(design.md) | v2(Figma) | 메모 |
|---|------|----------------|-----------|------|
| 1 | `bg/emphasis` | L gray/900 · D gray/50 | **L gray/800 · D gray/100** | 진한 채움 한 단계 부드럽게 |
| 2 | **Tag 색상** | hue만 규정(값은 Figma) | **전용 hue 고정** (blue `#2872F8`, green `#12BA54`, purple `#7C4DFF`, red `#FF4545` …) | status·primitive와 **다른** 독립 hue로 확정 |
| 3 | Elevation | card 4% · bottomsheet · floating | **shadow-card 6%** · shadow-sheet · **shadow-bar(신규)** · **shadow-brand(신규, 퍼플 글로우)** | `floating` 제거, brand 글로우 추가 |
| 4 | Radius | card 12 · btn 10/12 · badge | **풀 스케일** sm8 / md10 / lg12 / xl16 / 2xl20 / 3xl24 / full36 | 정식 스케일화 |
| 5 | `button/secondary` | (미정의) | **blue 틴트** (bg blue/100, text blue/500) | 블루 secondary 정식 정의 |
| 6 | `navy/deep` 추가 | — | `#0B1754` | brand/accent primitive 신규 |

> 위 외 Text/Icon/Status/Action/Border는 design.md와 대체로 동일. 적용은 diff 합의 후 진행 예정.

---

## 1. Primitive Colors

> 이름이 값을 설명. 변수에 라이브 바인딩됨. **컴포넌트에서 직접 사용 금지** (semantic 경유).

### Gray
| 토큰 | HEX | | 토큰 | HEX |
|------|-----|---|------|-----|
| `gray/0` | `#FFFFFF` | | `gray/500` | `#7D848F` |
| `gray/50` | `#F5F7F8` | | `gray/600` | `#58626C` |
| `gray/75` | `#F0F3F5` | | `gray/700` | `#464F58` |
| `gray/100` | `#E9EEF0` | | `gray/800` | `#2D333B` |
| `gray/200` | `#E3EAEF` | | `gray/900` | `#1D2227` |
| `gray/300` | `#D1D5DB` | | `gray/950` | `#171717` |
| `gray/400` | `#AAB2BE` | | | |

### Blue (브랜드)
| 토큰 | HEX | | 토큰 | HEX |
|------|-----|---|------|-----|
| `blue/50` | `#F4F8FF` | | `blue/500` ★ | `#4486FF` |
| `blue/100` | `#E5EEFF` | | `blue/600` | `#2566DD` |
| `blue/200` | `#C8DAFA` | | `blue/700` | `#144CB1` |
| `blue/300` | `#8CB5FF` | | `blue/800` | `#0A3788` |
| `blue/400` | `#689DFF` | | `blue/900` | `#052561` |

### Brand / Accent · Mint
| 토큰 | HEX | | 토큰 | HEX |
|------|-----|---|------|-----|
| `navy/deep` | `#0B1754` | | `mint/300` | `#8CE0E0` |
| `purple/500` | `#9B5DFF` | | `mint/400` | `#59CED8` |
| `purple/400` | `#B388FF` | | `mint/500` | `#00C3BC` |
| | | | `mint/600` | `#009B96` |

### Status
| 토큰 | HEX | | 토큰 | HEX |
|------|-----|---|------|-----|
| `red/50` | `#FFECEC` | | `green/500` | `#00BF40` |
| `red/400` | `#FF6B6B` | | `orange/50` | `#FFF3E5` |
| `red/500` | `#FF4242` | | `orange/400` | `#FFA733` |
| `green/50` | `#E5F8EC` | | `orange/500` | `#FF9200` |
| `green/400` | `#33D16A` | | `sky/50` | `#E5F4FF` |
| `sky/400` | `#47B4FF` | | `sky/500` | `#0E9BFF` |

### Alpha
| 토큰 | 값 |
|------|----|
| `alpha/black-50` | `#000000` · 50% |
| `alpha/black-60` | `#000000` · 60% |
| `alpha/red-16` | `#FF4242` · 16% |
| `alpha/green-16` | `#00BF40` · 16% |
| `alpha/orange-16` | `#FF9200` · 16% |
| `alpha/sky-16` | `#0E9BFF` · 16% |

---

## 2. Semantic Colors

> 색 토큰 고르는 순서: ① 특수 상태/면 위 → `text/state/*`(disabled·inverse·on-primary·brand) ② 아니면 타입 기본색 `text/{body·title·label·caption}/*` (default 기본 / strong 강조 / subtle 보조).
> 표기: **L** = Light, **D** = Dark. 화살표(→)는 다른 semantic 토큰 참조.

### Text
| 토큰 | Light | Dark |
|------|-------|------|
| `text/headline` | gray/900 `#1D2227` | gray/50 `#F5F7F8` |
| `text/title/default` | gray/900 `#1D2227` | gray/50 `#F5F7F8` |
| `text/title/subtle` | gray/600 `#58626C` | gray/400 `#AAB2BE` |
| `text/body/strong` | gray/900 `#1D2227` | gray/50 `#F5F7F8` |
| `text/body/default` | gray/600 `#58626C` | gray/400 `#AAB2BE` |
| `text/body/subtle` | gray/500 `#7D848F` | gray/500 `#7D848F` |
| `text/caption/default` | gray/500 `#7D848F` | gray/500 `#7D848F` |
| `text/caption/subtle` | gray/400 `#AAB2BE` | gray/600 `#58626C` |
| `text/label/strong` | gray/900 `#1D2227` | gray/50 `#F5F7F8` |
| `text/label/default` | gray/600 `#58626C` | gray/400 `#AAB2BE` |
| `text/placeholder` | gray/400 `#AAB2BE` | gray/600 `#58626C` |
| `text/state/inverse` | gray/0 `#FFFFFF` | gray/900 `#1D2227` |
| `text/state/on-primary` | gray/0 `#FFFFFF` | gray/0 `#FFFFFF` |
| `text/state/brand` | blue/500 `#4486FF` | blue/400 `#689DFF` |
| `text/state/disabled` | gray/400 `#AAB2BE` | gray/600 `#58626C` |

### Icon
| 토큰 | Light | Dark |
|------|-------|------|
| `icon/primary` | gray/500 `#7D848F` | gray/400 `#AAB2BE` |
| `icon/secondary` | gray/400 `#AAB2BE` | gray/500 `#7D848F` |
| `icon/tertiary` | gray/300 `#D1D5DB` | gray/600 `#58626C` |
| `icon/brand` | → text/state/brand | → text/state/brand |
| `icon/inverse` | → text/state/inverse | → text/state/inverse |
| `icon/on-primary` | → text/state/on-primary | → text/state/on-primary |
| `icon/disabled` | → text/state/disabled | → text/state/disabled |
| `icon/info` | → status/info | → status/info |
| `icon/danger` | → status/danger | → status/danger |
| `icon/success` | → status/success | → status/success |
| `icon/warning` | → status/warning | → status/warning |

### Background
| 토큰 | Light | Dark |
|------|-------|------|
| `bg/base` | gray/50 `#F5F7F8` | gray/950 `#171717` |
| `bg/surface` | gray/0 `#FFFFFF` | gray/900 `#1D2227` |
| `bg/surface-raised` | gray/0 `#FFFFFF` | gray/800 `#2D333B` |
| `bg/surface-sunken` | gray/50 `#F5F7F8` | gray/800 `#2D333B` |
| `bg/overlay` | alpha/black-50 | alpha/black-60 |
| `bg/selected` | blue/500 `#4486FF` · 8% | blue/400 `#689DFF` · 12% |
| `bg/emphasis` | gray/800 `#2D333B` | gray/100 `#E9EEF0` |
| `bg/emphasis-subtle` | gray/100 `#E9EEF0` | gray/700 `#464F58` |

### Border
| 토큰 | Light | Dark |
|------|-------|------|
| `border/subtle` | gray/100 `#E9EEF0` | gray/800 `#2D333B` |
| `border/default` | gray/200 `#E3EAEF` | gray/700 `#464F58` |
| `border/strong` | gray/300 `#D1D5DB` | gray/600 `#58626C` |
| `border/active` | → action/primary | → action/primary |

### Action
| 토큰 | Light | Dark |
|------|-------|------|
| `action/primary` | blue/500 `#4486FF` | blue/500 `#4486FF` |
| `action/primary-hover` | blue/600 `#2566DD` | blue/400 `#689DFF` |
| `action/primary-subtle` | blue/100 `#E5EEFF` | blue/900 `#052561` |
| `action/disabled` | gray/200 `#E3EAEF` | gray/700 `#464F58` |

### Status
| 토큰 | Light | Dark |
|------|-------|------|
| `status/danger` | red/500 `#FF4242` | red/400 `#FF6B6B` |
| `status/danger-bg` | red/50 `#FFECEC` | alpha/red-16 |
| `status/info` | sky/500 `#0E9BFF` | sky/400 `#47B4FF` |
| `status/info-bg` | sky/50 `#E5F4FF` | alpha/sky-16 |
| `status/success` | green/500 `#00BF40` | green/400 `#33D16A` |
| `status/success-bg` | green/50 `#E5F8EC` | alpha/green-16 |
| `status/warning` | orange/500 `#FF9200` | orange/400 `#FFA733` |
| `status/warning-bg` | orange/50 `#FFF3E5` | alpha/orange-16 |

### Accent
| 토큰 | Light | Dark |
|------|-------|------|
| `accent/fieldnote` | purple/500 `#9B5DFF` | purple/400 `#B388FF` |

### Trend (통계 상승/하강)
> 방향 전용. status와 재사용 금지. 한국식: 상승=빨강 / 하강=블루. 데이터 카테고리는 중립(블랙).

| 토큰 | Light | Dark |
|------|-------|------|
| `trend/up` | red/500 `#FF4242` | red/400 `#FF6B6B` |
| `trend/up-bg` | `#FF4242` · 8% | `#FF6B6B` · 16% |
| `trend/down` | blue/500 `#4486FF` | blue/400 `#689DFF` |
| `trend/down-bg` | `#4486FF` · 8% | `#689DFF` · 16% |
| `trend/flat` | gray/500 `#7D848F` | gray/400 `#AAB2BE` |

---

## 3. Button

> 패턴: `button/{color}/{role}-{state}` · role = bg·text·border·icon · state = default·hover·pressed·disabled.

### primary
| role | default | hover | pressed | disabled |
|------|---------|-------|---------|----------|
| bg | blue/500 | blue/400 | blue/600 | gray/100 |
| text | gray/0 | gray/0 | gray/0 | gray/400 |

### secondary (blue 틴트)
| role | default | hover | pressed | disabled |
|------|---------|-------|---------|----------|
| bg | L blue/100 · D blue/900 | L blue/50 · D blue/900 | L blue/200 · D blue/800 | L blue/100 · D blue/900 |
| text | L blue/500 · D blue/400 | L blue/400 · D blue/400 | L blue/600 · D blue/400 | L blue/300 · D blue/700 |

### assistive
| role | default | hover | pressed | disabled |
|------|---------|-------|---------|----------|
| bg | L gray/75 · D gray/100 | gray/50 | gray/200 | gray/50 |
| text | gray/700 | gray/700 | gray/700 | gray/400 |

### outline
| role | default | hover | pressed | disabled |
|------|---------|-------|---------|----------|
| bg | (투명) | gray/50 | gray/100 | (투명) |
| border | gray/200 | gray/200 | gray/200 | gray/100 |
| text | gray/700 | gray/700 | gray/700 | gray/400 |

### white
| role | default | hover | pressed | disabled |
|------|---------|-------|---------|----------|
| bg | gray/0 | gray/50 | gray/200 | gray/50 |
| text | gray/700 | gray/700 | gray/700 | gray/400 |

### danger (옅은 채움 + 테두리)
| role | default | hover | pressed | disabled |
|------|---------|-------|---------|----------|
| bg | — | `#FF4242` 6% | `#FF4242` 12% | — |
| border | `#FF4242` 20% | `#FF4242` 60% | `#FF4242` 80% | `#FF4242` 12% |
| text | L red/500 · D red/400 | L red/500 · D red/400 | L red/500 · D red/400 | `#FF4242` 20% |

### billing (mint teal)
| role | default | hover | pressed | disabled |
|------|---------|-------|---------|----------|
| bg | `#00C3BC` 10% | `#00C3BC` 6% | `#00C3BC` 16% | `#00C3BC` 6% |
| icon | mint/400 | L mint/300 · D mint/400 | L mint/500 · D mint/400 | mint/300 |
| text | L mint/500 · D mint/400 | mint/400 | L mint/600 · D mint/400 | mint/300 |

---

## 4. Tag / Badge Colors

> 텍스트=fg(메인), 배경=fg의 opacity 버전. bg·outline은 색마다 명도 균일화(불투명도 다름).
> 규칙: **Filled = bg+fg(테두리 없음)**, **Outline = outline+fg(배경 없음)**.
> ⚠️ 아래는 **Light** 값. Dark는 Filled 14–27% / Outline 30–60%로 더 진하게 (색별 정확값은 Figma 스와치 참조).

| color | fg | bg(Filled) | outline |
|-------|-----|-----------|---------|
| gray | `#606A74` | fg 6% | fg 26% |
| blue | `#2872F8` | fg 6% | fg 27% |
| indigo | `#564DF9` | fg 6% | fg 26% |
| purple | `#7C4DFF` | fg 6% | fg 26% |
| pink | `#F53188` | fg 7% | fg 29% |
| red | `#FF4545` | fg 7% | fg 30% |
| orange | `#F88F16` | fg 8% | fg 36% |
| amber | `#C2890A` | fg 7% | fg 31% |
| green | `#12BA54` | fg 8% | fg 34% |
| teal | `#00B5A5` | fg 8% | fg 34% |

> 💡 Tag hue는 status/primitive와 **다른 전용 색**이다. 예: tag/blue `#2872F8` ≠ blue/500 `#4486FF`, tag/red `#FF4545` ≠ red/500 `#FF4242`, tag/green `#12BA54` ≠ green/500 `#00BF40`.

### Badge 사이즈 (px)
| type | height | 좌우 | 상하 | radius | text | gap |
|------|--------|------|------|--------|------|-----|
| Round (pill) | 28 | 6 | 4 | pill | 13 | 10 |
| Rectangle S | 22 | 6 | 3 | 4 | 12 | 10 |
| Rectangle M | 26 | 6 | 3 | 4 | 13 | 10 |
| Round (state) | 32 | 10/8 | 6 | pill | 14 | 4 |

---

## 5. 부록 — 비-컬러 토큰 (v2)

### Radius
| 토큰 | 값 | | 토큰 | 값 |
|------|----|--|------|----|
| `radius-sm` | 8px | | `radius-xl` | 16px |
| `radius-md` | 10px | | `radius-2xl` | 20px |
| `radius-lg` | 12px | | `radius-3xl` | 24px |
| | | | `radius-full` | 36px (9999) |

### Elevation / Shadow
| 토큰 | offset | blur | color |
|------|--------|------|-------|
| `shadow-card` | 0, -1 | 12.7 | `#021C33` 6% |
| `shadow-sheet` | 0, -1 | 15.8 | `#000000` 6% |
| `shadow-bar` | 0, -1 | 7.9 | `#000000` 6% |
| `shadow-brand` | 0, 2 | 5 | `#5B12FF` 18% (퍼플 글로우) |

### Spacing
**Primitive** (4px 그리드): `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 20 · `space-6` 24 · `space-7` 28 · `space-8` 32 · `space-12` 48

**Semantic (layout)**: `screen-top` 16 · `section-gap` 24 · `region-gap` 36 · `screen-bottom` 48 · `screen-x` 16 · `content-gap` 12
**Card**: `card/padding` 16 · `card/padding-emphasis` 20 · `card/gap` 12
간격 위계: `card/gap`(12) < `card/padding`(16) ≤ `card/padding-emphasis`(20) < `section-gap`(24) < `region-gap`(36)

### Typography
폰트 **Pretendard** · letter-spacing **-0.41** 공통.

| 토큰 | size / line | weight |
|------|-------------|--------|
| `headline-semibold` | 28 / 36, 24 / 36 | SemiBold |
| `title-01-light` | 48 / 52 | Light |
| `title-01-semibold` · `-medium` | 20 / 28 | SemiBold · Medium |
| `title-02-bold` · `-semibold` | 18 / 26 | Bold · SemiBold |
| `body-01-semibold` · `-medium` · `-regular` | 16 / 24 | — |
| `body-01-reading` | 16 / 26 | Regular |
| `body-02-semibold` · `-medium` · `-regular` | 15 / 22 | — |
| `body-02-reading` | 15 / 24 | Regular |
| `body-03-semibold` · `-medium` · `-regular` | 14 / 20 | — |
| `label-01-semibold` · `-medium` · `-regular` | 13 / 20 | — |
| `label-02-medium` · `-regular` | 12 / 16 | — |
| `caption-01-regular` | 11 / 14 | Regular |

---

## 코드 적용 시 (다음 단계)

이 문서는 **Figma 추출 정리본(검토용)**이다. 실제 반영 대상은:
- [tailwind.config.js](../tailwind.config.js) · [theme.ts](../src/shared/constants/theme.ts) — 코드 토큰 (항상 1:1 동기)
- [design.md](design.md) · [CLAUDE.md](../CLAUDE.md) §1 — 기준 문서

> 적용 전 변경점(위 §0 표) 합의 후 진행. 컬러는 영향 범위가 넓어 diff 확인 필수.
