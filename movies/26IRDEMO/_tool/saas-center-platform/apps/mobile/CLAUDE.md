# CLAUDE.md (Mobile)

심리상담 센터 SaaS — 모바일 앱 (Expo + React Native)

**상담사(counselor) 전용 앱.** 일정 확인, 상담/검사 현황, 필드노트 녹음, 푸시 알림 등 상담사의 현장 업무를 지원한다. 관리자(manager / super_admin) **고유** 기능은 모바일 범위에 포함하지 않는다.

> 코드상 `src/features/center/useRole.ts`에 `isAdmin`/`isManager`/`hasFullAccess` 헬퍼가 존재하지만, 이는 향후 확장·임시 안전망 용도일 뿐 **설계 의도는 counselor 전용**이다. 신규 화면을 만들 때 관리자 전용 기능(센터 운영·결제·멤버 관리 등)은 mobile로 가져오지 않는다. 헷갈릴 때는 web 쪽 흐름을 기준으로 보고, 관리자 전용은 web에만 둔다.

> **권한 판단 기준 — "역할"이 아니라 "액션 단위"로**:
> 청구 관리(센터 운영 관점) ≠ 청구 인지(상담사 본인 담당 케이스의 미수금 알림).
> counselor에게 `read:billing` + `write:billing`(access_level=`own`)이 부여되어 있다. 따라서 **청구는 모바일의 예외 영역**이다 — 본인 담당 케이스에 한해 **청구서 발행·납부 등록·패키지 선결제까지 모바일에서 처리**할 수 있다 (web의 청구 기능을 환불·삭제만 빼고 가져온다). 사전기록지 조회(`read:form_instance`·`read:document`)도 counselor 권한 내. 차단해야 할 것은 "전체 센터 매출 대시보드", **"청구 환불·삭제"**(counselor에 `delete:billing` 없음 — 관리자 web 전용), "사전기록지 폼 발송" 같은 **운영자 액션**이다. **청구를 제외한** 운영자 액션은 처리를 web으로 위임하고, 모바일은 인지(read)와 1차 트리거(요청 메시지 전송 등)까지만 담는다.

---

## 📋 정보 스펙 (Information Spec) — 작업 시 반드시 준수

> **정식 위치**: [`apps/mobile/docs/INFORMATION_SPEC.md`](docs/INFORMATION_SPEC.md)
> 아래 `@import`로 mobile 작업 시 conversation context에 자동 로드된다.
>
> 화면·도메인별로 **표시해야 하는 정보의 기준**이 정의된 문서다. 모바일 앱의 모든 화면 작업은 이 스펙을 source of truth로 본다.

@docs/INFORMATION_SPEC.md

### Claude가 따라야 할 규칙

1. **스펙이 있는 화면을 작업할 때는 먼저 해당 섹션을 읽는다.** (예: 내담자 리스트 → §3-3, 상담 상세 → §3-2)
2. **스펙에 없는 항목은 임의로 추가하지 않는다.** "있으면 좋을 것 같아서"라는 이유로 필드·섹션을 끼워 넣지 않는다. 필요하다고 판단되면 먼저 사용자에게 묻고 스펙 갱신 여부를 확인한다.
3. **상태 표기 의미를 지킨다.**
   - ✅ 확정 — 그대로 구현
   - ⚠️ 상담사 검증 필요 — 변경·추가 시 사용자에게 확인
   - ❓ 정의 필요 — 추측 금지. 사용자에게 묻고 결정 후 진행
   - ❌ 사용 안 함 — 코드에서 제거 또는 추가 금지 (예: "N회차" 표기, 일지작성률)
4. **이미 ❌인 항목을 발견하면 제거를 제안**하되, 사용자가 명시적으로 요청한 경우가 아니면 단독으로 삭제하지 않는다.
5. **용어는 §1 정의를 따른다.** "세션 / 회기 / 일정 / 프로그램"의 의미가 혼용되지 않도록 한다.
6. **화면 간 네비게이션은 §2 화면 구조도를 따른다.** 새 진입점을 만들기 전 스펙의 흐름과 어긋나지 않는지 확인한다.

### 스펙 갱신 정책

- 스펙 변경은 **별도 작업**으로 처리한다. 화면 구현 작업에서 동시에 스펙을 고치지 않는다 (의도된 변경이 PR review에서 묻혀버림).
- 사용자가 새로운 정보 항목을 요구하면, 먼저 `INFORMATION_SPEC.md`에 추가/변경을 반영한 뒤 구현으로 넘어가는 것을 제안한다.
- ❓ 항목이 결정되면 ✅ 또는 ⚠️로 격상하며, 결정 근거(상담사 인터뷰 등)는 비고에 짧게 남긴다.

### 비교 문서와의 관계

`/web-mobile-diff` 스킬로 생성되는 web↔mobile 비교 문서는 **현재 코드 상태의 차이**를 본다. 정보 스펙은 **이상적 상태(목표)**를 정의한다. 두 문서가 충돌하면 **정보 스펙이 우선**이다 (web에 있어도 스펙에 없는 항목은 모바일에 가져오지 않는다).

---

## 🎨 디자이너 작업 규칙 (조건부 적용)

> **이 규칙은 디자이너에게만 적용된다.** 이 저장소는 개발자도 함께 사용하므로,
> 사용자가 자신을 **"디자이너"라고 밝힌 경우에만** 아래 규칙을 세션 끝까지 엄격히 지킬 것.
> 개발자가 사용 중일 때(또는 역할이 명시되지 않은 경우)는 이 섹션을 무시하고 일반 작업 방식대로 진행한다.

### 디자이너 모드 활성화 조건
- 사용자가 "저는 디자이너입니다" / "디자이너로 작업합니다" 등으로 역할을 명시한 경우
- 메모리에 사용자가 디자이너로 기록되어 있는 경우
- 그 외에는 **개발자 기본 모드**로 동작

---

### ✅ 디자이너 모드 — 수정해도 되는 것
- CSS, SCSS, Tailwind / NativeWind 클래스
- 색상, 폰트, 간격, 크기, 정렬
- 컴포넌트의 JSX/HTML 마크업 구조 (시각적 구조만)
- 이미지, 아이콘 경로
- 애니메이션, 트랜지션
- 반응형 레이아웃

### ❌ 디자이너 모드 — 절대 건드리지 말 것
- 함수 로직, 비즈니스 로직
- 상태 관리 코드 (`useState`, `useReducer`, store 등)
- API 호출, `fetch`, `axios` 코드
- 라우팅 로직
- `useEffect` 등 사이드 이펙트
- props로 전달되는 데이터 가공 로직
- 이벤트 핸들러 **내부** 로직 (`onClick` 함수 내용 등)
- 타입 정의, 인터페이스
- 백엔드, 서버 코드
- 패키지 설치, 의존성 변경

### 디자이너 모드 — 작업 방식
1. 수정 전, **어떤 파일의 어떤 부분을 바꿀지 먼저** 말해줄 것.
2. UI 수정을 위해 로직 영역을 건드려야 한다면 **수정하기 전에 반드시 사용자에게 먼저 물어볼 것.**
3. 확신이 없으면 추측하지 말고 **질문**할 것.
4. **한 번에 하나의 컴포넌트씩만** 수정할 것.

### 디자이너 모드 — 참고 이미지 활용

> 사용자가 외부 이미지(스크린샷, 디자인 시안, 타 앱 화면 등)를 첨부하며
> "이 느낌으로", "참고해서" 라고 요청하는 경우에 한해 적용.

**기본 원칙**: 참고 이미지는 **영감이지 복제 대상이 아니다.**
**이 문서(CLAUDE.md)에 명시된 디자인 시스템 원칙이 항상 우선**한다. 참고 이미지에서 좋아 보이는 요소가 있어도, 본 문서의 토큰·규칙·금지사항을 어기면서까지 적용하지 않는다.

#### 참고 이미지에서 **가져와도 되는 것**
- 전체적인 톤·무드·강약 구조 (예: "상단을 강한 컬러로 도장", "큰 숫자 강조")
- 강조 영역 위치, 시각 위계 아이디어
- 일러스트 활용 방식, 카드 구성·배치 패턴
- 인터랙션 방향성 (애니메이션 종류·타이밍 감)

#### 참고 이미지에서 **가져오면 안 되는 것**
- 디자인 시스템에 없는 색·폰트·radius·spacing 임의 토큰
- 본 문서의 명시적 금지 규칙
  - 예: gray 배경 위 카드 보더 금지 (§Border)
  - 예: 섹션 타이틀에 아이콘 결합 금지 (§0)
  - 예: 화면당 Primary 색 3곳 이상 금지 (§0)
- 본 문서 §12 UX 라이팅 규칙과 충돌하는 문구 (그대로 옮기지 않고 톤·말투 다듬어 적용)

#### 충돌 처리
1. 참고 이미지의 어떤 부분이 원칙과 어긋나는지 **먼저 사용자에게 알린다.**
2. 원칙 안에서 가능한 **대안을 제시**한다 (예: "이미지의 컬러 톤은 디자인 시스템 외 값이라, primary scale의 더 진한 톤으로 매핑하여 적용 가능").
3. 사용자가 명시적으로 "원칙을 어겨도 좋다"고 동의한 경우에만 예외 적용. 동의 없으면 원칙을 따른다.

### 디자이너 모드 — Git 커밋 규칙 (브랜치 보호)
> 디자이너가 세션 중에 자신을 디자이너라고 밝힌 상태에서 커밋을 요청하는 경우에 한해 적용.

1. 커밋 요청을 받으면 **가장 먼저 현재 브랜치를 확인**할 것 (`git branch --show-current` 등).
2. **현재 브랜치가 `main`이면 절대 `main`에 바로 커밋하지 말 것.**
   - 사용자에게 다음 사실을 명확히 알릴 것:
     - "현재 브랜치가 `main`입니다. 디자이너 작업은 `main`에 직접 커밋할 수 없습니다."
     - "새 브랜치를 만들어서 그 위에 커밋해야 합니다."
   - 작업 성격에 맞는 **새 브랜치 이름을 제안**하고 사용자 확인을 받을 것
     (예: `design/home-card-layout`, `style/profile-spacing` 등).
   - 사용자가 동의하면 `git checkout -b <새 브랜치>` 로 분기한 뒤 커밋을 진행할 것.
3. 현재 브랜치가 `main`이 아닌 경우에는 **그 브랜치 위에 그대로** 커밋해도 무방 (별도 분기 강요하지 않음).
4. 푸시는 사용자가 명시적으로 요청한 경우에만 실행할 것. `main`으로의 푸시/머지/강제 푸시는 절대 임의로 수행하지 말 것.

---

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Expo SDK 54 (React Native 0.81) + Expo Router v6 (파일 기반 라우팅) |
| Language | TypeScript 5.9 (strict) |
| Styling | **NativeWind v4 + TailwindCSS v3** (StyleSheet 지양) |
| State | Zustand v5 (persist + AsyncStorage) / TanStack Query v5 (서버 상태) |
| HTTP | Axios (request/response interceptor로 토큰 주입/갱신) |
| 아이콘 | 커스텀 SVG (react-native-svg + react-native-svg-transformer) + Ionicons (보조) |
| 스케일링 | 자체 `s()` 유틸 (기기 폭 기반) |

---

## Commands

```bash
npm run dev          # Expo web dev
npm run dev:mobile   # Expo dev client + tunnel
npm run start        # Expo dev client (iOS/Android)
npm run ios / android

# 네이티브/설정 변경 후
npx expo start -c    # Metro 캐시 클리어
```

---

## 📂 프로젝트 구조

```
apps/mobile/
├── app/                          # Expo Router (파일 기반)
│   ├── _layout.tsx               # Root: QueryClient, ErrorBoundary, hydration
│   ├── index.tsx                 # Splash/초기 라우팅
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── center-select.tsx     # 로그인 직후 첫 센터 선택
│   └── (main)/
│       ├── _layout.tsx           # 인증 가드 + Stack (slide_from_right)
│       ├── my-centers.tsx        # 센터 전환 페이지
│       ├── (tabs)/
│       │   ├── _layout.tsx       # 하단 탭 네비게이션
│       │   ├── _components/      # 탭 전용 하위 컴포넌트 (라우팅 제외)
│       │   ├── index.tsx         # 홈
│       │   ├── schedule.tsx
│       │   ├── clients.tsx
│       │   └── more.tsx          # 내 정보
│       ├── schedule/[id].tsx
│       ├── assessment/[id].tsx
│       ├── counseling/[id].tsx
│       ├── field-note/...
│       └── notifications/
├── src/
│   ├── features/                 # 도메인 모듈 (api.ts + hooks.ts + store.ts 패턴)
│   │   ├── auth/ center/ schedule/ assessment/ counseling/
│   │   ├── client/ field-note/ notification/
│   ├── shared/
│   │   ├── api/client.ts         # Axios 인스턴스 + 토큰 리프레시 큐
│   │   ├── components/
│   │   │   ├── icons/Icon.tsx    # 커스텀 SVG 아이콘 통합
│   │   │   └── ui/               # Typography, Badge, Toast, BottomSheet 등
│   │   ├── constants/theme.ts    # COLORS, TYPOGRAPHY, RADIUS, SPACING
│   │   └── utils/
│   │       └── scale.ts          # s(), ms() 스케일 유틸
├── assets/
│   └── icons/                    # 디자이너 SVG 원본 (README.md 규칙 참고)
├── tailwind.config.js            # 디자인 시스템 토큰 (theme.ts와 동기)
├── metro.config.js               # NativeWind + SVG transformer
├── svg.d.ts                      # *.svg 모듈 타입 선언
└── global.css                    # @tailwind base/components/utilities
```

---

## 🎨 디자인 시스템

> ⚠️ **컬러 시스템 v2 적용됨 (2026.06.23)**. 토큰 단일 소스 = [`src/shared/constants/tokens.js`](src/shared/constants/tokens.js) → `theme.ts`(`COLORS`)·`tailwind.config.js`가 여기서 생성된다. **값 수정은 tokens.js에서만** (수기 2중 동기 폐지).
> 전체 정리: [`docs/color-system-v2.md`](docs/color-system-v2.md) · north-star: [`docs/design.md`](docs/design.md).
> **primary = blue `#4486FF`** (구 cyan `#13BDFA` 폐기). 아래 일부 표는 v1 잔재 — 충돌 시 tokens.js/color-system-v2.md 우선. Light 전용(필드노트 스킨만 다크).

### Color (Primary: blue · v2)

```
primary  DEFAULT=#4486FF   (= blue/500, 브랜드 기준색)
blue.50  #F4F8FF   blue.100 #E5EEFF  blue.200 #C8DAFA
blue.300 #8CB5FF   blue.400 #689DFF  blue.500 #4486FF
blue.600 #2566DD   blue.700 #144CB1  blue.800 #0A3788  blue.900 #052561
```

