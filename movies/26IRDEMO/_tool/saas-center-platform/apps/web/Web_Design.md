---
name: (서비스명 TBD)
design_system_name: (디자인시스템명 TBD)
slug: counseling-saas
category: saas
last_updated: "2026-07-06"
sources:
  - Figma "SaaS V.2 통합" / 페이지 "✅ 0629 수정사항" (fileKey BqDw2oIuUXjenZxHSezjtj)
lang: ko
---

# (디자인시스템명 TBD) — design.md

> 국내 상담(counseling) SaaS 웹 제품의 디자인 시스템. 본 문서는 Figma "✅ 0629 수정사항" 페이지에 **실제 등록된 토큰·타이포·컴포넌트 실측값**을 1차 출처로 추출·합성한 결과다. AI 코딩 에이전트가 이 문서만 읽고 UI를 생성해도 기존 디자인과 이질감이 없도록 설계되었다.

정체성은 **light-first, token-driven, Pretendard-Korean** 으로 요약된다. light-first는 1차 환경이 화이트 캔버스이고 다크 모드는 아직 정의되지 않았다는 의미다. token-driven은 product-facing 색이 모두 시맨틱 alias로만 노출되고 raw 팔레트는 새 role을 만들 때만 직접 참조된다는 정책을 가리킨다. 표면은 흰 카드 + 옅은 페이지 배경 + 1px 헤어라인으로 분리되며, 색은 절제되어 상태(primary CTA, status badge, tag)에만 쓰인다.

## Brand & Style

본 제품은 시스템 정체성을 **light-first, token-driven, Pretendard-Korean, information-dense** 로 정의한다. light-first는 1차 환경이 화이트 캔버스이고 다크 모드는 아직 정의되지 않았다는 의미다. token-driven은 product-facing 색이 모두 시맨틱 alias로만 노출되고 raw 팔레트는 새 role을 만들 때만 직접 참조된다는 정책이다. information-dense는 상담 워크플로우 특성상 표·리스트·폼·상세 패널처럼 정보 밀도가 높은 표면이 화면의 중심이라는 뜻이다.

대상 도메인은 **상담센터 운영**이다 — 상담·발달치료, 검사(assessment), 일정, 회원, 청구(voucher/expense), 필드노트 등 모듈이 단일 시각 언어를 공유한다. 사용자는 센터 관리자·상담사가 1차이며, 내담자 관리와 기록이 핵심 과업이다.

전체 무드는 **bright, soft white** 다. 정보 밀도가 높은 표면은 **흰 카드(`{color.bg-surface}`) 위에 옅은 페이지 배경(`{color.bg-base}`, gray-050), 1px 헤어라인(`{color.border-default}`)으로 분리**하는 패턴이며, 색은 절제되어 시맨틱 팔레트는 상태(status badge·tag·primary CTA·청구 mint)에만 쓴다. 표면 위계는 색이 아니라 그림자로 구분한다.

**장식 정책** — 데이터 밀도가 높은 기능 화면에서는 장식을 절제한다. 일러스트·그래픽은 **빈 상태·온보딩·카드 포인트 등 특정 지점에만** 사용한다. 그라디언트·글래스/블러(`backdrop-filter`)는 시스템 표면에 쓰지 않으며, 트랜스페어런시는 모달/오버레이 딤(`{color.bg-overlay}`)과 아래 **떠 있는 층 예외**에만 허용한다.

> **🔴 예외 — 떠 있는 층(sticky·floating)의 글래스 (2026-09-03 등재).** 스크롤되는 콘텐츠가 **실제로 그 밑을 지나는 층**은 반투명 + `backdrop-filter`를 쓴다. 그 층이 위에 떠 있다는 사실을 그림자만으로 암시하는 것보다, 밑이 비쳐 지나가는 것으로 보여주는 편이 정확하다. 해당 층: `FloatingFilterBar`(목록 필터 바) · `Table` sticky 헤더 · `CareBoardDock` · 대시보드 응답 대기함 배너.
>
> | 항목 | 규칙 |
> |---|---|
> | 대상 | `sticky`/`fixed`로 **콘텐츠 위에 얹힌 층만**. 일반 카드·패널·모달 본문은 해당 없음 |
> | 면 색 | 그 층이 놓인 **캔버스 색**을 따른다 — 회색 캔버스 위 크롬은 `bg-gray-50/80`, 유채색 캔버스 위 카드형 층은 `bg-white/75` |
> | 블러 | **12~24px**(`backdrop-blur-md`~`xl`). 액션(버튼·링크)을 품은 층일수록 세게 — 밑을 지나는 것이 색 덩어리로 뭉개져야 레이블이 어수선한 배경 위에 놓이지 않는다 |
> | 불투명도 하한 | 텍스트·액션이 있으면 **/75 이상**. `/50`은 면이 없는 크롬(도크)에만 |
>
> - **무채색 캔버스 위에서는 쓰지 않는다** — 흰 카드가 흰 반투명 밑을 지나면 효과는 없고 스크롤 repaint 비용만 남는다. 밑색이 유채색이거나 캔버스와 층의 색이 다를 때만 값을 한다.
> - ⚠️ **조상에 `backdrop-filter`가 있으면 자손의 `position: fixed`가 그 조상 기준으로 잡힌다** — 뷰포트 좌표로 위치를 계산하는 툴팁·드롭다운이 통째로 밀린다(필드노트 시트 실사고, `Tooltip.svelte` 주석). 글래스 층 안에 그런 요소를 넣지 않는다. **일러스트·그래픽 자산의 색은 토큰화하지 않는다** — 아트워크 원본 색을 그대로 두고, 시맨틱 토큰은 UI 요소에만 바인딩한다.

**Voice** — UI 텍스트는 **한국어 전용**(영문 병기 없음)이다. 본문·안내문은 **해요체**(~해요/~예요)로, 부드럽고 친근하되 신뢰감 있는 톤을 유지한다(딱딱한 ~합니다체보다 한 단계 낮춘 존댓말). 버튼은 짧고 명확하게(예: "저장", "삭제", "청구하기"), 상태 라벨은 명사형(완료·진행중·취소·진행전)으로 통일한다. 과장된 마케팅 표현("혁신적", "최고의")은 product 카피에 쓰지 않는다.

> 본 메타 문서 자체는 서술 편의상 `~다` 평서체로 기술한다. 해요체 정책은 product surface 카피에 한해 적용된다.

## Colors

토큰은 **2계층**이다 — raw `Primitive 팔레트` 위에 product-facing `Semantic alias`를 얹는다. **화면·컴포넌트는 시맨틱 alias만 호출**하고, raw 팔레트는 새 role을 정의할 때만 직접 참조한다. 브랜드 primary는 **primary-500 `#2979FF`**, 청구(billing) 강조는 **mint-500 `#00ACA6`**, 필드노트 accent는 **purple-500 `#9B5DFF`** 다. 다크 모드는 미정의(라이트 전용).

### Primitive palette

```yaml
# Gray — 표면·텍스트·보더의 기반
gray-050: "#F5F7F8"
gray-075: "#F0F3F5"
gray-100: "#EDF0F4"
gray-200: "#DFE4EA"
gray-300: "#D4DBE2"
gray-400: "#AAB2BE"
gray-500: "#7D848F"
gray-600: "#58626C"
gray-700: "#464F58"
gray-800: "#2D333B"
gray-900: "#191C22"
white:    "#FFFFFF"
black:    "#171717"

# Primary (Blue) — 브랜드 primary, link, focus
primary-050: "#F4F8FF"
primary-100: "#E5EEFF"
primary-200: "#CFE0FF"
primary-300: "#A9CAFF"
primary-400: "#68A0FF"
primary-500: "#2979FF"   # 브랜드 primary
primary-600: "#1265F0"
primary-700: "#0E4DB7"
primary-800: "#07388B"
primary-900: "#042762"

# Mint — 청구(billing) 강조
mint-100: "#D9F7F7"
mint-200: "#AFEFED"
mint-300: "#8CE0E0"
mint-400: "#59CED8"
mint-500: "#00ACA6"      # billing primary
mint-600: "#009B96"
mint-700: "#007E7A"
mint-800: "#005956"
mint-900: "#003A38"

# Red — danger / 취소
red-050: "#FFECEC"
red-100: "#FFDADA"
red-200: "#FFC7C7"
red-300: "#FFA0A0"
red-400: "#FF6B6B"
red-500: "#FF4242"

# Green — success / 완료
green-050: "#E5F8EC"
green-400: "#33D16A"
green-500: "#00BF40"

# Orange — warning
orange-050: "#FFF9EC"   # 경고 배너 면 (2026-09-02 — 옛 #FFF3E5는 베이지빛으로 탁했다)
orange-400: "#FFA733"
orange-500: "#FFA500"   # 경고 앵커 (2026-09-02 — 옛 #FF9200은 붉은기가 돌아 danger와 계열이 붙었다)

# Sky — info
sky-050: "#E5F4FF"
sky-400: "#47B4FF"
sky-500: "#0E9BFF"

# Purple (AI) — accent / fieldnote
purple-500: "#9B5DFF"
```

### Semantic alias

alias는 raw 토큰 이름을 참조한다 — 값은 위 palette에서 유래하므로 별도 색 표기를 두지 않는다. 컴포넌트 스펙은 이 이름을 `{color.<token>}` 형태로 참조한다.

```yaml
# Text
text-headline:        gray-900
text-title-default:   gray-900
text-title-subtle:    gray-600
text-body-strong:     gray-900
text-body-default:    gray-700
text-body-subtle:     gray-500
text-caption-default:  gray-500
text-caption-subtle:   gray-400
text-label-strong:    gray-900
text-label-default:   gray-600
text-placeholder:     gray-400
text-state-inverse:   white        # 다크 배너 등 반대 톤 면 위
text-state-on-primary: white       # 브랜드(파란) 면 위
text-state-brand:     primary-500  # 링크·브랜드 강조
text-state-disabled:  gray-400

# Icon
icon-primary:    gray-500
icon-secondary:  gray-400
icon-tertiary:   gray-300
icon-inverse:    white
icon-danger:     red-500
icon-info:       sky-500
icon-success:    green-500
icon-warning:    orange-500

# Background
bg-base:            gray-050          # 페이지 캔버스
bg-surface:         white             # 기본 카드/면
bg-surface-raised:  white             # 떠 있는 면 — 구분은 색이 아니라 그림자
bg-surface-sunken:  gray-100          # 눌린/인셋 면(well)
bg-emphasis:        gray-800          # 강한 강조 면(다크 패널)
bg-emphasis-subtle: gray-100
bg-overlay:         black / 50%       # 오버레이 딤
bg-brand-subtle:    primary-500 / 6%  # 브랜드 틴트 배경(선택 카드 등)
bg-element:         gray-500          # 요소 배경(채움)

# Border
border-subtle:   gray-100
border-default:  gray-200
border-strong:   gray-300
border-active:   primary-500
border-emphasis: gray-900     # 최상위 구분선 — 영수증 절취 강조선(청구서 모달). 일반 카드·패널 구분엔 쓰지 않는다

> ## 🔴 카드 외곽선 — 깔린 배경이 정한다 (2026-08-27 등재)
>
> 같은 흰 카드라도 **무엇 위에 얹혔는지**로 외곽선 단계가 갈린다. 배경과의 명도차가
> 이미 카드를 분리해주면 선은 물러나고, 분리해주지 않으면 선이 그 역할을 대신한다.
>
> | 카드가 얹힌 배경 | 외곽선 | 예 |
> |---|---|---|
> | **회색 면**(`{color.bg-base}` #f5f7f8) 위 흰 카드 | **`{color.border-subtle}`**(gray-100) | 리스트·그리드 페이지의 카드 — 상담현황·검사현황·내담자·구성원·상담일지·청구·필드노트 |
> | **흰 면**(`{color.bg-surface}`) 위 카드 | **`{color.border-default}`**(gray-200) | 상세 패널·모달 안의 카드, 테이블 래퍼, 입력 외곽 |
>
> - **이유** — 회색 배경 위에서는 흰 면 자체가 이미 경계다. 거기에 gray-200을 두르면 선이
>   카드보다 먼저 읽혀 그리드가 격자처럼 보인다. 반대로 흰 배경 위에서는 명도차가 0이라
>   gray-100은 사실상 보이지 않아 카드가 배경에 녹는다.
> - **판정은 카드의 부모 면 기준.** 페이지 셸이 `bg-base`면 그 위 카드는 전부 subtle이다.
>   같은 컴포넌트를 흰 패널 안에서 재사용한다면 그 자리에서는 default로 덮는다.
> - 카드 **내부** 가로선은 이 규칙 밖 — §Components>card가 소유한다(`{color.border-subtle}`).
>   회색 배경 카드에서는 외곽과 내부가 같은 단계가 되므로, 내부 분할이 필요하면 선이 아니라
>   여백·면(well)으로 가른다.

# Action
action-primary:            primary-500
action-primary-hover:      primary-600
action-primary-subtle:     primary-100
action-primary-disabled:    primary-200  # Primary CTA 비활성 '면'
action-primary-disabled-fg: white        # Primary CTA 비활성 '라벨' — 면만 지고 라벨은 흰색 유지
action-disabled:           gray-200      # 중립 컨트롤(회색 계열)의 비활성 면. Primary CTA에는 쓰지 않는다

# Billing (청구 아웃라인 버튼 전용 — 청구 버튼은 mint-* 원시 팔레트를 직접 참조하지 않는다)
billing-line:          mint-300   # default 보더(연한 민트)
billing-line-hover:    mint-400   # hover 보더(한 단계 진하게)
billing-line-pressed:  mint-500
billing-line-disabled: mint-200
billing-fg:            mint-500   # 라벨·아이콘
billing-fg-hover:      mint-600
billing-fg-disabled:   mint-300
billing-surface-hover: mint-50    # hover 배경
billing-solid:         mint-500   # 솔리드 CTA 면 (§button-billing-solid)
billing-solid-hover:   mint-600   # 솔리드 CTA hover 면

# Status (fg / bg)
status-danger:   red-500     ·  status-danger-bg:  red-050
status-info:     sky-500     ·  status-info-bg:    sky-050
status-success:  green-500   ·  status-success-bg: green-050
status-warning:  orange-500  ·  status-warning-bg: orange-050

# Accent / Trend
accent-fieldnote: purple-500
trend-up:   red-500      # 국내 관행: 상승=빨강
trend-down: primary-500  # 하락=파랑
trend-flat: gray-500
```

### AI 그라디언트 (2026-08-28 등재)

**AI 기능을 강조하는 단 하나의 그라디언트.** AI가 만든 것·AI를 실행하는 것에만 쓴다 — 그 밖의 강조에는 쓰지 않는다(쓰는 곳이 늘면 "AI"라는 신호가 죽는다).

```yaml
gradient-ai: linear(to right)
  0%:   "#4486FF"   # 파랑
  48%:  "#22A4F2"   # 파랑-시안 중간
  100%: "#00C2E5"   # 시안
```

- **정의는 한 곳** — `app.css` `@theme`의 `--gradient-ai`(스톱은 `--gradient-ai-from/via/to`). 컴포넌트가 `linear-gradient(...)`나 hex를 직접 쓰지 않는다.
- **유틸 4종**으로만 소비한다:

| 유틸 | 용도 |
|---|---|
| `.bg-ai-gradient` | 면 — 흰 글자 AI CTA |
| `.bg-ai-gradient-subtle` | **틴트 면** — 같은 스톱의 연한 버전(`#EBF2FF → #E5F5FF → #E0FAFF`). 글자·아이콘이 AI 색인 실행 버튼(초안 생성). Figma node 9859:336467 |
| `.text-ai-gradient` | 글자 — AI 섹션 타이틀 |
| `.border-ai-gradient` | 1px 라인 — AI 결과 카드 외곽 (안쪽 면 색은 `--ai-gradient-surface`, 기본 흰색) |

- 틴트 면 위의 글자는 `ai-500`(15 Medium), 아이콘은 AI 그라디언트 아이콘(`AiStarIcon20`) — 면을 연하게 깐 자리라 글자까지 그라디언트로 얹지 않는다.
- **선택 규칙** — 솔리드 면·글자·라인 셋 중 **한 화면에 하나**만. 그라디언트 면 위에 그라디언트 글자, 그라디언트 라인 안에 그라디언트 면처럼 겹쳐 쓰지 않는다. 틴트 면은 신호 세기가 낮아 이 셈에서 뺀다.
- **단색이 필요한 자리**(라벨·아이콘·연한 배경)는 그라디언트가 아니라 `ai-*` 단색 팔레트를 쓴다 — 요약 카드는 `bg-ai-50` + `border-ai-500`이 정본(§Components 필드노트 AI 요약).
- 옛 인라인 그라디언트 `#9B5DFF → #FF00B7`(보라→핑크)는 파일마다 값이 갈려 있던 비정본이다. 새로 만드는 AI 표면은 전부 위 토큰을 쓴다.
- **2026-09-01 — AI 색상 계열을 보라에서 파랑으로 옮겼다.** 그라디언트 스톱(위 표)과
  `ai-*` 단색 팔레트를 함께 바꿨다(단색 앵커 `ai-500` = **#219EFF**, 명도 사다리는
  primary 블루와 같은 단계에 색상만 206°). 옛 값(그라디언트 `#A56EFF→#7B79FF→#219EFF`,
  `ai-500` `#9B5DFF`)은 폐기 — 그라디언트가 파랑으로 끝나는데 단색만 보라로 남아
  한 카드 안에서 테두리와 글자가 갈리던 상태를 해소한 것이다.

### Tag (분류 라벨 10색 · 지각 명도 통일)

분류 태그는 10개 hue를 두고, 각 hue는 **fg(글자) / bg(채움 틴트) / outline(테두리)** 3토큰 세트다. fg는 CIELAB 기준 **지각 명도가 균일**하도록 튜닝했고(초록·파랑이 같은 무게로 보이도록), bg·outline은 **동일 hue의 fg 색을 불투명도로 낮춘 값**이다. bg 불투명도는 hue별로 미세 조정되어 틴트 밝기도 균일하게 보인다.

```yaml
# hue: fg(hex) / bg(fg + opacity) / outline(fg + opacity)
tag-gray:   fg "#5E6A73"  · bg 12%  · outline 26%
tag-blue:   fg "#2E72F6"  · bg 11%  · outline 27%
tag-indigo: fg "#5367EC"  · bg 11%  · outline 26%   # blue와 purple 사이, 색상각 296°로 분리
tag-purple: fg "#9061E5"  · bg 11%  · outline 26%
tag-pink:   fg "#E71C7C"  · bg 10%  · outline 29%
tag-red:    fg "#E33638"  · bg 10%  · outline 30%
tag-orange: fg "#FD810E"  · bg 14%  · outline 36%
tag-amber:  fg "#B28011"  · bg 13%  · outline 31%
tag-green:  fg "#14A140"  · bg 10%  · outline 34%
tag-teal:   fg "#17887C"  · bg 10%  · outline 34%
```

### Status Badge (상태 배지 — tag 색 참조)

상태 배지는 **tag 팔레트를 재사용**한다(별도 색 없음). bg는 해당 tag의 저불투명 틴트, fg는 tag fg다. 원칙은 "흔하고 정상인 상태일수록 조용한 색, 종료/취소는 muted".

