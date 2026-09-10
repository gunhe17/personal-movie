# 마인드스코프(내담자앱) 디자인 정본

내담자·보호자 앱의 색·타이포·간격 **정본 문서**. 화면을 만들 때는 여기 정의된 토큰만 쓴다.
여기 없는 값이 시안에 나오면 **임의로 hex를 박지 말고 먼저 확인**하고, 확정되면 이 문서와
`src/shared/constants/tokens.js`에 함께 추가한다.

| 파일 | 역할 |
|------|------|
| `docs/design.md` (이 문서) | 사람이 읽는 정본 — 무엇이 있고 언제 쓰는지 |
| `src/shared/constants/tokens.js` | 코드 원천 — `theme.ts`(JS `COLORS`)와 `tailwind.config.js`(className)가 여기서 생성된다 |

전문가앱(`apps/mobile`)과는 **별도 디자인 시스템**이다. 구조 패턴(토큰 아키텍처·플로팅 탭바·전환 애니메이션)만 공유하고 값은 공유하지 않는다.

---

## 1. 색 — 프리미티브

브랜드 = 블루 `#31A4F7` (2026-07-24 색시스템 637:2 확정, 그린 폐기).

| 램프 | 값 |
|------|----|
| brand | 50 `#ECF6FE` · 100 `#E1F2FE` · 200 `#BAE1FC` · 300 `#8ECDFA` · 400 `#67BCF9` · **500 `#31A4F7`** · 600 `#0981D7` · 700 `#096AAE` · 800 `#095286` · 900 `#083A5E` |
| gray | 0 `#FFFFFF` · 50 `#F5F7F8` · 75 `#F0F3F5` · 100 `#E9EEF0` · 200 `#E3EAEF` · 300 `#D1D5DB` · 400 `#AAB2BE` · 500 `#696F78` · 600 `#414C58` · 700 `#363F4A` · 800 `#2D333B` · 900 `#14181C` |
| blue | brand와 같은 계열(50~800) — 버튼·액센트가 한 블루를 공유 |
| 상태 | red 500 `#FF4242` · green 500 `#00BF40` · orange 500 `#FF9200` · sky 500 `#0E9BFF` · mint 500 `#00B2AC` · purple 500 `#9B5DFF` (각 50 틴트 보유) |

## 2. 색 — 시맨틱 (화면 코드가 참조하는 층)

### text/*
| 토큰 | 값 | 쓰임 |
|------|----|------|
| `text/title/default` | gray900 `#14181C` | 화면·섹션 타이틀 |
| `text/title/subtle` | gray600 | 보조 타이틀·그룹 라벨 |
| `text/body/strong` | gray900 | 리스트 행 제목 |
| `text/body/default` | gray600 `#414C58` | 본문 |
| `text/body/subtle` | gray500 `#696F78` | 설명·보조 문구 |
| `text/caption/default·subtle` | gray500 · gray400 | 캡션 |
| `text/placeholder` | gray400 | 입력 placeholder |
| `text/state/on-primary` `inverse` | white | 컬러 면 위 글자 |
| `text/state/brand` | brand500 | 강조 링크 |
| `text/state/disabled` | gray400 | 비활성 · **빈 값(고스트) 텍스트** |

### bg/* · border/* · icon/*
| 토큰 | 값 | 쓰임 |
|------|----|------|
| `bg/base` | gray50 | 페이지 바닥 |
| `bg/surface` | white | 카드·시트 |
| `bg/surface-sunken` | gray50 | 카드 안 눌린 면(안내 박스) |
| `bg/brand-subtle` | brand50 `#ECF6FE` | 브랜드 틴트 면 — 아이콘 배지 |
| `bg/selected` | brand500 @8% | 선택 상태 면 |
| `bg/emphasis` `emphasis-subtle` | gray800 · gray100 | 강조 면 |
| `border/subtle` `default` `strong` | gray100 · gray200 · gray300 | 구분 강도 |
| `border/active` | brand500 | 포커스·선택 테두리 |
| `icon/primary` `secondary` `tertiary` | gray500 · gray400 · gray300 | 아이콘 계층 |
| `icon/brand` | brand500 | 액센트 아이콘 |

### button/* (공용 `Button` variant × state 미러)
`primary`(브랜드 채움) · `secondary`(블루 틴트) · `assistive`(그레이) · `white` · `billing`(민트 틴트) · `outline` · `danger` — 각 variant가 `bg / bgPressed / bgDisabled / text / textDisabled`를 갖는다. 화면에서 버튼 색을 직접 지정하지 않는다.

### tag/* (Badge 전용 팔레트 — 프리미티브와 값이 다르다)
gray `#606A74` · green `#12BA54` · blue `#2872F8` · red `#FF4545` · orange `#F88F16` · teal `#00B5A5` · purple `#7C4DFF` · pink `#F53188` (배경은 각 6~8% 틴트).

