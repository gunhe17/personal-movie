---
paths:
  - "apps/mobile-client/**"
---

# mobile-client 프론트 아키텍처 + 디자인 시스템 (Expo · 내담자/보호자 앱 "마인드스코프")

내담자(보호자) 전용 앱 — 초대 코드로 센터 연결, 일정·진행 현황 열람, 바우처 탐색. 직원 표면과 상호 차단(JWT `aud=client_app`, `/api/v1/app/*`만 사용).

> **디자인 정본 = 피그마 "내담자용 앱" 파일** (파운데이션 46:3 · 컴포넌트 셋 각 노드). 전문가앱(apps/mobile)과 별개 디자인 시스템이되, 구조 패턴(토큰 아키텍처·플로팅 탭바·전환 애니메이션)은 전문가앱을 따른다.

---

## 1. 토큰 — 단일 소스

**`src/shared/constants/tokens.js`가 색·radius·space의 유일한 원천.** `theme.ts`(JS `COLORS`)와 `tailwind.config.js`(className)가 여기서 생성된다 — 값 수정은 tokens.js에서만.

- Primitive: `gray 0~950` · `brand`(그린 #10A24E) · `blue`(#31A4F7 램프 — 버튼 시안용) · `red/green/orange/sky/purple/mint` · `space 2~48`
- Semantic: `text/* icon/* bg/* border/* action/* status/*` + **`button/*`**(Button variant×state 미러) + **`tag/*`**(Badge 전용 7색 — 프리미티브와 값이 다른 별도 팔레트)
- 피그마 변수값이 기존 프리미티브와 일치하면 참조하고, 없으면 **tokens.js에 먼저 추가**한 뒤 사용한다. 화면 코드에 hex 하드코딩 금지(콘텐츠성 일러스트 카드 색 등 예외는 주석으로 이유 명시).

## 2. 타이포그래피 — ⚠️ 인라인 fontSize 금지 (필수)

**화면 코드에서 `style={{ fontSize, lineHeight }}` 직접 지정 금지. 반드시 `Typography` variant + weight로 표현한다.** (`s()` 스케일도 Typography가 내부 처리 — 감쌀 필요 없음)

피그마 `get_design_context`는 등록 텍스트 스타일명을 함께 내려준다 ("These styles are contained in the design: …"). **그 이름을 아래 표로 매핑**한다:

| 피그마 스타일 | Typography variant | 크기 |
|--------------|--------------------|------|
| Title_01/Display-Light | `display-01` + light | 48/52 |
| Headline/Large-Semibold | `headline-large` | 28/36 |
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

- ⚠️ 피그마 네이밍과 앱 variant가 **한 단계 어긋나 있다**(피그마 Headline/Medium=`headline-01`, Title_01=`headline-02`, Title_02=`title-01`) — 리네임은 파급이 커서 보류 상태. 표를 신뢰할 것.
- **인스턴스 행간 편차는 노이즈로 정규화**: 화면 개별 텍스트가 등록 스타일과 1~4px 다르면(예: 20/24로 그려진 Headline) variant 값을 따른다. 의도된 편차로 확인되면 variant를 추가하는 게 맞고, 임의 값 인라인은 금지.
- **예외 — 공용 컴포넌트 내부 고정 스펙**: Button(13/16·14/16·15/18)·Badge(13/16) 등 variant에 없는 컨트롤 전용 타이트 행간은 해당 컴포넌트 안에만 캡슐화 허용. 화면 코드로 새어 나오면 안 됨.
- weight는 스타일명 접미(-Semibold/-Medium/-Regular/-Light)를 `weight` prop으로.
- 색은 `style={{ color }}`로 지정 (className `text-*`는 Typography 내부 기본색에 덮이는 gotcha — 전문가앱과 동일).

## 3. 공용 컴포넌트 우선 (Reuse First)

화면 구현 전 `src/shared/components/ui/` 먼저 탐색. 피그마 컴포넌트 셋은 이미 구현돼 있다:

| 컴포넌트 | 피그마 노드 | 비고 |
|----------|------------|------|
| `Button` | 55:491 | variant 7종(primary·secondary·assistive·white·billing·outline·danger) × size 4종(sm 36/md 40/lg 44/xl 52) |
| `Toggle` | 58:8 | reanimated 슬라이드+색 보간 |
| `Checkbox` | 58:16 | on/off/disabled, 체크 벡터 = 피그마 export |
| `Badge` | 64:30 | color 8종(`tag/*` — pink은 활동 요약 레이더 6축용 신설) × variant(subtle/solid) × shape(pill/rect — rect=Badge/Rectangle 150:2901) |
| `Fab` | 65:7 | 원형 56 / label 시 extended, 아이콘 슬롯 |
| `Chip` | 66:8 | selected 색 보간, 아이콘 슬롯 |
| `Tabs` | 608:6962 | 밑줄 탭 — hug 폭 탭 + 인디케이터 translateX 슬라이드(220ms) + 라벨 색 보간. 전문가앱 `Tabs` 포팅본(균등분할 → hug 폭 실측). pill 칩은 `Segment` |
| `LabeledInput` | 287:2001 | label+인풋+안내문구, status(error/correct), 포커스 액센트 테두리 |
| `Typography` `ProgressBar` `BottomSheet` `ConfirmModal` `StateView` | — | 기존 |

새 피그마 컴포넌트를 구현하면 이 표에 추가한다. 상태 전환이 있는 컨트롤은 **reanimated 애니메이션 기본**(색 보간 150~200ms). worklet 안에서 `s()` 호출 금지 — 렌더 단계에서 숫자로 프리컴퓨트.

## 4. 피그마 → 코드 절차 (Claude 작업 순서)

1. `get_design_context` 호출 (design-to-code 스킬 선행).
2. 응답의 **텍스트 스타일명 → §2 표로 variant 매핑** (raw px 복사 금지).
3. 색·radius는 **tokens.js 프리미티브/시맨틱과 대조** — 일치하면 토큰 참조, 없으면 tokens.js에 추가 후 사용.
4. 컴포넌트 인스턴스(Button·Badge 등)는 §3 공용 컴포넌트로 치환. 아이콘/이미지 인스턴스 슬롯은 ReactNode prop.
5. 아이콘은 손으로 그리지 말고 export 벡터 사용. **에셋 배치는 성격 기준**:
   - 아이콘(단색 글리프, 화면 무관 재사용) → **사이즈별** `assets/icons/<사이즈>/<PascalCase>Icon<사이즈>.svg`
   - 일러스트·사진(콘텐츠, 특정 맥락 전용) → **페이지·영역별** `assets/images/<영역>/kebab-case.{png,svg}` — 여러 화면 재사용이 확정되면 `images/common/`으로 승격
   - 일러스트를 icons/에 넣지 말 것 (사이즈 축이 무의미하고 페이지 교체 시 함께 정리돼야 함)
6. export SVG에 컴포넌트 셋 프레임 장식(배경 rect·보라 점선 rect)이 섞이면 제거.

## 5. 레이아웃 / 내비게이션

- 페이지 표준: `<SafeAreaView className="flex-1 bg-background" edges={['top']}>` + 헤더 h-12 + ScrollView `paddingTop: s(16)`.
- **탭 화면 스크롤 하단 패딩 = `useTabBarClearance()`** (플로팅 pill 탭바가 absolute 오버레이라 필수).
- 플로팅 탭바(`(tabs)/_layout.tsx`)·`SystemNavBarScrim`(Android 투명 내비 영역 틴트)은 전문가앱 구조 포팅본 — 수정 시 전문가앱과 비교.
- 페이지 전환: Stack `slide_from_right` 250ms + 제스처 (전 레이아웃 공통).
- `s()`는 고정 dimension에만. Tailwind utility(`p-4` 등)와 Typography는 스케일 안 감쌈. **기준 폭 BASE_W=375**(내담자앱 피그마 프레임 — 전문가앱 390과 다름). 피그마 픽셀값을 그대로 `s()`에 넣으면 시안 비율이 유지된다.
- **레이아웃 치수를 Pressable의 style 함수에 넣지 말 것**: `style={({pressed}) => ({width, opacity})}` 형태에 width 등 레이아웃 값을 섞으면 실기기에서 적용이 깨지는 사례가 있었다(바우처 티켓 카드). 고정 폭·높이는 **일반 View 래퍼**에 정적 style로 두고, Pressable은 pressed 피드백(opacity·scale)만 담당한다.

## 6. 보류 중인 디자인 결정 (임의 확정 금지)

| 사안 | 상태 |
|------|------|
| **액센트 그린 vs 블루** | 파운데이션(46:3)=그린 #10A24E, 컴포넌트 셋=블루 #31A4F7 — 파일 내 모순. 현재 구현은 블루. 컨트롤들은 `COLORS.button.primary.bg`를 참조하므로 확정 시 tokens.js 한 곳만 교체 |
| **엘리베이션 3종** | 피그마 shadow/card·floating·bottomsheet와 앱 SHADOWS 불일치 — 사용자 지시로 보류(card의 위쪽 그림자는 디자이너 확인 필요). floating은 Fab·탭바 등에 인라인 적용 중 |
| **타이포 네이밍 한 단계 어긋남** | §2 표 참조. 리네임 보류 |
| **미연결 홈 placeholder** | 가까운 센터·육아 이야기·딱 맞는 센터는 API/콘텐츠 시스템 부재로 시안 더미 — 출시 전 실데이터 연동 또는 숨김 결정 필요 |