### Color (Status — v2)

| 이름 | 값 | 용도 |
|------|-----|------|
| `status/danger` (error) | `#FF4242` | 에러/위험 |
| `status/success` | `#00BF40` | 완료/성공 |
| `status/warning` | `#FF9200` | 주의/진행중 |
| `status/info` | `#0E9BFF` | 정보 (구 #32AAFF) |

### Color (Gray Scale — v2)

```
0   #FFFFFF
50  #F5F7F8       (bg/base)
75  #F0F3F5       (assistive 버튼 bg)
100 #E9EEF0       (border/subtle, 절취선)
200 #E3EAEF       (border/default 표준)
300 #D1D5DB       (border/strong, 비활성 아이콘)
400 #AAB2BE
500 #7D848F
600 #58626C       (보조 텍스트)
700 #464F58
800 #2D333B
900 #1D2227       (기본 텍스트)
950 #171717
```

### Border 규칙

- **border 컬러는 `border-default` (gray-200 `#E3EAEF`) 사용** — 디자인 시스템 표준 (`border-default` 또는 `border-gray-200`)
- **White 배경(`bg-surface`, `bg-white`)의 카드·컨테이너에만 보더 적용**
- **Gray 배경(`bg-background`, `bg-gray-50` 등) 위에 놓인 카드·컨테이너에는 보더 사용 금지** — 카드 자체의 흰 배경 대비만으로 분리감을 확보 (이중 강조 방지)
- 절취선·내부 구분선은 `gray-100` 또는 `gray-300`을 용도에 맞게 사용

### Typography — 디자인 시스템 정석 이름 준수

`Typography` 컴포넌트 variant와 `text-*` className 모두 **동일 이름 체계**:

| variant | size / line-height | 용도 |
|---------|--------------------|------|
| `headline-01` | 24 / 36 | 최상위 헤드라인 (홈 인사) |
| `headline-02` | 20 / 28 | |
| `title-01` | 18 / 26 | 섹션 타이틀, 센터명 |
| `body-01` | 16 / 24 | 본문 중요 |
| `body-01-reading` | 16 / 26 | 긴 글 읽기용 |
| `body-02` | 15 / 22 | 본문 일반 |
| `body-02-reading` | 15 / 24 | 긴 글 읽기용 |
| `body-03` | 14 / 20 | 부가 본문 |
| `label-01` | 13 / 18 | 메타 라벨 |
| `label-02` | 12 / 16 | 뱃지, 마이크로 라벨 |
| `caption-01` | 11 / 14 | 캡션 |

**letter-spacing은 모든 variant에서 `-0.41px` 고정** (theme에 baked).

**Weight 네이밍** (Typography `weight` prop / `font-*` 클래스):
- `regular` = 400 (`font-normal`)
- `medium` = 500
- `semibold` = 600
- `bold` = 700 (디자인 시스템엔 없음, 유연성용)

**네이밍 규칙** (디자이너 소통용): `{variant}-{line-style}-{weight}`
- 예: `title-01-normal-semibold`, `body-03-normal-regular`
- "normal"은 기본 줄바꿈 스타일 (reading variant와 구분용)

### Radius
```
rounded-sm   6px   (badge)
rounded-md   10px  (sub-card, button)
rounded-lg   16px  (main card)
rounded-xl   20px
rounded-full 9999  (circle)
```

> **규칙 — radius = 내부 패딩 (필수)**: 카드·박스·시트 등 **내부 패딩을 가진 컨테이너의 모서리 radius는 그 컨테이너의 내부 패딩 값과 동일**하게 맞춘다. 가로·세로 패딩이 다르면 **가로(좌우) 패딩** 기준. (예: `padding 16` → `radius 16`) 원형 요소(아바타·circle 버튼)와 패딩 없는 라인/구분선은 예외.

---

## 🖼️ 커스텀 SVG 아이콘 시스템

### 규칙 (디자이너 공유)
- **viewBox**: 24×24 권장 (버튼/인디케이터), 28×28 (일러스트형)
- **색상**: `fill="currentColor"` 또는 `stroke="currentColor"` → color prop으로 주입 가능
  - 완성형 브랜드 아이콘(예: 센터 민트, 워크스페이스 오렌지)은 하드코딩 OK
- **파일명**: PascalCase + 크기 suffix (`HomeIcon24.svg`, `BellIcon20.svg`, `CounselingIcon28.svg`)

### 추가 절차
1. `assets/icons/*.svg` 드롭
2. `src/shared/components/icons/Icon.tsx`의 `ICON_MAP`에 import + 키 등록 (kebab-case)
3. `<Icon name="..." size={...} color={...} />`

### 예시
```tsx
import { Icon } from '@/shared/components/icons';
<Icon name="arrow-right" size={16} color={COLORS.gray[500]} />
```

커스텀 아이콘 미제공 구간에는 Ionicons 사용 가능 (점진적 교체).

---

## 📏 스케일 유틸 (`s()`)

**Figma 프레임 폭(390pt) ↔ 실기기 폭 차이 보정.**

```ts
import { s } from '@/shared/utils/scale';

<View style={{ height: s(216) }} className="rounded-lg bg-surface p-4" />
```

### 언제 쓰는지
- **고정 dimension** (카드 `h-[216px]`, 큰 width 등) → `s()`
- Tailwind utility (`p-4`, `gap-2`, `h-11` 등) → 그대로 (스케일 안 함)
- 폰트·radius → 필요 시 `ms(value, 0.5)` (moderate — 너무 안 커지게)

### NativeWind 한계
`className`은 동적 값 못 받음. 스케일 필요하면 **`style={{ height: s(N) }}`** 로 혼용.

---

## 🧭 네비게이션

- `(main)/_layout.tsx`: Stack + `animation: 'slide_from_right'`, `animationDuration: 250`, `gestureEnabled: true`
- 탭 ↔ 탭은 애니메이션 없음 (Tab navigator)
- 탭 ↔ 상세는 우측에서 슬라이드 인

---

## 🔐 인증/센터 흐름

- JWT access/refresh — AsyncStorage 저장, Axios interceptor가 401 시 자동 갱신 (대기 큐로 중복 방지)
- `(main)/_layout.tsx`에서 인증/센터 선택 가드 → unauth 시 `/(auth)/login`, 센터 미선택 시 `/(auth)/center-select`
- 센터 전환: `my-centers` 스크린에서 선택 → `setCenterContext` + `/(main)/(tabs)` replace

---

## 📐 레이아웃 규약

### 페이지 구조 (일반)
```tsx
<SafeAreaView className="flex-1 bg-background" edges={['top']}>
  <View className="h-12 ..." >{/* 헤더 52~48px */}</View>
  <ScrollView contentContainerStyle={{ paddingTop: s(16), paddingBottom: s(40) }}>
    {/* 콘텐츠 */}
  </ScrollView>
</SafeAreaView>
```

### 헤더 ↔ 콘텐츠 간격 규칙 (필수)

**모든 페이지에서 헤더 영역과 그 하위 첫 콘텐츠 사이에 `16px` 간격을 둔다.**

- 디자인 시스템 `gap/related (16px)` 토큰. 헤더와 콘텐츠가 부속 관계이므로 이 값을 사용.
- 적용 위치 우선순위:
  1. **헤더 직후가 `ScrollView`/`FlatList`인 경우** → `contentContainerStyle={{ paddingTop: s(16) }}`
  2. **헤더 직후가 일반 `View`인 경우** → 그 `View`에 `paddingTop: s(16)` 또는 `className="pt-4"`
  3. **헤더 wrapper 자체의 `paddingBottom`은 사용하지 않음** (헤더 박스 크기를 키우는 것이 아니라 콘텐츠 시작점을 내림)
- 헤더와 콘텐츠 사이에 검색바·필터·탭 등 부속 요소가 있어도, 그 부속 요소 자체가 첫 콘텐츠로 간주되어 동일하게 `paddingTop: s(16)`.
- 기존 페이지에 다른 값(`pt-1`, `pt-2`, `paddingTop: s(4)`, `paddingTop: s(20)` 등)이 있다면 `s(16)`으로 통일.

```tsx
// ✅ 표준 패턴
<View className="h-[52px] flex-row items-center px-4">...헤더...</View>
<ScrollView contentContainerStyle={{ paddingTop: s(16), paddingBottom: s(40) }}>
  {/* 콘텐츠 */}
</ScrollView>

// ❌ 잘못된 패턴 — 헤더 직후 마진 0
<View className="h-[52px] ...">...헤더...</View>
<ScrollView contentContainerStyle={{ paddingBottom: s(40) }}>
  {/* 콘텐츠가 헤더에 바로 붙음 */}
</ScrollView>
```

### 스크린별 컴포넌트 분리
- 한 스크린 내부에서만 쓰이는 컴포넌트 → **`app/.../_components/`** 에 배치
  - Expo Router는 **`_` prefix 폴더를 라우트로 인식 안 함** → 안전한 co-location
- 여러 스크린 공유 → `src/shared/components/` 또는 해당 feature 폴더

### 스크린 내 최대 라인 수 가이드
- ~300줄 넘어가면 sub 컴포넌트 추출 고려
- 데이터 훅/메모/계산은 메인 파일, 렌더 단위 JSX는 분리

---

## 🎨 스타일링 규칙

1. **기본은 NativeWind `className`**. StyleSheet.create는 기존 코드 유지보수 외엔 지양.
2. **동적 값**(스케일, 조건부 색상 등)은 `style={{}}` 병행 가능.
3. **색상은 theme/tailwind 토큰 사용**. 하드코딩 `bg-[#xxx]`는 **디자인 시스템에 없는 임시 색**에만 허용 (주석으로 이유 명시).
4. **텍스트는 Typography 컴포넌트 또는 `text-{variant}` 클래스** 중 선택:
   - `<Typography>` 사용 시: color/추가 className으로 overrice (`className="text-gray-900"`)
   - `<Text>` + tailwind 직접: 자유도 높음
5. **임의 letter-spacing 금지** — `text-body-02` 등 variant 쓰면 자동 -0.41px 적용됨.

---

## ⚠️ Gotchas

### SSR 불가 (웹과 다름)
모바일은 SSR 없음. 하지만 `onDestroy` 등 LIFECYCLE에서 브라우저 전용 API 호출 금지 (웹 빌드 고려 시).

### centerId 안전
`useCenterStore`는 AsyncStorage hydrated 후에만 값 채워짐. `onMount` 이전 또는 `requireCenterId()` 호출은 null 체크 필요.

### Metro 캐시
tailwind config, metro config, SVG 등 설정 변경 후에는 반드시 **`npx expo start -c`**.

### NativeWind 한계
- `className` 동적 값 불가 → `style={{}}` 혼용
- content 파일 패턴(`./app`, `./src`)에 포함된 폴더만 스캔됨

### `px` vs `dp`
NativeWind에서 `w-[216px]` = RN 216dp = Tailwind web과 동일 크기 의도. 다만 기기 물리 크기는 dp가 같아도 기기별 픽셀 밀도에 따라 실제 밀리미터 다름. Figma Mirror vs 실기기 차이는 **Figma 프레임 폭 vs 테스트 기기 폭** 비교로 설명 가능.

---

## 🧩 공용 컴포넌트 우선 사용 (Reuse First)

> **화면을 구현하기 전, 반드시 `src/shared/components/`를 먼저 탐색해서 기존 컴포넌트로 해결 가능한지 확인한다.**
> 디자인 시스템 일관성·유지보수 비용·번들 사이즈 모두를 위한 규칙. 새로 만드는 건 마지막 수단.

### 의사결정 순서
1. **기존 공용 컴포넌트 탐색** — `src/shared/components/ui/`, `src/shared/components/icons/` 먼저 확인
2. **prop/variant 조합으로 해결 가능?** → 그대로 사용 (override는 `className`, `style`로)
3. **거의 맞는데 표현력이 부족?** → 기존 컴포넌트에 prop 추가/확장 (호환성 유지)
4. **본질적으로 다른 컴포넌트?** → 새로 만들되 `src/shared/components/ui/`에 배치 + 이 표에 등록

### 공용 UI 컴포넌트 카탈로그 (`src/shared/components/ui/`)

| 컴포넌트 | 용도 |
|----------|------|
| `Typography` | 디자인 시스템 타이포 토큰(variant + weight) 적용 텍스트 |
| `Title` | 섹션 헤딩 (size: `lg`/`md`/`sm` 프리셋) |
| `Badge` | 사각형 라벨 (역할/태그) — gray/blue/green/red/outline |
| `BadgeRound` | pill 상태 라벨 (정적) — primary/warning/success/error/gray |
| `BadgeRoundState` | 출석 상태 드롭다운 트리거 (attended/absent/unconfirmed) — chevron + onPress, ref forwarding 지원 |
| `Segment` | pill 칩 필터 그룹 (value/onChange 컨트롤드, count 옵션) |
| `Tabs` | 언더라인 가로 탭 (활성 2px gray-800 / 비활성 1px gray-200, sliding indicator) |
| `Toggle` | on/off 스위치 (48×28, value/onChange 컨트롤드, 슬라이드 애니메이션) |
| `BottomSheet` | 하단 시트 모달 |
| `ConfirmModal` | 확인/취소 다이얼로그 |
| `Toast` | 일시적 알림 |
| `Skeleton` / `SkeletonCircle` | 로딩 스켈레톤 기본 박스 (gray-100↔gray-200 1.4초 shimmer). 페이지별 스켈레톤은 이 박스를 조합해 만든다 — [§6.2 로딩 상태](#62-로딩-상태) 참고 |
| `LoadingScreen` | 풀스크린 로딩 인디케이터 (스피너) — 스켈레톤이 어려운 전체 화면 전환에만. 콘텐츠 로딩은 스켈레톤 우선 |
| `ErrorBoundary` | React 에러 경계 |
| `Icon` (`components/icons/`) | SVG 아이콘 통합 (사이즈별 폴더 분리) |

새 컴포넌트가 다른 화면에서도 쓰일 가능성이 있다면 처음부터 공용으로 만들어라. "지금만 쓸 거야" 라며 화면 안에 박아두면 다음 사람이 똑같은 걸 또 만든다.

---

## 📁 Key Files

| 용도 | 경로 |
|------|------|
| Axios 인스턴스 | `src/shared/api/client.ts` |
| 토큰 저장 | `src/shared/utils/TokenStorage.ts` |
| 테마 상수 | `src/shared/constants/theme.ts` |
| Tailwind 설정 | `tailwind.config.js` |
| Typography | `src/shared/components/ui/Typography.tsx` |
| Title | `src/shared/components/ui/Title.tsx` |
| Badge | `src/shared/components/ui/Badge.tsx` |
| Segment | `src/shared/components/ui/Segment.tsx` |
| Icon | `src/shared/components/icons/Icon.tsx` |
| Scale 유틸 | `src/shared/utils/scale.ts` |
| 인증 스토어 | `src/features/auth/store.ts` |
| 센터 스토어 | `src/features/center/store.ts` |

---

## 🚀 새 스크린 추가 체크리스트

1. **공용 컴포넌트 먼저 탐색** — `src/shared/components/ui/`, `src/shared/components/icons/`에서 재사용 가능한 것 우선 활용 ([🧩 공용 컴포넌트 우선 사용](#-공용-컴포넌트-우선-사용-reuse-first))
2. `app/(main)/.../xxx.tsx` 파일 생성 (Expo Router 자동 라우팅)
3. `<SafeAreaView className="flex-1 bg-background" edges={['top']}>` 기본 레이아웃
4. 헤더 필요 시 `h-12 ...` + back 버튼 (`<Icon name="arrow-left" size={24} />`)
5. 데이터는 해당 feature의 `hooks.ts` 사용
6. **로딩 상태 = 스켈레톤 (필수)** — 스피너 대신, 그 화면 레이아웃을 흉내 낸 페이지별 스켈레톤을 `_components/`에 만들어 `Skeleton`/`SkeletonCircle`로 조합 ([§6.2 로딩 상태](#62-로딩-상태)). 빈/에러 상태도 함께 처리
7. 서브 컴포넌트 분리 고려 → `_components/` 폴더
8. 고정 dimension은 `s()` 활용

---

## 🧪 디자인 시안 비교 (Lab) 컨벤션

> 새로운 디자인 시안은 **반드시 lab 안에서 탭으로 전환해 비교 가능**해야 한다. 시안별로 별도 lab 파일을 양산하지 않는다.

### 파일 1개 = 시안 N개 (탭 전환)

```
app/(main)/lab/<feature-or-area>.tsx
  └─ 상단 탭: [현재] [신규 시안 A] [신규 시안 B]
      └─ 선택된 탭에 따라 같은 화면 영역을 다른 디자인으로 렌더
```

**기준 구현체**: [home-hero-bg.tsx](apps/mobile/app/(main)/lab/home-hero-bg.tsx)

### 새 시안 추가 절차

1. **기존 lab 파일에 시안 탭 추가** — 같은 영역의 변주라면 새 lab을 만들지 말고 기존 lab의 탭 배열에 항목을 추가한다.
2. **새 lab이 필요한 경우** — 영역/맥락이 완전히 다른 경우에만:
   - `app/(main)/lab/<slug>.tsx` 작성 (탭 구조 포함)
   - `src/features/lab/registry.ts` 의 `LAB_EXPERIMENTS` 배열에 등록
3. **탭 구조 규칙**
   - 첫 탭은 항상 **현재 화면** (대조군)
   - 두 번째 탭부터 변주 시안
   - 탭 레이블은 핵심 차이를 한 줄로 (예: `Primary 500 (현재)`, `Primary 50 (신규)`)
   - 탭 UI: `gray-50` 배경 pill + 활성 탭 white pill (홈 통계 PeriodToggle과 동일 스타일)
4. **mock 데이터** — 실데이터 의존 최소화. `_home-mock.ts` 같은 공통 mock 활용 또는 인라인 mock.

### 금지

- ❌ 시안별로 별도 lab 파일을 만드는 것 (예: `home-v2.tsx`, `home-v3.tsx`)
- ❌ 탭 없이 단일 시안만 보여주는 lab
- ❌ "현재" 대조군 없이 신규 시안만 보여주기

---

## 🪪 Git Commits (한글)

| Prefix | 용도 | 예시 |
|--------|------|------|
| `feat:` | 새 기능 | `feat: 내 센터 전환 페이지 추가` |
| `modify:` | 기존 기능 수정 | `modify: 홈 카드 레이아웃 개편` |
| `fix:` | 버그 수정 | `fix: 토큰 갱신 큐 중복 호출 수정` |
| `style:` | 스타일만 | `style: 프로필 카드 높이 134로 조정` |
| `publish:` | 배포 | `publish: v1.2.0` |

---

# 📘 UI Design System (정식 스펙)

> 위 섹션들은 코드 베이스 동기화용 요약입니다.
> 아래 내용이 **디자인 결정의 정식 기준**입니다. 토큰 이름·값이 충돌하면 이쪽을 따릅니다.

> 기준 디바이스: **375 × 812pt (iPhone SE 3세대 / 표준 기준)**
> 모든 수치는 **pt(포인트)** 단위. 실제 렌더링은 @2x / @3x 대응.
> 이 문서는 Figma 토큰과 1:1 대응되며, 임의 값 사용을 금지합니다.

---

## 목차

0. [디자인 톤 & 매너](#0-디자인-톤--매너)
1. [색상 시스템](#1-색상-시스템)
2. [타이포그래피](#2-타이포그래피)
3. [간격 & 레이아웃](#3-간격--레이아웃)
4. [컴포넌트](#4-컴포넌트)
5. [네비게이션 패턴](#5-네비게이션-패턴)
6. [상태 표현](#6-상태-표현)
7. [아이콘](#7-아이콘)
8. [인터랙션](#8-인터랙션)
9. [접근성](#9-접근성)
10. [네이밍 컨벤션](#10-네이밍-컨벤션)
11. [DO / DON'T](#11-do--dont)
12. [UX 라이팅](#12-ux-라이팅)

---

## 0. 디자인 톤 & 매너

> 이 섹션은 모든 디자인 결정의 출발점입니다.
> 색상을 고를 때도, 애니메이션을 짤 때도, 문구를 쓸 때도 — 항상 이 기준으로 먼저 판단합니다.

---

### 핵심 방향

| | 키워드 | 의미 |
|-|--------|------|
| 😊 | **친절** | 사용자가 막히는 순간이 없도록. 다음 행동을 항상 안내한다. |
| 🤝 | **친근** | 시스템이 아닌 사람처럼 말하고 반응한다. |
| ✨ | **재미** | 단조롭지 않게. 작은 순간에도 즐거움이 있다. |

세 키워드는 서로 독립적이지 않습니다. **친절하되 딱딱하지 않고, 친근하되 가볍지 않고, 재미있되 산만하지 않은** 균형을 목표로 합니다.

---

### UI 측면

**색상과 형태**
- Primary cyan(`#13BDFA`)은 차갑게 느껴지지 않도록, 따뜻한 맥락(완료, 성공, 강조)에 적극 사용한다.
- 카테고리 색상(상담 그린, 검사 블루)은 화면에 리듬감을 만드는 역할을 한다. 단일 색조 화면이 반복되지 않도록 한다.
- 모든 컴포넌트는 `radius-lg(16px)` 이상의 둥근 모서리를 기본으로 한다. 각진 요소는 의도적인 경우에만 허용한다.
- 빈 공간(white space)을 두려워하지 않는다. 여유로운 레이아웃이 친근함을 만든다.

**단조롭지 않게**
- 같은 정보라도 계층(타이틀/본문/캡션)을 명확히 나눠 시각적 리듬을 만든다.
- 상태 뱃지, 카드 카테고리 dot, 카테고리 색상처럼 작은 컬러 포인트를 적극 활용한다.
- 아이콘은 선 굵기와 크기를 맥락에 맞게 변화를 주어 단순한 나열이 되지 않도록 한다.

---

### UX(사용성) 측면

**친절한 흐름**
- 사용자가 어디에 있는지, 다음에 무엇을 해야 하는지 항상 명확하게 제시한다.
- 파괴적 행동(삭제, 나가기)은 반드시 한 단계 더 확인을 거친다.
- 오류가 발생해도 사용자를 탓하지 않고 해결 방법을 바로 제시한다.

**재미있는 인터랙션**
- 주요 완료 액션(저장, 등록)에는 단순 색 전환이 아닌 spring easing(`cubic-bezier(0.34, 1.56, 0.64, 1)`)을 사용해 탄력 있는 피드백을 준다.
- 성공 상태(토스트, 완료 뱃지)는 체크 아이콘 + 색상이 함께 등장하며 작은 celebrate 느낌을 만든다.
- 빈 상태는 "데이터 없음"이 아니라 시작을 유도하는 긍정적인 메시지로 구성한다.
- 스크롤, 탭 전환, 바텀시트 열림 등 모든 전환에는 적절한 모션을 적용해 화면이 살아있는 느낌을 준다.

**단조롭지 않게**
- 리스트 화면이 길어질 때는 섹션 구분, 날짜 헤더 등으로 시각적 리듬을 만든다.

---

### 레이아웃 측면

레이아웃은 정보를 담는 그릇입니다. 잘 짜인 레이아웃은 사용자가 의식하지 못하지만, 무너진 레이아웃은 바로 느껴집니다.

**페이지 레이아웃 원칙**
- 모든 콘텐츠는 좌우 `16px` 안에서 숨쉰다. 화면 끝까지 꽉 채우는 요소는 탭바, 네비게이션 바, 풀스크린 바텀시트뿐이다.
- 상위 프레임은 수직으로 쌓이며 프레임 간 간격은 `0`. 섹션 사이 여백은 각 프레임의 내부 패딩으로 만든다.
- 스크롤 가능한 콘텐츠 영역은 네비게이션 바 아래부터 탭바 위까지. 콘텐츠가 탭바에 가리지 않도록 하단 여백을 반드시 확보한다.
- 페이지 내 정보의 흐름은 **위→아래, 중요→부가** 순서를 지킨다. 사용자 시선이 자연스럽게 내려올 수 있도록 배치한다.

**섹션 구성 원칙**
- 하나의 섹션은 하나의 주제만 다룬다. 서로 다른 주제가 한 섹션에 섞이지 않도록 한다.
- 섹션 레이블(타이틀 S)은 해당 콘텐츠 바로 위에 붙이고, `gap/related(16px)`로 연결한다.
- 섹션과 섹션 사이는 `gap/section(24px)`으로 구분한다. 임의로 더 크거나 작은 값을 쓰지 않는다.

**카드 내부 레이아웃 원칙**
- 카드 안의 정보는 **타이틀 → 본문 → 캡션** 순서로 위에서 아래로 배치한다.
- 가장 중요한 정보(타이틀)는 항상 좌상단에 위치한다. 뱃지·액션 버튼은 우측에 배치한다.
- 카드 내부 요소 간 간격은 `gap/related(16px)`. 밀도가 높은 카드에서는 `gap/card(12px)`까지 허용한다.
- 카드 안에서 레이블-값 구조를 쓸 때는 레이블 너비를 그룹 내 가장 긴 레이블 기준으로 고정해 값의 시작 위치를 맞춘다.
- 카드의 좌우 패딩(`16px`)은 모든 내부 요소에 동일하게 적용한다. 일부 요소만 들여쓰거나 내어쓰지 않는다.

**정렬 원칙**
- 텍스트는 항상 좌측 정렬. 중앙 정렬은 바텀시트 드래그 핸들, 네비게이션 바 타이틀, 빈 상태 메시지에서만 허용한다.
- 숫자(시간, 날짜, 수치)는 우측 정렬. 같은 컬럼의 숫자는 소수점·콜론이 수직으로 맞아야 한다.
- 아이콘과 텍스트가 함께 있을 때는 항상 수직 중앙 정렬(`align-items: center`).

**여백의 사용**
- 여백은 정보의 관계를 나타낸다. 가까이 있으면 연관된 것, 멀리 있으면 독립적인 것.
- 콘텐츠를 억지로 채우지 않는다. 여백이 생기면 레이아웃이 숨쉬는 것으로 받아들인다.
- 빈 상태 화면은 수직 중앙에 배치하되, 화면 전체를 채우려 하지 않는다.

---

**페이지 단위 레이아웃 — 정돈되되 단조롭지 않게**

잘 정돈된 레이아웃과 단조로운 레이아웃은 다릅니다. 정돈은 일관된 규칙에서 오고, 생동감은 그 안에서의 의도적인 강약에서 옵니다.

```
❌ 단조로운 화면        ✅ 정돈되고 살아있는 화면

[카드]                  타이틀 ————————————————
[카드]
[카드]                  [강조 카드 — 더 넓은 여백]
[카드]
[카드]                  [카드]  [카드]
[카드]                  [카드]  [카드]
```

**강조 계층 만들기**

한 화면에서 모든 요소가 동일한 비중을 가지면 사용자는 어디를 봐야 할지 알 수 없습니다. 페이지에는 항상 명확한 강약이 있어야 합니다.

| 강조 수준 | 방법 | 사용 기준 |
|---------|------|---------|
| **1순위** — 핵심 정보 | 타이포 크기 키우기, 굵기 높이기, 색상 강조 | 페이지당 1~2개. 사용자가 가장 먼저 봐야 할 것 |
| **2순위** — 주요 콘텐츠 | 카드 배경 흰색 + 테두리, 충분한 패딩 | 섹션의 핵심 리스트 |
| **3순위** — 보조 정보 | 작은 폰트, gray 계열 색상, 적은 패딩 | 날짜, 메타, 부가 설명 |

규칙: **1순위는 페이지당 반드시 하나만.** 모두가 강조되면 아무것도 강조되지 않는다.

**강조 기법**

타이포 강조
- 타이틀은 `Headline_01/Semibold`로 크고 굵게. 첫 줄에서 페이지의 목적이 읽혀야 한다.
- 강조할 수치나 이름은 주변 텍스트보다 한 단계 위 스타일(`Body_01` → `Title_01`)로 올린다.
- 같은 크기의 텍스트가 나열될 때는 굵기(Regular vs Semibold)로 계층을 나눈다.

여백 강조
- 중요한 섹션은 위아래 여백을 더 넉넉히 준다. 여백이 많을수록 그 안의 콘텐츠가 돋보인다.
- 강조 카드는 `gap/section(24px)` 앞뒤 여백으로 주변 콘텐츠와 숨을 구분한다.

색상 강조
- Primary cyan은 한 화면에서 1~2곳에만. 곳곳에 쓰이면 강조 효과가 없어진다.
- 카테고리 색상(상담 그린, 검사 블루)은 해당 콘텐츠 영역에만 제한적으로 쓴다.
- 나머지 영역은 gray 계열로 차분하게 유지해 색상 포인트가 더 살아나도록 한다.

**단조로움을 깨는 방법**

레이아웃에 변화를 주되, 토큰과 규칙 안에서 해결합니다.

- 동일한 카드가 연속될 때 → 날짜 헤더, 섹션 레이블로 시각적 끊음을 만든다
- 정보 밀도가 높은 화면 → 빈 줄 없이 쌓지 말고, 섹션마다 `gap/section`으로 숨통을 터준다
- 전체가 회색인 화면 → Primary 또는 카테고리 색상이 한 곳 이상 사용되고 있는지 확인한다
- 텍스트만 가득한 화면 → 아이콘, 뱃지, 구분선 등 비텍스트 요소를 1~2개 배치한다

**과하지 않은 기준**

아래 중 하나라도 해당되면 지나친 것입니다.

```
- Primary 색상이 한 화면에 3군데 이상 사용됨
- 굵기 600(Semibold) 텍스트가 화면의 절반 이상을 차지함
- 두 가지 이상의 강조 기법이 같은 요소에 동시 적용됨
  (예: 크고 + 굵고 + 색상까지 primary인 텍스트)
- 카드 간격이 불규칙하게 섞임 (12px / 16px / 24px 혼재)
```

---

### UX 라이팅 측면

> 상세 규칙은 [12. UX 라이팅](#12-ux-라이팅) 참조.

**친절하게**
- 사용자가 다음 행동을 스스로 찾지 않아도 되도록 문구가 안내한다.
- 오류 메시지는 "무엇이 잘못됐는가"가 아니라 "어떻게 하면 되는가"로 작성한다.

**친근하게**
- `~해요` / `~예요` 체를 일관되게 유지한다.
- 가능한 곳에서는 사용자 이름을 넣어 개인화된 느낌을 준다. ("김민준님의 일정이에요")
- 시스템 용어(저장 완료, 처리됨)는 쓰지 않는다.

**재미있게, 단조롭지 않게**
- 빈 상태, 완료 메시지처럼 사용자가 집중하지 않는 순간에 작은 반전이나 따뜻한 한마디를 넣는다.
- 모든 문구가 "정보 전달"에만 그치지 않도록 한다. 읽혔을 때 살짝 기분이 좋아지는 문구를 지향한다.
- 단, 유머가 과하거나 상담이라는 전문적 맥락과 어울리지 않으면 사용하지 않는다.

---

### 균형 기준 — 이 앱의 맥락

이 앱은 **상담사가 매일 업무에서 사용하는 전문 도구**입니다.
지나치게 가볍거나 유희적인 디자인은 신뢰감을 해칩니다.

```
너무 딱딱함  ←————————————●——→  너무 가벼움
              전문적이고 친근한 중간 지점
```

판단이 애매할 때는 아래 기준으로 확인합니다.

- "이 디자인/문구를 보고 상담사가 신뢰할 수 있을까?" → 신뢰 가능하면 진행
- "이 디자인/문구가 매일 봐도 질리지 않을까?" → 질리지 않으면 진행
- "처음 보는 사람도 직관적으로 이해할 수 있을까?" → 이해 가능하면 진행

---

## 1. 색상 시스템

> ⚠️ **이 절은 v1(cyan) 잔재가 섞여 있습니다.** 컬러 v2의 정확한 값·토큰은 [`docs/color-system-v2.md`](docs/color-system-v2.md) + 코드 [`src/shared/constants/tokens.js`](src/shared/constants/tokens.js)가 source of truth입니다 (primary=blue `#4486FF`, Primitive→Semantic 2계층, Light 전용). 값이 충돌하면 v2를 따르세요. 아래 서술(톤·매너·구조 원칙)은 유효합니다.

색상 토큰은 **레이어 구조**(Primitive → Semantic → Component)로 관리합니다.
코드와 디자인 작업 시 **Primitive를 직접 참조하는 것을 금지**합니다. 반드시 Semantic 또는 Component 토큰을 사용합니다.

```
Tier 1  Primitive    팔레트의 원시값. "이 색이 존재한다"
           ↓         Figma 팔레트에서만 직접 정의·수정
Tier 2  Semantic     목적과 의미를 부여. "이 색이 어디에, 왜 쓰인다"
           ↓         개발/디자인 작업의 기본 참조 단위
Tier 3  Component    앱 도메인에 특화된 색상. Semantic으로 표현 불가한 경우만 정의
```

> **판단 기준**: Semantic 토큰으로 의미가 명확하게 전달되면 Component 토큰은 만들지 않습니다.
> Component 토큰이 필요한 신호 → "이 색은 [특정 기능/상태]에서만 쓰인다"고 설명해야 할 때.

---

### Tier 1 — Primitive

팔레트의 원시값입니다. **디자이너가 Figma에서 팔레트를 정의할 때만 사용**하며, 컴포넌트나 화면 작업에서 직접 참조하지 않습니다.

#### Gray

```
gray-white : #FFFFFF
gray-50    : #F7F8F8
gray-100   : #EEF1F2
gray-200   : #DADFE5
gray-300   : #D1D5DB
gray-400   : #AAB2BE
gray-500   : #7D848F
gray-600   : #606A74
gray-700   : #464F58
gray-800   : #2D333B
gray-900   : #1D2227
gray-black : #191919
```

#### Primary (Cyan)

```
primary-50  : #E8F8FE
primary-100 : #D7F2FC
primary-200 : #C1EEFF
primary-300 : #97E3FF
primary-400 : #5FD4FF
primary-500 : #13BDFA   ← 브랜드 기준색
primary-600 : #09A9E4
primary-700 : #0090C5
primary-800 : #006990
primary-900 : #00374C
```

#### Status

```
negative : #FF4242
positive : #00BF40
info     : #0E9BFF
notice   : #FF9200
```

#### Fieldnote

```
fieldnote-purple : #9B5DFF
```

#### Category

앱 내 두 가지 핵심 카테고리에 대응하는 전용 색상입니다.
**Component 토큰을 통해서만 참조**하며, Semantic 토큰으로 절대 연결하지 않습니다.

```
category-counseling : #05B17A   ← 상담
category-assessment : #3495F5   ← 검사
```

---

#### Extended Palette (확장 팔레트)

**Primary와 Gray로 해결되지 않을 때**만 사용하는 14색 보조 팔레트입니다.
**이 팔레트에 없는 임의 색은 새로 도입하지 않습니다.**

**기본 원칙**
- 색이 필요한 거의 모든 경우는 먼저 Primary와 Gray로 시도한다. 팔레트는 그 다음 수단.
- 한 화면에 팔레트 색이 3가지 이상 등장하면 과한 것 — 줄일 수 있는지 먼저 확인한다.
- 명도·채도가 비슷한 두 색(예: Red ↔ Coral, Purple ↔ Pink)은 같은 화면에서 동시에 쓰지 않는다.

**두 가지 변형**

| 변형 | 용도 | 비고 |
|------|------|------|
| **Solid** | 텍스트, 아이콘, 라인, 카테고리 dot 등 색 자체로 식별되는 요소 | 그대로 사용 (불투명) |
| **OpacityBG** | 뱃지·태그·상태 칩의 면 단위 배경 | 색마다 **정해진 투명도가 고정** — 임의 투명도 금지 |

**적용 금지**
- 캘린더 / 일정 카드의 카테고리 색상 (`schedule/accent-*`, `calendarDot`) — 기존 schedule accent 토큰을 그대로 사용한다. 팔레트로 교체하지 않는다.

**팔레트 정의**

> Yellow / Violet / Mint는 Solid와 OpacityBG의 **소스 hex가 의도적으로 다릅니다.** 배경에서 더 자연스럽게 보이도록 분리된 값이므로, OpacityBG가 필요할 때는 아래 명시된 소스 색 + 투명도를 그대로 적용합니다.

| 이름 | Solid | OpacityBG 소스 | Opacity |
|------|-------|---------------|---------|
| Red | `#D23E46` | `#D23E46` | 8% |
| Orange | `#F47500` | `#F47500` | 8% |
| Yellow | `#F5C300` | `#FDCA01` | 10% |
| Green_Yellow | `#84B522` | `#84B522` | 10% |
| Green | `#017750` | `#017750` | 6% |
| Blue | `#0E91ED` | `#0E91ED` | 8% |
| Purple_Blue | `#012396` | `#012396` | 10% |
| Violet | `#7B4FFF` | `#A78BFA` | 10% |
| Purple | `#9C23D0` | `#9C23D0` | 6% |
| Pink | `#C70A89` | `#C70A89` | 6% |
| Coral | `#EF4967` | `#EF4967` | 6% |
| Mint | `#009BA9` | `#1395A1` | 8% |
| Gray | `#717171` | `#717171` | 8% |
| Brick | `#C7371E` | `#C7371E` | 6% |

**토큰 참조**
- 코드: `COLORS.palette.{name}` / `COLORS.paletteBg.{name}` (`src/shared/constants/theme.ts`)
- Tailwind: `text-palette-{name}` / `bg-palette-bg-{name}` (kebab-case: `green-yellow`, `purple-blue`)

**상태 뱃지 매핑 (기본 가이드)**

상담·검사 등의 상태 뱃�는 OpacityBG + Solid 텍스트 쌍으로 구성합니다.

| 상태 의미 | 팔레트 색 |
|---------|---------|
| 진행중 (processing / in_progress / active) | **Blue** |
| 완료 (completed) | **Green** |
| 제출 완료·확인 대기 (submitted) | **Yellow** |
| 지각 (late) | **Yellow** |
| 거부·오류 (refused) | **Red** |
| 불참 (absent) | **Red** |
| 사유 결석 (excused) | **Blue** |
| 대기·취소·예정 (pending / cancelled / scheduled) | **Gray** |
| 그 외 추가 상태 | Violet · Mint · Coral 순으로 팔레트 내에서 선택 |

---

### Tier 2 — Semantic

**"이 색이 어디에, 왜 쓰이는가"** 를 정의합니다.
이 단계가 실제 작업의 기본 참조 단위입니다. 카테고리별로 구분하며, 각 토큰은 하나의 명확한 역할만 가집니다.

---

#### Surface — 배경색

요소의 **레이어 높이**를 나타냅니다. 위로 올라올수록 밝아집니다.

| 토큰 | Primitive | 값 | 판단 기준 |
|------|-----------|----|---------|
| `surface/page` | gray-50 | `#F7F8F8` | 화면의 가장 바닥 배경 |
| `surface/card` | gray-white | `#FFFFFF` | page 위에 올라오는 카드·시트·모달 |
| `surface/sunken` | gray-100 | `#EEF1F2` | card 안에 들어가 있는 듯한 영역 (인풋, 텍스트박스) |
| `surface/overlay` | gray-black @50% | — | 바텀시트·모달 뒤 딤 처리 |
| `surface/brand` | primary-500 | `#13BDFA` | 브랜드 강조 — 주요 버튼·액션 배경 |
| `surface/brand-subtle` | primary-50 | `#E8F8FE` | 브랜드 연한 강조 — 선택 상태, 활성 탭 배경 |

> ✅ `surface/card` vs `surface/sunken` 판단:
> 카드가 page 위에 떠 있는 느낌이면 `card`, 카드 안에 눌려 들어간 느낌이면 `sunken`.

---

#### Text — 텍스트색

정보의 **계층과 중요도**를 나타냅니다. primary → quaternary로 갈수록 시각적 무게가 줄어듭니다.

| 토큰 | Primitive | 값 | 판단 기준 |
|------|-----------|----|---------|
| `text/primary` | gray-black | `#191919` | 가장 중요한 텍스트 — 타이틀, 카드 타이틀 |
| `text/secondary` | gray-900 | `#1D2227` | 일반 본문 — 카드 본문, 설명 |
| `text/tertiary` | gray-500 | `#7D848F` | 부가 정보 — 날짜, 주소, 메타 |
| `text/quaternary` | gray-400 | `#AAB2BE` | 최소 강조 — placeholder, 비활성 |
| `text/label` | gray-600 | `#606A74` | 레이블-값 패턴의 레이블, 섹션 레이블 |
| `text/inverse` | gray-white | `#FFFFFF` | 어두운 배경(버튼, 토스트, 뱃지) 위 텍스트 |
| `text/brand` | primary-700 | `#0090C5` | 링크, 텍스트형 액션 버튼 ("수정하기") |
| `text/negative` | negative | `#FF4242` | 오류 메시지 |
| `text/positive` | positive | `#00BF40` | 성공 메시지 |

> ✅ `text/primary` vs `text/secondary` 판단:
> 해당 텍스트가 없으면 맥락을 이해할 수 없다면 `primary`, 보완 정보라면 `secondary`.
> ✅ `text/tertiary` vs `text/label` 판단:
> 단순 부가 정보면 `tertiary`, 항목을 구분하는 레이블 역할이면 `label`.

---

#### Border — 테두리색

요소의 **구분 강도**를 나타냅니다.

| 토큰 | Primitive | 값 | 판단 기준 |
|------|-----------|----|---------|
| `border/subtle` | gray-200 | `#DADFE5` | 있는 듯 없는 듯 구분선 — 카드 테두리, Divider |
| `border/default` | gray-300 | `#D1D5DB` | 명확한 구분 — 인풋 기본 테두리 |
| `border/dashed` | gray-300 | `#D1D5DB` | 점선 — "추가하기" 버튼 |
| `border/focus` | primary-500 | `#13BDFA` | 포커스 상태 |
| `border/negative` | negative | `#FF4242` | 오류 상태 인풋 |

> ✅ `border/subtle` vs `border/default` 판단:
> 배경과의 경계가 보조적 역할이면 `subtle`, 사용자가 인식해야 하는 경계면 `default`.

---

#### Interactive — 상호작용 색

버튼·탭 등 **사용자가 누르는 요소**의 상태 색상입니다.

| 토큰 | Primitive | 값 | 상태 |
|------|-----------|----|------|
| `interactive/primary` | primary-500 | `#13BDFA` | 기본 |
| `interactive/primary-pressed` | primary-600 | `#09A9E4` | 눌림 |
| `interactive/primary-disabled` | gray-300 | `#D1D5DB` | 비활성 |
| `interactive/secondary` | gray-100 | `#EEF1F2` | Secondary 버튼 기본 |
| `interactive/secondary-pressed` | gray-200 | `#DADFE5` | Secondary 버튼 눌림 |

---

### Tier 3 — Component

Semantic 토큰으로 표현할 수 없는 **앱 도메인에 특화된 색상**만 정의합니다.
이 토큰들은 내부적으로 Primitive를 참조하며, 의미 변경 없이 값만 바꿔야 할 때 Semantic을 수정하는 것과 달리 **기능이 바뀔 때 함께 수정**됩니다.

#### 상태 뱃지 (Status Badge)

상담·검사의 진행 상태를 나타냅니다. 배경색과 텍스트색을 세트로 사용합니다.

| 토큰 | 배경 | 텍스트 | Primitive 참조 |
|------|------|--------|--------------|
| `status/completed` | gray-200 `#DADFE5` | gray-600 `#606A74` | gray |
| `status/in-progress` | notice @12% `#FFF0DC` | notice `#FF9200` | notice |
| `status/scheduled` | gray-100 `#EEF1F2` | gray-600 `#606A74` | gray |
| `status/requested` | gray-100 `#EEF1F2` | gray-700 `#464F58` | gray |

> `status/in-progress` 배경은 `notice #FF9200`에 투명도 12%를 적용한 값입니다.

#### 일정 카드 카테고리 dot (Schedule Accent)

상담 유형을 색상으로 구분합니다. 카드 타이틀(내담자명) 앞 6×6px 원형 dot에만 사용합니다.

| 토큰 | 색상 | Primitive 참조 | 용도 |
|------|------|--------------|------|
| `schedule/accent-default` | `#13BDFA` | primary-500 | 기본 개인 상담 |
| `schedule/accent-group` | `#FF4242` | negative | 그룹·기타 유형 |
| `schedule/accent-fieldnote` | `#9B5DFF` | fieldnote-purple | 필드노트 연계 상담 |

---

#### 카테고리 색상 (Category)

상담(`#05B17A`)과 검사(`#3495F5`)를 구분하는 전용 색상입니다.

**적용 원칙**: 아래에 명시된 상황에서만 사용합니다. 새로운 사용처가 생길 때마다 이 문서에 추가하고, 명시되지 않은 곳에는 임의로 적용하지 않습니다.

| 토큰 | Primitive | 값 |
|------|-----------|----|
| `category/counseling` | category-counseling | `#05B17A` |
| `category/assessment` | category-assessment | `#3495F5` |

**적용 가능 상황** ← 확정된 것만 추가

```
(추가 예정)
```

---

## 2. 타이포그래피

### 2.1 폰트 패밀리

```
Primary : Pretendard
Fallback: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif
```

- **Letter Spacing**: 모든 스타일 공통 **-0.41px** (Pretendard 기본 커닝)
- `font-feature-settings: "tnum"` — 숫자(시간, 날짜) 사용 시 적용

### 2.2 타입 스케일

| 토큰명 | Size | Line Height | Weight | 용도 |
|--------|------|-------------|--------|------|
| `Time/Normal-Light` | 48pt | 52pt | 300 | 시간 표시 (대형) |
| `Headline_01/Semibold` | 24pt | 36pt | 600 | 페이지 메인 타이틀 (`안녕하세요, 김민준님`) |
| `Headline_02/Semibold` | 20pt | 28pt | 600 | 섹션 타이틀, 바텀시트 제목 |
| `Headline_02/Medium` | 20pt | 28pt | 500 | 서브 섹션 타이틀 |
| `Title_01/Semibold` | 18pt | 26pt | 600 | 카드 타이틀, 내비게이션 제목 |
| `Body_01/Reading-Regular` | 16pt | 26pt | 400 | 긴 본문 읽기 (상담일지 내용) |
| `Body_01/Semibold` | 16pt | 24pt | 600 | 강조 본문 |
| `Body_01/Medium` | 16pt | 24pt | 500 | 중간 강조 본문 |
| `Body_01/Regular` | 16pt | 24pt | 400 | 기본 본문 |
| `Body_02/Reading-Regular` | 15pt | 24pt | 400 | 보조 본문 읽기 |
| `Body_02/Semibold` | 15pt | 22pt | 500 | 카드 보조 강조 |
| `Body_02/Medium` | 15pt | 22pt | 500 | 카드 보조 텍스트 |
| `Body_02/Regular` | 15pt | 22pt | 400 | 카드 보조 텍스트 |
| `Body_03/Medium` | 14pt | 20pt | 500 | 메타, 보조 레이블 |
| `Body_03/Regular` | 14pt | 20pt | 400 | 메타, 날짜, 주소 |
| `Lable_01/Semibold` | 13pt | 18pt | 600 | 섹션 레이블 강조 |
| `Lable_01/Medium` | 13pt | 18pt | 500 | 배지, 탭 레이블 |
| `Lable_01/Regular` | 13pt | 18pt | 400 | 보조 레이블 |
| `Lable_02/Medium` | 12pt | 16pt | 500 | 캘린더 날짜, 칩 |
| `Caption_01/Regular` | 11pt | 14pt | 400 | 최소 크기 캡션, 도움말 |

### 2.3 역할별 타이포 정의 (Role-based)

스타일 토큰을 직접 쓰기보다, **역할**을 기준으로 판단합니다.
같은 `Body_02/Regular`라도 어디에 쓰이느냐에 따라 색상과 의미가 달라집니다.

#### 페이지 계층

| 역할 | 스타일 | 색상 | 높이 |
|------|--------|------|------|
| 페이지 타이틀 | `Headline_01/Semibold` | `text/primary` | L (26px) |
| 섹션 대제목 | `Headline_02/Semibold` | `text/primary` | M (24px) |
| 섹션 소제목 | `Title_01/Semibold` | `text/primary` | S (20px) |
| 섹션 레이블 | `Lable_01/Semibold` | `text/section-label` (gray-600) | — |

#### 카드 계층

| 역할 | 스타일 | 색상 |
|------|--------|------|
| 카드 타이틀 | `Body_01/Semibold` | `text/primary` (gray-black) |
| 카드 본문 | `Body_02/Regular` | `text/secondary` (gray-900) |
| 카드 캡션 | `Body_03/Regular` | `text/tertiary` (gray-500) |

#### 폼 계층

| 역할 | 스타일 | 색상 |
|------|--------|------|
| 폼 레이블 (타이틀 S) | `Lable_01/Semibold` | `text/primary` |
| 레이블-값 레이블 | `Body_02/Regular` | gray-600 |
| 레이블-값 값 | `Body_02/Regular` | gray-800 |
| 플레이스홀더 | `Body_02/Regular` | `text/quaternary` (gray-400) |
| 에러 메시지 | `Caption_01/Regular` | `text/negative` |

---

### 2.4 화면별 타이포 적용 가이드

#### 센터 선택 화면

```
인사 타이틀 ("안녕하세요, 김민준님")  → Headline_01/Semibold
서브 타이틀 ("시작할 센터를 선택해주세요") → Headline_01/Semibold (같은 블록)
센터명 (카드)                        → Body_01/Semibold
가입일 레이블 ("가입일")              → Body_03/Regular, text/tertiary
가입일 날짜 값                        → Body_03/Regular, text/tertiary
섹션 레이블 ("요청한 센터", "초대된 센터") → Lable_01/Medium, text/section-label
센터명 (요청/초대 카드)               → Body_01/Semibold
주소·전화번호                         → Body_03/Regular, text/tertiary
"+ 센터 추가하기"                     → Body_02/Medium, text/tertiary
```

#### 상담일지 화면

```
네비게이션 날짜 ("2026-04-13 (목)")  → Title_01/Semibold
일지 제목 ("김은지의 상담일지")       → Headline_02/Semibold
"수정하기" 액션 텍스트               → Body_02/Medium, text/brand
섹션 레이블 ("상담 목표", "상담 내용") → Lable_01/Semibold, text/section-label
본문 내용                            → Body_01/Reading-Regular
개인 메모 레이블                     → Lable_01/Medium
개인 메모 내용                       → Body_02/Regular
토스트 메시지                        → Body_02/Medium, text/inverse
```

#### 일정(스케줄) 화면

```
페이지 타이틀 ("일정")               → Headline_02/Semibold
월 표시 ("3월")                      → Body_01/Semibold
캘린더 날짜 숫자                     → Lable_02/Medium
오늘 날짜 (원형 배경)                → Lable_02/Medium, text/inverse
날짜 헤더 ("2026년 03월 12일")       → Body_03/Medium, text/secondary
시간 ("14:00 ~ 16:00")              → Body_03/Regular + Time 토큰
내담자명                             → Body_01/Semibold
내담자 정보 (나이·성별)              → Body_03/Regular, text/tertiary
상담실·치료유형                      → Body_03/Regular, text/tertiary
상태 뱃지 텍스트                     → Lable_02/Medium
하단 탭 레이블                       → Caption_01/Regular
FAB 레이블 ("필드노트")              → Lable_01/Medium, text/inverse
```

---

## 3. 간격 & 레이아웃

간격 토큰은 **3단계 레이어**로 관리합니다.
개발 시에는 Primitive를 직접 쓰지 않고, 반드시 **Semantic → Component** 순서로 참조합니다.

```
Primitive (숫자값)  →  Semantic (관계 기반)  →  Component (컴포넌트 명세)
     4px                  gap/intra                 label ↔ input : 4px
    12px                  gap/card                  카드 ↔ 카드 : 12px
    16px                  gap/related               타이틀 ↔ 하위 콘텐츠 : 16px
    24px                  gap/section               섹션 ↔ 섹션 : 24px
```

---

### 3.1 Primitive Spacing

```
space-4  :  4px
space-8  :  8px
space-12 : 12px
space-16 : 16px
space-24 : 24px
space-34 : 34px   ← iOS Safe Area (Home Indicator)
```

---

### 3.2 Semantic Spacing — 관계 기반 토큰

요소 간 **관계의 성격**으로 토큰을 정의합니다.
새로운 화면을 만들 때 "이 두 요소가 어떤 관계인가?"만 판단하면 적용할 토큰이 결정됩니다.

| 토큰 | 값 | 의미 | 사용 예 |
|------|----|------|--------|
| `gap/intra` | 4px | 직접 연결된 보조 요소 | 레이블↔인풋, 인풋↔에러메시지 |
| `gap/card` | 12px | 같은 리스트 안의 카드 사이 | 카드↔카드 |
| `gap/related` | 16px | 타이틀과 그에 속한 콘텐츠 | L타이틀↔하위 콘텐츠, 카드 내부 요소 간 |
| `gap/section` | 24px | 독립적인 섹션 사이 | L타이틀을 가진 섹션↔섹션 |

---

### 3.3 고정 높이 (Fixed Height) 컴포넌트

| 컴포넌트 | 높이 | 비고 |
|---------|------|------|
| 타이틀 L | 26px | 페이지 타이틀, 섹션 대제목 |
| 타이틀 M | 24px | 섹션 소제목 |
| 타이틀 S | 20px | 레이블, 폼 필드 제목 |
| 네비게이션 바 | 80px | 상단 고정 헤더 |
| 탭 | 48px | 세그먼트 탭 (상담/검사 등) |
| 바텀 탭바 | 48px + Safe Area | Safe Area는 기기별 동적 처리 |

---

### 3.4 화면 구조 & 상위 프레임 규칙

모든 화면은 **상위 프레임**을 세로로 쌓는 구조입니다. 프레임 사이 간격은 **0**, 간격은 각 프레임의 **내부 마진**으로 만듭니다.

```
┌────────────────────────────────┐  375px
│  네비게이션 바  (height: 80px) │  ← 내부 padding으로 간격 처리
├────────────────────────────────┤  gap: 0
│  프로필 섹션   (height: hug)   │  ← padding-x: 16px
├────────────────────────────────┤  gap: 0
│  탭            (height: 48px)  │
├────────────────────────────────┤  gap: 0
│  리스트 콘텐츠 (height: hug)   │  ← padding-x: 16px
│                                │
├────────────────────────────────┤  gap: 0
│  바텀 탭바     (height: 48px)  │
│  Safe Area    (height: 34px↑)  │  ← SafeAreaInsets.bottom
└────────────────────────────────┘
```

**상위 프레임 공통 규칙**

| 규칙 | 값 |
|------|----|
| 프레임 간 간격 | **0** (간격은 내부 패딩으로 처리) |
| 좌우 패딩 (`screen-padding-x`) | **16px** |
| 하단 패딩 — 바텀시트 / 네비게이션 하단 | **34px** ↓ |
| **헤더 ↔ 콘텐츠 간격** | **`16px`** (`gap/related`) — 헤더 직후 첫 콘텐츠의 `paddingTop`에 적용 |

> **하단 패딩 34px 근거**: iOS Home Indicator 영역(Safe Area)이 34px입니다. 기존 24px는 indicator와 겹쳐 보이는 문제가 있었으며, 34px로 맞추면 콘텐츠가 정확히 indicator 위에 안착됩니다. 코드에서는 하드코딩 대신 `SafeAreaInsets.bottom`을 사용해 기기별 자동 대응하는 것을 권장합니다.

> **헤더 ↔ 콘텐츠 16px 근거**: 헤더 영역과 첫 콘텐츠가 직접 붙으면 시각적 호흡이 없어 답답해 보입니다. 디자인 시스템 `gap/related (16px)` 토큰을 적용해 헤더와 본문이 같은 묶음이지만 시각적으로 구분되도록 합니다. 헤더 wrapper의 `paddingBottom`을 키우는 방식이 아니라, **콘텐츠 시작점의 `paddingTop`을 16으로 설정**합니다 (`ScrollView`/`FlatList`인 경우 `contentContainerStyle`, 일반 `View`인 경우 인라인 `style`). 헤더와 본문 사이에 검색바·필터·탭이 있어도 그 첫 부속 요소를 콘텐츠 시작점으로 간주합니다.

---

### 3.5 카드 내부 패딩 규칙

카드 패딩은 **상하단 요소의 종류**에 따라 두 가지로 나뉩니다.

```
┌──────────────────────────────────┐
│  ↕ padding-y                     │
│  텍스트 요소                      │  ← 텍스트는 자체 행간값 보유
│  ↕ gap/related (16px)            │
│  텍스트 요소                      │
│  ↕ padding-y                     │
└──────────────────────────────────┘
```

| 상황 | padding-y | padding-x | 이유 |
|------|-----------|-----------|------|
| 상·하단이 **텍스트**인 경우 | **12px** | 16px | 텍스트 행간(line-height)이 포함되어 있어 시각적으로 16px처럼 보임 |
| 상·하단이 **비텍스트**인 경우 | **16px** | 16px | 행간 없으므로 패딩 그대로 적용 |

> **판단 기준**: 카드 맨 위/아래 요소가 텍스트(타이틀, 본문, 캡션)이면 padding-y: 12px. 아이콘, 이미지, 버튼이면 16px.

---

### 3.6 Border Radius

```
radius-sm   :  8px   ← 배지, 상태 칩
radius-md   : 12px   ← 버튼
radius-lg   : 16px   ← 카드
radius-xl   : 20px   ← 바텀시트, 모달
radius-full : 9999px ← 아바타, 원형 버튼
```

> **규칙 — radius = 내부 패딩 (필수)**: 내부 패딩을 가진 컨테이너(카드·박스·시트 등)의 모서리 radius는 **그 컨테이너의 내부 패딩 값과 동일**하게 맞춘다. 가로·세로 패딩이 다르면 **가로(좌우) 패딩** 기준 (예: `padding 16` → `radius 16`). 원형 요소·패딩 없는 라인/구분선은 예외. 이 규칙은 앞으로의 모든 화면 작업에 적용한다.

---

### 3.7 그림자

```css
shadow-card:  0 1px 4px 0 rgba(0, 0, 0, 0.06);
shadow-float: 0 4px 16px 0 rgba(0, 0, 0, 0.12);  /* FAB, 바텀시트 */
shadow-toast: 0 8px 24px 0 rgba(0, 0, 0, 0.16);
```

---

### 3.8 Z-Index

```
z-base      :   0   ← 일반 콘텐츠
z-sticky    : 100   ← 네비게이션 바, 탭바
z-fab       : 200   ← FAB
z-sheet-dim : 300   ← 바텀시트 딤
z-sheet     : 400   ← 바텀시트
z-toast     : 500   ← 토스트
z-tooltip   : 600   ← 툴팁
```

---

## 4. 컴포넌트

### 4.1 Button

#### Primary Button ("참여", "확인" 등 주요 CTA)

```
배경색     : primary-500 #13BDFA
텍스트     : gray-white, Body_01/Semibold
높이       : 48pt
패딩       : 0 24pt
Border Radius: radius-md (12pt)
최소 너비  : 72pt

Pressed    : primary-600 #09A9E4 + scale(0.98)
Disabled   : gray-300 #D1D5DB (배경), gray-400 (텍스트)
```

#### Secondary Button ("요청 취소" 등)

```
배경색     : gray-100 #EEF1F2
텍스트     : gray-700 #464F58, Body_03/Medium
높이       : 36pt
패딩       : 0 16pt
Border Radius: radius-md (12pt)

Pressed    : gray-200 #DADFE5
```

#### Dashed Button ("+ 센터 추가하기")

```
배경색     : 투명
테두리     : 1pt dashed, border/dashed #D1D5DB
텍스트     : gray-500 #7D848F, Body_02/Medium
높이       : 52pt
너비       : 100% (full-width)
Border Radius: radius-lg (16pt)

Pressed    : surface/sunken #EEF1F2 배경
```

#### Text Button ("수정하기", 링크형)

```
색상      : primary-700 #0090C5 또는 primary-500
스타일    : Body_02/Medium
Underline : none (밑줄 없음)
터치 영역 : 최소 44×44pt 확보 (패딩으로 보완)
```

#### FAB — 필드노트

```
배경색     : fieldnote-purple #9B5DFF
텍스트     : gray-white, Lable_01/Medium
아이콘     : 마이크 아이콘 (16pt) + "필드노트" 텍스트
높이       : 48pt
패딩       : 0 20pt
Border Radius: radius-full
그림자     : shadow-float
위치       : 우측 하단, bottom: 탭바 높이 + 16pt, right: 16pt
```

---

### 4.2 Card

#### 카드 보더 원칙 — 페이지 배경에 따라 결정

카드는 페이지 배경과의 명도 대비로 떠 보이게 한다. 보더는 사용하지 않는다.

| 페이지 배경 | 카드 배경 | 보더 |
|-----------|---------|------|
| gray (`surface/page` #F7F8F8) — 기본 상세 페이지 | white (`surface/card` #FFFFFF) | **없음** |
| white (`surface/card` #FFFFFF) — 홈, 히어로 시트 | gray-50 (`#F7F8F8`) ± 상태별 변형 | **없음** |

판단 기준:
- 페이지가 회색이면 카드는 흰색, 보더 없이 명도 대비로 분리한다.
- 페이지가 흰색이면 카드는 연한 회색, 보더 없이 같은 방식으로 분리한다.
- 보더 + 같은 배경(흰색 위 흰색에 보더만)은 금지 — 명도 대비로 떠 보이지 않으면 디자인 의도에 맞지 않는다.
- 예외: TextInput·체크박스·버튼 같은 폼/컨트롤은 보더로 인터랙티브 경계를 표시할 수 있다 (이는 "카드"가 아님).

#### 카드 내 타이포그래피 역할

카드 안에서도 정보의 계층이 나뉩니다. 아래 3가지 역할을 기준으로 스타일을 결정합니다.

| 역할 | 스타일 | 색상 | 설명 |
|------|--------|------|------|
| **카드 타이틀** | `Body_01/Semibold` | `text/primary` (gray-black) | 카드의 핵심 정보. 가장 눈에 띄어야 함 |
| **카드 본문** | `Body_02/Regular` | `text/secondary` (gray-900) | 타이틀을 보완하는 내용 |
| **카드 캡션** | `Body_03/Regular` | `text/tertiary` (gray-500) | 날짜, 주소, 부가 메타 정보 |

---

#### 레이블-값 패턴 (Label-Value Row)

프로필 상세, 상담 정보 등 `항목명 + 값` 형태의 구조에 사용합니다.

```
┌──────────────────────────────────────┐
│  프로그램   놀이치료-그룹             │
│  담당자     김민지, 박지영            │  ← 레이블 너비: 그룹 내 가장 긴 레이블 기준 고정
│  시작일     2026. 4. 15              │
│  다음 상담일  2026. 5. 15            │
└──────────────────────────────────────┘
```

| 속성 | 값 |
|------|----|
| 레이블 스타일 | `Body_02/Regular` |
| 레이블 색상 | gray-600 `#606A74` |
| 값 스타일 | `Body_02/Regular` |
| 값 색상 | gray-800 `#2D333B` |
| 레이블 ↔ 값 간격 | **16px** |
| 레이블 너비 | 그룹 내 **가장 긴 레이블 기준 고정** (값이 항상 같은 x 좌표에서 시작) |
| 행과 행 사이 | **`gap/related` 16px** |

---

#### 센터 목록 카드

```
배경색          : surface/card #FFFFFF
테두리          : 없음 (페이지 배경과의 명도 대비로 분리 — 카드 보더 원칙 참조)
Border Radius  : radius-lg (16px)
padding-y      : 12px  (상·하단 텍스트이므로)
padding-x      : 16px
카드 간격       : gap/card 12px
그림자          : shadow-card
아이콘 영역     : 40×40px, Border Radius 10px
아이콘↔텍스트  : 12px

타이틀          : Body_01/Semibold, text/primary
본문(설명)      : Body_02/Regular, text/secondary
캡션(가입일)    : Body_03/Regular, text/tertiary

Pressed        : scale(0.98) + shadow 제거, 150ms
```

#### 일정 카드

상태(예정·진행중·완료)를 카드 배경색과 시간 컬러로 구분해 위→아래 시간 흐름을 시각화한다. 페이지 배경은 white이고 카드 자체가 gray로 부드럽게 떠 있는 inverted 패턴.

```
페이지 배경    : surface/card #FFFFFF (홈 화면 white 베이스)
Border Radius : radius-lg (16px)
테두리         : 없음 (배경색으로 상태 구분)
padding-y     : 12px  (상·하단 텍스트이므로)
padding-x     : 16px
카드 간격      : gap/card 12px
카테고리 dot   : 6×6px 원형, 유형별 색상 (Schedule Accent), 타이틀 앞에 배치

시간 컬럼      : 카드 좌측 외부, width 56px, 시작/종료 세로 배치
                Body_01/Semibold(시작) · Body_01/Regular(종료) · 사이 1px 세로 라인

상태별 배경 / 텍스트:
- 예정 (upcoming)    : 배경 gray-50 (#F7F8F8)        / 시간 fg/primary
- 진행중 (in-progress): 배경 surface/brand-subtle (primary-50, #f4f8ff) / 시간 primary-700·500
- 완료 (completed)   : 배경 gray-100 (#EEF1F2) + opacity 0.65 / 시간 fg/tertiary
- 취소/노쇼          : 배경 gray-100 + opacity 0.5  / 타이틀 line-through

타이틀(내담자명): Body_01/Semibold, text/primary
본문(메타)      : 성별·나이 Body_03/Regular, text/tertiary
캡션(상담실·프로그램): Body_03/Regular, text/label · 좌측 커스텀 SVG 아이콘 16px
상태 뱃지       : 카드 우측 상단 정렬
```

#### 검사 카드 (풀배터리 등)

```
배경색          : surface/card #FFFFFF
테두리          : 없음 (페이지 배경과의 명도 대비로 분리 — 카드 보더 원칙 참조)
Border Radius  : radius-lg (16px)
padding-y      : 12px
padding-x      : 16px
카드 간격       : gap/card 12px

타이틀          : Body_01/Semibold, text/primary
레이블-값 행    : 레이블-값 패턴 적용 (위 참조)
행간            : gap/related 16px
상태 뱃지       : 카드 우측 상단 정렬
```

#### 요청/초대 센터 카드

```
배경색          : surface/card #FFFFFF
테두리          : 없음 (페이지 배경과의 명도 대비로 분리 — 카드 보더 원칙 참조)
Border Radius  : radius-lg (16px)
padding-y      : 12px
padding-x      : 16px
버튼            : 우측 세로 중앙 정렬
```

---

### 4.3 Bottom Sheet (바텀시트)

상담일지 상세 등 상세 정보 진입 시 사용합니다.

```
배경색          : surface/card #FFFFFF
Border Radius  : radius-xl (20pt) — 상단만 적용
드래그 핸들     : 4×36pt, gray-300, 상단 8pt 여백
그림자          : shadow-float
딤 배경         : gray-black @ 50%

등장 애니메이션 : translateY(100%) → translateY(0), 500ms ease-out (duration-xslow + easing-enter)
퇴장 애니메이션 : translateY(0) → translateY(100%), 200ms ease-in  (duration-normal + easing-exit)
```

> **표준 모션 (필수)**: 모든 바텀시트는 위 등·퇴장 토큰을 따른다.
> 등장 500ms는 페이지에서 시트가 묵직하게 떠오르는 느낌을 주기 위해 `duration-xslow` 채택.
> spring 기반·임의 duration 사용 금지 — 디자인 시스템 외 값으로 일관성 깨짐.

**내부 레이아웃**:
```
┌──────────────────────────────┐
│      ─── (드래그 핸들)        │  8pt top
├──────────────────────────────┤
│  <  |  날짜 타이틀           │  ← 네비게이션 영역 44pt
├──────────────────────────────┤
│  제목            수정하기    │  ← 16pt padding
│                              │
│  섹션 레이블                 │
│  ┌──────────────────────┐   │
│  │  텍스트박스 영역      │   │  ← surface/sunken 배경
│  └──────────────────────┘   │
│                              │
│  🔒 개인 메모                │
│  ┌──────────────────────┐   │
│  │  메모 영역            │   │
│  └──────────────────────┘   │
└──────────────────────────────┘
```

**텍스트박스 영역** (상담 목표, 상담 내용, 개인 메모):
```
배경색          : surface/sunken #EEF1F2
Border Radius  : radius-lg (16pt)
패딩            : 12pt 14pt
텍스트          : Body_01/Reading-Regular (긴 본문), Body_02/Regular (메모)
```

---

### 4.4 Toast

```
배경색          : gray-800 #2D333B (반투명 아님, 불투명)
텍스트          : gray-white, Body_02/Medium
Border Radius  : radius-lg (16pt)
패딩            : 14pt 20pt
아이콘          : ✓ primary-500 (체크 아이콘, 20pt)
아이콘-텍스트 간격: 8pt
너비            : screen width - 32pt (좌우 16pt 여백)
위치            : bottom, Safe Area 위 + 12pt

표시 시간       : 성공/정보 3초, 오류 5초
등장            : translateY(20pt) + opacity 0→1, 200ms ease-out
퇴장            : opacity 1→0, 150ms ease-in
```

---

### 4.5 Badge

> 배지는 **두 가지 형태**만 존재한다. 두 형태 모두 **변할 수 있는 것은 가로 너비(레이블 길이)와 컬러뿐** — 높이·레이블 사이즈는 모든 화면에서 동일하게 고정한다.
> 공용 컴포넌트가 정식 구현체다: 라운드형 `BadgeRound`, 사각형 `Badge`. 새 배지는 반드시 이 둘 중 하나를 쓴다.

#### ① 라운드형 (Round / Pill) — 상태 표시

대부분의 상태(완료/진행중/예정/취소/노쇼/청구 등) 표시에 사용.

```
높이            : 28 (고정)
폭              : 최솟값 50 — 레이블이 길어지면 좌우 패딩 10 적용해 확장
좌우 패딩        : 10
Border Radius  : full (pill)
텍스트          : Lable_01 / Medium (13pt) (고정)
```

| 상태 | 배경 | 텍스트 색상 |
|------|------|------------|
| 완료 | gray-200 `#DADFE5` | gray-600 `#606A74` |
| 진행중 | `#FFF3E0` (notice @ 12%) | notice `#FF9200` |
| 대기중 | gray-100 `#EEF1F2` | gray-500 `#7D848F` |

#### ② 사각형 (Rectangle) — 역할 / 부가 정보

역할(보호자 등)이나 부가 정보(세트·패키지 등) 표시에 사용.

```
높이            : 22 (고정)
폭              : 최솟값 33 — 레이블이 길어지면 좌우 패딩 6 적용해 확장
좌우 패딩        : 6
Border Radius  : 4
텍스트          : Lable_02 / Medium (12pt) (고정)
```

---

### 4.6 센터 아이콘 (Avatar형)

센터 목록 카드의 아이콘 영역입니다.

```
크기           : 40×40pt
Border Radius : 10pt
아이콘 크기    : 22pt (내부)

색상 타입:
- 상담센터    : primary-500 배경 + gray-white 아이콘
- 내 워크스페이스: notice(#FF9200) 배경 + gray-white 아이콘
- 기타        : gray-200 배경 + gray-500 아이콘
```

---

### 4.7 Section Label (섹션 구분)

리스트 그룹 위에 표시되는 레이블입니다. (`요청한 센터`, `초대된 센터`)

```
텍스트   : Lable_01/Medium, text/section-label (#606A74)
패딩     : bottom 8pt
화면 왼쪽: screen-padding-x (16pt)와 동일 정렬
```

---

## 5. 네비게이션 패턴

### 5.1 Bottom Tab Bar

```
높이        : 49pt (탭 영역) + 34pt (Home Indicator) = 83pt 전체
배경색      : surface/card #FFFFFF
상단 보더   : 1pt solid, border/subtle #DADFE5
아이콘 크기 : 24pt
레이블      : Caption_01/Regular

활성 탭     : primary-500 아이콘 + primary-500 텍스트
비활성 탭   : gray-400 아이콘 + gray-400 텍스트
```

**탭 구성** (좌→우):

| 인덱스 | 아이콘 | 레이블 |
|--------|--------|--------|
| 0 | 홈 (집 모양) | 홈 |
| 1 | 캘린더 | 일정 |
| 2 | 사람 | 내담자 |
| 3 | 마이크 | 필드노트 |
| 4 | 사람 윤곽선 | 내정보 |

### 5.2 Navigation Bar (화면 상단)

```
높이   : 44~56pt (컨텐츠에 따라)
배경   : surface/card #FFFFFF 또는 투명
보더   : 없음 (바텀시트 내부 구분선만)

← 뒤로가기 아이콘  |  중앙 타이틀  |  우측 액션
```

바텀시트 내부 네비게이션:
```
뒤로가기: 24pt chevron-left 아이콘, gray-black
타이틀  : Title_01/Semibold, 중앙 정렬
```

### 5.3 브레드크럼 (Breadcrumb)

세부 화면 최상단의 경로 표시입니다. (`내정보/상담상세/일지보기`)

```
텍스트   : Caption_01/Regular, gray-400
구분자   : / 슬래시
배경     : gray-50 (페이지 배경과 동일)
패딩     : 8pt 16pt
```

---

## 6. 상태 표현

### 6.1 빈 상태 (Empty State)

```
아이콘   : 48pt, gray-300
타이틀   : Body_01/Semibold, text/secondary
설명     : Body_02/Regular, text/tertiary
CTA 버튼 : Primary Button
배치     : 화면 수직 중앙, 수평 중앙
```

### 6.2 로딩 상태

> **원칙 (필수): 콘텐츠를 불러오는 모든 화면의 로딩 상태는 스켈레톤으로 처리한다.**
> 스피너(`ActivityIndicator`/`LoadingScreen`)는 콘텐츠 로딩에 쓰지 않는다. 스켈레톤이 "곧 이 모양이 채워진다"를 미리 보여줘 레이아웃 점프를 없애고, 체감 속도를 높인다.
> 예외: 라우트 전환 직전의 짧은 전역 대기 등 레이아웃을 알 수 없는 경우에만 `LoadingScreen` 허용.

```
Skeleton 색상: gray-100 (#EEF1F2) → gray-200 (#DADFE5) shimmer
애니메이션   : 1.4초 반복, ease-in-out

카드 스켈레톤: 실제 카드와 동일한 높이·레이아웃
```

**2층 구조로 만든다:**

1. **공유 프리미티브** — `src/shared/components/ui/Skeleton.tsx`의 `Skeleton` / `SkeletonCircle`. 깜빡임·색·타이밍은 여기서만 관리. 새로 만들지 말고 재사용.
2. **페이지별 조합** — 각 화면의 실제 레이아웃(카드 위치·크기)을 위 박스로 **그대로 흉내** 낸 스켈레톤. 화면 옆 `_components/`에 둔다.
   - 예: `app/(main)/(tabs)/_components/client-browse.tsx`의 `ClientListSkeleton`, `app/(main)/client/[id]/_components/DetailSkeleton.tsx`의 `ClientDetailSkeleton`.

**연결 규칙:**

- 스켈레톤은 보통 자체 `ScrollView`(`scrollEnabled={false}`)라, 로딩/에러 분기를 **실제 `ScrollView` 바깥으로 올려** 스켈레톤이 본문 전체를 대체하게 한다 (스켈레톤을 ScrollView 안에 넣어 중첩시키지 말 것).
- 헤더 등 데이터가 필요 없는 chrome 은 로딩 중에도 그대로 두고, **본문만** 스켈레톤으로 대체한다.
- 스켈레톤 박스 크기는 실제 콘텐츠와 맞춰 데이터 도착 시 레이아웃이 튀지 않게 한다.

**빠른 로딩 깜빡임 방지 (필수):**

스켈레톤이 번쩍였다 사라지면 오히려 방해가 된다. 로딩 분기는 `isLoading` 을 직접 쓰지 말고 `useDelayedSkeleton`(`Skeleton.tsx`) 게이트를 통과시킨다.

- **지연 게이트** — 로딩이 `delay`(기본 200ms) 안에 끝나면 스켈레톤을 **아예 표시하지 않고** 바로 콘텐츠로. delay 창 동안은 빈 화면(헤더만).
- **최소 표시 시간** — 일단 떴으면 `minDuration`(기본 400ms) 유지해 on/off flash 방지.
- **캐시 우선** — TanStack Query `staleTime` 으로 재방문 시 즉시 캐시 표시 → `isLoading` 자체가 false 라 스켈레톤은 콜드 로딩에만 등장.

```tsx
const showSkeleton = useDelayedSkeleton(isLoading);
// 순서 주의: 스켈레톤 → (delay 창)빈 화면 → 에러 → 콘텐츠
return showSkeleton ? <XxxSkeleton />
  : isLoading ? <View className="flex-1" />   // delay 창
  : isError ? <ErrorView />
  : <Content />;
```

### 6.3 오류 상태

- 인풋 오류: `border/negative` + 하단 오류 메시지 (`Caption_01/Regular`, `text/negative`)
- 전체 화면 오류: 빈 상태 패턴 + 재시도 버튼
- 네트워크 오류: Toast (`negative` 색상 계열)

### 6.4 캘린더 날짜 상태

| 상태 | 배경 | 텍스트 |
|------|------|--------|
| 기본 | 없음 | gray-900 |
| 오늘 | primary-500 원형 | gray-white |
| 선택됨 | primary-50 원형 | primary-600 |
| 이번 달 아님 | 없음 | gray-300 |
| 일정 있음 | — | 날짜 아래 컬러 dot (3pt) |

캘린더 dot 색상:
```
dot-primary  : primary-500 #13BDFA
dot-secondary: negative #FF4242
dot-fieldnote: fieldnote-purple #9B5DFF
```

---

## 7. 아이콘

### 7.1 크기 기준

| 용도 | 크기 |
|------|------|
| 탭바 아이콘 | 24pt |
| 카드 내부 메타 아이콘 (📍, 📋) | 12~14pt |
| 버튼 내 아이콘 | 16pt |
| 네비게이션 뒤로가기 | 24pt |
| FAB 마이크 | 20pt |
| 빈 상태 | 48pt |
| 토스트 체크 | 20pt |
| 잠금 아이콘 (🔒 개인 메모) | 14pt |

### 7.2 색상

- 탭바 활성: `primary-500`
- 탭바 비활성: `gray-400`
- 카드 메타: `gray-400`
- 버튼 내부: `currentColor` (버튼 텍스트 색상 상속)
- 장식용: `aria-hidden="true"` 필수

---

## 8. 인터랙션

### 8.1 트랜지션 토큰

```
duration-fast   : 150ms   ← 버튼 상태 변화
duration-normal : 200ms   ← 카드 hover, 배지
duration-slow   : 300ms   ← 일반 슬로우 전환
duration-xslow  : 500ms   ← 바텀시트 등장, 페이지 전환

easing-default  : cubic-bezier(0.4, 0, 0.2, 1)
easing-enter    : cubic-bezier(0, 0, 0.2, 1)    ← 요소 등장
easing-exit     : cubic-bezier(0.4, 0, 1, 1)    ← 요소 퇴장
easing-spring   : cubic-bezier(0.34, 1.56, 0.64, 1)  ← FAB 등장
```

### 8.2 터치 피드백

| 컴포넌트 | 피드백 |
|---------|--------|
| Primary Button | `scale(0.97)` + 배경색 darkened, 150ms |
| 카드 (pressable) | `scale(0.98)` + opacity 0.9, 100ms |
| 탭바 아이콘 | 색상 전환만 (scale 없음) |
| FAB | `scale(0.95)`, 100ms |
| 텍스트 버튼 | opacity 0.6, 100ms |

### 8.3 마이크로 인터랙션

사용자가 의식하지 못하더라도 느끼는 작은 피드백들입니다. 앱이 "살아있다"는 느낌을 만드는 핵심 요소입니다.

#### 원칙

- 모든 마이크로 인터랙션은 **목적이 있어야** 합니다. 장식용 애니메이션은 추가하지 않습니다.
- 반응은 **즉각적**이어야 합니다. 사용자 입력 후 100ms 이내에 시각적 변화가 시작되어야 합니다.
- 완료·성공 순간에는 **조금 더 풍부한** 피드백을 줍니다. 일상적인 인터랙션보다 확실히 다름을 느끼게.

---

#### 버튼

| 상황 | 동작 | 상세 |
|------|------|------|
| 탭(눌림) | `scale(0.97)` + 배경 어두워짐 | duration-fast 150ms, easing-default |
| 릴리즈 | `scale(1.0)` 복귀 | easing-spring, 튕기는 느낌 |
| 로딩 진입 | 텍스트 fade-out → 스피너 fade-in | duration-fast 150ms |
| 로딩 완료 | 스피너 → 체크 아이콘 morph | duration-normal 200ms, easing-spring |
| Disabled | opacity 0.4, 즉시 | 애니메이션 없음 |

---

#### 카드

| 상황 | 동작 | 상세 |
|------|------|------|
| 탭(눌림) | `scale(0.98)` + opacity 0.92 | 100ms, easing-default |
| 릴리즈 | 원래 상태 복귀 | 150ms, easing-spring |
| 새 카드 등장 | `translateY(8px) + opacity 0` → 원래 위치 | 200ms, easing-enter |
| 카드 삭제 | `translateX(100%) + opacity 0` | 250ms, easing-exit |

---

#### 토글 / 체크박스

| 상황 | 동작 | 상세 |
|------|------|------|
| ON 전환 | 썸이 오른쪽으로 슬라이드 + 배경 primary로 전환 | 200ms, easing-spring |
| OFF 전환 | 썸이 왼쪽으로 슬라이드 + 배경 gray로 전환 | 200ms, easing-default |
| 체크박스 체크 | 체크 아이콘 draw 애니메이션 (획이 그려지듯) | 150ms, easing-spring |
| 체크박스 해제 | 체크 아이콘 fade-out + 테두리만 남음 | 100ms, easing-exit |

---

#### 입력 필드

| 상황 | 동작 | 상세 |
|------|------|------|
| 포커스 | 테두리 `border/focus` 전환 + 미세한 glow | 150ms, easing-default |
| 포커스 해제 | 테두리 `border/default`로 복귀 | 150ms |
| 오류 발생 | 테두리 `border/negative` + 좌우 흔들림 (shake) | shake: 300ms, 3회, ±4px |
| 오류 해소 | 테두리 정상으로 복귀 + 오류 메시지 fade-out | 200ms |

> shake 애니메이션: `translateX(-4px → 4px → -4px → 0)` 패턴. 오류임을 즉각 인지시키는 용도.

---

#### 탭 (세그먼트)

| 상황 | 동작 | 상세 |
|------|------|------|
| 탭 전환 | 활성 인디케이터가 슬라이드 이동 | 250ms, easing-spring |
| 콘텐츠 전환 | 이전 콘텐츠 fade-out → 새 콘텐츠 fade-in | 150ms |

---

#### 토스트

| 상황 | 동작 | 상세 |
|------|------|------|
| 등장 | `translateY(16px) + opacity 0` → 제자리 | 250ms, easing-spring |
| 퇴장 | `opacity 1 → 0` | 150ms, easing-exit |
| 성공 아이콘 | 체크 아이콘 draw 애니메이션 (등장 후 50ms 딜레이) | 200ms |

---

#### 바텀시트

| 상황 | 동작 | 상세 |
|------|------|------|
| 열림 | `translateY(100%) → translateY(0)` | 500ms, easing-enter (duration-xslow — 묵직하게 떠오르는 느낌) |
| 닫힘 | `translateY(0) → translateY(100%)` | 200ms, easing-exit (duration-normal) |
| 딤 등장 | `opacity 0 → 0.5` | 300ms, easing-default |
| 드래그 중 | 드래그량에 비례해 실시간 이동 (1:1 추적) | — |
| 드래그 threshold 미달 | 원래 위치로 snap-back | 300ms, easing-spring |

---

#### 아이콘 마이크로 인터랙션

아이콘은 단순한 픽토그램이 아니라 **상태 변화를 전달하는 수단**입니다. 상태가 바뀌는 아이콘에는 반드시 전환 애니메이션을 적용합니다.

| 아이콘 | 상황 | 동작 | 상세 |
|--------|------|------|------|
| 탭바 아이콘 | 비활성 → 활성 | `scale(1.0 → 1.15 → 1.0)` + 색상 전환 | 250ms, easing-spring |
| 탭바 아이콘 | 활성 → 비활성 | 색상만 전환 | 150ms, easing-default |
| 뒤로가기 `<` | 탭 | `translateX(-2px)` 순간 이동 후 복귀 | 100ms |
| 알림 벨 🔔 | 새 알림 있을 때 | 좌우 흔들림 `rotate(-15deg → 15deg → 0)` | 400ms, 1회 |
| 알림 벨 🔔 | 탭 | `scale(0.9 → 1.0)` | 150ms, easing-spring |
| 닫기 `✕` | 탭 | `rotate(0 → 90deg)` | 200ms, easing-spring |
| 체크 `✓` (완료 상태) | 최초 등장 | 아이콘 draw 애니메이션 | 200ms |
| 잠금 `🔒` (개인 메모) | 탭하여 펼칠 때 | `rotate(0 → -15deg)` 흔들림 후 잠금 해제 아이콘으로 morph | 250ms, easing-spring |
| FAB 마이크 🎙️ | 녹음 시작 | `scale(1.0 → 1.1)` + 배경 pulse (ripple 반복) | pulse: 1.2초 반복 |
| FAB 마이크 🎙️ | 녹음 중 | 배경 색상 살짝 밝아지는 pulse 지속 | — |
| FAB 마이크 🎙️ | 녹음 종료 | pulse 멈춤 + `scale(1.1 → 1.0)` | 150ms |
| 필터/정렬 아이콘 | 활성 상태일 때 | primary 색상 + 상단에 dot 표시 | 즉시 |

**아이콘 전환 공통 규칙**
- 두 아이콘 간 morphing(변형)이 불가한 경우: 이전 아이콘 `scale(0) + opacity 0` → 새 아이콘 `scale(1) + opacity 1`, 각 150ms
- 아이콘 색상 전환은 항상 `transition: color 150ms easing-default` 적용
- 아이콘 크기 변화(scale)에 `transform-origin: center` 필수

---

### 8.4 바텀시트 제스처

- **드래그 다운** → 닫기 (threshold: 40% 이상 내려갔을 때)
- **딤 영역 탭** → 닫기
- **스냅 포인트**: 전체 열림 / 닫힘 2단계

### 8.5 감소 모션 대응

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important; }
}
```

> 감소 모션 환경에서는 scale, translate, rotate 등 모든 움직임을 제거하고 **색상 전환만** 유지합니다.

---

## 9. 접근성

### 9.1 최소 터치 타겟

- 모든 터치 가능 요소: **44×44pt** 이상
- 시각적으로 작더라도 터치 영역은 패딩으로 확보

### 9.2 텍스트 대비율

| 텍스트 종류 | 최소 대비율 |
|------------|------------|
| 일반 본문 (≤18pt) | 4.5:1 (WCAG AA) |
| 대형 텍스트 (>18pt, bold>14pt) | 3:1 |
| UI 컴포넌트·아이콘 | 3:1 |

주요 색상 대비 확인:
- `gray-black #191919` on `gray-50 #F7F8F8` → **16.2:1** ✅
- `gray-white #FFFFFF` on `primary-500 #13BDFA` → **2.4:1** ⚠️ 큰 텍스트 한정 사용
- `gray-600 #606A74` on `gray-white #FFFFFF` → **5.1:1** ✅

### 9.3 시각 외 단서

- 상태 뱃지: 색상 + 텍스트 레이블 병행 (색상만으로 상태 표현 금지)
- 오류: 빨간 테두리 + 오류 텍스트 메시지 병행
- 캘린더 오늘: 파란 원 + `aria-label="오늘"` 병행

### 9.4 iOS 네이티브 접근성

- `accessibilityLabel`: 아이콘 전용 버튼, 아바타형 카드
- `accessibilityHint`: 복잡한 상호작용
- `accessibilityRole`: button, tab, text, image 구분
- VoiceOver 포커스 순서: 좌→우, 위→아래

---

## 10. 네이밍 컨벤션

### 10.1 색상 토큰

```
[팔레트]/[스텝]            예: gray/500, primary/700
[카테고리]/[속성]          예: surface/card, text/tertiary, border/focus
[기능]/[색상명]            예: fieldnote/purple, status/notice
```

### 10.2 타이포 토큰

```
[분류]_[순번]/[줄간격타입]-[굵기]
예: Body_01/Normal-Regular
    Headline_02/Normal-Semibold
    Lable_01/Medium
```

### 10.3 컴포넌트 (React Native 기준)

```
PascalCase              ← 컴포넌트 파일 (CenterCard.tsx)
camelCase               ← props, 변수
useHookName             ← 커스텀 훅
UPPER_SNAKE_CASE        ← 상수 (SCREEN_PADDING = 16)
```

### 10.4 Props 네이밍

| 목적 | 컨벤션 |
|------|--------|
| 변형 | `variant="primary"` |
| 크기 | `size="md"` |
| 상태 | `status="completed"` |
| 비활성 | `disabled` |
| 로딩 | `loading` |
| 이벤트 | `onPress`, `onChange` |

---

## 11. DO / DON'T

### 색상

| ✅ DO | ❌ DON'T |
|-------|---------|
| `color: text/primary` 토큰 사용 | `color: #191919` 하드코딩 |
| `background: surface/card` | `background: white` 또는 `#fff` |
| `border: border/subtle` | `border: 1px solid #DADFE5` 직접 |
| `primary-500`은 배경+아이콘 조합으로만 CTA에 사용 | 본문 텍스트 색상으로 `primary-500` 사용 |

### 타이포그래피

| ✅ DO | ❌ DON'T |
|-------|---------|
| `Body_01/Semibold` 토큰 사용 | `fontSize: 16, fontWeight: '600'` 직접 입력 |
| letter-spacing 항상 `-0.41px` 적용 | letter-spacing 생략 |
| 카드 타이틀에 `Body_01/Semibold` | 카드 타이틀에 임의 18pt 사용 |

### 컴포넌트

| ✅ DO | ❌ DON'T |
|-------|---------|
| 기존 Card 컴포넌트 재사용 | 새 화면마다 카드 스타일 새로 정의 |
| 카드는 페이지 배경 대비 명도로만 분리 (gray bg → white card / white bg → gray-50 card) | 카드에 보더 추가 |
| Primary Button은 화면당 1개 | 같은 화면에 Primary Button 2개 배치 |
| 상태 뱃지는 정해진 색상 세트만 사용 | 임의 색상의 뱃지 생성 |
| FAB은 필드노트(purple) 기능에만 | FAB 색상을 상황에 따라 변경 |

### 레이아웃

| ✅ DO | ❌ DON'T |
|-------|---------|
| `screen-padding-x: 16pt` 준수 | 화면마다 다른 좌우 패딩 사용 |
| Safe Area `34pt` 하단 확보 | 바텀 탭 위에 콘텐츠 겹침 |
| 터치 타겟 최소 44×44pt | 작은 버튼에 패딩 없이 배치 |
| `card-gap: 12pt` 카드 간격 | 카드 사이 8pt / 20pt 섞어서 사용 |

---

## 12. UX 라이팅

> 텍스트는 UI의 일부입니다. 색상·컴포넌트와 마찬가지로 일관된 기준을 따릅니다.

### 12.1 톤 & 보이스 (Tone & Voice)

이 앱은 **상담사와 내담자를 연결하는 전문적인 도구**이지만, 사용자가 매일 부담 없이 쓸 수 있도록 **친근하고 따뜻한 말투**를 기본으로 합니다.

#### 핵심 원칙

| 원칙 | 설명 | 예시 |
|------|------|------|
| **친근하게** | 딱딱한 시스템 언어 대신 사람이 말하는 것처럼 | "저장됐어요" / ~~"저장이 완료되었습니다"~~ |
| **간결하게** | 필요한 말만, 짧게 | "일지를 수정했어요" / ~~"일지 수정 작업이 정상적으로 처리되었습니다"~~ |
| **명확하게** | 사용자가 다음에 무엇을 해야 하는지 알 수 있게 | "센터에 참여 요청을 보냈어요. 승인을 기다려 주세요." |
| **존중하게** | 실수나 오류 상황에서도 사용자를 탓하지 않게 | "연결이 끊겼어요. 다시 시도해 볼까요?" / ~~"잘못된 요청입니다"~~ |

#### 말투 기준

- **경어체 유지**: 모든 문구는 `~해요` / `~예요` / `~세요` 체로 작성합니다.
- **이모지 사용 금지**: 시스템 메시지, 버튼, 레이블에는 이모지를 쓰지 않습니다. (아이콘 컴포넌트로 대체)
- **수동태 금지**: "처리되었습니다" ❌ → "처리했어요" ✅
- **부정형보다 긍정형**: "입력하지 않았어요" ❌ → "이름을 입력해 주세요" ✅
- **사용자 이름 적극 활용**: 가능한 곳엔 이름을 넣어 개인화합니다. ("김은지의 상담일지를 수정했어요")

---

### 12.2 버튼 & 액션 레이블

버튼 텍스트는 **동사 중심**으로 작성하며, 클릭 후 무슨 일이 일어나는지 예측 가능해야 합니다.

#### 규칙

- 2~5자 이내 권장 (최대 8자)
- `~하기` 형태는 가볍게, `~하세요`는 지시적으로 느껴지므로 지양
- 파괴적 액션(삭제, 취소)은 결과가 명확한 단어 사용

#### 표준 레이블 목록

| 액션 | 사용 | 사용 금지 |
|------|------|---------|
| 주요 진입 | 참여 | 입장, 접속, 클릭 |
| 가입/연결 | 센터 추가 | 등록, 신청하기 |
| 저장 | 저장 | 확인, 완료, OK |
| 수정 | 수정 | 편집, 변경 |
| 삭제 | 삭제 | 제거, 지우기 |
| 취소 (요청 철회) | 요청 취소 | 취소하기, 철회 |
| 닫기 | 닫기 | 나가기, 뒤로 |
| 재시도 | 다시 시도 | 재시도, 리트라이 |
| 확인 다이얼로그 긍정 | [동사] (예: 삭제, 나가기) | 예, OK, 확인 |
| 확인 다이얼로그 부정 | 취소 | 아니오, NO |

---

### 12.3 토스트 메시지

짧고 완결된 문장으로, **무슨 일이 일어났는지**만 전달합니다.

#### 패턴

```
[대상]을/를 [동사]했어요.
[대상]이/가 [동사]됐어요.
```

#### 성공 토스트 예시

| 상황 | 문구 |
|------|------|
| 상담일지 수정 | `김은지의 상담일지를 수정했어요` |
| 상담일지 저장 | `상담일지를 저장했어요` |
| 센터 참여 | `센터에 참여했어요` |
| 요청 취소 | `참여 요청을 취소했어요` |
| 필드노트 저장 | `필드노트를 저장했어요` |
| 일정 등록 | `일정을 등록했어요` |
| 일정 삭제 | `일정을 삭제했어요` |

#### 오류 토스트 예시

| 상황 | 문구 |
|------|------|
| 네트워크 오류 | `연결이 끊겼어요. 잠시 후 다시 시도해 주세요` |
| 저장 실패 | `저장하지 못했어요. 다시 시도해 주세요` |
| 불러오기 실패 | `정보를 불러오지 못했어요` |

#### 규칙

- 최대 **2줄** 이내 (약 40자)
- 마침표 **생략** (짧은 알림이므로)
- 사용자 이름 포함 시 더욱 개인화된 느낌 → 적극 활용
- 오류 메시지에 기술적 에러 코드 노출 금지

---

### 12.4 빈 상태 (Empty State) 문구

사용자가 막막하지 않도록 **이유 + 다음 행동**을 함께 안내합니다.

#### 패턴

```
[타이틀]: 아직 [대상]이 없어요
[설명]: [이유 또는 안내]
[CTA]: [행동 유도 버튼]
```

#### 예시

| 화면 | 타이틀 | 설명 | CTA |
|------|--------|------|-----|
| 내담자 목록 없음 | 아직 내담자가 없어요 | 새 내담자를 등록하고 상담을 시작해 보세요 | 내담자 추가 |
| 일정 없음 | 오늘 일정이 없어요 | 상담 일정을 등록해 보세요 | 일정 추가 |
| 상담일지 없음 | 작성된 일지가 없어요 | 상담 후 일지를 기록해 두면 다음 상담에 도움이 돼요 | 일지 작성 |
| 필드노트 없음 | 녹음된 필드노트가 없어요 | 상담 중 필드노트를 녹음하면 자동으로 저장돼요 | — |
| 검색 결과 없음 | 검색 결과가 없어요 | `'[검색어]'`와 일치하는 결과를 찾지 못했어요 | — |

---

### 12.5 폼 레이블 & 플레이스홀더

#### 레이블 규칙

- **명사형**으로 간결하게: `이름`, `연락처`, `상담 목표`
- 필수 항목: 레이블 뒤에 `*` 표시 (빨간색 아님 — `text/negative` 색상)
- 레이블은 항상 인풋 **위에** 위치 (인풋 안에 레이블 겸용 금지)

#### 플레이스홀더 규칙

- 입력 **형식** 또는 **예시**를 안내합니다.
- 레이블을 반복하지 않습니다.
- 너무 길지 않게 — 1줄 이내
- **검색 입력은 `[검색 대상]로 검색해주세요` 형태로 통일**합니다. (예: `이름, 전화번호로 검색해주세요`) — 모든 서치필드 공통. 공용 컴포넌트 `src/shared/components/ui/SearchField.tsx` 사용.

| 필드 | 레이블 | 플레이스홀더 |
|------|--------|------------|
| 이름 | 이름 | 홍길동 |
| 연락처 | 연락처 | 010-0000-0000 |
| 생년월일 | 생년월일 | 1990.01.01 |
| 상담 목표 | 상담 목표 | 이번 회기의 목표를 입력해 주세요 |
| 상담 내용 | 상담 내용 | 상담 내용을 기록해 주세요 |
| 개인 메모 | 개인 메모 | 나만 볼 수 있는 메모예요 |
| 내담자 검색 | — | 이름, 전화번호로 검색해주세요 |
| 센터 검색 | — | 센터 이름으로 검색해주세요 |

---

### 12.6 오류 메시지

사용자가 **무엇을 잘못했는지**가 아니라 **어떻게 하면 되는지**를 안내합니다.

#### 규칙

- 인풋 필드 바로 아래 표시 (`Caption_01/Regular`, `text/negative`)
- 기술 용어 사용 금지 (`null`, `undefined`, `500 error` 등)
- 마침표로 끝맺음

#### 예시

| 상황 | 오류 메시지 |
|------|------------|
| 필수 항목 미입력 | `이름을 입력해 주세요.` |
| 연락처 형식 오류 | `올바른 연락처 형식으로 입력해 주세요. (예: 010-0000-0000)` |
| 생년월일 범위 오류 | `올바른 생년월일을 입력해 주세요.` |
| 날짜 역순 선택 | `종료일은 시작일 이후로 선택해 주세요.` |
| 중복 등록 | `이미 등록된 내담자예요.` |
| 글자 수 초과 | `최대 200자까지 입력할 수 있어요. (현재 [N]자)` |

---

### 12.7 날짜 & 시간 포맷

앱 전체에서 아래 포맷을 통일하여 사용합니다.

| 용도 | 포맷 | 예시 |
|------|------|------|
| 네비게이션 날짜 | `YYYY-MM-DD (요일)` | `2026-04-13 (목)` |
| 일정 날짜 헤더 | `YYYY년 MM월 DD일` | `2026년 03월 12일` |
| 가입일, 등록일 | `YYYY. MM. DD` | `2026. 04. 16` |
| 상담 시간 범위 | `HH:mm ~ HH:mm` | `14:00 ~ 16:00` |
| 시간만 표시 | `HH:mm` | `14:00` |
| 상대적 시간 (최근) | `N분 전`, `N시간 전`, `어제`, `N일 전` | `3분 전` |
| 상대적 시간 (오래됨) | `YYYY. MM. DD` 포맷으로 전환 | 7일 초과 시 |

#### 요일 표기

| 요일 | 표기 | 색상 |
|------|------|------|
| 월요일 | 월 | `text/secondary` |
| 화요일 | 화 | `text/secondary` |
| 수요일 | 수 | `text/secondary` |
| 목요일 | 목 | `text/secondary` |
| 금요일 | 금 | `text/secondary` |
| 토요일 | 토 | `text/secondary` |
| 일요일 | 일 | `negative` `#FF4242` |

---

### 12.8 확인 다이얼로그 (Destructive Action)

삭제·나가기 등 되돌릴 수 없는 액션 전에 반드시 확인을 요청합니다.

#### 패턴

```
[타이틀]: [대상]을/를 [동사]할까요?
[설명]: [결과 안내 — 되돌릴 수 없는 경우 명시]
[부정 버튼]: 취소
[긍정 버튼]: [동사] (danger 색상)
```

#### 예시

| 상황 | 타이틀 | 설명 | 버튼 |
|------|--------|------|------|
| 일지 삭제 | 일지를 삭제할까요? | 삭제한 일지는 복구할 수 없어요. | 취소 / 삭제 |
| 요청 취소 | 참여 요청을 취소할까요? | 취소 후 다시 요청할 수 있어요. | 닫기 / 요청 취소 |
| 작성 중 나가기 | 작성을 그만둘까요? | 지금 나가면 작성 내용이 사라져요. | 계속 작성 / 나가기 |
| 센터 탈퇴 | [센터명]에서 나갈까요? | 나가면 해당 센터의 정보를 볼 수 없어요. | 취소 / 나가기 |

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-05-14 | 1.0.0 | 초안 작성 (스크린샷 + Figma 토큰 기반) |
| 2026-05-15 | 1.1.0 | §1 Tier 1에 Extended Palette (14색 Solid + OpacityBG) 추가. primary·gray 외 색 사용 시 본 팔레트 외 임의 색 금지. 캘린더 일정 색상은 예외(기존 schedule accent 유지). |

---

> **기여 방법**: 새 패턴 추가 시 Figma 토큰 정의 → 이 문서 업데이트 → PR 순서로 진행.
> 기존 토큰으로 해결 불가한 경우에만 신규 토큰 제안.
