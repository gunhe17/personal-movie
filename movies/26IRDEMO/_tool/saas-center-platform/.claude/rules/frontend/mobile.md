---
paths:
  - "apps/mobile/app/**"
  - "apps/mobile/src/**"
---

# mobile 프론트 아키텍처 + 디자인 시스템 (Expo · 상담사 전용)

**counselor 전용 앱** — 일정·상담/검사 현황·필드노트 녹음·푸시. 관리자(manager/super_admin) **고유** 기능은 모바일 범위 아님. 헷갈리면 web의 counselor 흐름 기준.

> 정보 기준의 source of truth는 `apps/mobile/docs/INFORMATION_SPEC.md`. 스펙에 없는 필드·섹션 임의 추가 금지, 스펙 갱신은 별도 작업.
> 디자인 시스템 정식 스펙은 `apps/mobile/CLAUDE.md` §UI Design System. **컬러 토큰만은 `src/shared/constants/tokens.js`(v2)가 source of truth** — CLAUDE.md 색상 절(§1)·버튼·그림자 서술은 v1(cyan) 잔재가 섞여 있으므로 값이 충돌하면 tokens.js를 따른다.

---

## 1. 권한 모델 — "역할"이 아니라 "액션 단위"

`src/features/center/`의 권한 시스템으로 게이팅한다 (`usePermission().can('read:billing')` 등). 역할 분기(`isAdmin`)가 아니라 **부여된 액션**으로 판단.

- counselor에게 `read:billing` + `write:billing`(access_level=`own`)이 있어 **본인 담당 케이스에 한해 청구서 발행·납부 등록·패키지 선결제까지 모바일에서 처리**한다 (web 청구 기능을 환불·삭제만 빼고 가져옴).
- 차단 대상: 전체 센터 매출 대시보드, **청구 환불·삭제**(`delete:billing` 없음), 사전기록지 폼 발송 같은 운영자 액션.
- 청구를 제외한 운영자 액션은 web에 위임, 모바일은 인지(read)와 1차 트리거까지.
- `center/`: `permissions.ts` · `usePermission.ts` · `useRole.ts` · `permission-store.ts`.

---

## 2. Stack

Expo SDK 54 (RN 0.81) · Expo Router v6(파일 기반) · TS 5.9 strict · NativeWind v4 + Tailwind 3(StyleSheet 지양) · Zustand v5(persist+AsyncStorage) · TanStack Query v5 · Axios(interceptor) · 커스텀 SVG 아이콘 · 자체 `s()` 스케일.

```bash
npm run dev          # Expo web dev
npm run start        # Expo dev client (iOS/Android)
npx expo start -c    # 네이티브/설정 변경 후 Metro 캐시 클리어
```

---

## 3. 프로젝트 구조

```
app/                      Expo Router (파일 = 라우트)
├── _layout.tsx           Root: QueryClient · ErrorBoundary · hydration
├── (auth)/               login · center-select
└── (main)/
    ├── _layout.tsx       인증·센터 가드 + Stack(slide_from_right)
    ├── my-centers.tsx    센터 전환
    ├── (tabs)/           index(홈)·schedule·clients·more + _components/
    └── schedule|assessment|counseling|field-note|notifications/[id]
src/
├── features/             도메인 모듈 (아래 §4 패턴)
│   ├── auth center client schedule assessment counseling
│   ├── billing home notice notification field-note toast lab
│   └── center/           권한 시스템 (permissions·usePermission·useRole)
└── shared/
    ├── api/client.ts     Axios + 토큰 리프레시 큐
    ├── components/
    │   ├── ui/           공용 UI 카탈로그 (§9)
    │   ├── cards/        AssessmentCaseCard · CounselingCaseCard
    │   └── icons/Icon.tsx  커스텀 SVG 통합
    ├── constants/
    │   ├── tokens.js     ★ 컬러·radius 단일 소스 (v2)
    │   └── theme.ts      COLORS·TYPOGRAPHY·RADIUS·SPACING·SHADOWS (tokens.js에서 생성)
    ├── hooks/            useTabBarClearance · useDoubleBackExit · useFadeIn
    └── utils/scale.ts    s(), ms()
```

---

## 4. Feature 모듈 패턴

도메인 모듈은 파일 단위로 책임을 나눈다. 화면(`app/.../*.tsx`)은 렌더+이벤트만, 데이터·상태는 feature가 캡슐화.

| 파일 | 책임 |
|------|------|
| `api.ts` | endpoint 정의 (HTTP 호출만, 순수) |
| `hooks.ts` | TanStack Query 훅 (조회/뮤테이션 + invalidate) |
| `store.ts` | Zustand 클라이언트 상태 (auth·center·toast·field-note 등) |
| `types.ts` · `constants.ts` | 도메인 타입 / 상수 |
| `index.ts` | 배럴 export (외부는 이걸 통해서만 접근) |
| `components/` · co-located `*.tsx` | 도메인 전용 컴포넌트·시트 (예: `AssessmentOpinionSheet`) |