```yaml
state-pending:   → tag-gray    # 진행 전
state-progress:  → tag-blue    # 진행 중(조용한 파랑)
state-done:      → tag-green   # 완료
state-canceled:  → tag-red     # 취소 (라벨에 line-through 병행)
state-inactive:  → tag-gray    # 비활성
```

### Category (차트·카테고리 팔레트 8색)

차트·카테고리 구분용 정성 팔레트. 상태/태그와 별개다.

```yaml
category: ["#E96FD9" pink, "#4EC5CE" teal, "#1C9DFB" blue, "#7A6DF0" indigo,
           "#15B76C" green, "#A6C94E" lime, "#EFB13E" amber, "#EF6A54" coral]
```

## Typography

폰트는 **Pretendard** 단일 패밀리(한글·라틴 동일 metric). 자간 기본 `-0.41px`(단, **24px 페이지 타이틀은 0**). 행간은 두 축으로 운영된다 — **Normal**(= 폰트 크기와 동일, 100%, 단일 줄 UI·제목용) / **Reading**(= 150%, 여러 줄 본문용). 스타일 이름 자체가 `역할_번호/행간축-굵기` 로 `크기 + 굵기 + 행간`을 한 세트로 고정한다(예: `Title_01/Normal-Semibold`).

### Size ladder (등록 스타일)

```yaml
# 역할: fontSize / Normal 행간 / Reading 행간 / 제공 굵기
Display_01:  44 / 44 / —    / Bold
Display_02:  32 / 32 / 150% / SemiBold·Bold
Headline_00: 28 / 28 / —    / Medium·SemiBold·Bold
Headline_01: 24 / 24 / 150% / Regular·Medium·SemiBold·Bold
Headline_02: 20 / 20 / 150% / Regular·Medium·SemiBold·Bold
Title_01:    18 / 18 / 150% / Regular·Medium·SemiBold·Bold
Body_01:     16 / 16 / 150% / Regular·Medium·SemiBold·Bold
Body_02:     15 / 15 / 150% / Regular·Medium·SemiBold
Body_03:     14 / 14 / 150% / Regular·Medium·SemiBold·Bold
Label_01:    13 / 13 / —    / Regular·Medium·Bold
Label_02:    12 / 12 / 150% / Regular·Medium·Bold
Caption_01:  10 / 10 / —    / Regular·Medium·Bold
Caption_02:   8 /  8 / —    / Regular·Medium·Bold
```

- **본문은 반드시 `Body` 계열만 사용한다** — `Body_01`(16, 기본/Reading) · `Body_02`(15) · `Body_03`(14). 본문에 Title/Headline/Label/Caption 크기를 쓰지 않는다.
- **등록된 타입 스타일 밖의 크기는 금지** — 위 사다리에 없는 임의 폰트 크기(너무 작거나 큰 값)를 쓰지 않는다. 항상 등록된 스타일에서 고른다.
- UI 라벨 = `Label_01`(13)~`Body_03`(14) / Normal.
- 특수: `Body_01/Normal-Regular-Log`(16 / 행간 36) = 상담기록·로그 전용(의도적 넓은 행간).
- 컬러 페어링: Headline·Title → `{color.text-title-*}`, Body → `{color.text-body-*}`, Label → `{color.text-label-*}`, Caption → `{color.text-caption-*}`.

### 타이포 사용 역할 (usage roles)

실측 페이지 기준, 각 크기가 실제로 어디에 쓰이는지의 매핑. **아래 역할 외의 크기·굵기는 쓰지 않는다.** (24/20/18 = 제목 XL/L/M은 §Title system 참조.)

| 역할 | 크기·굵기 | 기본 색 | 사용처 |
|---|---|---|---|
| `title-01` | 18 SemiBold | `{color.text-body-strong}` | 리스트 아이템 제목, 탭 텍스트, LNB 메뉴 (예: "놀이치료 - 그룹") |
| `title-01-md` | 18 Medium | `{color.text-body-default}` | 프로필 보조 정보 강조 (생년월일·성별 등) |
| `body-01` | 16 Regular | body-strong 또는 body-default | 본문 데이터·테이블 셀 값·연락처 등 **대부분의 데이터** |
| `body-01-md` | 16 Medium | 상황별(버튼 색·body-default) | 버튼 텍스트, 강조 본문, 토글 선택 항목 |
| `body-01-reading` | 16 Regular / lh 1.5 | `#2D333B` (gray-800) | **여러 줄 텍스트(메모·설명문)는 반드시 이것** |
| `body-02-md` | 15 Medium | `{color.text-title-subtle}` | **레이블 표준** — 필드 레이블, 테이블 헤더, 단위("건") |
| `body-02` | 15 Regular | `{color.text-body-default}` | 보조 데이터(날짜·성별 병기, 진행률, 코드) |
| `body-03` | 14 Regular | `{color.text-title-subtle}` | 캡션, 카운트(타이틀 옆 개수) |
| `label-01` | 13 Medium | 태그 색 | 사각 뱃지 텍스트(예: "C00063") |
| `label-02` | 12 Medium / lh 12 | 태그 색 | 소형 뱃지 텍스트(예: "세트") |
| `caption-01` | 10 Medium | 흰색 또는 태그 색 | **원형 카운트 뱃지 전용** — 지름 14~24 원 안의 숫자·이니셜(알림 카운트, 아바타 이니셜, 단계 번호). 원이 작아 12로는 글자가 원을 넘긴다. **본문·안내 문구에는 쓰지 않는다**(§1044) |

**크기 결정 규칙** — 화면 제목·큰 값·이름 24 → 섹션 제목 20 → 하위·아이템 제목 18 → 데이터 16 → 레이블·보조 15 → 캡션 14 → 뱃지 13/12 → **원형 카운트 10**. **강조는 크기를 키우지 말고 굵기(Regular→Medium→SemiBold)나 색(default→strong)으로** 한다.

### Title system (XL/L/M · 실측 기준)

제목은 3단계(XL/L/M)로 정의한다. 화면에서는 px가 아니라 이 레벨로 지칭한다. **굵기는 XL·L·M 모두 항상 SemiBold** 이며, 컬러는 `{color.text-title-default}`. **타이틀 영역의 높이는 레벨과 "서브내용(설명 한 줄)" 유무에 따라 가변**하며, 그 아래 섹션과의 **gap은 16 고정**이다.

| 레벨 | 역할 | 텍스트 | 영역 높이 (서브내용 있음 / 없음) |
|---|---|---|---|
| **XL** | 페이지 최상단 메인 타이틀 (페이지당 1개) | `Headline_01/Semibold` (24) | **44 고정** |
| **L** | 섹션 타이틀 | `Headline_02/Semibold` (20) | 51 / 44 |
| **M** | 하위(서브섹션)·아이템 타이틀 | `Title_01/Semibold` (18) | 47 / 24 |

**규칙**
- 페이지당 **XL은 1개**, 레벨은 건너뛰지 않는다. **모달·팝업 헤더 타이틀은 L 고정**(모달은 페이지 하위 컨텍스트 — XL 금지, §Components>modal).
- **굵기** — XL·L·M은 항상 **SemiBold**. **Bold는 별도로 지정된 특정 상황이 아니면 절대 쓰지 않는다.**
- **서브내용**(타이틀 아래 설명 한 줄, `Body_02/Regular` 15 `{color.text-body-subtle}`)이 붙으면 L·M 영역 높이가 커진다(위 표). XL은 서브내용 여부와 무관하게 44 고정.
- **XL 좌측 GNB 아이콘 — 28** (2026-08-27 등재, 아래 규격). L·M에는 아이콘을 붙이지 않는다(§Components>title-icon 없음 = §Title system이 소유).
- 타이틀 영역 ↔ 하위 섹션 **gap 16**(§Layout 참조) — **단 바로 아래가 자체 상하 여백을 가진 행 영역(탭·카운트 헤더·필터 바 등)이면 8**(2026-08-27 등재, 아래 규격). 상단 헤더 ↔ XL 타이틀 사이는 20(§Layout).
- 텍스트 행간은 Normal(100%), 2줄 wrap 시에만 해당 스타일 `Reading`(150%).
> ## 🔴 타이틀 → 바로 아래 요소 — 16 / 8 (2026-08-27 등재)
>
> 타이틀(XL·L·M) 아래 간격은 **바로 다음에 오는 것이 무엇인가**로 갈린다.
>
> | 바로 아래 요소 | gap |
> |---|---|
> | **콘텐츠 영역 컨테이너** — 면을 가진 카드·테이블·패널·그리드(배경·보더로 가장자리가 서는 블록) | **16** (`mb-4`) |
> | **상하 여백을 스스로 가진 행 영역** — 탭바, 카운트 헤더("총 N건"), 필터·검색 바, 툴바 | **8** (`mb-2`) |
>
> - **이유** — 행 영역은 자기 안에 이미 상하 여백을 품고 있어 16을 주면 실제로 보이는 간격이 24~32로 벌어져 타이틀과 끊긴 별개 블록으로 읽힌다. 면 컨테이너는 가장자리가 콘텐츠에 딱 붙으므로 16이 그대로 시각 간격이 된다.
> - **판정은 첫 번째 요소 기준**. 배경·보더 없는 레이아웃 전용 래퍼(`div.flex`·`{#if}`)는 건너뛰고 그 안의 첫 실물 요소로 본다. 컨테이너 카드 *안쪽*에 있는 탭(권한 설정·내 정보)은 타이틀 직속이 아니므로 16.
> - 탭·필터 바 ↔ 그 아래 콘텐츠의 간격은 이 규칙이 아니라 뒤따르는 요소가 소유한다(`FloatingFilterBar`의 `py-4` 등).
> - **두 값을 합산하지 않는다** — 타이틀의 `mb`와 다음 요소의 `mt`를 같이 주면 40이 된다(검사 통계 `mb-4`+`mt-6` 사례).
> - 8 미만으로 더 붙이지 않는다 — §Spacing ①의 "8 이하 금지"가 하한이다.

> ## 🔴 XL 타이틀 좌측 GNB 아이콘 — 28 (2026-08-27 등재)
>
> 페이지 최상단 XL 타이틀 왼쪽에 **그 화면이 속한 GNB 메뉴의 아이콘**을 얹는다 — 좌측 메뉴에서 지금 어디에 있는지가 본문 첫 줄에서 한 번 더 확인된다.
>
> | 항목 | 값 |
> |---|---|
> | 아이콘 박스 | **28 × 28** (GNB 아이콘의 타이틀 스케일 변형 `*On28`) |
> | 아이콘 ↔ 타이틀 | **8** (`gap-2`) |
> | 상태 | 항상 **활성(On) 컬러** — 지금 보고 있는 메뉴이므로 |
> | 정렬 | 44 타이틀 행 안에서 세로 중앙, 아이콘은 **28 박스 정중앙** |
>
> - **아이콘은 메뉴 단위, 타이틀은 하위 메뉴 단위.** 한 메뉴의 하위 화면은 전부 같은 아이콘을 쓰고(상담 현황·상담일지·프로그램 관리 = 상담 아이콘), 타이틀 문구는 그 **하위 메뉴 이름**을 쓴다. 하위 메뉴가 없는 메뉴만 상위 이름 그대로.
> - **붙이는 곳 = 사이드바에 있는 메뉴 경로뿐.** 상세·설정 하위 등 메뉴에 없는 화면은 아이콘 없이 타이틀만. 배선 정본은 `src/lib/config/title-icon.ts`(경로 → 아이콘, **정확히 일치**하는 경로만)이고 `PageTitleSection`이 현재 경로로 자동 해소한다.
> - **에셋은 크기별 파일로 등재**한다(`CalendarOn28.svelte` 등, `src/lib/assets/sidebar/`). 20·24 원본을 CSS로 늘리지 않는다.
> - **아트워크를 박스 정중앙에 맞춘다** — 원본 에셋 다수가 viewBox 안에서 0.5~1 치우쳐 있어, 그대로 키우면 타이틀과의 광학 중심이 어긋난다. 28 변형을 만들 때 bbox를 재서 `<g transform="translate(dx, dy)">`로 보정한다.
> - **예외 — 대시보드**는 XL 타이틀이 없는 히어로(인사말) 화면이라 아이콘도 없다.