### status/* · calendar/*
`danger` `info` `success` `warning` + 각 `-bg` 틴트 / 요일색 `sunday` `saturday`.

---

## 3. 타이포그래피

**화면 코드에서 `fontSize`·`lineHeight` 직접 지정 금지.** 항상 `Typography` variant + weight로 쓴다.
weight는 스타일명 접미(-SemiBold/-Medium/-Regular/-Light)를 그대로.

| 피그마 스타일 | variant | 크기/행간 |
|--------------|---------|----------|
| Title_01/Display-Light | `display-01` | 48/52 |
| Headline/Large-* | `headline-large` | 28/36 |
| Headline/Medium-* | `headline-01` | 24/36 |
| Title_01/Normal-* | `headline-02` | 20/28 |
| Title_02/Normal-* | `title-01` | 18/26 |
| Body_01/Normal-* | `body-01` | 16/24 |
| Body_01/Reading-* | `body-01-reading` | 16/26 |
| Body_02/Normal-* | `body-02` | 15/22 |
| Body_02/Reading-* | `body-02-reading` | 15/24 |
| Body_03/Normal-* | `body-03` | 14/20 |
| Label_01/Normal-* | `label-01` | 13/20 |
| Label_02/Normal-* | `label-02` | 12/16 |
| Caption_01/Normal-* | `caption-01` | 11/14 |

- ⚠️ 피그마 이름과 앱 variant가 **한 단계 어긋나 있다**(피그마 Title_01 = `headline-02`). 값은 같으니 이 표를 신뢰한다. 리네임은 파급이 커서 보류.
- **행간 편차는 노이즈로 정규화** — 시안 인스턴스가 등록 스타일과 1~4px 다르면 variant 값을 따른다(예: 시안 20/24 → `headline-02` 20/28).
- 색은 `style={{ color }}`로. className `text-*`는 Typography 기본색에 덮인다.
- 예외 — Button(13/16·14/16·15/18)·Badge(13/16) 등 컨트롤 전용 타이트 행간은 그 컴포넌트 안에만 캡슐화.

---

## 4. Radius · Spacing · Shadow

| Radius | 값 | 쓰임 |
|--------|----|------|
| `sm` | 8 | 뱃지·상태 칩 |
| `md` | 10 | 버튼 |
| `lg` | 12 | 카드 내부 요소·아이콘 배지 |
| `xl` | 16 | 카드 |
| `2xl` | 20 | 바텀시트·모달 |
| `3xl` | 24 | — |
| `full` | 9999 | 원형·pill |

- **중첩은 바깥 > 안쪽** (카드 16 ⊃ 배지 12 ⊃ 칩/인풋 8). 같은 값 금지.
- 시안에 토큰 밖 값이 나오면(예: 11.163) 가장 가까운 토큰으로 정규화한다.

**Spacing** — 4px 배수만(2/4/8/12/16/20/24/28/32/36/40/48). 시맨틱: `intra 4` / `card 12` / `related 16` / `section 24`, 화면 좌우 패딩 16.

**Shadow** (RN `SHADOWS`) — `card`(0,1 / 12.7 / 6%) · `sheet`(0,-1 / 15.8 / 6%) · `bar`(0,-1 / 7.9 / 6%) · `glow`(틸 0 / 9.55 / 20%).

---

## 5. 화면 구현 규칙

- 페이지 표준: `<SafeAreaView className="flex-1 bg-background" edges={['top']}>` + 헤더 h-12 + ScrollView `paddingTop: s(16)`.
- 탭 화면 스크롤 하단 패딩 = `useTabBarClearance()` (플로팅 탭바가 absolute라 필수).
- 기준 폭 **375**(피그마 프레임) — 고정 치수는 `s()`로 감싼다. Tailwind utility·Typography는 감싸지 않는다.
- 레이아웃 치수를 `Pressable`의 함수형 style에 넣지 않는다. 폭·높이는 래퍼 View, Pressable은 pressed 피드백만.
- 아이콘은 손으로 그리지 않고 피그마 export 에셋을 쓰고, **에셋 네이티브 크기**로 렌더한다.
  단색 글리프 → `assets/icons/<사이즈>/`, 컬러 일러스트 → `assets/images/<영역>/`.
- 상태 전환이 있는 컨트롤은 reanimated 색 보간 150~200ms 기본. worklet 안에서 `s()` 호출 금지.

## 6. 보류 중인 결정 (임의 확정 금지)

| 사안 | 상태 |
|------|------|
| 엘리베이션 3종 | 피그마 shadow/card·floating·bottomsheet와 앱 SHADOWS 불일치 — 디자이너 확인 대기. floating은 Fab·탭바에 인라인 적용 중 |
| 타이포 네이밍 한 단계 어긋남 | §3 표로 흡수, 리네임 보류 |
| 미연동 홈의 치료 유형 콘텐츠 | 놀이·미술·음악치료 상세 콘텐츠 부재 — 현재 '준비 중' 안내로 연결 |