- 화면은 feature `hooks.ts`로 데이터를 받는다. 복잡한 도메인(`field-note`)은 전용 훅·스토어·Host 컴포넌트를 feature 안에 둔다.
- 화면 ~300줄 넘으면 sub 컴포넌트 추출. 화면 전용 컴포넌트는 `app/.../_components/`에 co-locate (`_` prefix는 라우트 미인식).

---

## 5. 네비게이션 / 인증

- `(main)/_layout.tsx`: Stack `slide_from_right`(250ms, gesture). 탭↔탭 무애니, 탭↔상세 우측 슬라이드.
- JWT access/refresh → AsyncStorage. interceptor가 401 시 대기 큐로 중복 없이 자동 갱신.
- 가드: unauth → `/(auth)/login`, 센터 미선택 → `/(auth)/center-select`. 센터 전환은 `my-centers`에서 선택 → `setCenterContext` + `(tabs)` replace.

---

## 6. 🔴 Gotchas

- **SSR 없음**(웹과 다름). 단 lifecycle에서 브라우저 전용 API 호출 금지.
- **centerId**: `useCenterStore`는 AsyncStorage hydrate 후에만 값이 채워짐 → `requireCenterId()`는 null 체크 필요. action은 centerId 없으면 빈 결과 반환.
- **NativeWind**: `className`은 동적 값 불가 → 스케일·조건부는 `style={{ height: s(N) }}` 혼용. content 패턴(`./app`,`./src`) 폴더만 스캔.
- **Metro 캐시**: tailwind/metro/SVG 설정 변경 후 `npx expo start -c` 필수.
- **`s()` 적용 범위**: 고정 dimension(카드 높이·큰 width)은 `s()`, Tailwind utility(`p-4`,`gap-2`,`h-11`)는 스케일 안 함. 폰트·radius는 `ms(v, 0.5)`.
- **Typography 색**: `style={{ color }}`로. `className="text-*"`는 Typography 내부 강제 색에 덮일 수 있음.

---

## 7. 디자인 시스템 — 토큰

### 7.1 아키텍처 (v2)

**Primitive(원시값) → Semantic(역할) 2계층. 화면에는 semantic만 적용, primitive 직접 사용 금지.**

- 단일 소스: `src/shared/constants/tokens.js` → `theme.ts`(JS `COLORS`) + `tailwind.config.js`(className)가 여기서 생성됨. **값 수정은 tokens.js에서만** (드리프트 방지).
- 모드: **Light 전용** (앱 전역 다크 미지원). 필드노트 다크 스킨만 `theme.ts` `fieldnoteDark`로 별도.
- 브랜드 기준색: **blue/500 `#4486FF`** (cyan 아님). 정리본 `docs/color-system-v2.md`.

### 7.2 Primitive (참고용 — 직접 쓰지 말 것)

```
gray  0 #FFFFFF · 50 #F5F7F8 · 100 #E9EEF0 · 200 #E3EAEF · 300 #D1D5DB
      400 #AAB2BE · 500 #7D848F · 600 #58626C · 700 #464F58 · 800 #2D333B · 900 #1D2227
blue  500 #4486FF(★) · 600 #2566DD · 100 #E5EEFF · 50 #F4F8FF
purple 500 #9B5DFF(fieldnote) · mint 500 #00C3BC · red 500 #FF4242 · green 500 #00BF40
       orange 500 #FF9200 · sky 500 #0E9BFF · navy/deep #0B1754
```

### 7.3 Semantic (작업 기본 단위)

| 그룹 | 주요 토큰 | 비고 |
|------|----------|------|
| `text/*` | headline · title(default/subtle) · body(strong/default/subtle) · caption · label · placeholder · state(inverse·brand·disabled) | brand=blue/500 |
| `icon/*` | primary·secondary·tertiary(gray 직결) · brand · info/danger/success/warning | 상태색은 status 참조 |
| `bg/*` | base(gray50) · surface(white) · surface-sunken(gray50) · overlay · selected(blue@8%) · emphasis(gray800) | 레이어 높이 |
| `border/*` | subtle(gray100) · default(gray200) · strong(gray300) · heavy(gray900) · active(blue500) | 구분 강도 |
| `action/*` | primary · primary-hover · primary-subtle · disabled | 버튼/인터랙션 |
| `status/*` | danger·info·success·warning + 각 `-bg` 틴트 | 의미색 |
| `trend/*` | up=red · down=blue · flat=gray (+`-bg`) | 통계 방향. **status와 재사용 금지** |
| `accent/*` | fieldnote=purple/500 | 도메인 강조 |
| `tag/*` | gray·blue·indigo·purple·pink·red·orange·amber·green·teal — 각 `{fg,bg,outline}` | 상태 배지 전용 hue (status·primitive와 **다름**) |
| `button/*` | primary·secondary(blue 틴트)·assistive·outline·white·danger·billing(mint) — `{role}-{state}` | 색/상태 세트 |