- **필드 라벨은 제목이 아니다** — 라벨은 Title 사다리(XL/L/M)에 속하지 않는다. "Title S"는 존재하지 않으며, 제목처럼 보이는 폼 그룹 머리글(`내담자 정보`·`요일`·`근무 시간`)도 **라벨**이다.
- **라벨 정본 (전 폼 공통)** — `Body_02/Medium`(15) · `{color.text-title-subtle}`(gray-600 `#58626C`) · 라벨↔입력 간격 **8**. 2026-08-19 교정 — 옛 표기 `text-body-default`(gray-700)는 §Components>text-field의 Figma 정본(`624:38104` Textfield_Vertical)과 어긋나 코드가 두 색으로 갈려 있었다(gray-700 135곳 / #58626C 32곳). **Figma 정본 쪽으로 단일화.** ⚠️ 코드 클래스는 `text-title-subtitle`이다 — app.css 토큰명(`--color-title-subtitle`)이 이 문서의 alias(`text-title-subtle`)와 철자만 다르다. 필드 라벨과 그룹 라벨을 나누지 않고 **한 규격으로 통일**한다(단계를 늘리면 화면마다 16/15/14가 섞인다). 필수 표시 `*`는 `{color.status-danger}`.

## Spacing

베이스 단위는 **4px**이며 **모든 간격은 4px 단위로만** 적용한다(**2px 금지**). 아래 사다리 값만 쓴다. 원칙: **관련도가 높을수록 좁게, 애매하면 좁은 쪽.**

> ## 🔴🔴 그룹핑 vs 구분 — 세로 위계의 핵심 규칙 (모든 화면에서 항상 먼저 참고)
>
> 세로 간격은 **"묶을 것은 좁게, 나눌 것은 넓게"** 로 위계를 만든다. **이 두 간격의 대비가 곧 구조다** — 타이포·색보다 먼저 이 간격 규칙으로 무엇이 한 묶음이고 무엇이 다른 묶음인지 읽히게 한다.
>
> | 관계 | gap | 원칙 |
> |---|---|---|
> | **① 그룹 내부** — 타이틀 → 직속 콘텐츠, 레이블 → 값, 섹션 제목 → 리스트 | **12** (범위 **12~16**) | 하나의 묶음으로 보이도록 좁게. **단 8 이하로 붙이지 말 것** — 8 이하면 위계가 뭉개져 제목과 내용이 한 줄처럼 붙어버린다. |
> | **② 그룹 간 구분** — 액션(버튼) ↔ 섹션, 블록 ↔ 블록, 서로 다른 정보 묶음 | **24** (범위 **24~32**) | 서로 다른 묶음임이 한눈에 보이도록 **명확히** 벌린다. |
>
> **⚠️ 불변 부등식 — `② 구분 간격 > ① 그룹 간격` (권장 약 2배: 12 ↔ 24).**
> 이 부등식이 깨지면(예: 타이틀↔콘텐츠 8, 버튼↔섹션 12) 무엇이 묶이고 무엇이 나뉘는지 전혀 읽히지 않는다. **간격을 정할 땐 항상 "이건 묶는 간격인가, 나누는 간격인가?"를 먼저 판단하고 12/24 중에서 고른다.**
>
> - ✅ **좋은 예** (권한 설정 좌측 레일) — `[역할 추가 버튼] —(구분 24)— "역할" —(그룹 12)— 관리자·전문가 리스트`
> - ❌ **나쁜 예** — `[역할 추가 버튼] —(12)— "역할" —(8)— 리스트` : 버튼이 리스트에 붙고 타이틀이 리스트에 붙어 **전부 한 덩어리**로 보임(구분 간격 = 그룹 간격이라 위계 소멸).
>
> *(이 규칙은 아래 "역할 기준 간격" 표의 `섹션 타이틀 → 콘텐츠 12`, `큰 섹션 사이 24~28`을 위계 관점으로 재정의·강조한 것이다. 인접 요소 최소값을 다루는 "관계별 최소 간격 규칙"과는 층위가 다르다 — 저건 가로 인접, 이건 세로 그룹핑.)*

```yaml
space: [0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96]   # px
# 예외: gap 6 은 "인라인 세로 구분선(divider) 주변"에만 허용(그 외 홀수·비4배수 금지)
```

**관계별 최소 간격 규칙**

| 관계 | 최소 gap |
|---|---|
| 아이콘 ↔ 텍스트 | **8** |
| 연관된 텍스트 ↔ 텍스트 (같은 정보군) | **8** |
| 구분되는 요소들 (다른 묶음/구획) | **12** |

- **연관 예시** — 내담자 정보 패널에서 `이름` 항목과 `성별·생년월일` 항목처럼 **같은 정보군 안의 인접 항목**은 gap 8. 반면 서로 다른 블록(예: `메모` 블록 ↔ `진행 현황` 블록)은 **구분**으로 보고 12 이상. 위는 **최소값**이며 4px 단위 안에서 더 키울 수 있다.

**역할 기준 간격 (실측)**

| 상황 | gap |
|---|---|
| 한 덩어리의 인접 조각(값+단위, 이름+코드) | 4 |
| 인라인 데이터 ↔ 세로 구분선(divider) | 6~8 |
| 아이콘(20) ↔ 텍스트 | 8 |
| 세로형 레이블 → 값 | 4 (요약 지표는 8) |
| 관련 필드 묶음 세로 나열(연락처 3줄 등) | 12 |
| 리스트 카드 사이 / 2분할 카드 영역 사이 | 16 |
| 카드 내부 정보 그룹 사이 | 16~20 |
| 섹션 타이틀(L·M) → 섹션 콘텐츠 | 12 |
| **상세 화면 좌측 패널 — 섹션 타이틀 → 직속 콘텐츠** | **16** (액션 붙은 헤더는 12 — 아래 규격) |
| 카드 내부 큰 섹션 사이 | 24~28 |
| 페이지 메인 타이틀(XL) → 본문 영역 | **16** (콘텐츠 컨테이너) / **8** (탭·카운트·필터 등 여백 가진 행) |

**🔵 상세 화면 좌측 패널 — 섹션 타이틀 규격 (2026-08-13 등재)**

상세 화면(검사·상담·내담자·구성원)의 좌측 정보 패널은 섹션이 세로로 쌓이는 유일한 자리라, 섹션마다 간격이 흔들리면 패널 전체가 들쭉날쭉해 보인다. 아래 두 값을 **고정**한다.

| 항목 | 값 | 이유 |
|---|---|---|
| **섹션 타이틀 → 직속 콘텐츠** | **헤더 행 높이와 짝으로 갈린다 — 아래 표** | 좌측 패널은 타이틀이 `Title_01`(18)이고 바로 아래가 카드·라벨행이다. 행 높이가 커지면 타이틀 아래 시각 여백이 이미 확보되므로 gap을 함께 키우면 과해진다. |

**🔵 섹션 헤더 — 행 높이 × gap 짝 (2026-08-19 개정)**

헤더 우측에 **액션(케밥·`수정`·추가 버튼 등)이 붙는지**로 갈린다. 두 값은 항상 짝으로 움직인다.

| 헤더 유형 | 행 높이 | 타이틀 → 콘텐츠 gap |
|---|---|---|
| **텍스트만** (타이틀, 카운트 병기 포함) | **24** (`h-6`) = Title M 영역 높이(서브내용 없음) | **16** |
| **액션 있음** (케밥·수정·추가 버튼) | **32** (`h-8`) — 아이콘 20 + 패딩이 24를 넘는다 | **12** |

- 액션 헤더가 32인 것은 **예외 조항**이지 기본값이 아니다. 텍스트만 있는 헤더까지 32로 올리지 않는다.
- 액션 헤더의 gap이 12인 이유 — 행이 32로 커지면서 타이틀 글자(18) 위아래로 7씩 여백이 이미 생긴다. 여기에 16을 더하면 텍스트 기준 실제 간격이 23이 되어 텍스트 헤더(24+16)보다 벌어져 보인다.
- **권한·데이터로 액션이 조건부 노출되는 헤더는 액션 기준(32/12)으로 고정**한다 — 로그인한 역할에 따라 헤더 높이가 달라지면 안 된다.
- 옛 규정("한 패널 안에 액션 헤더가 하나라도 있으면 모든 섹션 헤더를 32로 맞춘다")은 폐기. 헤더마다 자기 유형을 따른다.
| **섹션 헤더 행 높이** | **24 / 32** — 위 「행 높이 × gap 짝」 표 | 액션 유무로 갈린다. `items-center`는 두 경우 모두. |
| **섹션 ↔ 섹션** | **구분선 + 위아래 28**(`my-7` + `h-px bg-border-default`) | 좌측 패널은 성격이 다른 정보 묶음이 이어지므로 여백만으로 나누지 않는다. 여백만 쓰면 28+28=56처럼 중복 합산되는 사고가 난다(패딩은 한쪽만 소유). |

- 적용 대상: `AssessmentSidebar`(검사 상세) · `ProgramInfoPanel`(상담 상세) · `ProfileSection`(내담자 상세) · `MemberProfileCard`(구성원 상세).
- 패널 최상단의 **패널 헤더**(`내담자 정보`·`상담 정보` 등 닫기 버튼을 동반한 줄)는 이 규칙이 아니라 §Components>panel-header(높이 62)를 따른다.
- 섹션 내부의 서브 블록(메모 박스 등)의 `Body_02` 라벨 → 본문은 섹션 타이틀이 아니므로 8을 유지한다.

**컨테이너 패딩 (실측)**

- **페이지 콘텐츠 영역(셸 패딩) — 좌우 80 · 상단 20 · 하단 32**, 배경 `{color.bg-base}`. 소유는 앱 셸 하나(`routes/+layout.svelte`의 `px-20 pt-5 pb-8`)이며 **페이지가 자기 좌우 패딩을 따로 두지 않는다**. (2026-08-26 교정 — 옛 표기 "좌우 40~48 · 상단 20~32 · 하단 40"은 코드 실측과 어긋난 값이었다. 셸이 단일 소유이므로 범위가 아니라 단일값이다.)
  - 오버레이 모드(태블릿·모바일, `!responsive.isDesktop`): 좌우 16 · 상하 16(`px-4 py-4`).
  - 예외는 셸에서만 선언한다 — 검사 접수 페이지 `p-0`, 하단 여백 제거 페이지 `pb-0`.
  - **상세 2분할 좌측 패널 폭 = 컨테이너 대비 비율** (`var(--spacing-detail-side)`) — 규격은 §Layout Patterns > 2분할 좌측 패널 폭. 적용처: 내담자·구성원 상세 · 상담 상세(`ProgramInfoPanel`) · 검사 상세(`AssessmentSidebar`) · 내 정보 · 센터 정보. (2026-08-26 개정 — 같은 날 정한 `400px 고정`은 해상도마다 좌측 비중이 47.6%~18.9%로 흔들려 폐기. 그 이전의 `w-110`(440)·`[460px]` 혼재 정리는 그대로 유효하다.)
    - **이를 대체하는 오버레이 패널(`panelStore` width)은 400 고정**이다 — 오버레이는 2분할 컨테이너 위에 떠 있어 나눌 비율이 없다.
    - 우측 도크가 열리면 셸 `pr`로 컨테이너가 줄고 좌측도 **같은 비율로 자동으로** 따라 줄어든다(옛 400→360 단계 분기 폐기). 여닫을 때 `grid-template-columns`에 200ms 트랜지션을 걸어 우측 패딩 변화와 함께 움직인다.
  - **콘텐츠 ↔ 세로 패널 간격은 패널의 성격으로 갈린다 — 영구 크롬(GNB) 80 / 열려 있는 도크 40.** GNB는 항상 있는 앱 골격이라 페이지 마진과 같은 값(80)으로 떼어놓고, 도크(우측에서 열리는 상시 표면)는 **지금 이 페이지를 보려고 연 것**이라 관련도가 높은 만큼 좁힌다(§Spacing 원칙 "관련도가 높을수록 좁게"). 도크가 닫히면 우측 마진은 80으로 돌아온다 — **열림 상태에만 붙는 값**이지 페이지 마진의 예외가 아니다.
  - **떠 있는 진입 버튼(FAB)은 화면 모서리 기준 인셋 56/56**이며, 콘텐츠 끝선(우 80 · 하 32)에 **일부러 맞추지 않는다.** 끝선에 정확히 맞추면 컨테이너에 걸쳐 놓은 요소처럼 읽혀 "떠 있음"이 사라진다 — 떠 있는 요소는 페이지 정렬축에서 벗어나야 레이어가 다르다는 게 읽힌다.
- 대형 컨테이너 카드: padding 24 · 리스트 아이템 카드: padding 20 · 서브 블록(메모·인포박스): padding 12~16
- 테이블 셀: 좌 24 · 우 12 · 상하 10 (데이터 행 80 / 헤더 행 52~56)
- 버튼: 높이 44~48 · 좌우 20 · 상하 10

## Rounded

**radius는 5개뿐** — 이 값 외(6·10·20 등)는 쓰지 않는다.

```yaml
radius-4:     4      # 사각 뱃지
radius-8:     8      # 버튼 · 입력 · 아이콘버튼 · 서브 블록
radius-12:    12     # 중형 블록(지표 박스, 토글 그룹)
radius-16:    16     # 카드 · 대형 컨테이너
radius-pill:  9999   # 라운드 뱃지 · 아바타 · 토글 · 태그
```

> **⚠️ 코드 매핑(Tailwind v4)** — 이 프로젝트는 radius 오버라이드가 없어 Tailwind 기본값을 쓴다: `rounded` **4** · `rounded-sm` 4 · `rounded-md` 6 · `rounded-lg` **8** · `rounded-xl` 12 · `rounded-2xl` **16** · `rounded-norm`(커스텀) 10. (2026-09-07 교정 — 옛 표기 "`rounded` 8"은 빌드 CSS 실측(`.rounded{border-radius:.25rem}`)과 어긋났다. 배지 radius 4는 `rounded`가 맞다.) **콘텐츠 컨테이너·카드의 radius 16은 반드시 `rounded-2xl`** 이며 `rounded-lg`(=8px)를 카드에 쓰면 안 된다. (과거 문서·다수 페이지가 `rounded-lg`를 카드 래퍼에 잘못 써서 8px로 렌더된 것이 "페이지별 radius 제각각"의 주원인이었다 — 2026-07-08 전역 통일.)

> **🔴 중첩 규칙 — 바깥 > 안쪽 (동일값 금지).** 컨테이너를 겹칠 때 **바깥 컨테이너의 radius는 항상 안쪽보다 커야 한다.** 같은 값(예: 바깥 8 · 안쪽 8)은 금지 — 모서리 곡률이 어긋나 보인다. 이상적으로는 `바깥 = 안쪽 + 사이 여백`(안쪽 8 + padding 8 → 바깥 16), 최소한 사다리에서 **한 단계 이상 크게**. 3중 이상 중첩도 단조 감소로: **카드(16) ⊃ 중형 블록(12) ⊃ 인풋·칩·서브박스(8)**. (예: 미리보기 바깥 박스 12 안에 흰 카드 8.)

## Elevation & Depth

표면 위계(`surface` vs `surface-raised`)는 **색이 아니라 그림자**로 구분한다. 카드는 최소 그림자(`shadow-card`), 떠 있는 표면(팝업·모달·사이드패널)만 강한 그림자를 쓴다.

```yaml
shadow-card:      0 2px 6px  rgba(204,204,204,.15)   # 기본 카드
shadow-raised:    0 4px 12px rgba(0,0,0,.10)         # 살짝 떠 있는 요소
shadow-popup:     0 2px 16px rgba(0,0,0,.10)         # 팝업/드롭다운
shadow-floating:  4px 6px 6px -4px rgba(90,90,90,.04), 0 5px 20px rgba(66,66,66,.15)  # 플로팅/모달/드롭다운
shadow-sidepanel: -2px 0 21px rgba(0,0,0,.06)        # 사이드 패널
shadow-segmented: 0 0 4px rgba(0,0,0,.08)            # 세그먼트 컨트롤
shadow-icon:      0 2px 4px rgba(54,54,54,.07)        # 아이콘 버튼
```

> 코드 토큰명 — 위 `shadow-floating`은 `app.css`에 **`--shadow-dropdown`**(Tailwind `shadow-dropdown`)으로
> 들어가 있다. 값은 동일(Figma "Floating" 이펙트). 드롭다운·셀렉트·케밥 메뉴 패널은 이 토큰만 쓴다
> — `shadow-lg`/`shadow-2xl`/`drop-shadow` 임의 조합 금지(§Components>dropdown).

## Components

아래 컴포넌트는 모두 **Figma 실측값**을 반영한다(버튼·인풋·카드·배지·태그·테이블·모달·팝업·탭·페이지네이션·툴팁·사이드바). 색·간격·라운드는 시맨틱 토큰을 참조한다.

| 카테고리 | 컴포넌트 |
|---|---|
| Button | button(solid/outline × primary/secondary/tertiary/caution/white/billing), icon-button |
| Input | text-input, field, search |
| Data Display | card, table, badge(rectangle S·M / round pill), tag, status-badge |
| Feedback / Overlay | modal, popup(confirm), tooltip, loading-skeleton |
| Navigation | tab(underline/segmented), pagination, sidebar(GNB) |

### button

버튼은 **Category(`Solid` / `Outline`) × Hierarchy × Size × Status** 4축이다. Hierarchy는 `Primary · Secondary · Tertiary · white · caution · billing · billing-solid`. 공통 규약: radius `{radius.button}`(8), 아이콘–텍스트 gap **8 고정**. **🔴 Solid 계열은 보더 없음** — 위계는 면/톤(배경색)으로만 표현하고, 보더는 Outline 계열 전용이다. **레이블 굵기 = Medium(weight 500) 고정** — ⚠️ SemiBold/Bold로 키우지 않는다(진해 보임). **레이블 크기는 버튼 사이즈별로 지정**(모두 Medium 굵기):

| 버튼 사이즈 | 레이블 크기 |
|---|---|
| Medium (40) | `Body_02`(15) |
| **Title (44)** | `Body_01`(16) — **타이틀 행(높이 44)과 세로 정렬해 쓰는 전용 사이즈**(페이지 타이틀 우측 액션·검색입력 옆 버튼 등). MD 4단 사다리엔 없지만 타이틀/인풋 정렬을 위해 별도 정의. |
| Large (48) | `Body_01`(16) |
| XLarge (52) | `Body_01`(16) |

레이블은 버튼이 커질수록 **작아지지 않는다**(단조 비감소). 구현 정본은 `docs/design-system-guide.md` §4-1 Button. 임의 크기(13·14 등)로 줄이지 말고 위 값에서만 고른다. **상호작용은 단조 심화** — hover·pressed 모두 default보다 어두워지고 pressed가 hover보다 더 어둡다(scale/transform 없음). 텍스트는 유지하거나 진해지며 연해지지 않는다.

> ## 🔴🔴 Primary 버튼은 한 화면에 하나 (2026-08-14 등재)
>
> **Solid Primary(`primary-500` 채움 + 흰 텍스트)는 그 화면의 주행동(primary action) 하나에만 쓴다.** 둘 이상이면 "지금 눌러야 할 것"이 사라져 위계가 무너지고, 화면이 파란 덩어리로 얼룩진다.
>
> - **소유자 판정** — 페이지는 우상단 메인 CTA(`PageActionButton`), 모달은 **푸터의 확정 버튼**이 Primary를 갖는다. 그 화면의 목적을 완결하는 액션 하나다.
> - **나머지 액션은 위계를 한 단 낮춘다** — 컨테이너·패널 안의 보조 추가/실행 버튼은 `button-tertiary`(Gray solid: bg `gray-100` · 텍스트 `gray-600` · hover `gray-200`), 중립 액션은 `button-white`, 취소·닫기는 아웃라인.
> - ❌ **나쁜 예** — 초대 모달에서 행 추가 `추가`와 푸터 `초대`가 둘 다 Primary. 보조 액션인 `추가`가 확정 액션과 같은 급으로 읽힌다 → `추가`를 tertiary로 내린다.
> - ✅ **예외는 confirm 다이얼로그** — 취소/확인 2분할에서 확인이 Primary인 것은 그 화면의 유일한 주행동이므로 규칙과 충돌하지 않는다(§popup).
> - 같은 급 액션이 나란히 둘 이상 필요하면, 그건 Primary를 늘릴 게 아니라 **화면이 목적을 두 개 갖고 있다는 신호**다 — 분리하거나 하나를 보조로 내린다.

> **🔴 레이블 카피 = 명사(형)로 끝낸다.** `추가하기·저장하기·삭제하기·수정하기` 같은 **`~하기` 어미 금지** → `추가·저장·삭제·수정`, 목적어가 있으면 `세트 추가·역할 추가`처럼 **명사구**로. (동사 어간+`하기` 형태를 쓰지 않는다. 예: ❌ `세트 추가하기` → ✅ `세트 추가`)

> ## 🔴 추가 액션(`+ 명사`) — 전 화면 단일 규격 (2026-09-02 등재)
>
> "무언가를 더한다"는 액션은 화면·형태(텍스트 버튼 · 점선 카드 · 드롭다운 꼬리 · 섹션 헤더 액션)를
> 가리지 않고 **한 벌**로 고정한다. 같은 뜻의 액션이 어떤 화면에선 회색, 어떤 화면에선 파란 원판을
> 달고 나오면 사용자는 그것들을 서로 다른 기능으로 읽는다.
>
> | 항목 | 값 |
> |---|---|
> | 문구 | **`+ 명사`** — `추가` · `세트 추가` · `상담실 추가` · `새 양식 등록`. **`~하기` 금지**(`추가하기`·`만들기` ❌) |
> | 아이콘 | **`PlusIcon20`**(20 · `currentColor`) — **선(+)만.** 원판·틴트 배경을 깔지 않는다 |
> | 색 | **`{color.action-primary}` 고정** — 아이콘·레이블 같은 색(아이콘은 `currentColor`라 부모를 따른다). hover는 `{color.action-primary-hover}` |
> | 아이콘↔텍스트 | gap **8** |
>
> - **옛 `PlusIcon`(24 · 연한 파란 원판 `#D7E5FD` · stroke `#4C87F6` 고정)은 폐기.** 원판이 깔리면
>   텍스트 버튼 한 줄이 "버튼 두 개"처럼 읽히고, 하드코딩된 stroke가 옆 레이블(`primary-500`)과
>   미세하게 달라 같은 액션인데 두 색으로 보였다. `PlusGrayIcon`(12 viewBox)도 같은 이유로 폐기 —
>   20 자리에 12를 늘려 쓰면 선 굵기가 혼자 얇다.
> ### 🔴 색 고정은 **면 없는 액션**에만 — 버튼 안에 들어가면 그 버튼 규격을 따른다
>
> | 형태 | 레이블·아이콘 색 |
> |---|---|
> | 순수 텍스트 버튼(면·보더 없음) · 점선(dashed) 액션 · 드롭다운 꼬리 링크 | **`{color.action-primary}` 고정** |
> | `button-white` · `button-tertiary` · `button-outline` · Solid CTA **안에 들어간** `+ 추가` | **그 버튼 variant가 정의한 레이블 색** (§button-white는 gray-600, outline-secondary는 gray-700 …) |
>
> 버튼은 이미 자기 색 체계를 갖고 있다. 그 안의 레이블만 파랗게 바꾸면 면·보더와 글자가 따로 놀고,
> 같은 variant의 다른 버튼과도 어긋난다. **아이콘이 `currentColor`이므로 버튼 색을 따라오게 두면
> 저절로 맞는다** — `Typography`로 감싼 레이블은 `color="text-current"`로 둔다.
> (실제 사고: 근무일정 `추가`가 outline-secondary 버튼인데 레이블만 파래져 보더(gray)와 갈렸다.)
>
> - 회색 **텍스트** 추가 버튼은 파랑으로 통일한다 — 추가는 그 자리에서 사용자가 다음에 할 수 있는
>   일이라 중립 회색으로 묻어두지 않는다. (§Primary 버튼은 한 화면에 하나 규칙과 충돌하지 않는다 —
>   그건 **Solid 면**을 가진 CTA 이야기고, 이건 면 없는 텍스트/점선 액션이다.)
> - 예외는 **첨부·업로드처럼 '더하기'가 아닌 액션**뿐 — 아이콘만 같은 `+`를 쓰되 색은 그 자리의
>   중립색을 따른다.

사이즈는 4단(높이 × 좌우 padding × 상하 padding), radius는 전 사이즈 8 고정. **리딩/트레일링 아이콘 크기는 버튼 높이별로 지정**하며(아래), **아이콘–텍스트 gap은 항상 8 고정**:

```yaml
Small:  32 × 16 × 0    # 고정 높이 · 아이콘 16
Medium: 40 × 24 × 10   # 레이블 15 · 아이콘 20
Title:  44 × 20 × 10   # 레이블 16 · 아이콘 20 · 타이틀(44)·인풋 정렬 전용
Large:  48 × 20 × 10   # 레이블 16 · 아이콘 20
XLarge: 52 × 24 × 10   # 레이블 16 · 아이콘 24
```

**버튼 높이 → 아이콘 크기**: `52 → 24` · `48·44·40 → 20` · `32 → 16`. gap은 크기와 무관하게 항상 8.

### button-primary

Solid. `{color.action-primary}`(primary-500) bg + 흰 텍스트. Hover `primary-600`, Pressed `primary-700`. **Disabled 면 `{color.action-primary-disabled}`(primary-200) + 라벨 `{color.action-primary-disabled-fg}`(흰색)** (2026-09-02 개정 — 옛 `primary-300` 라벨은 면(primary-200)보다 겨우 한 단계 진해 "흐릿하게 눌린 글씨"로 읽혔다. 비활성 신호는 **면(배경 톤)만 지고 라벨은 흰색을 유지**한다 — 활성과 같은 라벨색이라 버튼의 정체는 유지되고, 위계는 면 대비로만 떨어진다).

> **🔴 Primary CTA의 비활성은 앱 전체에서 한 모습이다.** 비활성 색은 원시 팔레트를 직접 쓰지 않고 위 **시맨틱 토큰 두 개만** 호출한다(`disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg`). 회색 비활성(`gray-100/200` 면 + `gray-400` 라벨)은 **중립 컨트롤 전용**이며, 활성이 `primary-500`인 버튼에는 쓰지 않는다 — 같은 급 CTA가 화면마다 파랑/회색으로 갈리면 "비활성"이 두 가지 언어가 된다(2026-09-02 전면 통일: 회색으로 갈라져 있던 16곳 교정). 라벨을 `Typography`로 감싸는 인라인 버튼도 상태 분기 없이 흰색을 유지한다.

### button-secondary

Tonal(보더 없음). bg `primary-100` + 텍스트 `primary-500`. Hover bg `primary-200`. Pressed bg `primary-300`·텍스트 `primary-600`. Disabled bg `primary-100`·텍스트 `primary-300`.

### button-tertiary

Gray solid. bg `gray-100` + 텍스트 `gray-600`. Hover·Pressed bg `gray-200`. Disabled bg `gray-050`·텍스트 `gray-300`.

### button-white

흰 배경 + **회색 텍스트**(`gray-600`). Hover bg `gray-050`·텍스트 `gray-800`. Pressed bg `gray-200`·텍스트 `gray-900`. Disabled bg `gray-050`·텍스트 `gray-300`. 동반 아이콘은 `{color.icon-primary}`(hex 하드코딩 금지).

> **회색 면 위 예외** — 흰 버튼이 `gray-050` 배경(빈 상태 박스·페이지 캔버스) 안에 놓이면 hover bg를 쓰지 않는다. 배경과 같은 색이라 버튼이 사라진다. 대신 **`{color.border-default}`(gray-200) 인셋 테두리**로 hover를 표시하고 배경은 흰색을 유지한다(레이아웃 밀림 방지 위해 평소엔 투명 테두리를 깔아둔다). 회색보다 연한 단계는 사다리에 없으므로(white가 이미 기본 상태) 배경으로는 해결되지 않는다.

> 2026-08-04 재정의 — 이전 정의는 파란 텍스트(`primary-500`)였으나 **회색으로 통일**한다. 흰 버튼은 회색 빈 상태 박스·회색 캔버스 위에서 면(흰 배경)으로 구분되는 중립 액션이며, 파란 텍스트는 primary CTA와 위계가 충돌한다. 파란 강조가 필요하면 button-secondary(tonal) 또는 button-primary를 쓴다.

### button-billing

청구용 라인(민트 아웃라인). **색은 전부 `billing-*` 시맨틱 토큰으로만 부른다** — 화면·컴포넌트에서 `mint-500` 같은 원시 팔레트를 직접 쓰지 않는다(§Do's).

| 상태 | 보더 | 라벨·아이콘 | 배경 |
|---|---|---|---|
| **default** | `billing-line`(mint-300) | `billing-fg`(mint-500) | 투명/흰색 |
| **hover** | `billing-line-hover`(mint-400) | `billing-fg-hover`(mint-600) | `billing-surface-hover`(mint-50) |
| **pressed** | `billing-line-pressed`(mint-500) | mint-700 | mint-50 |
| **disabled** | `billing-line-disabled`(mint-200) | `billing-fg-disabled`(mint-300) | 투명 |

- **라인은 라벨보다 두 단계 연하다.** 보더까지 mint-500으로 주면 아웃라인이 solid처럼 튀어, 페이지의 메인 CTA와 같은 급으로 읽힌다(2026-08-18 전면 교정 — 코드가 mint-200/300/500 세 톤으로 갈라져 있었다).
- **hover는 보더·라벨이 함께 한 단계 진해진다**(단조 심화). 옛 표기 "hover 텍스트 mint-400"은 default(500)보다 **연해지는** 방향이라 §Do's의 hover 규칙과 모순 — 폐기하고 mint-600으로 교정했다.
- 카노니컬 클래스: `border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover`
- 라벨을 `Typography`로 감싸면 **`color="text-current"`** 로 둔다 — 자식이 자기 색을 고정하면 부모의 hover 색이 먹지 않는다.
- **상태(청구하기/청구 확인/청구 완료)에 따라 보더 톤을 바꾸지 않는다.** 같은 버튼이 상태만 바뀌었는데 라인 굵기가 달라 보인다.

### button-billing-solid

청구용 솔리드. bg **`{color.billing-solid}`**(mint-500 `#00ACA6`) + 흰 텍스트. Hover **`{color.billing-solid-hover}`**(mint-600), Pressed `mint-700`. Disabled bg `mint-100`·텍스트 `mint-300`. **아웃라인과 같은 이유로 화면에서 `bg-mint-500`을 직접 쓰지 않는다** — 면 토큰 2개를 호출한다(2026-09-07 등재). ⚠️ 흰 텍스트 대비가 낮은 편(약 2.8) — 라벨 가독성이 중요하면 bg를 `mint-600`~`700`으로.

### button-outline (3색 · 톤 통일)

Category=Outline은 전용 토큰 3색이며 **동일 톤으로 통일**돼 있다 — 보더는 옅은 단계, 텍스트는 진한 단계, hover 시 옅은 동색 배경.

- **outline-primary** — 보더 `primary-300` · 텍스트 `primary-500` · bg 투명. Hover bg `primary-050`, Pressed bg `primary-100`. Disabled 텍스트 `primary-300`.
- **outline-secondary** — 보더 `gray-200` · 텍스트 `gray-700` · bg 투명. Hover bg `gray-050`, Pressed bg `gray-100`. Disabled 보더 `gray-100`·텍스트 `gray-400`.
- **outline-caution** — 보더 `red-200`(옅음) · 텍스트 `red-500` · bg 투명. Hover 보더 `red-300`·bg `red-050`, Pressed 보더 `red-400`·bg `red-100`. Disabled 텍스트 `gray-400`.

```
<!-- 카노니컬 사용 예 (SvelteKit + Tailwind 부록 참고) -->
<button class="inline-flex items-center gap-2 h-10 px-6 rounded
  bg-brand hover:bg-brand-hover text-fg-inverse font-medium">저장</button>
```

### icon-button

단독 아이콘 버튼 **44×44**, radius `{radius.icon-btn}`(8), 패딩 좌우 8 상하 6. bg 투명 → hover `{color.bg-surface-sunken}`.

### text-input / field

높이 **44**, radius **8~10**(드롭다운 8·검색 10), 패딩 좌우 10~12·상하 10. bg `{color.bg-surface}` + 1px `{color.border-default}` 보더, 텍스트 `{color.text-body-default}`(14~16), placeholder `{color.text-placeholder}`. **Focus** — 보더 `{color.border-active}`(primary-500) **1px만**. ring(box-shadow)을 얹지 않는다 — 보더 위에 1px이 더해져 2px처럼 두꺼워 보인다(2026-08-19 개정). **Error** — 보더 `{color.status-danger}` + 하단 `{color.status-danger}` 문구(아래 §입력 하단 문구). **Disabled** — bg `{color.bg-surface-sunken}`·텍스트 `{color.text-state-disabled}`.

### checkbox / radio + 레이블

체크박스·라디오 옆에 붙는 **선택지 레이블은 `Body_01/Normal-Medium`(16 / 500)** 하나로 고정한다.
성별(남자·여자), 고용형태(정규직·계약직·프리랜서), 유형 선택 등 컨트롤 하나가 곧 항목인 자리 전부.

- 컨트롤↔레이블 간격 **8**, 선택지끼리는 그 이상(24 이상)으로 벌려 어느 레이블이 어느 동그라미의
  것인지 눈으로 갈리게 한다.
- **SemiBold를 쓰지 않는다.** 레이블은 값이지 제목이 아니다 — 굵히면 폼 안에서 섹션 머리글로 읽힌다.
- 폼 **필드 라벨**(§5.5 `Body_02/Normal-Medium` 15)과 다르다. 필드 라벨은 "무엇을 묻는가"이고
  이건 "고를 값"이라, 값 쪽이 한 단계 크다.
- 실제 사고: 같은 성별 선택이 화면마다 `Title_02/SemiBold`(16/600) · `Body_01/Regular`(16/400) ·
  `Body_02/Regular`(15/400)로 갈려 있었다(2026-08-19 통일).

### filter-reset (필터 초기화 버튼) — 전 화면 단일 규격

리스트·캘린더 화면 필터 바의 초기화. **정본 컴포넌트 = `FilterResetButton`** — 페이지에서 버튼을 직접 그리지 않는다.

| 항목 | 값 |
|------|-----|
| 기본형 `icon` | **44×44** · radius 8 · bg `{color.bg-surface}` + 1px `{color.border-default}` · 아이콘만 |
| 변형 `label` | 높이 44 · 좌우 16 · 아이콘+"초기화" · bg `{color.bg-surface-sunken}` pill (필터가 한 줄로 끝나는 좁은 바) |
| 아이콘 | `RefreshIcon` · `{color.icon-primary}` |
| **hover** | 면 한 단계 진하게 + 아이콘 **180° 회전** + `{color.text-body-strong}` |
| **툴팁** | **활성일 때만** 붙인다 — "필터 초기화". disabled면 툴팁 없음(누를 수 없는 버튼이 말을 걸면 상태가 흐려진다, 2026-08-26 개정) |
| **disabled** | 기본값과 다른 필터가 하나도 없을 때. 보더 `{color.border-subtle}` · 아이콘 `{color.text-state-disabled}` · **회전·색 변화·hover 면 전부 없음** |

- **인터랙션과 툴팁은 세트다.** 아이콘만 있는 버튼은 이름이 없으므로 툴팁이 이름을 대신하고,
  회전은 "눌리는 것"임을 알린다. 둘 중 하나만 있으면 페이지마다 다른 버튼처럼 읽힌다
  (실제 사고: 9개 페이지가 hover만 / 툴팁만 / 둘 다 없음으로 제각각이었다).
- **누를 게 없으면 못 누르게 한다.** 각 페이지가 `filters.buildFilters()`를 기본값과 대조해
  `disabled`를 넘긴다. 탭·정렬·뷰 토글은 필터가 아니므로 판정에서 뺀다.
- 위치는 필터 바 맨 끝 — 정렬·뷰 토글이 뒤따르면 `h-9 w-px bg-gray-200` 구분선으로 가른다.

### dropdown (드롭다운 · 선택지 패널) — 전 화면 단일 규격

**정본 = Figma `SaaS V.2 통합` node `1170:67951`.** 셀렉트·필터·검색 결과·케밥(더보기) 메뉴·
버튼을 눌러 열리는 선택지 영역까지 **전부 같은 규격**이다. "드롭다운이냐 메뉴냐"로 갈리지 않는다 —
트리거에 매달려 떠오르는 선택지 목록이면 이 규격.

**트리거(Dropdown_Menu)** — 정본 = Figma node `655:57036`

드롭다운을 여는 필드. 필터 바의 셀렉트, 폼의 선택 입력, 다중선택 필터가 전부 이 하나를 쓴다.

| 항목 | 값 |
|------|-----|
| 높이 | **48**(작성 영역) / **44**(필터 바 안) — 아래 주 |
| 폭 | **140 기본** — 라벨이 길어 잘리는 경우만 마크업에서 넓힌다(`w-full`은 폼 필드) |
| radius | **8** |
| 배경 / 보더 | `{color.bg-surface}` + 1px `{color.border-default}` |
| 패딩 | **좌 12 · 우 8** — 우측은 아이콘(20)이 여백을 겸하므로 12가 아니라 8이다 |
| 라벨 | `Body_02/Normal-Regular`(15 / 400 / -0.41) · `{color.text-body-default}`(gray-700) |
| 아이콘 | **Icon/20/Arrow_Down**(`ArrowDownIcon20`) · 펼치면 180° 회전 · `{color.icon-primary}` |
| 라벨↔아이콘 | gap **8** |
| Open | 보더 `primary-400` |
| 필터 활성 | 보더 `primary-500` + 라벨·아이콘 `primary-600` |
| Placeholder / Disabled | 라벨 `{color.text-placeholder}` / bg `{color.bg-surface-sunken}` + `{color.text-state-disabled}` |

> **라벨이 넘칠 때 — 말줄임은 이름에만 건다.** "김민준 외 2명"에서 잘려야 하는 건 이름이지 개수가 아니다.
> 라벨 `.dropdown-trigger-label`(`flex-1 min-w-0 truncate`) + 보조 `.dropdown-trigger-suffix`(`shrink-0`)로
> 나눠 담는다. 통짜 한 문자열을 truncate하면 "안녕하세요보호…"로 끝나 몇 명인지 사라진다.
> 셰브론 아이콘을 임의 크기(12·16)로 그리지 않는다 — 에셋 `ArrowDownIcon20` 하나만 쓴다.

**패널(Dropbox)**

| 항목 | 값 |
|------|-----|
| 배경 | `{color.bg-surface}` (white) |
| radius | **12** (`rounded-xl`) |
| 패딩 | **8** 사방 (`p-2`) |
| 항목 간격 | **4** (`gap-1`) |
| 그림자 | `{shadow.floating}` = `0 5px 20px rgba(66,66,66,.15)`, `4px 6px 6px -4px rgba(90,90,90,.04)` |
| 최소 너비 | **160** |
| **최대 높이** | **320** — 44 항목 6개(300)가 들어가고 7번째가 살짝 걸쳐 스크롤을 알린다. 넘치면 **패널이 스크롤**한다 |
| 보더 | **없음** (그림자가 표면을 세운다 — 보더+그림자 이중 처리 금지) |

> 검색·푸터처럼 **고정되어야 할 머리·꼬리가 있는 패널**은 패널 자신이 구르면 그것들이 같이 밀려난다.
> 이때는 패널에 `overflow-hidden`을 주고 **가운데 리스트 영역만** `min-h-0 flex-1 overflow-y-auto`로 굴린다.
> 이미 자체 상한을 가진 리스트를 품은 패널(검색 다중선택류)은 `max-h-none overflow-hidden`으로 전역 상한에서 빠진다 — 상한이 두 겹이면 스크롤바가 두 개 생긴다.

**항목(Dropdown_Field_Atomic)**

| 항목 | 값 |
|------|-----|
| 높이 | **44** (`h-11`) |
| 패딩 | 좌우 **8** (`px-2`) — 높이는 44 고정이 정한다 |
| radius | **8** (`rounded-lg`) — 패널 12 ⊃ 항목 8 (중첩 radius 규칙) |
| 타이포 | `Body_02/Normal-Medium` (15 / 500 / -0.41) |
| 색 | `{color.text-body-default}` (gray-700) |
| 정렬 | 좌측 라벨 · 우측 보조요소(`justify-between`), 라벨↔보조 gap **8** |
| hover | `{color.bg-surface-sunken}` (gray-50) |
| selected | bg `primary-50` · 텍스트 `primary` |
| danger | 텍스트 `red-600` · hover `red-50` (삭제 등 파괴적 액션) |
| dot(선택) | 8×8 원 — 담당자 색·상태 색 표시용 |

**무게(weight) — 패널 안 텍스트는 전부 Medium**

패널 안에서 `Regular`를 쓰지 않는다. 항목 라벨·부가 정보·빈 상태 문구·푸터 안내까지 **전부 Medium(500)**.
`SemiBold`는 두 곳만 — **그룹 헤더**와 **리치 행의 이름**(아바타가 붙는 검색 결과 행). 그 외 강조는 색으로 한다.
> 옛 사고: `Select`가 트리거용 `textClass`를 옵션 `<li>`에도 합쳐서, 같은 화면의 케밥 메뉴(Medium)와
> 필터 드롭다운(Regular)이 다른 무게로 보였다. 트리거 스타일은 옵션에 흘리지 않는다.

**패널 꼬리 안내(찾는 항목이 없을 때 + 인라인 등록) — 전 화면 단일 규격** (2026-09-02 등재)

검색형 드롭다운의 리스트 아래에 붙는 "찾는 X가 없나요? + 새 X 등록" 한 줄. 규격이 없어
내담자·기관·양식·지원사업 드롭다운 5곳이 제각각(안내 15/500·15/400·14, 링크 16·15,
아이콘 24 원판·20 선, 간격 4·8·12)으로 굳었던 자리다.

| 항목 | 값 |
|---|---|
| 컨테이너 | 상단 1px `{color.border-subtle}` · 상하 **16**(`py-4`) · 가운데 정렬 · 안내↔링크 gap **8** |
| 안내 문구 | **`Body_02/Normal-Regular`(15/400)** · `{color.text-body-default}` |
| 등록 링크 | **`Body_02/Normal-Medium`(15/500)** · `{color.action-primary}` · hover `underline` |
| 아이콘 | `PlusIcon20`(20 · `currentColor`) · 아이콘↔텍스트 gap **8** (§button 추가 액션) |
| 빈 상태 | 같은 규격 — 문구만 "검색 결과가 없어요" / "등록된 X가 없어요"로 갈린다 |

- **안내와 링크는 같은 15**, 굵기(400/500)와 색(회색/파랑)으로만 갈린다. 링크를 16으로 키우면
  한 줄 안에서 baseline이 어긋나고 패널의 다른 행(15)과도 안 맞는다.
- 이 자리는 §dropdown "패널 안 텍스트는 전부 Medium"의 **예외**다 — 안내는 Regular(2026-09-02 결정).
- 문구는 해요체(`~없어요`)이고 **`~하기` 어미 금지**(`새 양식 만들기` ❌ → `새 양식 등록` ✅).
  도메인 어휘는 리터럴 대신 `t()` 경유(기관 프로필에 따라 "내담자"가 바뀐다).

**다중선택이면 하단에 액션 바** — 접수일 필터(`DateRangeFilter`)와 동일 규격

체크박스로 여러 개를 고르는 드롭다운은 체크 즉시 반영하지 않는다. **draft에 모았다가 '적용'에서 커밋**한다
(고르는 도중마다 목록이 다시 그려지면 고를 수가 없다). 패널 밖을 클릭해 닫으면 draft는 버린다.

| 항목 | 값 |
|------|-----|
| 바 | 상단 1px `{color.border-subtle}` · **두 버튼 모두 우측 끝에 모인다 — `초기화` → `적용` 순**(`justify-end`) · 버튼 간 gap **8** |
| 버튼 | 높이 **32** · radius 8 · 좌우 **16** · `Body_03/Normal-Medium`(14/500) |
| 초기화 | 적용 **바로 왼쪽**(gap 8) · **좌우 패딩 8**(면 없는 레이블 버튼이라 16을 주면 쉬는 상태에서 적용과 너무 벌어져 한 묶음으로 안 읽힌다) · 기본은 레이블만(bg 없음) `{color.text-body-subtle}` · **hover `{color.bg-surface-sunken}` 면 + `{color.text-body-strong}`** — 클릭 영역이 보여야 한다. 적용(gray-100)보다 한 단계 옅게 |
| 적용 | 우측 끝 · 회색 solid `{color.bg-surface-sunken}`+`{color.text-body-subtle}` · 좌우 패딩 16 · hover 한 단계 진하게. 변경이 없으면 disabled(`gray-50` / `gray-300`) — **disabled일 때는 hover 반응을 주지 않는다**(면이 깔리면 눌리는 줄 안다) |

**너비 — 항목은 절대 두 줄로 접히지 않는다**

- 항목 텍스트는 `whitespace-nowrap`. 줄바꿈으로 44 높이가 깨지는 것을 허용하지 않는다.
- 패널 폭 = `max(160, 트리거 폭, 가장 긴 항목 폭)`을 **4px 배수로 올림**한다.
  트리거 폭은 상한이 아니라 **하한**이다 — 짧은 트리거 밑에 긴 항목이 오면 패널이 넓어진다.
- 구현: `positionPortal.ts`가 portal 드롭다운의 폭을 자동으로 스냅한다(`min-width` + 4px 올림).
  portal을 쓰지 않는 드롭다운은 `min-w-*`를 160 미만으로 주지 않는다.

**체크박스 — 필요한 화면에만**

Figma 시안에는 항목 우측에 체크박스가 있으나 그건 **다중선택 변형**이다.
단일선택 드롭다운·액션 메뉴에는 **붙이지 않는다.** 다중선택일 때만 공용 `Checkbox`(20 박스 / 1.5px
`{color.border-default}` / radius 4)를 항목 우측에 둔다.

- **선택했을 때만 나타나는 체크 아이콘을 쓰지 않는다.** 다중선택은 빈 체크박스가 **항상 보여야** 고를 수
  있다는 걸 알린다 — 아이콘이 선택 후에야 나타나면 열었을 때 다중선택인지 알 수 없고, 같은 필터 바에서
  이웃 드롭다운과 어포던스가 갈린다. 단일선택에서 현재 값을 표시하는 체크 아이콘(`showCheck`)은 별개다.

**구현 (app.css 유틸 — 값을 화면마다 다시 적지 않는다)**

```
.dropdown-panel   패널        (radius 12 · p 8 · gap 4 · shadow-dropdown · min-w 160 · max-h 320 + scroll)
.dropdown-list    내부 리스트  (스크롤 래퍼 등 — gap 4만, 자체 여백·그림자 없음)
.dropdown-search  패널 머리 검색 필드 (h 44 · radius 8 · bg gray-50 · 1px gray-100 · px 10 · gap 8 · 입력 16/500)
.dropdown-trigger 트리거 필드 (h 44 · w 140 · radius 8 · pl 12 / pr 8 · 15/400 gray-700 · 1px gray-200)
  └ .is-open / .is-active / .is-placeholder / .is-disabled
.dropdown-trigger-label / .dropdown-trigger-suffix   라벨(말줄임) / 보조 문구(안 잘림)
.dropdown-footer  다중선택 액션 바
  └ .dropdown-footer-reset(초기화) / .dropdown-footer-apply(적용)
.dropdown-item    항목        (h 44 · px 8 · radius 8 · Body_02/Normal-Medium · gray-700)
  └ .is-selected / .is-danger / .is-disabled
.dropdown-item-dot  8px 원
.dropdown-divider   항목 그룹 구분선 (1px gray-100)
```

전부 `:where()`로 감싸 **특이도 0** — 마크업의 Tailwind 유틸(`w-*`·`h-auto`·`min-w-*`)이 항상 이긴다.
규격이 기본값이고 화면별 예외는 클래스 하나로 덮는다. 새 드롭다운은 이 유틸을 쓰고,
`rounded-lg + border + shadow-lg` 같은 조합을 다시 만들지 않는다.

**변형 — 그룹 드롭다운 (검색 + 접히는 그룹)**

담당자 선택처럼 항목이 많아 **분류로 접어야 하는** 드롭다운. 정본 = Figma node `3437:238264`.
기본 패널·항목 규격을 그대로 쓰되 다음만 다르다.

| 항목 | 값 |
|------|-----|
| 패널 | 너비 **248**(246→4px 배수) · 패딩은 기본과 같은 **8**(시안의 16/12를 따르지 않는다 — 아래 주) · radius 12 · 같은 그림자 |
| 검색 | `.dropdown-search` — 높이 **48** · radius 8 · bg `{color.bg-surface-sunken}` · 1px `{color.border-subtle}` · 좌우 패딩 10 · 아이콘 24(네이티브) · gap 8 · `Body_01/Normal-Medium`(16), placeholder `{color.text-placeholder}`. **검색 필드를 쓰는 드롭다운은 전부 이 하나를 공유한다**(담당자·내담자 필터 등) |
| 그룹 | 상하 패딩 **8** · 그룹 사이 1px `{color.border-default}`(마지막 그룹 제외) |
| 그룹 헤더 | 높이 **36**(패딩 포함 52) · **좌우 안쪽 여백 4** · `Body_02/Normal-Semibold`(15) `{color.text-body-strong}` · `이름 · gap 8 · 개수`(숫자만, "명" 없음) · 우측 화살표 아이콘 20(펼침 시 180° 회전) |
| 그룹 ↔ 항목 | gap **8** |
| 스크롤 | 검색은 고정, **그룹 목록만** 스크롤(패널 `overflow-hidden` + 목록 `min-h-0 flex-1 overflow-y-auto`) |
| 항목 | 기본 규격 그대로(44 · px 8 · radius 8 · 15/500) — 좌측 담당자 색 dot 8, **우측 체크박스**(다중선택) |

항목끼리는 그룹 안에서 **간격 0**으로 붙인다(그룹 자체가 이미 묶음을 만들므로 4 간격이 중복 신호가 된다).

> 아코디언(접히는 그룹) 헤더는 패널 안쪽에서 **좌우 4를 더 들여쓴다** — 제목이 패널 벽에 붙으면
> 아래 항목보다 바깥으로 튀어나와 보인다. 구분선은 들여쓰지 않는다(그룹 경계는 끝까지 그어야 갈린다).
>
> **패딩은 기본 패널과 같은 8이다** — 시안의 좌우 16 / 상하 12를 따르지 않는다(2026-08-19 결정).
> 드롭다운 패딩은 변형마다 달라지지 않는다. 8 하나로 고정해야 검색·항목·액션 바가 같은 세로선에 서고,
> 화면을 옮겨 다닐 때 패널 안쪽 여백이 흔들리지 않는다.
>
> 그룹 헤더는 시안(Figma 16)에서 **한 단계 내려 15**를 쓴다(2026-08-19 결정). 항목과 같은 크기가 되고
> 위계는 굵기(SemiBold)만으로 진다 — 240 남짓한 패널에서 16은 헤더가 항목을 눌러 목록이 아니라
> 제목 나열처럼 읽힌다. 위계는 크기가 아니라 굵기로(§Do's and Don'ts).

**이 규격을 쓰지 않는 예외 (전부)**

- **날짜 필드**(접수일·기간 선택) — 셰브론이 아니라 캘린더 아이콘을 달고 팝오버가 그리드다. §text-input 소유(높이 44·radius 8·1px gray-200은 이미 같다).
- **케밥·아이콘 버튼** — 트리거가 필드가 아니라 아이콘이다. 열리는 패널만 이 규격을 따른다.
- **배지형 상태 셀렉트**(`BadgeDropdown`) · **칩 셀렉트**(`PersonChipSelect`) — 표 안의 배지가 곧 트리거다.
- **폼 빌더 인스펙터**(`BuilderSelect`, 높이 32) — 밀집 편집 툴. 44로 키우면 인스펙터가 무너진다.
- 예외를 늘리지 않는다. 새 드롭다운은 위 다섯에 해당하지 않으면 무조건 `.dropdown-trigger`.

> 캘린더/데이트피커 팝오버는 드롭다운이 아니다(선택지 목록이 아니라 그리드) — §card·자체 규격을 따른다.

### text-field (입력 필드) — 전 화면 단일 규격

**정본 = Figma node `624:38104` `Textfield_Vertical`.** 라벨·`*`·입력 안 아이콘·보조문구가
상황에 따라 붙었다 빠지는 한 벌이다. 빠진 요소의 자리를 남기지 않는다(gap 기반).

```
라벨 (15/500 · title-subtle)  [*]  [i]
  ↓ 8
입력 (48 · radius 8 · 좌우 12)             [아이콘 20]
  ↓ 8
보조문구 (14/400 · line-height 1.5 · gray-600)
```

| 요소 | 값 |
|------|-----|
| 라벨 | `Body_02/Normal-Medium`(15 / 500) · `{color.text-title-subtle}`(#58626C) · 요소 간 gap **4** |
| 필수 `*` | **16 / 500** · `{color.status-negative}` — 라벨보다 한 단계 크다(작으면 안 보인다) |
| 라벨 ↔ 입력 | **8** |
| 입력 | 높이 **48**(필터 바 안에서는 44 — §dropdown 주) · radius **8** · bg `{color.bg-surface}` · 1px `{color.input-border}`(#E4E4E8) · 좌우 패딩 **12** |
| 입력 텍스트 | `Body_01/Normal-Regular`(16 / 400) · `{color.text-body-default}` |
| placeholder | 같은 16/400 · **`{color.text-placeholder}` 토큰만**(#AAB2BE). `gray-300`·`gray-400`을 직접 쓰지 않는다 — 화면마다 미입력 상태의 톤이 달라진다 |
| 입력 안 아이콘 | **20**, 우측 12에 세로 가운데. 있을 때만 그만큼 `pr-*`를 더한다 |
| Focus / Error | 보더 `{color.border-active}` / `{color.status-negative}` |
| Disabled·readonly | bg `{color.bg-surface-sunken}` · 텍스트 `{color.text-state-disabled}` |
| 입력 ↔ 보조문구 | **8** (시안은 10이지만 4px 그리드에 맞춰 8 — 2026-08-19 결정) |
| **필드 한 벌 ↔ 다음 필드 한 벌** | **24** — 한 벌 안(라벨↔입력 8)의 3배. `구분 > 그룹 내부`(§Spacing) 부등식 |
| 보조문구 | `Body_03`(14 / 400) · 라인박스 **20** · `{color.text-body-subtle}`. 에러일 땐 `{color.status-danger}` — 전체 규격은 **§입력 하단 문구(에러·헬퍼)** 가 정본이며 이 행은 그 요약이다 |

> **높이는 자리가 정한다 — 작성 48 / 필터 44** (2026-08-19 결정).
> 모달·등록 페이지처럼 **정보를 작성하는** 입력 나열은 48, 목록 위 **필터 바**는 44.
> 필터는 값을 쓰는 자리가 아니라 고르는 자리라 본문을 밀어내지 않을 만큼만 차지한다.
> 한 줄 안에서는 예외 없이 같은 값이다 — 입력·셀렉트·검색·초기화 버튼이 전부 그 줄의 값을 따른다.
> 구현: 컨트롤 기본은 48, **필터 줄 컨테이너에 `.filter-bar` 하나만 붙이면** 안의 컨트롤이 함께 44가 된다
> (컨트롤마다 높이를 다시 적지 않는다). 44는 드롭다운 항목·아이콘 버튼의 값이기도 하다.
>
> **radius는 컨트롤 전부 8이다** — 입력·셀렉트·드롭다운 트리거·항목·검색 필드가 한 값을 쓴다
> (시안의 입력 12는 따르지 않는다, 2026-08-19 결정). 폼에서 입력과 셀렉트가 나란히 서는데
> 라운드가 다르면 같은 줄이 두 종류로 읽힌다. 12는 **컨테이너**(드롭다운 패널)의 값이고,
> 16은 카드다 — 중첩 radius 사다리(카드 16 ⊃ 패널 12 ⊃ 컨트롤 8, §Rounded)는 그대로 유지된다.

**구현 (app.css 유틸 — 화면마다 값을 다시 적지 않는다)**

```
.field-group   라벨+입력+보조문구 한 벌 (flex col · gap 8)
.field-label   라벨 (15/500 · title-subtle · gap 4)
.field-required  필수 * (16/500 · status-negative)
.field-input   입력 (48 · radius 8 · px 12 · 16/400)  └ .is-error / .is-disabled
.field-help    보조문구 (14/400 · 150%)  └ .is-error
```

- 전부 `:where()` 특이도 0 — 마크업의 `w-*`·`bg-*`·`pr-*`가 항상 이긴다. 폭·아이콘 여백만 화면이 정하고
  높이·라운드·보더·타이포는 유틸이 소유한다.
- **입력마다 `h-12 rounded-lg border border-gray-200 px-2.5 focus:...`를 다시 적지 않는다.**
  (실제 사고: 274개 입력이 높이 44/48/52, radius 8/12, 패딩 10/12/16, 타이포 4종으로 갈려 있었다.)
- **입력을 감싼 래퍼는 입력만 감싼다.** 래퍼에 `mt-*`·`p-*`를 주면 부모의 gap과 이중으로 붙어
  라벨이 멀어진다(실제 사고: 라벨 gap 12 + 래퍼 `mt-2` = 20). 여백은 부모의 gap 하나만 소유한다.
- **작성 영역에서는 예외 없이 48이다.** 모달 안이라고 44로 줄이지 않는다 — 같은 폼이 화면 위치에 따라
  다른 규격이 되면 규격이 아니다. 44로 내려가는 자리는 **필터 바 한 곳뿐**이고, 그건 컨트롤이 아니라
  컨테이너(`.filter-bar`)가 정한다.
- 드롭다운 패널 머리의 검색 필드는 이것이 아니라 `.dropdown-search`가 소유한다(§dropdown).

> ## 🔴 textarea (여러 줄 입력) — 높이 120 고정 (2026-08-28 등재)
>
> 메모·사유·안내처럼 여러 줄을 받는 입력의 규격. 라벨·보조문구·라운드·보더는 위 한 벌 규격을
> 그대로 따르고, **높이와 타이포만** 한 줄 입력과 다르다.
>
> | 항목 | 값 |
> |---|---|
> | 높이 | **120**(`h-30`) 고정 · `resize-none` — 사용자가 늘리게 두지 않는다 |
> | 패딩 | 좌우 **12**(`px-3`) · 상하 **14**(`py-3.5`) — 좌우는 한 줄 입력과 같은 12, 상하만 첫 줄이 위에 붙지 않게 한 단 키운다 |
> | 텍스트 | `Body_01/Reading-Regular`(16 / 400 / **150%**) · `{color.text-body-default}` — 여러 줄이므로 Normal(100%)을 쓰지 않는다(§Typography) |
> | 보더·라운드·Focus | 한 줄 입력과 동일(1px `{color.input-border}` · radius 8 · focus `{color.border-active}`) |
>
> - **`rows` 로 높이를 만들지 않는다.** `rows={2}`처럼 줄 수로 잡으면 폰트·행간에 따라 화면마다
>   높이가 갈린다(실제 사고: 같은 성격의 메모 입력이 78 / 120 / 132로 셋이었다). 높이는 `h-30` 하나가 정한다.
> - 120은 **3줄이 보이고 4번째 줄이 스크롤로 이어지는** 크기다. 더 긴 본문을 받는 자리(상담일지 등)는
>   이 입력이 아니라 전용 에디터가 소유한다.
> - 구현 다수파 = `components/modal/{ChangeClientInfo,MemberModify}Modal.svelte`의 메모 입력.

### card

bg `{color.bg-surface}`(white) + radius `{radius.card}`(16) + `{shadow.card}`, at-rest 그림자는 이 최소 그림자만. **패딩** — 리스트 카드 좌우 20·상단 24·하단 20 / 상세 패널 24(전방향). 내부 요소 gap 12~16, 내부 구분선 `{color.border-subtle}`, 인셋 영역(well)은 `{color.bg-surface-sunken}`.

**외곽선은 깔린 배경이 정한다** — 회색 면(`{color.bg-base}`) 위 = `{color.border-subtle}` / 흰 면 위 = `{color.border-default}`. 근거·판정 기준은 §Colors "카드 외곽선 — 깔린 배경이 정한다"가 소유한다.

**클릭 가능한 리스트 카드 — 단일 규격** (2026-08-27 등재). 목록에 반복 렌더되는 카드는 radius·외곽선·hover가 화면마다 갈리지 않는다:

| 항목 | 값 |
|---|---|
| radius | **16**(`rounded-2xl`) — 8·12 금지 |
| 외곽선 | 1px, 위 배경 규칙대로 (리스트 페이지는 회색 배경이므로 `{color.border-subtle}`) |
| hover | 보더 `{color.action-primary-hover}` 계열 **primary-400** + `{shadow.card-hover}` |
| 구현 | `border` (ring 아님) — 페이지 카드는 border가 다수파이자 §Layout 규약 |

적용처 = 상담현황·검사현황·내담자·구성원·상담일지·청구·필드노트 카드. **테이블 래퍼·패널 컨테이너·문서 썸네일(양식 갤러리)은 리스트 카드가 아니다** — 이 규격 밖.

### panel-header

상세 화면의 좌/우 패널 최상단 바(상담 상세 좌측 정보 패널·우측 회기 패널·회기 상세 헤더 등).

높이 **62 고정** · 패딩 좌우 24 · 하단 1px `{color.border-default}` · 내용 세로 가운데 정렬. 타이틀은 M레벨 `Title_01/Semibold`(18), 우측 액션은 `Title(44)` 사이즈 버튼·아이콘 버튼.

- **여기서만 고정 높이를 쓴다.** 모달 헤더(§modal)는 패딩이 높이를 정하지만, 패널 헤더는 좌우 2단 레이아웃에서 **두 컬럼의 헤더 밑선이 맞아야** 하고 그건 패딩이 아니라 고정 높이만 보장한다.
- 좁은 화면에서 헤더가 2줄로 접히는 경우만 고정을 풀고 상하 12 패딩으로 대체한다(`md:` 이상에서 62 유지).
- 2줄 구성(이름+메타)인 내부 정보 바는 패널 헤더가 아니다 — 패딩(상하 12~16)이 높이를 정한다.

### 🔵 panel-footer (하단 고정 액션 바) — 전 화면 단일 규격 (2026-08-28 등재)

상세 패널·문서 뷰어 **하단에 고정**되는 액션 바(상담 상세 일지의 `전달문 만들기·저장`, 검사 상세 PDF 뷰어의 `이전/다음·화면맞춤`). 스크롤되는 본문 아래 층에 항상 붙어 있는 바이며, 모달의 §modal Footer와는 **다른 규격**이다 — 모달 푸터는 패널 안에서 한 번 끝나는 확정 액션이라 상단 16/하단 20으로 무게를 주지만, 이 바는 화면이 살아 있는 동안 계속 떠 있는 도구 층이라 상하가 대칭이다.

| 항목 | 값 |
|---|---|
| 패딩 | 좌우 **20** · 상하 **12** (상하 대칭) |
| 상단 구분선 | 1px `{color.border-subtle}`(gray-100) — gray-200 아님. 본문과 붙어 있는 같은 면이라 한 단 연하게 |
| 바 높이 | **69** (1 + 12 + 44 + 12) — 고정 높이를 주지 않고 패딩·버튼이 정한다 |
| 버튼 높이 | **44**(§button `Title`) — 텍스트·아이콘 버튼 공통. 아이콘 버튼은 44×44 |
| 버튼 레이블 | `Body_01/Medium`(16) — 버튼 높이에 맞춘 값. 15로 내리지 않는다 |
| 버튼 간 gap | **8** (모달 푸터의 12과 다름 — 도구 층이라 더 조인다) |
| 배치 | 좌측에 상태 텍스트(저장 시각 등)가 있으면 `justify-between`, 없으면 `justify-end` |

- **버튼 크기·바 높이는 화면끼리 동일하고, 달라지는 것은 레이블뿐이다.** 같은 층위의 바가 화면마다 40/48로 갈리면 좌우 패널을 오갈 때 밑선이 흔들린다.
- 좌측 상태 텍스트는 `Body_03/Regular`(14) + `{color.text-body-subtle}`.
- 스텝 이동(이전/다음)처럼 폭을 맞춰야 하는 짝 버튼만 **너비 140 고정**을 함께 쓴다 — 높이·간격은 위 표 그대로다.
- 구현 정본 = `components/counseling/InlineJournalEditor.svelte` 하단 바 · `components/assessment/status/{SelfReport,ExternalService}DetailPanel.svelte` 하단 바. `components/PDFViewer.svelte`의 자체 툴바(줌·페이지 이동)는 문서 조작 도구라 이 규격 밖이다.

### badge

배지는 **두 형태(shape)** 로 정의된다 — 각진 **Rectangle**(낮은 라운드)과 알약형 **Round**(pill). 공통 규약: 아이콘(16×16)–텍스트 gap **4**, fg = hue 색, bg = **동일 hue의 저불투명 틴트**(약 8~12%). 색 세트는 §Colors의 Tag / Status Badge를 참조한다.

**Rectangle — 2 사이즈** (분류·라벨용: 팀명·카테고리 등)

| size | 높이 | radius | 패딩(상하×좌우) | 텍스트 |
|---|---|---|---|---|
| **S** | 24 | 4 | 6 × 8 | `Label_01/Medium` (13) |
| **M** | 32 | 6 | 6 × 12 | `Body_03/Medium` (14) |

**Round (pill)** — 상태 인디케이터(status badge)용

- 높이 **32**, radius `{radius.pill}`, 패딩 **8 × 12**, 텍스트 `Body_02/Medium` (15), 아이콘 16.
- 색은 상태 매핑을 따른다 — `pending`·`inactive` → `{color.tag-gray}`, `progress` → `{color.tag-blue}`, `done` → `{color.tag-green}`, `canceled` → `{color.tag-red}`. **취소 배지는 라벨에 `line-through` 병행.**

> Rectangle은 **정보 라벨**(중립·분류), Round는 **상태 표시**에 쓴다. 둘 다 짧은 라벨 전용 — 옅은 틴트 위 대비가 본문급에는 부족할 수 있다.

**🔴 일정 취소 배지 — 전 화면 단일 규격 (2026-08-19 등재)**

일정(회기·검사·운영)이 취소됐음을 알리는 배지는 **어느 화면에서든 아래 한 벌**로 고정한다.

| 항목 | 값 |
|---|---|
| 컴포넌트 | `BadgeRectangle` (`$lib/components/common/BadgeRectangle.svelte`) |
| 형태·크기 | **Rectangle S** — 높이 24 · 패딩 6×8 · `Label_01/Medium`(13) |
| 색 | `color="red"` = `{color.tag-red}` (bg `tag-red-bg` / fg `tag-red-fg`) |
| 라벨 | **"취소"** — 화면마다 '취소됨'/'취소된 일정'으로 갈리지 않게 고정 |
| 자리 | 정보 블록·팝오버는 **우상단**(`ml-auto`), 타이틀이 있는 헤더는 **타이틀 바로 옆** |

- 적용처: 검사 상세 좌측 패널(검사 일정) · 캘린더 칩 hover 팝오버 · 일정 상세 모달 헤더.
- 일정 상세 모달에서 **취소만** 배지이고 완료·진행중·노쇼는 종전대로 타이틀 위 `SessionStatusText`다 —
  회기 상태 전반을 배지로 올리면 케이스 상태 배지와 축이 겹친다(`SessionStatusText` 주석 참조).
- `rounded-full`·`text-xs`·`bg-red-100` 같은 하드코딩 금지. 취소 **일시·사유 텍스트**의 `line-through`는 배지와 별개로 유지한다.

> ## 🔴 입력 하단 문구(에러·헬퍼) — 규격 (2026-08-14 등재)
>
> 입력 아래에 붙는 보조 문구(유효성 에러·도움말)는 아래 값으로 고정한다. `text-[11px]`·`text-[13px]` 같은 **임의 크기 금지**.
>
> | 항목 | 값 |
> |---|---|
> | 크기·굵기 | **`Body_03`(14) Regular** — 폼 라벨이 `Body_02`(15)이므로 보조 문구는 한 단 아래가 하한. `Caption_01`(10)은 본문급 안내에 쓰지 않는다 |
> | 색 | 에러 `{color.status-danger}` / 헬퍼 `{color.text-body-subtle}` |
> | **입력 ↔ 문구 gap** | **4** — 입력에 종속된 부속 문구라 붙여 읽힌다(같은 정보군 8보다 한 단 좁게) |
> | 라인박스 | **20**(`leading-5`) — 타이포 토큰의 line-height가 14(=글자 크기)라 글리프가 박스 밖으로 삐져나와, 그대로 두면 CSS 4가 시각적으로 2~3처럼 읽힌다. 간격은 **텍스트 박스 기준**으로 재므로 라인박스를 정상 높이로 연다 |
> | 자리 확보 | 문구가 나타나도 행이 밀리지 않게 필드 컨테이너가 **하단 `gap + 라인박스`(= 4 + 20 = **24**)** 를 미리 확보하고, 문구는 `absolute bottom-0`으로 앉힌다 |
>
> - **⚠️ 같은 행의 다른 요소도 같은 하단 확보값을 갖는다.** 행이 `items-end` 정렬이면 확보값이 다른 요소만 아래로 내려가 기준선이 어긋난다(구성원 초대 모달에서 `추가` 버튼만 12px 내려갔던 사례).
> - 24는 임의값이 아니라 **파생값**이다(간격 4 + 라인박스 20). 값을 바꿀 땐 gap을 고치고 확보값을 다시 계산한다.

### tag

`badge` Rectangle/Round 형태에 §Colors의 Tag 10색 세트를 입힌 분류 라벨. fg `{color.tag-<hue>}` + 동일 hue 저불투명 bg, 필요 시 outline. **짧은 라벨 전용.**

### table

행 높이가 콘텐츠에 따라 갈린다.

- **헤더 행 44 / 52~56px** — 컬럼 라벨 `Body_02/Medium`(15) `{color.text-title-subtle}`(#58626C), bg `{color.bg-surface}`. 44는 컴팩트(카드 내 서브 테이블·선택 목록 등), 52~56은 표준 데이터 테이블.
- **바디 행** — 아바타(프로필 이미지) 포함 행 **80px** / 텍스트만 있는 행 **72px**. 행 구분선 하단 1px `{color.border-default}`(#DFE4EA), 행 hover bg `{color.bg-surface-sunken}`.
- **셀 패딩** — 좌 24 · 우 12 · 상하 10, 정렬 좌측 기본.
- **셀 텍스트** — 주 식별자(내담자 이름) `Title_01/SemiBold`(18) `{color.text-body-strong}` · 기본 셀 `Body_01/Regular`(16) `{color.text-body-default}` · 보조 값 `Body_02/Regular`(15) `{color.text-body-subtle}` · 서브 라벨 `Body_03/Medium`(14) · 코드·식별 태그 `Label_01/Medium`(13) · 인라인 버튼 `Body_03/Medium`(14).
- 상태 배지·진행바·인라인 버튼은 각 컴포넌트 토큰을 그대로 사용.

### modal

오버레이 `{color.bg-overlay}` 위에 패널이 뜬다. 패널 `{color.bg-surface}` + **radius 20** + `{shadow.floating}`. **폭 4단** — 540(기본) / 640(중간) / **740(2단 레이아웃)** / 1000(넓음, invoice류), **최대 높이 ≈ 940**. 740은 좌우 2단 구성 모달 전용(달력+선택 목록, 폼+미리보기 등) — 640이면 우측 단이 눌리고 1000은 과한 구간이다(2026-08-07 등재). 3영역 수직 구성:

- **Header** — 패딩 **좌우 20 · 상하 16**(2026-08-07 개정, 옛 좌우 24). 좌우는 본문·푸터와 같은 20으로 좌우선을 맞추고, **상하만 16**으로 줄인다 — 닫기 아이콘(32)이 타이틀(20)보다 커서 헤더 높이를 결정하는데, 상하 20 이상을 주면 헤더가 불필요하게 부푼다. 상하 16이면 **65**. **타이틀 = L레벨 `Headline_02/Semibold`(20) 고정** — XL(24)은 페이지 최상단 전용이라 모달에 쓰지 않는다(§Title system). 컬러 `{color.text-body-strong}`, 우측 닫기 아이콘 `{color.icon-secondary}`. **타이틀·닫기 아이콘은 세로 가운데 정렬**(닫기 아이콘 32이 타이틀보다 커서 상단 정렬하면 타이틀이 위로 뜬다) — 서브내용 한 줄이 붙는 2줄 헤더만 상단 정렬. (compact personinfo 헤더는 56, 패딩 12×16)
- **Content(본문)** — 패딩 **상·좌·우 20 · 하 28**(`p-5 pb-7`, 2026-08-28 개정 — 옛 20 사방, 그 전 24 사방), 필드 그룹 gap 24(그룹에 딸린 보조 컨트롤만 12). **상단은 헤더·푸터와 같은 20**이다 — 헤더 구분선 아래 첫 필드까지의 거리는 좌우선과 같은 값이어야 본문이 하나의 면으로 읽힌다. **하단만 28인 이유**는 그 아래 푸터 상단이 16으로 좁아 본문 마지막 요소가 확정 버튼에 붙어 읽히기 때문이다 — 하단만 한 단(8) 키워 '본문 끝 → 액션'의 경계를 만든다.
- **🔴 footer 없는 모달 — 본문 하단만 40** (2026-08-18 등재). 액션 버튼이 없어 footer를 두지 않는 조회 전용 모달(미리보기·상세·목록)은 **본문 하단 패딩을 40**(`pb-10`)으로 준다. **좌·우·상단 20은 그대로.** 본문 하단 28은 아래에 footer(상단 보더 + 16 + 버튼 44 + 하단 20 = 약 100)가 따라붙는 걸 전제한 값이라, footer가 빠지면 마지막 요소가 28만 남기고 패널 끝에 바로 붙어 눌려 보인다 — 특히 마지막이 보더 있는 표·카드처럼 무거운 블록일 때 두드러진다. 28은 본문 내부의 그룹 구분 간격(§Spacing ②, 24~32) 안에 들어 '바깥 여백'으로 읽히지 않으므로, 그 범위를 벗어나는 **40**을 쓴다.
  - 본문을 섹션으로 쪼갠 경우 이 40은 **마지막 섹션**이 소유한다(`px-5 pb-10`). `bodyClass`로 주는 경우는 `p-5 pb-10`.
  - **판정 기준은 footer 스니펫 유무가 아니라 '본문 맨 아래 액션 버튼 바'의 유무**다. footer 대신 본문 안에 취소/확인 버튼 행을 직접 그린 모달(BillableModalShell·BaroLinkInfoModal·PaymentReceiptModal)은 이미 하단 구조를 가지므로 **대상이 아니다** — 그 버튼 행이 footer 규격(`px-5 pt-4 pb-5`)을 따른다.
- **Footer** — 패딩 **좌우·하단 20 · 상단 16**(2026-08-07 개정, 옛 사방 24). 상단만 16인 이유는 헤더와 같다 — 본문 마지막 요소와 버튼 사이는 본문 자체의 하단 패딩(28)이 이미 벌려주므로 푸터 상단까지 20을 주면 하단부가 무거워진다. 상단 1px `{color.border-default}` 구분선, 버튼 **우측 정렬**(`justify-end`) · 버튼 간 gap **12** · **버튼 높이 44**(§button `Title` 토큰 — 옛 "container 높이 48" 표기는 폐기). 삭제 버튼이 동반되면 `justify-between`(삭제 좌 · 취소/확인 우).
- **2줄 헤더(타이틀+부제) 규격** (2026-08-12 등재) — 타이틀 밑에 설명 한 줄이 붙는 형태는 **타이틀↔부제 간격 8**, 부제 **`Body_02/Regular`(15) + `{color.text-body-subtle}`(gray-500)** 고정. 부제를 16/Medium으로 올리면 타이틀(20/600)과 위계가 경쟁하므로 한 단 낮춘다. gray-400은 비활성·고스트 색이라 부제 본문에 쓰지 않는다. 간격 4는 붙어 보이고 6은 4px 그리드를 벗어난다(§Spacing) — **8만 쓴다.** 세로 정렬은 이 형태만 상단(`items-start`).
- **헤더 하단 구분선은 기본 켬**(BaseModal `showHeaderBorder` 기본값 = 1px `{color.border-subtle}`). 타이틀과 본문을 가르는 선이 있어야 본문 상단 20이 '헤더에 딸린 여백'이 아니라 본문의 시작으로 읽힌다. 끄는 경우는 본문 첫 요소가 스스로 면을 갖는 형태(전폭 탭 바·회색 well·아이콘 중심 다이얼로그)뿐이며, 폼·목록 모달에서 임의로 끄지 않는다.
- **좌우 20은 세 영역 공통이며 하나만 달리 쓰지 않는다**(좌우선이 어긋난다). 상하는 영역마다 다르다 — 헤더 16/16 · 본문 20/28 · 푸터 16/20. 본문을 섹션으로 쪼갤 때는 컨테이너 패딩을 0으로 두고 **각 섹션이 좌우 20을 갖고, 첫 섹션이 상단 20 · 마지막 섹션이 하단 28을 소유한다**(패딩 소유자는 항상 한 곳).
- 헤더에 고정 높이(`h-*`)를 주지 않는다 — 높이는 패딩과 콘텐츠가 정한다. 2줄 헤더는 자연히 늘어난다.

### popup (confirm dialog)

확인·삭제 등 소형 다이얼로그. **폭 420**, `{shadow.popup}`(0 2px 16px α.10). 헤더가 없고 **본문 첫 요소가 아이콘**인 형태다 — 본문 패딩은 아래 표를 따른다. 요소 gap 16. 내부 강조 영역(well) `{color.bg-surface-sunken}`(gray-50) + radius 8 + 패딩 16. 푸터 패딩 **좌우·하단 20 · 상단 16**·버튼 gap **12**, 버튼은 **높이 44**로 좌우 **균등 2분할 전폭**(취소 좌 · 확인 우) — modal 푸터와 달리 우측 정렬이 아니다. (옛 "gap 8 · XLarge h52" 표기는 폐기 — 실제 구현은 44/12로 통일돼 있었다.)

> ## 🔴 헤더 없는 아이콘 다이얼로그 — 본문 패딩 32 / 20 / 12 (2026-09-07 등재)
>
> popup은 **헤더가 없다.** §modal의 본문 패딩(상 20 · 하 28)은 위에 헤더(상하 16 + 구분선)가 얹혀 있는 걸
> 전제한 값이라 popup에 그대로 쓰면 위아래가 모두 어긋난다 — 위는 아이콘이 패널 천장에 붙고,
> 아래는 본문 28 + 푸터 상단 16이 **이중으로 쌓여 44**가 되어 버튼 영역만 떠 보인다.
>
> | 변 | 값 | 이유 |
> |---|---|---|
> | **상단** | **32** (`pt-8`) | 헤더가 없어 이 패딩이 곧 패널의 천장 여백이다. 헤더 있는 모달은 헤더(16+16+구분선)가 그 역할을 하므로 본문이 20으로 시작하지만, 헤더가 빠지면 20은 아이콘이 모서리에 눌린다. 32는 **아이콘↔타이틀 간격(16)의 정확히 2배**라 `32 → 16 → 12`가 4px 그리드 위에서 한 사다리로 떨어진다(§Spacing). 40은 아래 간격들과 배수 관계가 없어 천장만 뜨고, 36은 그리드엔 맞지만 어느 값의 배수도 아니다. |
> | **좌우** | **20** | 본문·푸터 좌우선 공통 (§modal과 동일) |
> | **하단** | **12** (`pb-3`) | 아래 푸터가 이미 상단 16을 갖는다 — 본문 마지막 요소↔버튼 = 12+16 = **28**로 §modal과 같은 거리를 만든다. 여기에 28을 또 주면 44가 되어 버튼 영역이 본문에서 떨어져 나온다. |
>
> - **`bodyClass="px-5 pt-8 pb-3"`** 가 이 형태의 고정값이다. §modal의 `p-5 pb-7`을 popup에 복사하지 않는다.
> - **판정 기준 = 헤더(타이틀 행)의 부재 + 본문 첫 요소가 아이콘.** 타이틀 행이 있는 모달은 아이콘이 있어도 §modal 값(`p-5 pb-7`)이다.
> - 푸터가 없는 조회 전용이면 하단은 12가 아니라 §modal의 40 규칙(`pb-10`)을 따른다 — 12는 **푸터 상단 16과 합산되는 것**이 전제다.
> - **세로 사다리** — 아이콘 원(52) → 타이틀 16 → 서브문구 12 → 본문 블록 24 → 하단 12. `구분(24) > 그룹(12)` 부등식(§Spacing)이 성립한다.
> - 구현 정본 = `lib/components/modal/SecretModeActivateModal.svelte`.

> ## 🔴 confirm 다이얼로그 — 위험도(type) 3단계 (2026-08-14 등재)
>
> confirm은 `type`으로 **위험도**를 선언하고, 아이콘·확인 버튼 색이 거기서 자동으로 갈린다. 화면마다 아이콘·버튼 색을 손으로 고르지 않는다.
>
> | type | 언제 | 상단 아이콘 54 | 확인 버튼 |
> |---|---|---|---|
> | **`info`** (기본) | 되돌릴 수 있는 중립·긍정 확인 — 상태 전이, 승인, 재전송, 플랜 변경 | 초록 원 + 체크 | **Primary solid** (`primary-500` bg + 흰 텍스트) |
> | **`warning`** | 되돌리기 번거롭거나 부수효과가 있는 확인 — 일정 충돌, 비활성화, 종결, 구독 해지, 코드 재발급 | **`!` 경고 삼각형**(노랑) | **Primary solid** |
> | **`danger`** | **되돌릴 수 없는 파괴적 액션 — 삭제 전용** | 빨간 주의 아이콘 | 아웃라인 + **레드 텍스트** |
>
> - **⚠️ `!` 경고 삼각형은 `warning`·`danger`에만.** 중립 확인에 경고 아이콘을 붙이면 모든 확인이 위험해 보여 경고가 무뎌진다. `modalUtils.confirm`의 **기본 type은 `info`** 이며, 위험한 호출부가 `type`을 **명시**한다(안전한 기본값).
> - **⚠️ 확인 버튼의 레드는 `danger`(삭제)에만.** 버튼 2개짜리 다이얼로그의 메인 액션은 원칙적으로 **Primary solid**다 — 취소(아웃라인·회색)와 메인(솔리드·파랑)의 위계가 색으로 갈려야 어느 쪽이 진행인지 즉시 읽힌다. 둘 다 아웃라인이면 위계가 사라진다.
> - 아이콘을 예외적으로 바꿔야 하면 `modalUtils.confirm(msg, title, { icon })`로 호출부에서 지정한다(타입 기본값보다 우선). 타입 자체를 우회하는 용도가 아니라, 맥락에 더 맞는 아이콘이 있을 때만.
> - 구현 정본 = `lib/components/modal/ConfirmModal.svelte` + `lib/stores/modal.ts`. 값이 어긋나면 이 표가 이긴다.

### tab

두 형태(shape).

- **Underline** — 텍스트 `Body_01`(16) **Medium**(활성·비활성 공통, **SemiBold 아님**), 셀 너비 **140**, 상하 패딩 **20**, 아이콘–라벨 gap 4. 트랙 하단 1px `{color.border-default}`. **활성**: 텍스트 `primary-500` + 하단 2px `primary-500`. **비활성**: 텍스트 `gray-400`. **굵기는 Medium 고정**이며 활성/비활성 구분은 **색으로만** 한다(굵기 변화 없음). 공용 컴포넌트 `TabBar.svelte`가 이 규격의 단일 소스이므로 페이지에서 재정의하지 않는다.
- **Segmented(round)** — pill 높이 **36**, radius `{radius.pill}`, 패딩 상하10·좌우12, 그룹 내 gap 4. 활성: `gray-700`(#464F58) 채움 + 흰 텍스트. 비활성: 흰 bg + 1px `{color.border-default}`. 텍스트 15.

### pagination

컨테이너 gap 16. **페이지 버튼 40×40**, radius 4, 버튼 간 gap 8 — 활성 `{color.action-primary}` bg + 흰 텍스트, 비활성 투명 bg(hover `{color.bg-surface-sunken}`). 이전/다음 60×40(radius 6). 페이지당 개수 드롭다운 높이 44·radius 8, 텍스트 `Body_02/Regular`(15)·아이콘 20.

### tooltip

말풍선은 **하나의 규격**을 두 형태로 쓴다 — hover로 뜨는 `Tooltip`과 상시 노출 고지 `NoticeBubble`. 기준은 청구 화면의 '미청구 N건이 있어요!' 말풍선이다(2026-08-28 실측 등재, 옛 "gray-700 · 패딩 8 · 15" 표기는 구현과 어긋나 폐기).

| 항목 | 값 |
|---|---|
| 면 | `gray-800` + radius **8** |
| 패딩 | 좌우 **12** · 상하 **6** (닫기 버튼이 붙으면 오른쪽만 6) |
| 텍스트 | `Body_03/Normal-Regular`(14) 흰색 · 한 줄(`whitespace-nowrap`) |
| 꼬리 | 5px 삼각형, 면과 같은 색. 앵커 중앙(`bottom`) 또는 왼쪽 16(`bottom-start`) |
| 앵커와의 거리 | 상시형 **4**(`mb-1`, 꼬리 5 포함 실제 ~9) · hover형 8(컴포넌트 `offset` 기본값) |
| 닫기(상시형만) | 20×20 버튼 안 X 16, `gray-400` → hover 흰색. 아이콘↔텍스트 8 |

- **hover형(`Tooltip`)** — 보조 설명. 지연 100ms, 위치는 컴포넌트가 계산(뷰포트 clamp)한다.
- **상시형(`NoticeBubble`)** — "지금 눌러야 할 것"을 가리키는 고지. 항상 떠 있고 X로만 닫힌다(닫힘 상태는 호출부가 소유). 위치는 호출부가 `absolute`로 앵커에 맞춘다.
- 두 형태의 면·패딩·타이포는 **같다.** 화면마다 말풍선을 새로 그리지 않는다 — 둘 중 하나를 쓴다.

### loading-skeleton (로딩 스켈레톤) — 전 화면 단일 규격 (2026-08-19 등재)

데이터를 불러오는 동안 **그 화면이 곧 갖게 될 모양**을 회색 상자로 미리 보여준다. "로딩 중..." 같은
문구나 스피너는 자리를 차지하지 않아 데이터가 도착할 때 화면이 튀고, 무엇이 오는지도 알려주지 않는다.
모바일 앱과 같은 규격([apps/mobile/CLAUDE.md](../mobile/CLAUDE.md) §6.2)이다.

| 항목 | 값 |
|---|---|
| 색 | `gray-100` ↔ `gray-200` 왕복 (`{color.border-subtle}` ↔ `{color.border-default}`와 같은 두 단계) |
| 주기 | **1.4초** · `ease-in-out` · 무한 반복. `prefers-reduced-motion`이면 애니메이션 없이 `gray-100` 고정 |
| radius | 기본 8. 알약·원형 자리(배지·아바타)는 마크업에서 `rounded-full`로 덮는다 |
| 구현 | app.css 유틸 **`.skeleton`** 하나 — 색·주기는 여기만 소유하고, **크기·라운드는 마크업의 Tailwind 유틸**이 정한다(`:where()` 특이도 0) |

**2층 구조로 만든다**

1. **상자** — `.skeleton` 유틸. 새로 만들지 않고 재사용한다.
2. **화면별 조합** — 그 화면의 실제 레이아웃(카드 위치·크기)을 상자로 **그대로 흉내** 낸 것. 해당
   컴포넌트 옆에 `{이름}Skeleton.svelte`로 둔다(레퍼런스: `TodayScheduleCarouselSkeleton`).

**규칙**

- **상자 치수 = 실제 콘텐츠 치수.** 데이터가 도착할 때 레이아웃이 밀리면 스켈레톤이 제 일을 못 한 것이다.
  참조한 컴포넌트의 값이 바뀌면 스켈레톤도 같이 고친다.
- **데이터가 필요 없는 요소는 로딩 중에도 그대로 둔다** — 페이지 타이틀·섹션 제목·고정 라벨은 chrome이다.
  값 자리만 상자로 바꾼다(예: 처리할 일 카드는 라벨은 그대로, 건수만 상자).
- **한 화면의 쿼리가 여럿이면 전부 도착한 뒤 한 번에 걷는다.** 도착하는 대로 그리면 숫자가 0에서 뛰고
  빈 상태 문구가 잠깐 떴다 사라져 화면이 조각조각 튄다.
- **한 번 걷힌 스켈레톤은 되돌리지 않는다** — 백그라운드 갱신·권한 정보가 늦게 도착할 때 다시 깜빡인다.
- 로딩 중 카드는 누를 수 없게 한다(`disabled` + `disabled:pointer-events-none`) — hover가 살아 있으면
  아직 못 누르는 것이 눌리는 것처럼 보인다.
- **스켈레톤이 어려운 자리에만 문구를 남긴다** — 레이아웃을 알 수 없는 전역 대기 등. 콘텐츠 로딩은 스켈레톤이 정본.

### sidebar / GNB

좌측 고정 네비게이션. **폭 240**(컨테이너 패딩 20). bg `{color.bg-surface}`.

- **메뉴 항목** — 높이 40(단순 LNB) / 50(아코디언), radius **선택 12 · 비선택 8**, 패딩 상하4~12·좌우12~16, 아이콘 24 + 라벨 gap 8~12.
- **아코디언 펼침 그룹** — 배경 `{color.bg-base}`(gray-50), 하위 항목(SNB) 높이 50·radius 8·패딩 12.
- 비활성 라벨 `{color.text-body-subtle}`, hover `{color.bg-surface-sunken}`.

## Layout Patterns

### Page grid & margins (실측)

앱 골격은 **상단 헤더 + 좌측 사이드바(LNB) + 우측 콘텐츠**의 3분할 고정 셸이다. 콘텐츠 배경 `{color.bg-base}`, 카드 `{color.bg-surface}`. 아래는 1920 뷰포트 기준 여백이다.

```yaml
top-header:      height 64,  좌우 padding 40             # 상단 헤더 바
sidebar (LNB):   width 240                              # 좌측 고정 네비
content-area:                                           # 헤더/LNB 오른쪽 본문 영역
  좌우 마진:      40
  상단 마진:      20                                     # 헤더 ↔ 메인 타이틀 사이
  하단 마진:      40
  # 콘텐츠 내부 폭 = 뷰포트 − 240(LNB) − 80(좌우 40+40),  예: 1920 → 1600
main-title(XL):  height 44 고정,  타이틀 영역 ↔ 하위 섹션 gap 16
                 # 예외: 여백 가진 행(탭·카운트·필터)이 바로 아래면 8 (§Title system)
                 # L/M 및 서브내용 유무에 따른 타이틀 높이는 §Typography Title system(가변)
split-card-gap:  16                                     # 콘텐츠 2분할 시 카드 영역 사이 gap
```

- **앱 골격** — 좌측 고정 LNB(240) + 상단 헤더(64) + 우측 콘텐츠. 콘텐츠 영역은 **좌우 40·상단 20·하단 40** 마진 안에 배치하고, 최상단 **메인 타이틀(높이 44)** 아래로 **16** gap을 둔다.
- **2분할 콘텐츠** — 우측 콘텐츠를 좌/우 카드 영역으로 나눌 때 두 카드 영역 사이 gap **16**.
- **리스트 + 상세** — 좌측 요약(고정 정보) / 우측 이력(리스트). 상세 진입 상태 유지.
- **폼** — 필드 라벨 + 필드 세로 스택, 필드 간 16~20, 섹션 간 24~32.
- **빈 상태** — 중앙 아이콘 + 안내(`{color.text-body-subtle}`) + primary 액션 버튼.

### 🔵 콘텐츠 컨테이너 표준 (전역 불변 — 모든 페이지 동일)

페이지 타이틀 아래 본문을 감싸는 **최상위 콘텐츠 컨테이너**(단일, 또는 2분할된 좌/우 각각)는 전 페이지에서 아래 스펙으로 **동일하게** 맞춘다. 페이지 바깥 여백(헤더·LNB와의 간격)은 앱 셸이 담당하므로(§Page grid & margins) 여기서 다루지 않는다 — 여기서 말하는 마진은 **컨테이너 내부 패딩**이다.

- **radius 16 = `rounded-2xl`** — 컨테이너 종류와 무관하게 항상. (`rounded-lg`=8px 금지, §Rounded 코드 매핑 참조)
- **테두리 = 1px `border-gray-200`** — 하드코딩 hex(`border-[#E4E4E8]` 등) 금지.
- **그림자 = `shadow-card`** — 있는 경우 유지·통일.
- **내부 패딩 24 = `p-6`** — 단, 컨테이너는 두 종류로 나뉘고 패딩 적용 방식이 다르다:

| 종류 | 정의 | 패딩 |
|---|---|---|
| **콘텐츠 카드** | 폼 필드·텍스트·정보를 컨테이너가 **직접** 담음 (센터정보 패널, 내담자·구성원 상세 좌측, 설정 카드, 폼 카드 등) | **`p-6`(24 사방)**. `px-6 py-5`·`p-5`·`pt-5 pb-6 px-5` 같은 변형 금지 → `p-6`로 통일 |
| **프레임 컨테이너** | 테이블·리스트·캘린더·탭 패널 등 **콘텐츠가 스스로 가장자리를 관리** (대개 `overflow-hidden`) | **바깥 패딩 없음** — 콘텐츠를 테두리에 꽉 채우고, 24 인셋은 내부 셀·섹션(`px-6` 등)이 담당. 우측 탭 패널은 `p-6 pt-3`(탭바 플러시)을 허용 |

- **2분할 콘텐츠** — 좌/우 컨테이너 사이 gap **16(`gap-4`)**. 좌측 정보 패널 폭은 아래 §2분할 좌측 패널 폭 규격.
- **풀블리드 페이지** (대시보드·카드 그리드·통계 등 단일 컨테이너가 없는 화면)는 이 규칙의 대상이 아니다 — 카드 그리드의 개별 카드는 리스트 카드 스펙(radius 16 + padding 20)을 따른다.

**정본 구현 스니펫**

```svelte
<!-- 콘텐츠 카드 (폼·텍스트 직접 담음) -->
<section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">…</section>

<!-- 프레임 컨테이너 (테이블·리스트·캘린더·탭) — 바깥 패딩 없음, 내부가 인셋 담당 -->
<div class="rounded-2xl border border-gray-200 bg-white overflow-hidden">…</div>

<!-- 2분할 (좌측 폭 = 비율 토큰, 아래 §2분할 좌측 패널 폭) -->
<div class="grid grid-cols-1 xl:grid-cols-[var(--spacing-detail-side)_1fr] gap-4">…</div>
```

### 🔵 2분할 좌측 패널 폭 — 비율 고정 (2026-08-26 등재)

상세 화면(검사·상담·내담자·구성원·센터정보·내 정보)의 좌측 정보 패널 폭은 **px 고정이 아니라 컨테이너 대비 비율**이다.

| 항목 | 값 |
|---|---|
| 토큰 | **`--spacing-detail-side`** (`src/app.css` @theme) = `clamp(360px, 27%, 560px)` |
| 사용 | grid `grid-cols-[var(--spacing-detail-side)_1fr]` / flex `w-[var(--spacing-detail-side)] shrink-0` |
| 기준 | **1920 = 좌 27% / 우 72%**(gap 16). 이 비율을 전 해상도에서 유지한다 |
| 하한 360 | 이보다 좁으면 레이블+데이터 가로형 행의 값이 줄바꿈되어 행 높이 20 규격이 깨진다 |
| 상한 560 | 이보다 넓으면 레이블 열은 auto라 **값 뒤 여백만** 늘어난다 |

- **px 고정 금지.** `400px`로 박아두면 좌측 비중이 1280에서 47.6%, 2560에서 18.9%로 흔들린다(2026-08-26 실측) — 큰 모니터에서 좌측이 쪼그라들고 작은 화면에서 좌측이 화면을 먹는다.
- `%`는 **2분할 컨테이너** 기준이라 LNB 접힘·사이드 도크(`pr-*`)로 컨테이너가 줄면 좌측도 같은 비율로 따라 줄어든다. 도크 열림 같은 상황마다 폭을 한 단계씩 깎는 분기를 두지 않는다.
- 적용 대상은 **상세 2분할**뿐이다. 접수 스테퍼의 요약 레일처럼 비율이 아니라 고정폭이 맞는 사이드 레일은 대상이 아니다.

### 🔵 목록 레일 폭 — 280 고정 (2026-08-26 등재)

좌측에서 **항목을 고르면 우측 본문이 바뀌는** 마스터-디테일 화면의 레일 폭은 **280(`w-70`) 고정**이다. 위 §2분할 좌측 패널(360~560 비율)과 **다른 패턴**이므로 토큰을 섞어 쓰지 않는다.

| 항목 | 값 |
|---|---|
| 폭 | **280 고정** (`md:w-70` / `grid-cols-[280px_minmax(0,1fr)]`) |
| 우측 | 나머지 전부(`1fr`) · 별도 카드면 사이 gap **16**(split-card-gap) |
| 적용처 | 권한 설정(역할 레일) · 바우처 현황 바우처 기준안(사업 레일) |

- **280인 이유 = 항목명이 잘리지 않는 최소치.** 레일 내부 인셋(16+12)과 우측 카운트를 빼면 이름 영역이 185px 남아, `Body_02`(15) 기준 11자 한글 항목명(`아동청소년 심리지원`·`슈퍼관리자` 등)이 들어간다. 240으로 줄이면 145px가 되어 긴 사업명이 잘리는데, **항목명 가독이 이 레일의 유일한 존재 이유**라 폭을 아껴 얻는 40px보다 손해가 크다.
- **비율(`%`)을 쓰지 않는 이유** — 레일은 읽는 패널이 아니라 고르는 목록이라, 넓어져도 이름 뒤 여백만 늘고 우측 작업 영역만 줄어든다. 큰 화면에서 늘려야 하는 쪽은 본문(테이블)이다.
- 두 형태 모두 이 폭을 쓴다: **한 카드 안 분할**(`border-r`로 나눔 — 권한 설정) / **별도 카드 2개**(gap 16 — 바우처 기준안). 카드 구성만 다르고 폭은 같다.

> ## 🔴 레일 항목 — 선택 표시는 full-bleed 금지 (2026-08-27 등재)
>
> 레일 항목의 **선택·hover 배경은 레일 폭을 가로로 꽉 채우지 않는다.** 목록 컨테이너가 좌우 인셋 **20**(`px-5`)을 갖고, 항목이 그 안에서 **radius 8 + 패딩 12**(`rounded-lg p-3`)로 칠해진다.
>
> | 항목 | 값 |
> |---|---|
> | 목록 컨테이너 | `px-5 pb-5` · 항목 사이 gap **8**(`gap-2`) |
> | 항목 | `rounded-lg p-3` · 선택 `bg-primary-50` / 비선택 hover `bg-gray-50` |
> | 텍스트 | `Body_01/Normal-SemiBold`(16) — 선택 `primary-600` / 비선택 `gray-800` |
> | 우측 카운트·아이콘 | `Body_02/Normal-Medium`(15) — 선택 `primary-600` / 비선택 `gray-400` |
> | 레일 상단 추가 버튼 영역 | `p-5`(모바일 `p-3`) |
>
> - **이유** — 면을 가장자리까지 붙이면 선택 표시가 레일 자체의 배경 전환처럼 읽혀 "항목 하나가 골라졌다"는 게 사라지고, 카드의 radius 16과 항목의 각진 모서리가 맞부딪친다(중첩 규칙 위반). 인셋을 두면 칠해진 면이 곧 항목의 히트 영역이 된다.
> - `md:rounded-none md:px-6`처럼 데스크탑에서만 full-bleed로 되돌리지 않는다 — 모바일 칩과 데스크탑 항목이 다른 규격이 된다.
> - 참조 구현: 권한 설정(역할 레일) · 바우처 현황(사업 레일) · 양식 관리 > 문자 양식(템플릿 레일).
- 좁은 화면(`<md`/`<xl`)에서는 레일을 접는다 — 가로 스크롤 칩 행(권한 설정) 또는 상단 드롭다운(바우처 기준안).

### 반복 패턴 (재구현 금지 · 이 스펙 그대로 사용)

기존 페이지에 이미 있는 구조는 새로 디자인하지 말고 아래 패턴을 그대로 재사용한다.

> 🔴 **신규 카드·패널·상세 블록을 만들 때의 절차 (2026-08-07 신설).**
> "기존 화면과 동일하게"라는 요청은 **껍데기(radius·보더·패딩·그림자)만이 아니라 내부 데이터 행 규격까지** 같게 하라는 뜻이다.
> 실제 사고: 구성원 상세 담당 상담·검사 카드를 만들며 껍데기만 복사하고 내부 간격(이름↔생년월일, 레이블↔값, 행간)을
> 눈대중으로 새로 지어냈다 — 값이 4/8/16으로 제각각이 됐고 세 번에 걸쳐 되돌려야 했다.
>
> **순서를 지킨다:**
> 1. 이 절(반복 패턴)에서 **해당 패턴을 먼저 찾는다.** 여기 있으면 수치는 이미 정해져 있다 — 눈대중 금지.
> 2. 참조 컴포넌트를 열어 **내부 마크업까지 대조**한다(껍데기만 보지 않는다).
> 3. 문서와 참조 컴포넌트의 값이 **다르면 이 문서가 이긴다.** 동시에 어긋난 컴포넌트도 같이 고쳐
>    다음 사람이 어느 쪽을 봐도 같은 답을 얻게 한다(불일치를 남겨두지 않는다).
> 4. 이 절에 없는 새 패턴이라면, 구현 후 **여기에 수치를 등재**한다.
>
> 레이블+데이터 가로형의 참조 구현 — 패널(16 · gap 12) = `MemberProfileCard` · `CenterProfileCard` · `ProgramInfoPanel` · `ProfileSection`(내담자) · `AssessmentSidebar` · `myInfo` / 카드 안(15 · gap 8) = `CounselingCard` · `AssessmentCaseCard` · `CaseHistoryCard` · `MemberCaseHistoryCard` · `SessionListSection`(회기 카드).

- **레이블+데이터(세로형, 기본)** — 레이블 `body-02-md`(15, `{color.text-title-subtle}`) → gap 4 → 값 `body-01`(16 Regular). **지표 변형**: 레이블 → gap 8 → 값(SemiBold `{color.text-title-default}`) + gap 4 + 단위 `body-02`. 값 크기는 상단 요약 스트립이면 24(headline-01), 카드 내부 소형 지표 박스면 20(headline-02). (예: 메모 블록, "상담 10건" 지표, 바우처 요약)
- **레이블+데이터(가로형, 아이콘 레이블)** — 아이콘 20 + gap 8 + 값 `body-01`(16 Regular). (예: 전화·이메일·주소)
- **레이블+데이터(가로형, 텍스트 레이블)** — 고정폭 레이블 열(**`{color.text-label-default}`**=gray-600) + 레이블↔값 gap **24** + 값(**`{color.text-body-strong}`**=gray-900). **레이블과 값은 같은 크기이고 위계는 색으로만 가른다**(레이블 gray-600 / 값 gray-900) — 크기까지 벌리면 한 덩어리 안에 글자 크기가 여러 개 섞여 산만해진다(2026-08-07 개정, 전 페이지 공통). **크기는 놓인 자리로 갈린다 — 페이지 컨테이너(상세 화면의 좌/우 정보 패널) `body-01`(16) / 카드 안 `body-02`(15).** 패널은 화면의 주 정보 영역이라 본문 크기를 그대로 쓰고, 카드는 좁은 폭에 여러 행을 담아야 해 한 단계 내린다. 레이블 열 폭은 **가장 넓은 레이블에 맞춰 auto**로 잡아(권장 구현 `grid grid-cols-[auto_1fr]`) 여러 행의 값 좌측을 정렬한다. **각 레이블+값 행(데이터 프레임)은 높이 20 고정**(텍스트 수직 중앙 정렬 — 타이포 토큰의 line-height가 16이라 행을 감싸지 않으면 행이 얇아져 같은 gap도 좁아 보인다. 구현: `auto-rows-[20px] items-center` 또는 `min-h-5 items-center` 래퍼). **행↔행 세로 gap은 놓인 자리로 갈린다 — 상세 화면의 좌측 정보 패널 12 / 카드 안 8.** 패널은 화면의 주 정보 영역이라 숨 쉴 여백을 주고, 카드는 고정 높이 안에 여러 행을 담아야 해 조인다. 한 페이지 안에서 섞지 않는다(상담 상세 좌우 패널처럼 나란히 놓이면 같은 12). 빈값은 `{color.text-caption-subtle}`로 `-` 표기. **⚠️ 이 레이블(`text-label-default`=gray-600)/값(`text-body-strong`=gray-900) 컬러 페어링은 레이블+데이터 표기의 전 페이지 공통 표준이다(구성원 상세와 동일).** (예: 센터 정보의 대표자명·사업자번호·주소·전화번호)
- **인라인 병기 데이터** — `값 + gap 6 + 세로선(1px, 높이 10~12, {color.border-strong}) + gap 6 + 값`. (예: "2018-01-12 | 여", "김은지 상담사 | 상담실 A")
- **섹션 타이틀 행** — `headline-02`(20 SemiBold) + gap 4~6 + 카운트 `body-03`(14 Regular, `{color.text-title-subtle}`) 같은 줄, 아래 콘텐츠와 gap 12.
- **리스트 카운트 헤더** — 리스트/그리드 위의 "총 N건/개" 카운트 표기 줄. **영역 높이 44 고정**(텍스트 수직 중앙), 텍스트 `body-02-md`(15 Medium, `{color.text-body-subtle}`=gray-500), **아래 콘텐츠와 gap 4**. (강조색·볼드 없이 단일 톤)
- **카드는 2변형뿐** — ① 컨테이너 카드: `{color.bg-surface}` + 1px `{color.border-default}`(#DFE4EA) + radius 16 + padding 24. ② 리스트 카드: 흰 배경 + 1px `{color.border-strong}`(#D4DBE2) + radius 16 + padding 20, 확장 시 내부 1px 구분선 + `{color.bg-base}` 배경 하위 행(행 padding 12~16).
- **설정 토글 행** (2026-09-08 등재 · 정본 구현 `features/notification/components/NotificationSettingRow.svelte`) — 카드 안에 토글이 세로로 쌓이는 설정 화면(알림 설정)의 행. 카드는 **프레임 컨테이너**(바깥 패딩 없음)이고 행 목록이 `p-3`이라 **행 텍스트 좌측선이 카드 기준선 24와 맞는다**(12+12). **카드 안에 별도 제목을 두지 않는다** — 페이지 타이틀이 이미 그 카드를 가리키면 제목·부제가 한 번 더 반복될 뿐이다(성격이 다른 두 번째 카드부터 `px-6 pt-6` 헤더를 둔다).

| 항목 | 값 |
|---|---|
| 행 | 패딩 좌우 12 · 상하 **16**(하위 그룹 행 12) · radius **12** · hover `bg-gray-50` · 저장 중 `opacity-60` |
| 아이콘 타일 | **36**(`size-9`) · radius **8** · `{color.bg-base}`(gray-050) 중립 면 + **에셋 네이티브 20 아이콘**(듀오톤이 색을 갖는다 — 타일에 hue를 칠하지 않는다). 타일↔텍스트 gap **12** |
| 타이틀 | 상위 행 `Body_01/Medium`(16, `{color.text-body-strong}`) / 하위 그룹 행 `Body_02/Medium`(15, `{color.text-body-default}`) |
| 설명 | 둘 다 `Body_03/Regular`(14, `{color.text-body-subtle}`) · 타이틀과 gap **8**. 하위 항목이 아코디언에 그대로 나오는 상위 행은 설명을 **두지 않는다**(중복) |
| 행 우측 | **스위치 → 셰브론** 순(셰브론이 맨 끝, gap 12). 셰브론(`ArrowDownIcon20`, `{color.icon-secondary}`)은 24 히트 영역의 **별도 버튼**이고 펼침 시 180° 회전. 타이틀 옆에 붙이면 타이틀 길이마다 축이 흔들린다. **셰브론 없는 행도 같은 목록 안이면 24 자리를 비워** 스위치 세로축을 맞춘다 |
| 하위 그룹 | 좌측 인셋 **48**(`ml-12`) — 인셋 48 + 행 패딩 12 = 상위 타이틀과 같은 세로선 |
| 행 사이 | 상위 행끼리만 1px `{color.border-subtle}`(`mx-3`) · 하위 그룹 사이엔 선 없음 |
| 마스터 ↔ 하위 | 상위 토글이 꺼지면 **하위는 저장값과 무관하게 전부 off + 스위치 잠금**(행은 흐리게 하지 않는다 — 무엇이 꺼졌는지는 읽혀야 한다). 저장값은 지우지 않아 상위를 다시 켜면 원래 설정으로 돌아온다 |

  중첩 radius는 카드 16 ⊃ 행 12 ⊃ 타일 8로 단조 감소한다(§Rounded).

## Do's and Don'ts

**Do**

- product-facing 색은 시맨틱 alias(`{color.*}`)로만 호출한다 — raw 팔레트 직접 참조는 새 role을 만들 때만.
- 표면 위계는 그림자로 구분한다 — `card`는 `{shadow.card}`, 떠 있는 표면(modal·tooltip·popup·sidepanel)만 강한 그림자.
- 버튼 hover/pressed는 **한 단계 어둡게** swap(단조 심화), scale/transform 없음.
- `white` 버튼 텍스트는 **파란색**(`primary-500`)으로 둔다(회색 아님).
- 제목은 Normal(100%) 행간, 제목–본문 간격은 spacing 토큰으로. 제목은 XL·L·M **SemiBold** / S **Medium**, 필드 라벨은 Medium·`{color.text-label-default}`.
- 강조는 **SemiBold**까지만 쓴다.
- 취소 상태 배지는 `line-through` 병행.
- 간격·라운드·그림자는 토큰 값만 사용(4px 스케일, 2px 금지).

**Don't**

- raw hex를 화면·컴포넌트에 직접 쓰지 않는다 — 항상 시맨틱 토큰.
- primitive(`gray-500` 등)를 화면에서 직접 참조하지 않는다 — 토큰 정의에만.
- **일러스트·그래픽 자산 색을 토큰화하지 않는다**(그대로 둔다).
- 버튼 hover에서 어떤 건 밝게·어떤 건 어둡게 섞지 않는다 — 전부 어둡게 통일.
- 필드 라벨을 SemiBold/Bold로 키워 제목과 혼동시키지 않는다.
- 태그/상태 배지 fg를 본문급 텍스트에 쓰지 않는다(옅은 틴트 위 대비 부족) — 짧은 라벨 전용.
- 홀수·비4배수 간격(5·10·14 등)을 쓰지 않는다(4px 스케일만, 예외: 인라인 구분선 주변 gap 6).
- **타이틀과 직속 콘텐츠를 8 이하로 붙이지 않는다**(그룹 내부는 12~16). **구분되는 블록(버튼↔섹션 등)을 그룹 내부 간격과 같거나 좁게 두지 않는다** — `구분 간격 > 그룹 간격`(약 2배) 부등식을 항상 지킨다. → §Spacing 🔴 그룹핑 vs 구분.
- 정의된 5개 밖의 **새 radius(6·10·20 등)를 쓰지 않는다.**
- **카드에 좌측 액센트 보더·그림자·그라데이션을 넣지 않는다** — 구분은 항상 1px 보더로.
- **강조 목적으로 폰트 크기를 키우지 않는다** — 굵기(→SemiBold)나 색(default→strong)으로 한다.
- **Bold를 임의로 쓰지 않는다** — 별도로 지정된 특정 상황에만 허용하고, 기본 강조는 SemiBold까지만.
- **등록된 타입 스타일 밖의 폰트 크기를 쓰지 않는다** — 너무 작거나 큰 임의 크기 금지, 사다리 값에서만 고른다. 본문은 `Body` 계열만.
- **기존 페이지에 있는 구조를 새로 디자인하지 않는다** — §반복 패턴을 그대로 재사용한다(새 패턴이 필요하면 임의 생성 말고 먼저 제안).
- **드롭다운/선택지 패널을 화면마다 새로 조립하지 않는다** — `rounded-lg + border + shadow-lg`, `py-1 + px-4 + text-sm` 같은 즉석 조합 금지. `.dropdown-panel` / `.dropdown-item` 유틸만 쓴다(§Components>dropdown).
- **드롭다운 항목을 두 줄로 접히게 두지 않는다** — 폭을 4px 배수로 넓힌다(최소 160). 텍스트를 줄이거나 말줄임으로 때우지 않는다.
- **필요 없는 곳에 드롭다운 체크박스를 남기지 않는다** — 단일선택·액션 메뉴에는 체크박스가 없다.
- Title Case/ALL CAPS를 쓰지 않는다 — 문장형 한국어 유지.

### 🔴 수량 단위 표기 (2026-08-18 등재)

같은 화면에서 "건"이 두 층위를 가리키면 사용자는 탭만 옮겨도 단위가 바뀐 걸 알 수 없다
(실제 사고: 청구 내역의 카운트 헤더 `총 N건`이 미청구 탭에서는 회기 수, 나머지 탭에서는 청구서 수였다).

| 대상 | 단위 | 예 |
|---|---|---|
| **원자 단위** — 상담 회기 1회 · 검사 1개 | **건** | 미청구 8건 · 청구 항목 3건 |
| **컨테이너** — 청구서처럼 원자를 묶은 문서 | **개** | 청구서 3개 |

- **한 화면에서 "건"은 언제나 원자 단위 하나를 뜻한다.** 묶음을 세야 하면 "개"를 쓴다.
- 일괄 처리 문구는 **"N건을 한 번에"** 뉘앙스로 쓴다 — "8건을 청구서 3개로 발행했어요".
- **화면에 "세션"이라는 말을 쓰지 않는다.** 상담 전용 맥락은 **"회기"**, 상담·검사가 섞이는 맥락은
  그 도메인의 말로 흡수한다 — 청구에서는 **"미청구건"**(집계 지표) · **"항목"**(표 컬럼, 청구서 상세의
  "청구 항목"과 같은 말). 유형은 상담/검사 배지가 이미 알려주므로 명사를 겹쳐 쓰지 않는다.
  검사는 회기가 아니므로 혼재 목록을 "회기"로 부르면 틀린다(`BillableTargetType = 'assessment' | 'counseling'`).
- 카운트 헤더처럼 **같은 자리에 다른 집합이 들어오는 곳**은 단위로 구분한다(미청구 탭 `총 N건` / 청구서 탭 `총 N개`).

## Known Gaps

- **서비스명 / 디자인시스템명** — frontmatter `name`·`design_system_name` 미확정(TBD). Brand & Style 본문은 확정.
- **다크 모드** — 미정의(라이트 전용).
- **추가 미문서화 컴포넌트** — 파일에 Toast(400×48)·Segmented Control·Date Picker·Search Autocomplete·File Upload·Toggle Switch 등이 존재하나 아직 문서화 전. 필요 시 실측 추가.
- **타이포 이슈** — `Display_02/Normal-Semibold` 행간 28(글자 32보다 작음, 100% 규칙 위반). 텍스트 스타일 정의 수정 필요(로컬 Pretendard 환경에서 교정).
- **폰트 반영** — 자동화 환경에 Pretendard 미설치라 텍스트 스타일 metric(행간/자간) 일괄 교정은 로컬 실행 스크립트로 위임.
- **Rectangle 배지 색 바인딩** — `Badge/Round`는 tag 토큰(`tag/{hue}/bg`·`fg`)에 재바인딩 완료(2026-07-06). `Badge/Rectangle`은 현재 gray 샘플만 등록돼 있어, 컬러 변형 확장 시 동일하게 tag 토큰으로 바인딩 필요.

---

## Appendix — SvelteKit + Tailwind 매핑

본문의 추상 토큰을 우리 스택(SvelteKit + Tailwind)에 붙이는 구현 레이어. 프레임워크 종속이므로 부록으로 분리한다.

### app.css (source of truth)

```css
@layer base {
  :root {
    /* text */
    --fg-strong:#191C22; --fg:#464F58; --fg-subtle:#7D848F;
    --fg-caption:#7D848F; --fg-placeholder:#AAB2BE; --fg-disabled:#AAB2BE;
    --fg-brand:#2979FF; --fg-inverse:#FFFFFF;
    /* surface */
    --surface:#FFFFFF; --surface-sunken:#EDF0F4; --canvas:#F5F7F8; --emphasis:#2D333B;
    --overlay:rgba(0,0,0,.5); --brand-subtle:rgba(41,121,255,.06);
    /* line */
    --line:#DFE4EA; --line-subtle:#EDF0F4; --line-strong:#D4DBE2; --line-active:#2979FF;
    /* brand / action */
    --brand:#2979FF; --brand-hover:#1265F0; --brand-tint:#E5EEFF;
    /* status */
    --danger:#FF4242; --danger-bg:#FFECEC; --success:#00BF40; --success-bg:#E5F8EC;
    --warning:#FFA500; --warning-bg:#FFF9EC; --info:#0E9BFF; --info-bg:#E5F4FF;
    /* billing */
    --billing:#00ACA6; --billing-hover:#009B96;
  }
}
```

### tailwind.config.js — theme.extend

```js
export default {
  theme: {
    extend: {
      colors: {
        fg: { DEFAULT:'var(--fg)', strong:'var(--fg-strong)', subtle:'var(--fg-subtle)',
              caption:'var(--fg-caption)', placeholder:'var(--fg-placeholder)',
              disabled:'var(--fg-disabled)', brand:'var(--fg-brand)', inverse:'var(--fg-inverse)' },
        surface:{ DEFAULT:'var(--surface)', sunken:'var(--surface-sunken)', emphasis:'var(--emphasis)' },
        canvas:'var(--canvas)',
        line:{ DEFAULT:'var(--line)', subtle:'var(--line-subtle)', strong:'var(--line-strong)', active:'var(--line-active)' },
        brand:{ DEFAULT:'var(--brand)', hover:'var(--brand-hover)', tint:'var(--brand-tint)' },
        billing:{ DEFAULT:'var(--billing)', hover:'var(--billing-hover)' },
        danger:{ DEFAULT:'var(--danger)', bg:'var(--danger-bg)' },
        success:{ DEFAULT:'var(--success)', bg:'var(--success-bg)' },
        warning:{ DEFAULT:'var(--warning)', bg:'var(--warning-bg)' },
        info:{ DEFAULT:'var(--info)', bg:'var(--info-bg)' },
        tag: { gray:'#5E6A73', blue:'#2E72F6', indigo:'#5367EC', purple:'#9061E5',
               pink:'#E71C7C', red:'#E33638', orange:'#DB7B12', amber:'#B28011',
               green:'#178C3F', teal:'#17887C' },
      },
      fontFamily: { sans:['Pretendard','system-ui','sans-serif'] },
      fontSize: {
        'display-1':['44px',{lineHeight:'44px',letterSpacing:'-0.41px',fontWeight:'700'}],
        'display-2':['32px',{lineHeight:'32px',letterSpacing:'-0.41px'}],
        'headline':['28px',{lineHeight:'28px',letterSpacing:'-0.41px'}],   // H1
        'h1':['24px',{lineHeight:'24px',letterSpacing:'-0.41px'}],          // H2
        'h2':['20px',{lineHeight:'20px',letterSpacing:'-0.41px'}],          // H3
        'title':['18px',{lineHeight:'18px',letterSpacing:'-0.41px'}],
        'body':['16px',{lineHeight:'24px',letterSpacing:'-0.41px'}],        // Reading=150%
        'body-sm':['15px',{lineHeight:'15px',letterSpacing:'-0.41px'}],     // 필드 라벨
        'label':['13px',{lineHeight:'13px',letterSpacing:'-0.41px'}],
        'label-sm':['12px',{lineHeight:'12px',letterSpacing:'-0.41px'}],
        'caption':['10px',{lineHeight:'10px',letterSpacing:'-0.41px'}],
      },
      borderRadius: { sm:'8px', DEFAULT:'8px', lg:'16px', pill:'9999px' },
      boxShadow: {
        card:'0 2px 6px rgba(204,204,204,.15)',
        raised:'0 4px 12px rgba(0,0,0,.10)',
        popup:'0 2px 16px rgba(0,0,0,.10)',
        floating:'4px 6px 6px -4px rgba(90,90,90,.04), 0 5px 20px rgba(66,66,66,.15)',
        sidepanel:'-2px 0 21px rgba(0,0,0,.06)',
      },
      spacing: { 15:'60px', 18:'72px', 22:'88px', 30:'120px' }, // 4px 단위만
    }
  }
}
```

### Figma 토큰 → Tailwind 클래스

| 토큰 | Tailwind |
|---|---|
| `{color.bg-surface}` | `bg-surface` |
| `{color.bg-base}` | `bg-canvas` |
| `{color.bg-surface-sunken}` | `bg-surface-sunken` |
| `{color.text-body-default}` | `text-fg` |
| `{color.text-body-strong}` / title | `text-fg-strong` |
| `{color.text-body-subtle}` / caption | `text-fg-subtle` |
| `{color.text-placeholder}` | `text-fg-placeholder` |
| `{color.text-state-brand}` | `text-fg-brand` |
| `{color.border-default}` | `border-line` |
| `{color.action-primary}` | `bg-brand` / `text-brand` |
| `{color.status-danger}`(-bg) | `text-danger` / `bg-danger-bg` |
| billing | `bg-billing` / `text-billing` |
| 카드/컨테이너 라운드·그림자 | `rounded-2xl shadow-card` (⚠️ `rounded-lg`=8px 아님) |
| 태그(초록) | `text-tag-green bg-tag-green/10` |