- semantic은 `colors`에 평탄화돼 className 그룹 접두어가 없다 — `text-headline`·`bg-surface`·`bg-background`(=bg.base alias)·`border-default`·`text-icon-primary`·`bg-action-primary`·`bg-tag-blue-bg`·`text-tag-blue-fg`. 코드(JS)는 `COLORS.text.headline` 등.
- 카테고리 색(상담/검사 구분)은 화면 리듬용 — 명시된 사용처에만. 일정 카드 accent dot은 기존 schedule accent 토큰 그대로 사용(팔레트 교체 금지).

### 7.4 타이포그래피

폰트 **Pretendard**, letter-spacing 전체 **-0.41px**(variant에 내장 — 임의 지정 금지), 숫자엔 `tnum`.

| 토큰 | Size/LH/Weight | 용도 |
|------|----------------|------|
| `Headline_01/Semibold` | 24/36/600 | 페이지 메인 타이틀 |
| `Headline_02/Semibold` | 20/28/600 | 섹션 대제목, 바텀시트 제목 |
| `Title_01/Semibold` | 18/26/600 | 카드 타이틀, 내비 제목 |
| `Body_01/Reading-Regular` | 16/26/400 | 긴 본문(상담일지) |
| `Body_01/Semibold` · `Body_01/Regular` | 16/24 | 강조 본문 / 기본 본문 |
| `Body_02/*` | 15/22~24 | 카드 보조 텍스트 |
| `Body_03/Regular` | 14/20/400 | 메타·날짜·주소 |
| `Lable_01/*` 13 · `Lable_02/Medium` 12 | — | 섹션 레이블·뱃지·탭 / 캘린더·칩 |
| `Caption_01/Regular` | 11/14/400 | 최소 캡션 |

**역할 기준으로 선택** (스타일 토큰 직접 X) — 색은 v2 className으로: 페이지 타이틀=`Headline_01/Semibold`+`text-headline` · 섹션 레이블=`Lable_01/Semibold`+`text-label-default` · 카드 타이틀=`Body_01/Semibold`+`text-title-default` · 카드 본문=`Body_02/Regular`+`text-body-default` · 카드 캡션=`Body_03/Regular`+`text-caption-default` · 플레이스홀더=`text-placeholder`.

### 7.5 간격 — 관계 기반 (Semantic)

"두 요소가 어떤 관계인가"로 토큰이 결정된다.

| 토큰 | 값 | 관계 |
|------|----|------|
| `gap/intra` | 4 | 직접 연결된 보조 (레이블↔인풋, 인풋↔에러) |
| `gap/card` | 12 | 같은 리스트 카드 사이 |
| `gap/related` | 16 | 타이틀↔하위 콘텐츠, 카드 내부 요소 간 |
| `gap/section` | 24 | 독립 섹션 사이 |

- 좌우 패딩 `screen-padding-x` = **16**. 상위 프레임은 세로로 쌓고 프레임 간 간격 **0**(여백은 내부 패딩으로).
- **헤더 ↔ 첫 콘텐츠 간격 = `s(16)`** (필수). ScrollView/FlatList면 `contentContainerStyle.paddingTop`, 일반 View면 인라인 style. 헤더 wrapper의 paddingBottom으로 키우지 않음. 검색바·필터·탭이 있어도 그 첫 부속을 콘텐츠 시작점으로 간주.
- 하단 여백은 `SafeAreaInsets.bottom`(iOS Home Indicator ≈ 34px). 콘텐츠가 탭바에 가리지 않게 확보.

### 7.6 Radius / Shadow / Z-index

```
radius (tokens.js): sm 8 · md 10 · lg 12 · xl 16 · 2xl 20 · 3xl 24 · full
shadow (RN: theme.ts SHADOWS): card 6% · sheet · bar · brand(퍼플 글로우)
z: base 0 · sticky 100 · fab 200 · sheet-dim 300 · sheet 400 · toast 500 · tooltip 600
```

> **radius = 내부 패딩 규칙**: 내부 패딩을 가진 컨테이너의 모서리 radius는 그 컨테이너의 좌우 패딩 값과 동일하게 맞춘다 (`padding 16` → `radius 16`). 원형·패딩 없는 라인은 예외.

### 7.7 톤 & 매너 (모든 디자인 결정의 출발점)

- **친절·친근·재미** — 친절하되 딱딱하지 않고, 친근하되 가볍지 않고, 재미있되 산만하지 않게.
- 모든 컴포넌트 `radius-lg(16)` 이상 둥근 모서리 기본. 빈 공간을 두려워하지 않음.
- 강조 계층: 1순위(핵심)는 **페이지당 하나만**. 모두 강조되면 아무것도 강조 안 됨.
- 파괴적 행동(삭제·나가기)은 **한 단계 더 확인**. 오류는 사용자를 탓하지 않고 해결법 제시.
- 주요 완료 액션엔 spring easing(`cubic-bezier(0.34,1.56,0.64,1)`) + 체크 아이콘으로 작은 celebrate.

### 7.8 DO / DON'T (핵심)

| ✅ DO | ❌ DON'T |
|-------|---------|
| semantic 토큰 (`text/primary`, `bg/surface`) | hex 하드코딩 (`#191919`, `white`) |
| Typography 토큰/variant | `fontSize`+`fontWeight` 직접 입력 |
| Primary 버튼 화면당 1개 | 같은 화면 Primary 2개 |
| 카드는 명도 대비로만 분리 (gray bg→white card) | 카드에 보더 추가 |
| 상태 뱃지는 정해진 `tag/*` 세트만 | 임의 색 뱃지 |
| FAB은 필드노트(purple) 기능에만 | FAB 색 상황마다 변경 |
| 좌우 패딩 16 · 카드 간격 12 일관 | 화면마다 다른 패딩 / 8·20 섞기 |
| 터치 타겟 최소 44×44 | 작은 버튼 패딩 없이 배치 |

---

## 8. 페이지 레이아웃 표준

```tsx
<SafeAreaView className="flex-1 bg-background" edges={['top']}>
  <View className="h-[52px] flex-row items-center px-4">{/* 헤더 */}</View>
  <ScrollView contentContainerStyle={{ paddingTop: s(16), paddingBottom: s(40) }}>
    {/* 콘텐츠 — 위→아래, 중요→부가 */}
  </ScrollView>
</SafeAreaView>
```

- 텍스트 좌측 정렬(중앙은 드래그 핸들·네비 타이틀·빈 상태만). 숫자 우측 정렬. 아이콘+텍스트는 수직 중앙.
- 카드 내부: 타이틀→본문→캡션 순, 좌상단에 타이틀, 우측에 뱃지/액션. 패딩 좌우 16, 상하단이 텍스트면 padding-y 12(행간 보정)·비텍스트면 16.

---

## 9. Reuse First + 공용 컴포넌트

화면 구현 전 `src/shared/components/ui/`·`icons/`·`cards/`를 **먼저 탐색**. prop/variant로 해결 → 부족하면 확장 → 본질적으로 다르면 신규 생성하되 `ui/`에 배치 + 카탈로그 등록.

`Typography` · `Title` · `Badge` / `BadgeRound` / `BadgeRoundState` · `Segment` · `Tabs` · `Toggle` · `BottomSheet` · `ConfirmModal` · `Toast` · `Skeleton`/`SkeletonCircle` · `LoadingScreen` · `ErrorBoundary` · `SearchField` · `GenderAgeMeta` · `NotificationBell` · `Icon`. 카드: `AssessmentCaseCard` · `CounselingCaseCard`.

---

## 10. 새 스크린 체크리스트

1. 공용 컴포넌트 먼저 탐색 2. `app/(main)/.../xxx.tsx` 생성(자동 라우팅) 3. `<SafeAreaView className="flex-1 bg-background" edges={['top']}>` 4. 헤더 + back `<Icon name="arrow-left" size={24}/>` 5. feature `hooks.ts`로 데이터 6. **로딩=페이지별 스켈레톤(필수)**: 화면 레이아웃을 흉내 낸 스켈레톤을 `_components/`에 `Skeleton`/`SkeletonCircle` 조합으로. 빈/에러 상태도 함께 7. 서브 컴포넌트는 `_components/` 8. 고정 dimension은 `s()`.

---

## 11. Lab 컨벤션

디자인 시안 비교는 **파일 1개 = 시안 N개(탭 전환)**, 첫 탭은 항상 현재(대조군). 시안별 별도 파일 양산 금지. 새 lab은 `src/features/lab/registry.ts`에 등록, **mock 데이터만** 사용. 기준 구현체 `app/(main)/lab/home-hero-bg.tsx`.

---

상세: 정보 스펙 `docs/INFORMATION_SPEC.md` · 디자인 시스템 `CLAUDE.md §UI Design System` · 컬러 v2 `docs/color-system-v2.md`(+`tokens.js`) · UX 라이팅 `docs/ux-writing.md`.
