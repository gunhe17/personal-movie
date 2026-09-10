# Frontend Design System Guide

> 상담(Counseling) · 검사(Assessment) · 청구(Billing) 페이지를 기준으로 정리한 디자인 시스템 규칙.
> UI 코드를 작성하거나 수정할 때 이 문서를 참조한다.
>
> **최종 업데이트**: UX 디자이너 / 프론트엔드 개발자 / PM 3인 심층 코드 리뷰 반영 (2026-06)

---

## 목차

| # | 섹션 | 빠른 참조 |
|---|------|----------|
| **1** | [개요 및 핵심 원칙](#1-개요-및-핵심-원칙) | 토큰 우선 · Svelte 5 · 피드백 · 접근성 |
| **1-2** | [⭐ 두 층위 · 기준 화면 · 현실 보정](#1-2-문서의-두-층위--기준-화면--현실-보정) | **충돌 시 최우선**. L1/L2, 기준 화면, 현실 우선 |
| **2** | [파운데이션](#2-파운데이션) | 타이포(2-1) · 색상(2-2) · 간격(2-3) · 반경(2-4) · 그림자(2-5) · z-index(2-6) · 포커스/disabled(2-7) |
| **3** | [레이아웃 시스템](#3-레이아웃-시스템) | 앱 레이아웃 · 페이지 패턴 · 카드 래퍼 · 반응형 |
| **4** | [컴포넌트 레퍼런스](#4-컴포넌트-레퍼런스) | Button · Table · Select · Modal · NoDataSection 등 15종 |
| **5** | [패턴 가이드](#5-패턴-가이드) | 헤더 · 필터바 · 테이블 · 폼 · 로딩/에러/빈상태 · 모달 · 카드 · 마이크로카피(5-14) |
| **6** | [역할 기반 UI 분기](#6-역할-기반-ui-분기) | 3계층 원칙 · 숨김 vs 비활성 · 역할별 영역 |
| **7** | [금지 패턴](#7-금지-패턴) | 절대 금지 표 (위반 차단용) |
| **8** | [신규 화면 개발 체크리스트](#8-신규-화면-개발-체크리스트) | **8-0 처음→끝 빌드 경로** + 구현 전후 점검 |
| 부록 | [레거시 기술 부채 목록](#부록-레거시-기술-부채-목록) | 컴포넌트별 부채 + 우선순위 |

---

## 1. 개요 및 핵심 원칙

이 가이드는 상담센터 SaaS 플랫폼의 UI 일관성을 유지하기 위한 실무 규칙이다. 디자인 토큰, 컴포넌트 API, 반복 패턴을 기준으로 신규 화면을 짧은 시간 내에 일관성 있게 구현할 수 있도록 한다.

> 🆕 **처음 화면을 만든다면**: 먼저 §1-2(현실 우선 원칙)와 §8-0(처음→끝 빌드 경로)을 읽고, 가장 가까운 기존 화면을 베껴 시작한다. 개별 규칙(토큰·컴포넌트)은 만들면서 해당 절을 참조한다.

### 핵심 원칙

1. **토큰 우선**: 색상·타이포그래피·간격은 반드시 디자인 토큰 클래스를 사용한다. 인라인 hex, `text-[15px]`, `style=` 속성은 금지한다.
2. **Svelte 5 Runes 전용**: 공유 컴포넌트는 `$state`, `$props`, `$derived`, `onclick=`, snippet 패턴만 허용한다. `export let`, `on:event`, `createEventDispatcher`, `$$props`는 신규 코드에서 금지한다.
3. **사용자 피드백 명시**: API 에러 상태는 반드시 화면에 표시한다. 빈 상태에는 맥락에 맞는 설명과 write 권한 사용자 대상 CTA를 포함한다.
4. **비가역적 액션 보호**: 삭제·복구 불가 상태 변경은 반드시 확인 다이얼로그를 거친다.
5. **접근성 최소 요건**: 클릭 가능한 요소에는 키보드 접근이 가능해야 한다. `focus:outline-none` 단독 사용으로 포커스 링을 제거하지 않는다(포커스·disabled 상태 표준은 §2-7).

---

## 1-2. 문서의 두 층위 · 기준 화면 · 현실 보정

> ⭐ **최우선 절 — 다른 절과 충돌하면 이 절을 따른다.**
>
> **핵심 한 줄**: 문서의 이상론과 실제 다수파 화면이 어긋나면 → **화면(현실)을 표준으로 채택**한다. (단, 오타·접근성 결함 같은 *버그*는 다수파여도 채택 안 함)

### 두 층위 (L1 / L2)

| 층위 | 내용 | 효력 |
|------|------|------|
| **L1 — 품질 규칙 (불변)** | 색상·간격·타이포 토큰, hex/임의크기 금지, Svelte 5 문법, 접근성, z-index, 에러·빈상태 처리 | 현실과 무관하게 **반드시 준수**. 거의 모든 화면이 지키며, **이질감의 원인이 아니다** |
| **L2 — 구조 관습 (현실 표준)** | 페이지 헤더, Typography 사용, 로딩 문구, **테이블 형태** | **실제 다수파 화면을 표준으로 삼는다.** 문서의 이상론보다 우선 |

L1은 결제 내역(`subscription/billing`)도 이미 충족한다 — 토큰 차원에서는 어떤 화면도 이질적이지 않다. 화면 간 이질감은 전적으로 **L2, 특히 🔴 테이블**에서 발생한다.

### 기준 화면 레지스트리

신규 화면은 아래 **기준(reference)** 을 보고 맞춘다. 가이드 본문과 실제 화면이 다르면 **화면을 따른다.**

| 구분 | 화면 | 비고 |
|------|------|------|
| **구조 관습 기준** | `assessment/status`, `counseling/status`, `clients`, `members` | 콘텐츠 목록의 사실상 표준. 헤더·필터바·도메인 테이블·카드 토글의 합의된 형태 |
| **L1 품질 기준** | `subscription/billing`, `counseling/status` | 토큰·레이아웃 골격이 가장 깨끗함 |
| **generic Table 예외 (확산 금지)** | `notice`, `subscription/billing` | 도메인 커스텀 테이블 없이 generic `Table`을 직접 사용 — 점진적으로 도메인 테이블화 대상 |

### 구조 관습 대조표 (현실 표준 vs 기존 이상론) — 이질감 기여도 순

| 관습 | 우선 | 현실 다수파 = **표준** | 기존 문서가 적은 이상 | 판정 (현실 우선) |
|------|:---:|------------------|----------------|--------|
| **테이블 형태** | 🔴 | 콘텐츠 목록 = **도메인 전용 커스텀 테이블**(아바타·2줄 셀·진행바·액션·케밥) + 리스트/그리드 카드 토글 (`AssessmentCaseTable`·`CounselingStatusTable`·`ClientListTable`) | generic `Table` + 래퍼 | **커스텀 테이블이 표준.** generic `Table`은 단순·부차 목록에만 |
| 페이지 헤더 | 🟡 | `<h1 class="text-headline-01-normal-bold text-gray-800">` + 우측 Button (`flex justify-between`) | `PageTitleSection` 필수 | **둘 다 허용.** 단 weight가 다름 → 아래 주 참조 |
| 페이지 레벨 Typography | 🟡 | `Typography` 컴포넌트 사용이 다수 | 페이지 레벨 사용 금지 | **허용.** 인라인 클래스도 허용. 강제 전환 없음 |
| 로딩 문구 | 🟡 | `로딩 중...` | `불러오는 중...` 표준 | **표준 = `로딩 중...`**(다수). 화면 내 통일이 핵심 |

🟡 항목은 동일 토큰을 써서 **렌더 결과가 사실상 같다 → 시각 이질감이 작다.** 문서와 현실의 거짓 일치를 없애기 위해 표기만 바로잡고, **강제 일괄 마이그레이션 대상은 아니다.** 결제 내역이 튀는 실제 원인은 🔴(테이블) 하나다.

> **페이지 제목 weight 기준(단일화)**: 인라인 헤더는 `text-headline-01-normal-bold`(700), `PageTitleSection` 컴포넌트는 내부적으로 `headline-01-normal-semibold`(600)를 쓴다 — **둘은 굵기가 다르다.** 둘 다 허용하지만, 한 비교 맥락(같은 영역의 여러 페이지)에서는 하나로 통일한다. 토큰 표·체크리스트의 "페이지 제목" 항목은 이 두 값을 가리킨다.

> **현실이지만 버그인 것은 채택하지 않는다.** 예: 헤더에 잔존하는 `text-headline-01-nomal-bold`(오타 토큰)는 다수파여도 표준이 아니라 **수정 대상**이다(→ `normal`). "다수파 채택"은 *설계 관습*에 한하며 오타·접근성 결함에는 적용하지 않는다.

### 결제 내역(`subscription/billing`)을 안 튀게 하려면

L1은 이미 충족 → 남은 건 🔴 하나다. generic `Table`(맨 셀, `h-[64px]`, hover·행 액션 없음)을 다른 현황 화면과 같은 **밀도 있는 도메인 테이블**로 끌어올린다. (별도 단계에서 진행)

---

## 2. 파운데이션

### 2-1. 타이포그래피

#### 토큰 명명 규칙

```
text-{category}-{number}-{type}-{weight}
```

| 세그먼트 | 선택지 | 설명 |
|---------|-------|------|
| category | `display`, `headline`, `title`, `body`, `label`, `caption` | 역할 계층 |
| number | `00`, `01`, `02`, `03` | 계층 내 크기 |
| type | `normal` | tight — 줄높이 = 폰트 크기 |
| type | `reading` | 150% 줄높이 (본문 흐름 텍스트) |
| weight | `regular` `medium` `semibold` `bold` | 글꼴 굵기 |

> 모든 토큰에 `letter-spacing: -0.41px`이 적용된다.

#### 용도별 빠른 선택 (자주 쓰는 것)

| 용도 | 토큰 |
|-----|------|
| 페이지 제목 | `text-headline-01-normal-semibold`(PageTitleSection) / `…-bold`(인라인 헤더) — §1-2 |
| 카드/섹션 제목 | `text-title-01-normal-semibold` |
| 폼 라벨 | `text-body-01-normal-medium` |
| 탭 레이블 | `text-body-01-normal-semibold` |
| 로딩/빈상태 메시지 | `text-body-01-reading-regular` |
| 테이블 셀 기본 | `text-body-02-normal-regular` |
| 테이블 헤더 레이블 | `text-body-02-normal-medium` |
| 부가 정보·카운트 | `text-body-03-normal-regular` |

#### 전체 토큰 목록

| 클래스 | 크기 | 줄높이 | 굵기 | 주요 용도 |
|-------|-----|-------|-----|---------|
| `text-display-01-normal-bold` | 44px | 44px | 700 | 랜딩 히어로 |
| `text-display-02-reading-bold` | 32px | 150% | 700 | |
| `text-display-02-normal-semibold` | 32px | 28px | 600 | |
| `text-headline-00-normal-medium` | 28px | 28px | 500 | |
| `text-headline-00-normal-bold` | 28px | 28px | 700 | |
| `text-headline-01-normal-regular` | 24px | 24px | 400 | |
| `text-headline-01-normal-medium` | 24px | 24px | 500 | |
| `text-headline-01-normal-semibold` | 24px | 24px | 600 | **페이지 제목** (PageTitleSection 컴포넌트) |
| `text-headline-01-normal-bold` | 24px | 24px | 700 | **페이지 제목** (인라인 헤더, §1-2) |
| `text-headline-01-reading-bold` | 24px | 150% | 700 | |
| `text-headline-01-reading-semibold` | 24px | 150% | 600 | |
| `text-headline-02-normal-regular` | 20px | 20px | 400 | |
| `text-headline-02-normal-medium` | 20px | 20px | 500 | |
| `text-headline-02-normal-semibold` | 20px | 20px | 600 | |
| `text-headline-02-normal-bold` | 20px | 20px | 700 | |
| `text-headline-02-reading-semibold` | 20px | 150% | 600 | |
| `text-headline-02-reading-bold` | 20px | 150% | 700 | |
| `text-title-01-normal-regular` | 18px | 18px | 400 | |
| `text-title-01-normal-medium` | 18px | 18px | 500 | |
| `text-title-01-normal-semibold` | 18px | 18px | 600 | **카드/섹션 제목** |
| `text-title-01-normal-bold` | 18px | 18px | 700 | |
| `text-title-01-reading-regular` | 18px | 150% | 400 | |
| `text-title-01-reading-semibold` | 18px | 150% | 600 | |
| `text-body-01-normal-regular` | 16px | 16px | 400 | |
| `text-body-01-normal-medium` | 16px | 16px | 500 | |
| `text-body-01-normal-semibold` | 16px | 16px | 600 | 탭 레이블 (TabBar) |
| `text-body-01-normal-bold` | 16px | 16px | 700 | |
| `text-body-01-reading-regular` | 16px | 150% | 400 | **로딩/빈상태 메시지** |
| `text-body-01-reading-medium` | 16px | 150% | 500 | |
| `text-body-01-reading-semibold` | 16px | 150% | 600 | |
| `text-body-02-normal-regular` | 15px | 15px | 400 | **테이블 셀 기본 텍스트** |
| `text-body-02-normal-medium` | 15px | 15px | 500 | **테이블 헤더 레이블** |
| `text-body-02-normal-semibold` | 15px | 15px | 600 | |
| `text-body-02-reading-regular` | 15px | 150% | 400 | |
| `text-body-02-reading-semibold` | 15px | 150% | 600 | |
| `text-body-03-normal-regular` | 14px | 14px | 400 | 부가 정보, 카운트 |
| `text-body-03-normal-medium` | 14px | 14px | 500 | |
| `text-body-03-normal-semibold` | 14px | 14px | 600 | |
| `text-body-03-normal-bold` | 14px | 14px | 700 | |
| `text-body-03-reading-regular` | 14px | 150% | 400 | |
| `text-body-03-reading-semibold` | 14px | 150% | 600 | |
| `text-label-01-normal-regular` | 13px | 13px | 400 | |
| `text-label-01-normal-medium` | 13px | 13px | 500 | |
| `text-label-01-normal-bold` | 13px | 13px | 700 | |
| `text-label-02-normal-regular` | 12px | 12px | 400 | |
| `text-label-02-normal-medium` | 12px | 12px | 500 | |
| `text-label-02-normal-bold` | 12px | 12px | 700 | |
| `text-caption-01-normal-regular` | 10px | 10px | 400 | |
| `text-caption-01-normal-medium` | 10px | 10px | 500 | |
| `text-caption-01-normal-bold` | 10px | 10px | 700 | |
| `text-caption-02-normal-regular` | 8px | 8px | 400 | |
| `text-caption-02-normal-medium` | 8px | 8px | 500 | |
| `text-caption-02-normal-bold` | 8px | 8px | 700 | |

#### 레거시 토큰 (deprecated)

`app.css`에 `nomal`(오타) 형식의 레거시 alias가 남아있다. **신규 코드에서 절대 사용 금지**.

```
❌ 레거시 (오타, deprecated)          ✅ 정식 토큰
text-headline-01-nomal-bold    →   text-headline-01-normal-bold
text-body-01-nomal-medium      →   text-body-01-normal-medium
text-body-02-nomal-regular     →   text-body-02-normal-regular
text-body-03-nomal-medium      →   text-body-03-normal-medium
text-title-01-nomal-semibold   →   text-title-01-normal-semibold
```

단축형 alias(`body-01-medium`, `body-02-regular` 등 normal/reading 없이)도 기존 코드에 다수 존재하나 신규 코드에서는 full-form 정규형을 사용한다.

> **`text-xs` 등 Tailwind 기본 스케일 처리**: 배지·폼 helper 등 마이크로 텍스트에서 `text-xs font-medium`(12px)이 현실 다수파다(§1-2). 명명된 Tailwind 스케일(`text-xs`)은 허용하되, 정식 등가 토큰은 `text-label-02-normal-medium`이며 신규 코드는 이를 *권장*한다. **금지되는 것은 `text-[15px]` 같은 대괄호 임의 크기뿐이다** — `text-xs`와 임의 크기를 혼동하지 말 것. 본 문서 예시의 `text-xs`도 이 규칙을 따른다.

#### 타이포그래피 클래스 사용 원칙

페이지 레벨 HTML에서는 항상 토큰 클래스를 직접 사용한다. `Typography` 컴포넌트(`@common/components/Typography.svelte`)는 공유 UI 컴포넌트(예: SegmentToggle) 내부에서만 사용하며, 페이지 레벨 `<span>` · `<p>` · `<div>`에는 인라인 클래스를 사용한다.

> ⚠ **현실 보정 (§1-2)**: 실제로는 대다수 화면이 페이지 레벨에서 `Typography`를 사용한다. **금지가 아니라 허용**한다. 신규 코드는 인라인 클래스를 *권장*하되 강제하지 않으며, 기존 `Typography` 사용을 일괄 교체 대상으로 보지 않는다. (토큰만 맞으면 렌더가 동일 → 이질감 없음)

```svelte
<!-- 올바른 사용 — 클래스 직접 적용 -->
<span class="text-body-02-normal-medium text-gray-600">헤더 레이블</span>
<p class="text-body-01-reading-regular text-gray-400">로딩 중...</p>

<!-- 금지 — 페이지 레벨에서 Typography 단독 사용 -->
<Typography variant="headline-01-normal-semibold">페이지 제목</Typography>
```

| 맥락 | 방법 |
|-----|------|
| 페이지/모달 내 일반 텍스트 | 인라인 클래스 직접 사용 |
| Table 셀 기본 | 자동 적용 (`body-02-normal-regular text-gray-600`) |
| Table 헤더 | 자동 적용 (`body-02-normal-medium text-gray-600`) |
| 공유 UI 컴포넌트 내부 | Typography 컴포넌트 허용 (`variant="body-01-medium"` 단축형) |

---

### 2-2. 색상 팔레트

#### Primary (브랜드 컬러)

| 토큰 | hex | 용도 |
|-----|-----|------|
| `primary-50` | — | 활성 탭 배경, 강조 배경 |
| `primary-100` | — | disabled 상태 배경 |
| `primary-200` ~ `primary-300` | — | disabled 텍스트/아이콘 |
| `primary-400` | `#4C87F6` | 기본 버튼(Button primary base), **활성 탭 텍스트**, 카운트 강조 숫자 |
| `primary-500` | `#256EF4` | 강조 버튼(CTA), 토글 on 상태, 페이지네이션 활성, **탭 슬라이딩 인디케이터 바** |
| `primary-600` | — | hover 강조 (피그마 확정 필요 — 현재 `#256EF4`와 동일하게 정의됨) |

> **주의**: `primary-600`~`primary-800`이 현재 `app.css`에서 모두 `#256EF4`로 동일하게 정의되어 있어 hover 시 시각적 피드백이 없다. 피그마 확정 전까지 `primary-600` 이상 사용을 삼간다.

> **인터랙티브 색상 기준**: 라이트 강조 요소는 `primary-400`(`#4C87F6`), 주요 CTA/토글 on 상태는 `primary-500`(`#256EF4`)으로 통일한다. `bg-blue-*` 및 인라인 hex(`#256EF4`, `#4C87F6`)는 사용 금지.
>
> **`text-primary-400` 대비 주의**: `primary-400`은 가장 옅은 파랑이라 흰 배경 위 일반 텍스트로 쓰면 대비가 낮다. 활성 탭 텍스트(§4-5)·카운트 강조 숫자처럼 **굵거나 보조적인 강조에만** 허용하고, 본문 길이의 핵심 정보 텍스트에는 `primary-500` 이상을 쓴다.

#### Gray (중립)

| 토큰 | 용도 |
|-----|------|
| `gray-50` | row hover 배경, 입력창 배경 |
| `gray-50/80` | 테이블 헤더 배경 (반투명) |
| `gray-100` | 카드 내부 구분선, 비활성 배지 배경 |
| `gray-200` | 카드/테이블/입력창 외곽 테두리 |
| `gray-300` | 비활성 테두리, disabled |
| `gray-400` | placeholder, 부가 텍스트, **로딩/빈상태 메시지**(§5-6) |
| `gray-500` | **조회 실패 안내 문구**(§5-7, 중립 톤 — 의미색 red 아님), 비활성/취소 상태 텍스트 |
| `gray-600` | 셀 기본 텍스트, 헤더 레이블 |
| `gray-700` | 보조 텍스트 |
| `gray-800` | 주 텍스트 (금액, 이름) |
| `gray-900` | 최상위 강조 텍스트 |

#### Semantic (상태 색상) — 4색 정본

상태 색상은 아래 **4계열(green·red·amber·gray)로 단일화**한다. 이것이 상태 매핑의 정본이며, 배지(§5-11)·인라인 상태 텍스트의 색은 여기서만 고른다.

| 의미 | 배경(연한 배지) | 텍스트 | 강조 텍스트/아이콘(배경 없을 때) |
|-----|------|-------|-------|
| 성공/완료 | `bg-green-50` | `text-green-700` | `text-green-600` |
| 오류/연체/필수 | `bg-red-50` | `text-red-600` | `text-red-500` |
| 경고/대기 | `bg-amber-50` | `text-amber-700` | `text-amber-600` |
| 비활성/취소 | `bg-gray-100` | `text-gray-500` | `text-gray-500` |

**가중치 선택 규칙(모순 제거)**:
- **연한 배경 위 배지 텍스트**: `-700`(green·amber)·`-600`(red) — 진한 쪽. `-50` 배경과의 대비를 확보한다(§5-11 `STATUS_COLORS`가 이 쌍을 씀).
- **배경 없는 인라인 강조**(흰 바탕의 `*`표시·연체 금액 등): `-600`(green·amber)·`-500`(red). 폼 필수 표시(`*`)는 `text-red-500`(§5-5).

> **대비 최소선 (접근성 L1)**: 의미 전달용 색 텍스트는 흰 배경 또는 같은 계열 `-50` 배경 위에서 **WCAG AA(일반 텍스트 4.5:1, ≥18px·bold는 3:1)** 를 만족하는 위 가중치만 쓴다. **`-400`/`-300` 같은 옅은 색을 의미 텍스트에 쓰지 않는다.** 또한 **색만으로 상태를 구분하지 않는다** — 배지·아이콘에는 항상 텍스트 라벨(또는 `aria-label`)을 동반한다(색각 이상 대응).

> **off-palette 정리 대상(현실 보정 §1-2)**: 코드에 `orange`·`emerald`·`yellow` 계열이 상태색으로 일부 혼재한다(`bg-orange-50`·`bg-emerald-50`·`bg-yellow-50` 등). 이는 위 4색의 중복 표현이므로 **신규 코드 금지**, 해당 화면 손댈 때 매핑한다: `emerald→green`, `orange/yellow→amber`(→ 부록 P2).

---

### 2-3. 간격 시스템

| 용도 | 클래스 | 설명 |
|-----|-------|------|
| 카드/섹션 가로 패딩 | `px-6` | 24px |
| 섹션 헤더 세로 패딩 | `py-4` | 16px |
| 테이블 셀 세로 패딩 | `py-3` | 12px |
| 테이블 헤더 높이 | `h-[52px]` | |
| 필터 입력창 높이 | `h-11` | 44px — 표준 |
| 필터 바 gap | `gap-3` | 12px |
| 페이지 헤더 아래 여백 | `mb-6` | 24px — 표준 |
| 카운트 행 여백 | `my-2.5` | |
| 카드 내부 구분선 여백 | `my-3` | |
| 모달 기본 padding | `px-6 py-5` | header / body / footer 공통 |

**결정 기준**: 요소 간 관계가 긴밀할수록 간격이 좁다. 섹션 단위 분리는 `mb-6`, 동일 섹션 내 요소 간격은 `gap-3` 또는 `space-y-4`.

---

### 2-4. 테두리 반경

| 클래스 | 용도 |
|-------|------|
| `rounded-sm` | 버튼 xs 크기 |
| `rounded` | 버튼 sm/md/lg 기본 |
| `rounded-lg` | 카드, 테이블 래퍼, 입력창, 모달 |
| `rounded-full` | 뱃지, pill 버튼, 아바타 |
| `rounded-l-xl` / `rounded-r-xl` | SegmentToggle 버튼 |

---

### 2-5. 그림자

| 클래스 | 용도 |
|-------|------|
| `shadow-sm` | 페이지 최상위 단일 콘텐츠 패널 |
| `shadow-md` | 카드 hover 상태 (`hover:shadow-md`) |
| `shadow` | 드롭다운, 플로팅 요소 |

**적용 기준**:
- 페이지에 주요 콘텐츠 카드가 1개이면 `shadow-sm` 적용.
- 테이블 래퍼, 카드 그리드 내 개별 카드에는 `shadow` 미적용 (hover만).
- 대시보드 위젯처럼 카드가 병렬 배치된 경우 `shadow-sm` 적용.

---

### 2-6. Z-index 레이어 체계

임의 z-index 사용을 금지한다. 아래 표에 정의된 값만 사용하고, 새 오버레이 추가 시 이 표에 먼저 등록한다.

| 레이어 | z-index | 용도 |
|-------|---------|------|
| page content | 1 ~ 9 | 일반 콘텐츠 |
| sticky header | 10 | 테이블 sticky 헤더 등 |
| dropdown (inline) | 50 | 페이지 내 인라인 드롭다운 |
| side panel | 100 ~ 9000 | 슬라이드 패널 |
| secret lock | 9999 | SecretModeLock 오버레이 |
| modal backdrop | 10000 | BaseModal 배경 |
| portal dropdown | 10001 | Select/TimeSelect portal 드롭다운 |
| snackbar | 20000 | Snackbar 토스트 |

---

### 2-7. 포커스 · 비활성 상태 표준 (접근성 L1)

> 포커스·disabled는 L1 품질 규칙이다(§1-2). 포커스 링 누락은 다수파여도 표준이 아니라 **수정 대상 결함**이다.

#### 포커스 링 — 요소 유형별 단일 규칙

| 요소 | 표준 포커스 클래스 | 현실 |
|-----|----------------|------|
| **입력류** (input·textarea·검색창) | `focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400` | ✅ 실제 다수파(§5-5). 그대로 사용 |
| **버튼·클릭형 div·아이콘 버튼·메뉴 항목** | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2` | ⚠ **목표값. 현재 거의 미적용**(코드 2곳뿐) → 신규/수정 시 추가 |

**핵심 구분**: 입력류는 항상 보이는 `focus:ring-1`(포커스 시 항상 강조), 클릭형은 키보드 전용 `focus-visible:ring-2`(마우스 클릭엔 링 없음). 둘을 섞지 말 것.

**절대 금지**: `focus:outline-none` **단독**(대체 포커스 표시 없음). 위 두 규칙 중 하나를 반드시 병행한다.

#### disabled — 요소 유형별 단일 규칙

| 요소 | 표준 처리 |
|-----|---------|
| **Button 컴포넌트** | color별 `disabledClasses` 맵(자동, 색상 wash-out) |
| **유틸 버튼**(아이콘·초기화 등) | `disabled:opacity-50 disabled:cursor-not-allowed` |
| **모달/폼 제출 버튼**(인라인 마크업) | `disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`(§5-9) |
| **입력류** | `disabled:bg-gray-100 disabled:cursor-not-allowed` |

`opacity-30`·`opacity-40`은 어디서도 사용 금지(불일치). 비활성 색 wash-out과 `opacity-50`을 같은 요소에 중복 적용하지 않는다.

---

## 3. 레이아웃 시스템

### 3-1. 전체 앱 레이아웃

```
+------------------------------------------+
|  AppHeader (h-16, sticky, z-10)          |
+------------------------------------------+
|  Sidebar        |  Content Area           |
|  240px(펼침)    |  flex-1 overflow-auto   |
|  72px(축소)     |  bg-gray-50             |
|  CSS var:       |                         |
|  --sidebar-width|                         |
+------------------------------------------+
```

- 사이드바 펼침 너비: `240px` (`--spacing-aside`)
- 사이드바 축소 너비: `72px`
- 헤더 높이: `64px` (`--spacing-header`, `h-16`)
- 모바일/태블릿: 오버레이 모드 — 사이드바가 콘텐츠 위에 drawer 형태로 열림

---

### 3-2. 페이지 레이아웃 패턴

#### 목록 페이지 (표준)

```svelte
<div in:fade class="xl:h-full flex flex-col xl:overflow-hidden bg-gray-50">
  <!-- 헤더 -->
  <PageTitleSection title="페이지 제목" className="mb-6">
    {#snippet extraBtn()}
      <Button color="primary" size="md">추가하기</Button>
    {/snippet}
  </PageTitleSection>

  <!-- 필터 바 -->
  <div class="mb-3 flex flex-wrap items-center gap-3">
    <!-- 검색창 -->
    <div class="flex h-11 w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4">
      <SearchIcon class="h-5 w-5 shrink-0 text-gray-400" />
      <input
        type="text"
        bind:value={filters.search}
        placeholder="검색어를 입력해주세요"
        class="text-body-02-normal-regular w-full bg-transparent outline-none placeholder:text-gray-400"
      />
    </div>
    <!-- 필터 Select -->
    <Select class="h-11 w-30 rounded-lg" options={statusOptions} ... />
    <!-- 초기화 버튼 -->
    <button class="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
      onclick={filters.reset}>
      <RefreshIcon class="h-5 w-5 text-gray-400" />
    </button>
  </div>

  <!-- 탭 바 (선택) -->
  <TabBar {tabs} {activeTab} onTabChange={(tab) => filters.changeTab(tab)} />

  <!-- 카운트 + 정렬 -->
  <div class="my-2.5 flex items-center justify-between">
    <span class="text-body-02-normal-medium text-gray-500">
      총 <span class="text-primary-400">{total}</span> 건
    </span>
    <Select class="h-9 w-28 rounded-lg" options={sortOptions} ... />
  </div>

  <!-- 테이블 영역 -->
  <div class="relative flex min-h-0 flex-1 flex-col">
    {#if isLoading}
      <div class="flex-center h-full">
        <p class="text-body-01-reading-regular text-gray-400">로딩 중...</p>
      </div>
    {:else if isError}
      <div class="flex-center h-full flex-col gap-3">
        <p class="text-body-01-reading-regular text-gray-500">데이터를 불러오지 못했어요.</p>
        <button onclick={refetch}
          class="rounded-lg border border-gray-200 px-4 py-2 text-body-02-normal-medium text-gray-600 hover:bg-gray-50">
          다시 시도
        </button>
      </div>
    {:else if rows.length > 0}
      <div class="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 overflow-hidden">
        <Table {columns} data={rows} keyField="id" onRowClick={handleClick} hoverEnabled={true} />
      </div>
    {:else}
      <div class="flex-center h-full">
        <NoDataSection description="검색 결과가 없어요" />
      </div>
    {/if}

    <!-- 페이지네이션 -->
    {#if rows.length > 0 && total > pageSize}
      <div class="mt-4 flex shrink-0 justify-center">
        <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage={filters.page} />
      </div>
    {/if}
  </div>
</div>
```

#### 설정/상세 페이지 (카드 래퍼)

```svelte
<div in:fade class="xl:h-full flex flex-col xl:overflow-hidden bg-gray-50">
  <PageTitleSection title="설정 제목" className="mb-6" />

  <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
    <!-- 콘텐츠 -->
  </div>
</div>
```

> ⚠️ 콘텐츠 컨테이너 radius는 **`rounded-2xl`(16px)**. 이 프로젝트 Tailwind v4에서 `rounded-lg`는 8px이므로 카드/컨테이너에 쓰지 않는다. 전역 표준은 Web_Design.md §"콘텐츠 컨테이너 표준" 참조.

#### 2컬럼 레이아웃

- **보호된 페이지 (사이드바 있음)**: `xl:grid xl:grid-cols-[300px_1fr]` — xl(1280px)에서 2컬럼 전환
- **설정/관리 페이지**: `md:grid md:grid-cols-[280px_1fr]` — md(768px)에서 2컬럼 전환
- `responsive` 스토어 기반 `isDesktop` 분기는 신규 코드에서 사용 금지 → Tailwind 반응형 prefix로 대체

---

### 3-3. 카드/섹션 래퍼 표준

> **콘텐츠 컨테이너 radius = `rounded-2xl`(16), 테두리 = `border-gray-200`** (전 페이지 공통). 콘텐츠 카드는 `p-6`(24 사방), 테이블·리스트·캘린더·탭 프레임은 바깥 패딩 없이 콘텐츠를 테두리에 꽉 채운다(내부 셀·섹션이 24 인셋 담당). 상세는 Web_Design.md §"콘텐츠 컨테이너 표준(전역 불변)".

```svelte
<!-- 흰 카드 (폼·텍스트를 직접 담는 콘텐츠 카드) -->
<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">...</div>

<!-- 테이블·프레임 래퍼 (콘텐츠가 가장자리를 관리 → 바깥 패딩 없음) -->
<div class="rounded-2xl border border-gray-200 overflow-hidden">
  <Table ... />
</div>

<!-- 그리드 카드 (클릭 가능) -->
<div class="rounded-lg bg-white p-4 ring-1 ring-inset ring-gray-200
            duration-200 hover:ring-primary-400 hover:shadow-md cursor-pointer">
  ...
</div>
```

**테두리 패턴 기준**:
- 공유 컴포넌트(Button, Select, Checkbox, Pagination): `ring-1 ring-inset` 패턴
- 페이지 내 카드/테이블/입력창 외곽: `border border-gray-200`
- 카드 내부 구분선: `<hr class="border-gray-100 my-3" />`
- 내부 섹션 구분(상단): `border-t border-gray-100 mt-6 pt-6`

---

### 3-4. 반응형 처리 기준

| Prefix | 기준 | 주요 사용 |
|--------|------|---------|
| `sm` | 533px | 모바일 레이아웃 분기 |
| `md` | 768px | 외부 서비스 대응, 설정 2컬럼 |
| `lg` | 1024px | 중간 레이아웃 조정 |
| `xl` | 1280px | 사이드바 보호 페이지 2컬럼, 오버플로우 제어 |
| `2xl` | 1536px | 넓은 화면 최적화 |

---

## 4. 컴포넌트 레퍼런스

| # | 컴포넌트 | 언제 쓰나 |
|---|---------|----------|
| 4-1 | [Button](#4-1-button) | 모든 액션 버튼 |
| 4-2 | [Table](#4-2-table) | generic 표 (단순·부차 목록만 — §1-2) |
| 4-3 | [Select](#4-3-select) | 드롭다운 선택 (필터 포함) |
| 4-4 | [SearchDropdown](#4-4-searchdropdown) | 텍스트 검색 + 항목 선택 |
| 4-5 | [TabBar](#4-5-tabbar) | 페이지 탭 + 뷰/정렬 토글 |
| 4-6 | [SegmentTab](#4-6-segmenttab) | animated pill 탭 (2개+) |
| 4-7 | [FilterTabs](#4-7-filtertabs) | 탭+검색+칩 복합 필터 |
| 4-8 | [Pagination](#4-8-pagination) | 목록 페이지네이션 |
| 4-9 | [Modal (BaseModal)](#4-9-modal-basemodal) | 모달 / 다이얼로그 |
| 4-10 | [NoDataSection](#4-10-nodatasection) | 빈 상태 |
| 4-11 | [PageTitleSection](#4-11-pagetitlesection) | 페이지 헤더 |
| 4-12 | [Checkbox](#4-12-checkbox) | 체크박스 |
| 4-13 | [Switch](#4-13-switch) | on/off 토글 |
| 4-14 | [NameChip](#4-14-namechip) | 이름 선택 칩 |
| 4-15 | [Snackbar (Toast)](#4-15-snackbar-toast) | 성공/실패 피드백 |

#### 컴포넌트 API 규약 (콜백·bindable 네이밍 — 신규 컴포넌트 필독)

공유 컴포넌트의 prop 네이밍에는 **현실 다수파인 두 규약이 공존**한다(§1-2). 신규 컴포넌트는 아래 규칙으로 선택하고, 기존 시그니처는 표에 적힌 실제 이름을 그대로 쓴다.

| 종류 | 규약 | 적용 컴포넌트 | 신규 기준 |
|-----|------|-------------|----------|
| **DOM 이벤트 그대로 노출** | 소문자 `onclick`·`onchange` (네이티브 핸들러 시그니처 그대로 전달) | Button(`onclick`), Checkbox(`onchange`·`onclick`), Switch(`onclick`) | 컴포넌트가 단일 native 요소를 감싸고 그 이벤트를 그대로 위임할 때 |
| **의미 기반 콜백** | camelCase `on{Event}` (`onSelect`·`onChange`·`onRowClick`·`onTabChange`·`onCheckChange`·`onClick`) | SearchDropdown(`onSelect`), SegmentTab(`onChange`), TabBar(`onTabChange`/`onViewChange`/`onSortChange`), Table(`onRowClick`/`onCheckChange`), NameChip(`onClick`) | 도메인 의미가 있는 선택/행 클릭/탭 변경 등 추상 이벤트일 때 |

> NameChip만 단순 클릭에 의미 콜백 `onClick`(대문자)을 쓴다 — Button(`onclick`)과 대문자가 다르니 혼동 주의. **신규 컴포넌트는 둘 중 하나로만 정하고 한 컴포넌트 안에서 섞지 않는다.**

**양방향 바인딩(`$bindable`) prop** — `bind:`로 연결, 그 외엔 `bind:` 금지:

| 컴포넌트 | bindable prop | 콜백 병행 |
|---------|--------------|----------|
| Table | `selectedIds` | `onCheckChange` |
| TabBar | `activeTab`·`viewType`·`sort` | `onTabChange`·`onViewChange`·`onSortChange` |
| Checkbox | `checked` | `onchange` |
| Switch | `checked` | `onclick` |
| Pagination | `currentPage` | — |
| Select | `selected` | `on:change`(Svelte 4) |
| **SegmentTab** | **없음** | `onChange` (단방향, `bind:selected` 불가 — §4-6) |

> bindable과 콜백을 둘 다 제공하는 컴포넌트는 **하나만 골라** 쓴다(예: TabBar는 `bind:activeTab` *또는* `onTabChange` 중 하나). 둘을 동시에 쓰면 갱신 경로가 중복된다.

### 4-1. Button

```svelte
<Button
  color="primary"
  size="lg"
  content="버튼 텍스트"
  loading={isSubmitting}
  onclick={handleClick}
/>
```

**Props**

| Prop | 타입 | 기본값 | 설명 |
|-----|------|-------|-----|
| `color` | `'primary' \| 'dark' \| 'light' \| 'tertiary' \| 'white-action' \| 'primary-dark' \| 'stroke-primary' \| 'stroke-secondary' \| 'stroke-delete' \| 'expense'` | `'primary'` | 버튼 색상 계열 |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'lg'` | 크기 |
| `weight` | `'bold' \| 'medium' \| 'normal'` | `'bold'` | 글꼴 굵기 |
| `outline` | `boolean` | `false` | 아웃라인 스타일 |
| `pill` | `boolean` | `false` | 둥근 모서리 (`rounded-full`) |
| `disabled` | `boolean` | `false` | 비활성 |
| `loading` | `boolean` | `false` | 로딩 스피너 표시 |
| `content` | `string` | `'Button'` | 텍스트 (children 없을 때) |
| `href` | `string` | — | 링크로 렌더링 (`<a>`) |
| `class` | `string` | — | 추가 클래스 |
| `onclick` | `(e: MouseEvent) => void` | — | 클릭 핸들러 |
| `children` | `Snippet` | — | 슬롯 콘텐츠 |

**크기별 스펙**

| size | 높이 | 가로 패딩 | 반경 |
|------|-----|---------|-----|
| `xs` | `h-4.5` | `px-2` | `rounded-sm` |
| `sm` | `h-7` | `px-3` | `rounded` |
| `md` | `h-9` | `px-4` | `rounded` |
| `lg` | `h-12` | `px-6` | `rounded` |

**주요 색상 사용 예시**

```svelte
<!-- 주 액션 (파란 배경) -->
<Button color="primary" size="lg">저장</Button>

<!-- 취소 (테두리) -->
<Button color="stroke-secondary" size="md">취소</Button>

<!-- 삭제 (빨간 테두리) -->
<Button color="stroke-delete" size="md">삭제</Button>

<!-- 로딩 중 (API 호출 중 반드시 사용) -->
<Button color="primary" size="lg" loading={isSubmitting} disabled={isSubmitting}>저장</Button>
```

**disabled 처리 원칙**:
- Button: color별 `disabledClasses` 맵으로 색상 wash-out 처리 (자동 적용)
- 아이콘 버튼 등 유틸리티 요소: `disabled:opacity-50 cursor-not-allowed`
- `opacity-30`, `opacity-40`은 사용 금지

---

### 4-2. Table

> ⚠ **현실 보정 (§1-2)**: generic `Table`은 콘텐츠 목록의 표준이 **아니다**. 실제 모든 콘텐츠 목록(검사·상담·내담자·구성원)은 **도메인 전용 커스텀 테이블**(`AssessmentCaseTable`·`CounselingStatusTable`·`ClientListTable` — 아바타·2줄 셀·진행바·액션·케밥 + 리스트/그리드 카드 토글)을 쓴다. generic `Table` 직접 사용은 `notice`·`subscription/billing`뿐이며 **확산 금지**. 단순·부차 목록에만 generic `Table`을 쓰고, 콘텐츠 목록은 도메인 테이블 컴포넌트를 만든다(아래 generic Table 스펙은 그 내부 골격으로 재사용).

```svelte
<Table
  {columns}
  data={rows}
  keyField="id"
  onRowClick={handleClick}
  hoverEnabled={true}
/>
```

**TableColumn 타입**

```typescript
export interface TableColumn<T = any> {
  key: string
  label: string
  width?: string            // CSS grid-template 값 (예: '120px', 'minmax(140px, 1fr)', '2.5fr')
  align?: 'left' | 'center' | 'right'
  headerClass?: string
  cellClass?: string
  stopPropagation?: boolean // 셀 클릭이 행 클릭으로 전파 차단
  render?: Snippet<[{ item: T; index: number; isChecked: boolean }]>
  headerRender?: Snippet<[]>
}
```

**Props**

| Prop | 타입 | 기본값 | 설명 |
|-----|------|-------|-----|
| `columns` | `TableColumn[]` | 필수 | 컬럼 정의 |
| `data` | `any[]` | 필수 | 행 데이터 |
| `keyField` | `string` | `'id'` | 고유 키 필드 |
| `showCheckbox` | `boolean` | `false` | 체크박스 열 |
| `selectedIds` | `string[]` | `[]` | 선택된 id 목록 (bindable) |
| `onCheckChange` | `(ids: string[]) => void` | — | 체크박스 변경 |
| `onRowClick` | `(item: any) => void` | — | 행 클릭 |
| `hoverEnabled` | `boolean` | `false` | hover 하이라이트 |
| `rowHeight` | `string` | `'min-h-18.5'` | 행 높이 클래스 |
| `headerClass` | `string` | `''` | 헤더 추가 클래스 |
| `rowClass` | `string` | `''` | 행 추가 클래스 |
| `containerClass` | `string` | `''` | 루트 div 추가 클래스 |
| `bodyClass` | `string` | `''` | 스크롤 컨테이너 추가 클래스 |

**렌더 클래스 (참조)**

```
헤더:  sticky top-0 z-10 grid h-[52px] shrink-0 items-center gap-4
       bg-gray-50/80 backdrop-blur-sm px-6
       → 기본 텍스트: body-02-normal-medium text-gray-600

행:    grid items-center {rowHeight} gap-4 border-b border-gray-100 bg-white px-6 py-3
       [hoverEnabled: cursor-pointer hover:bg-gray-50]
       → 기본 셀 텍스트: body-02-normal-regular text-gray-600
```

**테이블 래퍼 (항상 사용)**

```svelte
<!-- 표준 목록 페이지 -->
<div class="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 overflow-hidden">
  <Table {columns} data={rows} hoverEnabled={true} onRowClick={handleClick} />
</div>

<!-- 클릭 불가 테이블 (청구 상세 등) -->
<div class="rounded-lg border border-gray-200 overflow-hidden">
  <Table {columns} data={rows} rowHeight="h-[64px] shrink-0"
    headerClass="bg-white border-b border-gray-200" />
</div>
```

#### generic Table vs 도메인 커스텀 테이블 — 판단 기준

| 묻는 것 | generic `Table` 직접 사용 | 도메인 커스텀 테이블 (표준) |
|--------|:---:|:---:|
| 콘텐츠 목록인가? (검사·상담·내담자·구성원 등 핵심 엔티티) | ❌ | ✅ |
| 셀이 단일 텍스트/금액뿐인가? | ✅ | — |
| 아바타·2줄 셀·진행바·상태배지·행 액션·케밥 중 1개+ 필요? | — | ✅ |
| 리스트/그리드 카드 토글이 필요한가? | ❌ | ✅ |
| 부차·읽기전용 표(notice 목록, 청구 명세 행)인가? | ✅ | — |

→ 위 표에서 ✅가 도메인 쪽이면 **도메인 테이블 컴포넌트를 만든다.** generic `Table`은 그 골격으로 내부에서 재사용한다(아래 레시피). 콘텐츠 목록을 generic `Table`만으로 끝내지 않는다(§1-2 🔴).

#### 신규 도메인 테이블 만드는 법 (레시피)

기존 도메인 테이블은 모두 **generic `Table`을 감싸는 얇은 래퍼**다 — 새로 만들지 말고 이 골격을 복제한다. 기준 구현: `AssessmentCaseTable`·`CounselingStatusTable`·`ClientListTable`.

1. **위치**: `src/lib/components/{domain}/{Domain}Table.svelte`(실제 예: `assessment/AssessmentCaseTable`, `counseling/status/CounselingStatusTable`, `table/ClientListTable` — 폴더 명칭은 도메인마다 다르나 모두 `lib/components` 하위다). 재사용 셀은 같은 폴더 `cells/`에 둔다(예: `StaffAvatar`·`GenderIcon`·`KebabMenu`, 진행바는 공통 `common/ProgressBar`).
2. **데이터**: `data`는 ViewModel 배열(`view-model.ts` 변환 결과)을 받는다. raw API 타입을 직접 받지 않는다.
3. **컬럼**: 컴포넌트 내부에 `TableColumn<VM>[]`를 정의하고 각 셀은 `{#snippet}` → `render`로 연결한다. 페이지는 컬럼을 모른다.
4. **래퍼**: 루트 div가 `flex flex-col h-full rounded-lg border border-gray-200 overflow-hidden`를 갖고, generic `Table`엔 `containerClass="flex-1 min-h-0"` `bodyClass="flex-1 min-h-0 overflow-auto"`를 넘긴다(헤더 sticky + 본문만 스크롤).
5. **행 클릭/액션**: 행 전체 클릭은 `onRowClick`. 행 내부 버튼·케밥 컬럼은 `stopPropagation: true`로 행 클릭 전파를 막는다.
6. **카드 토글**: 리스트/그리드 토글이 필요하면 페이지에서 `TabBar`의 `showViewToggle`로 분기하고, grid 뷰는 `5-12` 카드 패턴을 재사용한다(도메인 테이블 컴포넌트 안에 넣지 않는다).

```svelte
<!-- {Domain}Table.svelte (골격) -->
<script lang="ts">
  import Table from '$lib/components/Table.svelte'
  import type { TableColumn } from '$lib/components/Table.svelte'
  import StaffAvatar from './cells/StaffAvatar.svelte'

  interface Props { data: DomainVM[]; onRowClick?: (r: DomainVM) => void }
  let { data, onRowClick }: Props = $props()

  const columns: TableColumn<DomainVM>[] = [
    { key: 'client', label: '내담자', width: 'minmax(140px, 1fr)', align: 'left', render: clientCell },
    { key: 'progress', label: '진행률', width: 'minmax(150px, 1fr)', align: 'center', render: progressCell },
    { key: 'actions', label: '', width: '1fr', align: 'center', stopPropagation: true, render: actionsCell },
  ]
</script>

{#snippet clientCell({ item })}
  <div class="flex items-center gap-2">
    <StaffAvatar name={item.name} />
    <div class="flex flex-col">
      <span class="text-body-02-normal-medium text-gray-800 truncate">{item.name}</span>
      <span class="text-body-03-normal-regular text-gray-500">{item.subText}</span>
    </div>
  </div>
{/snippet}

<div class="flex flex-col h-full rounded-lg border border-gray-200 overflow-hidden">
  <Table {columns} {data} {onRowClick} hoverEnabled={!!onRowClick}
    containerClass="flex-1 min-h-0" bodyClass="flex-1 min-h-0 overflow-auto" />
</div>
```

#### 셀·행 밀도 관습 (도메인 테이블)

| 항목 | 관습 |
|-----|------|
| 행 높이 | `rowHeight="h-[64px] shrink-0"`(콘텐츠 목록 다수파). 셀이 2줄이면 `rowClass="!py-0"`로 패딩 제거 후 내부 정렬 |
| 주 텍스트(이름·금액) | `text-body-02-normal-{regular\|medium} text-gray-800` + `truncate` (도메인마다 weight 차이 있음, 색은 `gray-800` 고정) |
| 보조 텍스트(나이·연락처·날짜) | `text-body-03-normal-regular text-gray-500` (주 텍스트 아래 2줄째) |
| 컬럼 너비 | CSS grid 값: 고정 `120px`, 가변 `minmax(140px, 1fr)`, 비중 `2.5fr`. `width` 미지정 시 `1fr` 균등 |
| 정렬 | 텍스트=`left`, 진행률·상태·액션=`center`, 금액=`right` |
| 액션 컬럼 | `stopPropagation: true` 필수. 아이콘 버튼은 §2-7 클릭형 포커스 링 + `aria-label` |
| **실패·취소 행** | 텍스트 셀에 `line-through opacity-70` 추가. 색 토큰 교체 없이 opacity로만 dim. 상태 배지는 유지. 기준 구현: `PaymentHistoryTable`, `WeeklyScheduleLine`, `ScheduleLine` |

```svelte
<!-- 실패·취소 행 셀 패턴 (단일 셀) -->
{@const dimmed = status === 'failed' || status === 'cancelled'}
<span class="text-body-02-normal-regular text-gray-600 {dimmed ? 'line-through opacity-70' : ''}">
  {value}
</span>

<!-- 2줄 셀: 각 span에 개별 적용 -->
<div class="flex flex-col gap-0.5">
  <span class="text-body-02-normal-regular text-gray-600 {dimmed ? 'line-through opacity-70' : ''}">{primary}</span>
  <span class="text-body-03-normal-regular text-gray-400 {dimmed ? 'line-through opacity-70' : ''}">{secondary}</span>
</div>
```

> **2줄 셀 vs 단일 셀**: 한 엔티티의 식별 정보(이름+나이/연락처)는 한 셀에 2줄로 묶어 컬럼 수를 줄인다 — 가로 스캔 부담을 낮추는 게 콘텐츠 목록 밀도 관습이다. 별도 컬럼으로 펼치지 않는다.

---

### 4-3. Select

옵션 패널은 **portal로 body에 띄운다** — 모달·툴바 등 `overflow-hidden` 조상 안에서도
잘리지 않는다. 모달 안에서 드롭다운이 필요하면 직접 만들지 말고 이걸 쓴다(§4-9).

```svelte
<Select
  options={[{ value: 'done', label: '완료' }, { value: 'wait', label: '대기' }]}
  bind:value={filters.status}
  ariaLabel="상태"
  className="w-32"
/>
```

**Props**

| Prop | 타입 | 기본값 | 설명 |
|-----|------|-------|-----|
| `options` | `readonly { value: string \| number; label: string; desc?: string }[]` | — | 옵션 목록 (`as const` 가능) |
| `value` | `string \| number \| undefined` | — | 선택된 값 (bindable) |
| `onChange` | `(v: string \| number \| undefined) => void` | — | 변경 콜백. 해제 시 `undefined` |
| `placeholder` | `string` | `''` | 값이 없을 때 회색으로 표시 |
| `clearable` | `boolean` | `false` | 값이 있으면 chevron 자리에 X → 누르면 해제 |
| `fullWidth` | `boolean` | `false` | 래퍼까지 `w-full` (폼 필드용) |
| `className` | `string` | `''` | 트리거 버튼 클래스 |
| `menuClassName` | `string` | `''` | 패널 폭 지정 시 트리거 폭 추종을 끈다 |
| `disabled` | `boolean` | `false` | 비활성 |
| `ariaLabel` | `string` | `''` | 접근성 라벨 |

**`desc` — 2줄 옵션**

권한·역할처럼 "고르면 뭐가 달라지는지"가 선택에 직접 쓰이는 곳에만 준다.
단순 필터에는 쓰지 않는다(목록만 길어진다).

```svelte
<Select options={ROLE_OPTIONS} bind:value={role} fullWidth className="w-full" />
<!-- ROLE_OPTIONS = [{ value: 'clinician', label: '임상심리사', desc: '검사 수행 및 보고서 작성' }, …] -->
```

**열림 표시는 `ChevronToggle`**

통짜 chevron을 `rotate-180`으로 돌리면 아이콘이 "뒤집히는" 것으로 보인다.
`ChevronToggle`은 획 두 개가 평평한 `-`를 지나 반대로 꺾여, 펼침/접힘이라는
동작 자체를 보여준다. `open` prop으로 제어하며 `rotate-180`을 붙이지 않는다.

```svelte
<ChevronToggle {open} size={18} class="shrink-0 text-icon-secondary" />
```

> 회전축이 꼭짓점이라 획만 돌리면 도형이 한쪽으로 쏠린다(중심이 9.35/14.65로
> 갈리고 토글할 때 위아래로 튄다). 아이콘 내부에서 ±2.65 보정해 두 상태 모두
> 정중앙(12)에 오게 맞춰져 있다 — 획 길이나 각도를 바꾸면 이 값도 다시 계산한다.

**`clearable` — 선택 해제**

선택형(옵셔널) 필드는 목록에 '선택 안함' 항목을 넣지 말고 `clearable` + `placeholder`를 쓴다.
값이 있을 때만 X가 떠서 죽은 버튼이 생기지 않는다. **필수 항목에는 켜지 않는다.**

```svelte
<Select options={GENDER_OPTIONS} bind:value={gender}
  placeholder="선택 안함" clearable fullWidth className="w-full" />
```

---

### 4-3-1. FormField / 입력 필드 클래스

폼 한 줄(라벨 + 입력)의 표준. 라벨 크기·간격·필수 표시가 여기 한 곳에 있다.
**입력 요소 클래스를 손으로 쓰지 말고** `FIELD_INPUT_CLASS` / `FIELD_TEXTAREA_CLASS`를 쓴다.

```svelte
<script>
  import FormField, { FIELD_INPUT_CLASS, FIELD_TEXTAREA_CLASS }
    from '$components/ui/FormField.svelte'
</script>

<FormField label="이름" id="client-name" required>
  <input id="client-name" bind:value={name} class={FIELD_INPUT_CLASS} />
</FormField>

<!-- Select 등 네이티브 컨트롤이 아니면 id 생략 (label for로 못 묶는다) -->
<FormField label="성별">
  <Select options={GENDER_OPTIONS} bind:value={gender} clearable fullWidth className="w-full" />
</FormField>
```

| Prop | 설명 |
|-----|------|
| `label` | 라벨 텍스트 |
| `id` | 주면 `<label for>`로 연결. Select·커스텀 컨트롤은 생략 |
| `required` | 라벨 뒤 빨간 `*` |
| `note` | 라벨 **아래** 보조 설명 (예: "복수 선택 시 배터리로 등록됩니다") |
| `hint` | 입력 **아래** 보조 설명 |

**높이는 `h-11`(44) 하나로 통일한다** — `FIELD_INPUT_CLASS`·`Select`·`DatePickerInput`·
`PersonSelect`가 모두 같은 값이라 한 줄에 나란히 놓아도 밑변이 맞는다.
아이콘이 붙어 좌우 패딩이 필요하면 `twMerge(FIELD_INPUT_CLASS, 'pl-9')`로 덧쓴다.

**textarea는 `resize-none`이다**(FIELD_TEXTAREA_CLASS에 포함). 높이는 `rows`로 정한다 —
사용자가 손잡이로 늘리면 모달 레이아웃이 깨지고 바디 스크롤과 싸운다.

**placeholder 색은 `placeholder:text-gray-400`으로 고정**되어 있다. 지정하지 않으면
브라우저 기본값이라 입력마다 달라 보인다(Select·DatePicker의 빈 상태와도 어긋난다).

**세로 간격은 FormField가 flex gap으로 준다** — 자식에 `mt-*`/`mb-*`를 더하면
이중이 된다. 라벨→note는 `gap-1`, 라벨묶음→입력·입력→hint는 `gap-1.5`.

**보조 문구(note·hint)는 `FIELD_HELP_CLASS`(12px, label-02)**. `caption-01`은
**10px**이고 뱃지·아바타 이니셜 전용이라 읽는 문장에 쓰지 않는다.
(`text-caption-01-regular`라는 클래스는 존재하지 않는다 — 정확한 이름은
`text-caption-01-normal-regular`. 오타를 쓰면 크기가 아예 안 먹고 부모 15px을 물려받는다.)

---

### 4-3-2. PersonSelect

아바타(이름 이니셜) + 2줄 옵션이 붙는 **사람 선택** 드롭다운. 검사 등록의
내담자·검사자가 같은 모양이라 하나로 묶었다. 패널은 portal로 띄운다.

> 고르는 대상이 "사람"이면 PersonSelect, 그냥 값 목록이면 `Select`(§4-3).
> Select에는 아이콘 슬롯이 없다.

```svelte
<FormField label="내담자" required>
  <PersonSelect
    options={clientOptions}          {/* { id, name, sub? }[] */}
    bind:value={clientId}
    bind:selectedName={selectedClientName}
    searchable                        {/* 목록이 길 때 이름 검색 */}
    searchPlaceholder="내담자 이름을 검색하세요"
    emptyText="등록된 내담자가 없습니다"
  />
</FormField>
```

| Prop | 설명 |
|-----|------|
| `options` | `{ id, name, sub? }[]` — `sub`는 생년월일·역할 등 보조줄 |
| `value` / `selectedName` | 둘 다 bindable. 이름을 따로 두어 목록 로딩 전에도 칩을 그린다 |
| `searchable` | 입력창으로 이름 필터 (기본 false → 버튼형 트리거) |
| `locked` | 값 고정, X 숨김 (예: 임상심리사 본인 자동 지정) |
| `tone` | 아바타 색 `primary`(내담자) / `blue`(검사자) |

---

### 4-4. SearchDropdown

제네릭 타입 T를 지원하는 검색형 드롭다운. 자유 텍스트 검색 + 항목 선택이 필요할 때 사용.

```svelte
<SearchDropdown
  items={memberList}
  filterFn={(item, query) => item.name.includes(query)}
  onSelect={handleSelect}
>
  {#snippet itemSnippet({ item })}
    <span>{item.name}</span>
  {/snippet}
</SearchDropdown>
```

---

### 4-4-1. Tabs (마인드봄 공용)

```svelte
<Tabs
  tabs={[{ value: 'exams', label: '검사 이력', count: 3 }, { value: 'reports', label: '종합보고서' }]}
  selected={activeTab}
  onChange={(v) => (activeTab = v)}
  size="sm"          {/* 목록 위 촘촘한 헤더일 때 */}
  fixedWidth={false} {/* 라벨이 길면 내용폭에 맞춤 */}
/>
```

| Prop | 기본값 | 설명 |
|-----|-------|-----|
| `tabs` | 필수 | `{ value, label, count? }[]` |
| `selected` / `onChange` | 필수 | 활성 값과 변경 콜백 |
| `shape` | `'underline'` | `'segmented'`는 pill 형태 |
| `size` | `'md'` | `md`=상하 20(정본) / `sm`=상하 10 + 라벨 15 |
| `fixedWidth` | `true` | 셀 너비 140 고정. 라벨이 길면 `false` |

**활성 표시는 미끄러진다.** 밑줄을 각 버튼 안에 그리면 탭을 바꿀 때 지워졌다 새로
생겨 "툭" 튄다. 트랙에 하나만 띄우고 활성 버튼의 위치·너비를 좇게 한다
(`left`/`width`를 함께 전환하므로 폭이 다른 탭 사이에서도 늘고 주는 게 보인다).

- 측정은 `getBoundingClientRect` + `ResizeObserver` — 리사이즈뿐 아니라 **웹폰트가
  적용돼 글자폭이 변할 때**도 따라붙어야 하므로 버튼도 함께 관찰한다.
- **첫 배치까지는 전환을 끈다**(`ready`). 0에서 출발하면 진입하자마자 밑줄이 왼쪽
  끝에서 미끄러져 들어오는데, 사용자는 탭을 누른 적이 없다.
- `motion-reduce:transition-none`으로 동작 최소화 설정을 존중한다.

> `segmented`에는 이동 인디케이터를 쓰지 않는다 — 비활성 pill만 1px 보더를 갖는
> 구조라 채움이 미끄러지면 글자가 1px씩 밀린다. 색 전환으로 둔다.

---

### 4-5. TabBar

```svelte
<TabBar
  tabs={[{ value: 'all', label: '전체', count: 42 }, { value: 'pending', label: '대기' }]}
  activeTab={filters.tab}
  onTabChange={(tab) => filters.changeTab(tab)}
/>
```

**Props**

| Prop | 타입 | 기본값 | 설명 |
|-----|------|-------|-----|
| `tabs` | `{ value: string; label: string; count?: number }[]` | 필수 | |
| `activeTab` | `string` | 필수 | 활성 탭 값 (**bindable** — `bind:activeTab` 또는 `onTabChange` 중 하나) |
| `onTabChange` | `(tab: string) => void` | — | |
| `showViewToggle` | `boolean` | `false` | 리스트/그리드 토글 |
| `viewType` | `'list' \| 'grid'` | `'list'` | **bindable** |
| `onViewChange` | `(view) => void` | — | |
| `showSort` | `boolean` | `false` | 정렬 Select 표시 |
| `sort` | `string` | `'desc'` | **bindable** |
| `sortOptions` | `{ value: string; title: string }[]` | — | |
| `onSortChange` | `(sort: string) => void` | — | |
| `class` | `string` | — | |

**시각적 특성**:
- 컨테이너: `border-b border-gray-200`
- 활성 탭: `text-primary-400`
- 비활성 탭: `text-gray-400`
- 슬라이딩 인디케이터: `h-0.5 bg-primary-500` (ResizeObserver + getBoundingClientRect 기반)

---

### 4-6. SegmentTab

N개 항목을 지원하는 animated pill 탭 컴포넌트. pill 배경이 선택 항목 위치로 translate되는 시각 효과.

```svelte
<!-- prop은 items(=options 아님) + selected(단방향) + onChange. bind:selected 아님 -->
<SegmentTab
  items={[{ value: 'monthly', label: '월간' }, { value: 'weekly', label: '주간' }]}
  selected={period}
  onChange={(v) => (period = v)}
/>
```

| Prop | 타입 | 기본값 | 설명 |
|-----|------|-------|-----|
| `items` | `{ value: string; label: string }[]` | `[]` | 항목 목록 (`options` 아님) |
| `selected` | `string` | `''` | 선택값 — **단방향**(bindable 아님). 변경은 `onChange`로 받아 직접 갱신 |
| `onChange` | `(value: string) => void` | — | 선택 변경 콜백 |
| `class` | `string` | — | 컨테이너 클래스 |

> ⚠ `selected`는 `$bindable`이 아니므로 `bind:selected`가 동작하지 않는다 — `onChange`로 값을 받아 상위에서 `period = v`로 갱신한다.

**SegmentTab vs SegmentToggle 선택 기준**:

| | SegmentTab | SegmentToggle |
|--|------------|---------------|
| 항목 수 | 2개 이상 (동적) | 정확히 2개 |
| 높이 | `h-11` | `h-12` |
| 인디케이터 | animated pill translateX | border + 배경색 |
| 사용 맥락 | 기간 선택, 뷰 전환 | 이진 토글 |

---

### 4-7. FilterTabs

탭 + 검색 + 칩 필터를 조합한 복합 필터 컴포넌트. 페이지 상단 전용 필터 바로 사용.

> **주의**: 현재 `border-[#4C87F6]`, `text-[#256EF4]` 하드코딩 hex를 사용 중 (기술 부채). 이 컴포넌트를 직접 수정할 때는 `border-primary-500`, `text-primary-500`으로 교체한다.

---

### 4-8. Pagination

> **현황**: Svelte 4 문법 사용 중. `currentPage`는 양방향 바인딩.

```svelte
<Pagination
  totalItems={total}
  itemsPerPage={20}
  bind:currentPage={filters.page}
  maxVisiblePages={5}
/>
```

| Prop | 타입 | 기본값 |
|-----|------|-------|
| `totalItems` | `number` | `0` |
| `itemsPerPage` | `number` | `10` |
| `currentPage` | `number` | `1` |
| `maxVisiblePages` | `number` | `5` |

**배치 표준**:

```svelte
{#if rows.length > 0 && total > pageSize}
  <div class="mt-4 flex shrink-0 justify-center">
    <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage={filters.page} />
  </div>
{/if}
```

---

### 4-9. Modal (BaseModal)

#### 구조

```svelte
<BaseModal
  {modalId}
  size="lg"
  title="모달 제목"
  showHeaderBorder={true}
  showFooterBorder={true}
  headerClass="px-6 py-5"
  bodyClass="px-6 py-5"
  footerClass="px-6 py-5"
>
  {#snippet body()}
    <!-- 본문 -->
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <button onclick={close} class="h-12 w-30 rounded-lg bg-gray-100 hover:bg-gray-200
        text-body-01-normal-medium text-gray-700">취소</button>
      <button onclick={submit} class="h-12 w-35 rounded-lg bg-primary-500 hover:bg-primary-400
        text-body-01-normal-medium text-white">저장</button>
    </div>
  {/snippet}
</BaseModal>
```

**size 목록**

| size | 너비 | 용도 |
|------|------|------|
| `sm` | `max-w-sm` | 간단한 확인 다이얼로그 |
| `md` | `max-w-md` | 단순 폼 (미지정/미매핑 시 fallback) |
| `lg` | `max-w-lg` | 표준 폼 모달 |
| `xl` | `max-w-xl` | 넓은 폼 |
| `wide` | `max-w-4xl` | 복합 레이아웃 |
| `fit` | `max-w-fit mx-4` | 콘텐츠 너비에 맞춤 |
| `full` | `max-w-full mx-4` | 전체 화면 |

> `ModalOptions.size` 타입과 `ModalContainer.sizeClasses`는 **같은 7개**로 맞춰져 있다(2026-08-19). 한쪽에만 값을 추가하면 매핑이 없는 쪽이 조용히 `md`로 떨어지니 항상 함께 고친다.

#### 등장·퇴장 전환

`ModalContainer`가 준다 — 모달 본문에서 따로 걸지 않는다.

| 대상 | 들어올 때 | 나갈 때 |
|---|---|---|
| 백드롭 | `fade` 220ms · cubicOut | `fade` 180ms · cubicIn |
| 카드 | `scale` 220ms · cubicOut · 0.96→1 | `scale` 160ms · cubicIn |

**들어올 때가 나갈 때보다 길다.** 열림은 눈이 따라갈 대상이라 여유를 주고, 닫힘은
이미 끝난 동작이라 끌면 답답하다. easing도 그에 맞춰 갈린다(cubicOut은 빠르게 시작해
부드럽게 멈추고, cubicIn은 천천히 시작해 빠르게 사라진다).

카드 시작값 `0.96`은 1에 가깝게 잡은 것이다 — 더 낮추면 "튀어나오는" 느낌이 나서
백드롭과 리듬이 어긋난다.

`prefers-reduced-motion: reduce`면 duration을 0으로 떨어뜨린다(요소를 분기시키지
않고 전환만 즉시 끝냄 — 분기하면 스택·포커스 처리가 두 벌이 된다).

#### 스크롤 — 어디가 스크롤하는가

바깥 카드(`ModalContainer`)는 `overflow-hidden`이고, **스크롤은 BaseModal의 바디만** 한다.
그래서 헤더·푸터가 고정된다. 카드에 `overflow-y-auto`를 되돌리면 헤더/푸터까지 같이
밀려 올라가므로 넣지 않는다.

바디의 `min-h-0`은 장식이 아니다 — flex 자식의 기본 `min-height:auto`는 내용만큼
부풀어서 스크롤이 생기지 않고, 대신 모달 전체가 늘어나 푸터가 화면 밖으로 나간다.

#### ⚠ 모달 안의 드롭다운은 반드시 portal

카드가 `overflow-hidden`이라 `absolute` 패널은 **잘린다**. 공용 `Select`·`DatePickerInput`은
이미 portal로 띄우므로 그대로 쓰면 되고, 직접 만들 때도 `use:portal`에
`zIndex: Z_LAYER.portalDropdown`을 준다(§2-6, `positionPortal.ts`).

**padding 표준**:
- 기본: `headerClass="px-6 py-5"`, `bodyClass="px-6 py-5"`, `footerClass="px-6 py-5"`
- 섹션 구분 필요 시: `bodyClass="p-0!"` + 내부 섹션마다 `px-6 py-5`
- `px-8`은 특수 레이아웃 외 사용 금지

**footer 버튼 정렬**:
- 기본: `justify-end` (취소 왼쪽, 확인 오른쪽)
- 삭제 버튼이 있으면: `justify-between` (삭제 왼쪽, 취소/확인 오른쪽)

**중첩 모달(Stacked Modal)**: `modalStore.updateModalOptions`로 런타임 size/width 변경 가능.

---

### 4-10. NoDataSection

```svelte
<NoDataSection description="청구 내역이 없어요">
  {#snippet actions()}
    <Button color="primary" size="md" onclick={openCreateModal}>새로 만들기</Button>
  {/snippet}
</NoDataSection>
```

| Prop | 타입 | 기본값 |
|-----|------|-------|
| `description` | `string` | `'일치하는 검사가 없어요'` — **반드시 컨텍스트에 맞게 지정** |
| `actions` | `Snippet` | — |

**필수 규칙**:
1. `description`은 반드시 명시한다. 기본값 그대로 노출 금지. 문구는 §5-14 표준표(`아직 등록된 {대상}이 없어요` / 검색 결과는 `…결과가 없어요. 필터를 초기화해보세요.`).
2. write 권한이 있는 역할에서는 `actions` snippet에 CTA 버튼을 포함한다.
3. 필터/검색 결과 없음: description에 초기화 안내 포함 + 초기화 버튼 CTA.
4. 빈 상태 텍스트를 `<p>` 직접 렌더링 금지 — 항상 `NoDataSection` 컴포넌트 사용.

**배치 표준**:

```svelte
<!-- 전체 높이 -->
<div class="flex-center h-full">
  <NoDataSection description="..." />
</div>

<!-- 섹션 내부 -->
<div class="flex-center py-16">
  <NoDataSection description="..." />
</div>
```

---

### 4-11. PageTitleSection

```svelte
<PageTitleSection title="직원 관리" description="기관 구성원을 관리합니다">
  {#snippet actions()}
    <Button variant="primary" size="md" onclick={openInviteModal}>직원 초대</Button>
  {/snippet}
</PageTitleSection>
```

| Prop | 타입 | 설명 |
|-----|------|-----|
| `title` | `string` | 필수 |
| `description` | `string` | 제목 아래 한 줄 설명 |
| `actions` | `Snippet` | 우상단 액션(등록 버튼 등) |
| `class` | `string` | 기본 `mb-4` 위에 덧씀 |

- 제목: `text-headline-01-normal-semibold`
- 영역 높이 `min-h-11`(44) + `shrink-0` — 세로 flex 안에서 눌리지 않게 하는 필수 조건
- **부제는 `text-body-03-reading-regular`**(line-height 150%). `normal`은 line-height가
  글자 크기와 같아(14px) 위아래 여백이 0이라 제목에 붙어 보인다. 간격이 좁다고
  `mt`를 키우면 타이틀 영역 높이가 흔들리므로 **행간으로 준다**. 대시보드 헤더도 같은 값.
- **신규 페이지 권장 진입점.** 단 §1-2(현실 우선)에 따라 인라인 `div + h1`(`text-headline-01-normal-bold`) 헤더도 **허용**한다. **금지되는 건 헤더 골격 없이 `<span class="text-headline-…">`만 두는 우회뿐**(아래 §5-1 BAD)

---

### 4-12. Checkbox

```svelte
<Checkbox
  id="my-check"
  bind:checked={value}
  onchange={handler}
  checkedClass="text-primary-500"   <!-- 커스텀 체크 색상 -->
/>
```

Table 컴포넌트 내부에서 `showCheckbox={true}` 시 자동 사용.
접근성: `aria-label` 또는 연결된 `<label>` 필수. ⚠ `appearance-none` 박스라 네이티브 포커스 링이 없다 — 키보드 포커스 가시성을 위해 `focus-visible:ring-2`(§2-7)를 box 클래스에 추가한다(현재 미적용, 부채).

---

### 4-13. Switch

```svelte
<Switch
  bind:checked={enabled}
  ariaLabel="알림 활성화"
/>
```

**Props**: `checked`(bindable) · `ariaLabel` · `disabled` · `onclick` · `className`. ⚠ prop명은 `ariaLabel`(camelCase)이며 `aria-label`이 아니다.

**시각적 스펙**:
- checked: `bg-primary-500` (브랜드 컬러) — ⚠ **현재 코드는 `bg-blue-500`(부채 P0). 수정 대상**
- unchecked: `bg-gray-300`
- 트랙: `h-6 w-11 rounded-full`
- thumb: `h-4 w-4 rounded-full bg-white`
- 이동 거리: checked → `translate-x-6`, unchecked → `translate-x-1`
- disabled: `cursor-not-allowed opacity-50`

> **접근성 (L1 — 미충족 결함)**: 토글의 표준 시맨틱은 `role="switch" aria-checked={checked}`다. **현재 `Switch.svelte`는 `aria-label`만 있고 `role`/`aria-checked`가 없다** → 스크린리더가 on/off 상태를 읽지 못함. 이는 다수파여도 채택하지 않는 *버그*(§1-2)이며, 컴포넌트 수정 시 추가한다(→ 부록 P0).

---

### 4-14. NameChip

이름 기반 선택 칩. 내담자/상담사 선택 UI에서 사용.

```svelte
<NameChip
  name="홍길동"
  isActive={selected}
  onClick={handleSelect}
/>
```

| Prop | 타입 | 기본값 |
|-----|------|-------|
| `name` | `string` | 필수 |
| `isActive` | `boolean` | `false` |
| `onClick` | `() => void` | — |

- 활성: `border-primary-500 bg-primary-500 text-white`
- 비활성: `border-gray-200 bg-white text-gray-700`

---

### 4-15. Snackbar (Toast)

직접 렌더링하지 않고 `snackbarStore`를 통해 호출한다.

```typescript
import { snackbarStore } from '$lib/stores/snackbar'

snackbarStore.success('저장되었어요.')   // 해요체 — §5-14
snackbarStore.error('데이터를 불러오지 못했어요.')
snackbarStore.info('알림 메시지')
snackbarStore.warning('주의사항')
```

- z-index: `20000` (최상위 레이어)
- **API·제출 응답**(성공/서버 에러)은 Snackbar로 처리. 단 *제출 전 필드 검증*은 inline `<p>`가 표준이며 모순 아님(경계는 §5-5)
- 색상은 컴포넌트가 type(`success`/`error`/`info`/`warning`)별로 자체 정의한다 — 페이지에서 지정하지 않는다. `info`(파랑)·`warning`(노랑) 계열은 §2-2 상태 4색에 없는 토스트 전용 톤이며 **§2-2 적용 대상이 아니다**(상태 4색은 배지·인라인 상태 텍스트용). 현재 이 색들은 토큰 밖 값이라 부록 참조
- **문구는 §5-14 보이스 표준(해요체)을 따른다.** 위 예시는 형태만 보여줄 뿐, 실제 문구는 표준표에서 가져온다

---

## 5. 패턴 가이드

5-1 [페이지 헤더](#5-1-페이지-헤더-패턴) · 5-2 [필터 바](#5-2-필터-바-패턴) · 5-3 [테이블 페이지 구조](#5-3-테이블-페이지-전체-구조) · 5-4 [상세 사이드 패널](#5-4-상세-사이드-패널-패턴) · 5-5 [폼 섹션](#5-5-폼-섹션-패턴) · 5-6 [로딩 상태](#5-6-로딩-상태-패턴) · 5-7 [에러 상태](#5-7-에러-상태-패턴) · 5-8 [빈 상태](#5-8-빈-상태-empty-state-패턴) · 5-9 [모달 내 폼](#5-9-모달-내-폼-패턴) · 5-10 [확인/취소 다이얼로그](#5-10-확인취소-다이얼로그-패턴) · 5-11 [배지/상태 태그](#5-11-배지상태-태그-패턴) · 5-12 [카드 컴포넌트](#5-12-카드-컴포넌트-패턴) · 5-13 [3점 메뉴 드롭다운](#5-13-3점-메뉴-드롭다운-패턴) · 5-14 [⭐ 마이크로카피·한글 보이스](#5-14--마이크로카피한글-보이스-표준)

### 5-1. 페이지 헤더 패턴

**권장** (신규 페이지 진입점):

```svelte
<PageTitleSection title="페이지 제목" className="mb-6">
  {#snippet extraBtn()}
    <Button color="primary" size="md" onclick={openCreateModal}>추가하기</Button>
  {/snippet}
</PageTitleSection>
```

```
OK: PageTitleSection + mb-6  (semibold, 권장)
OK: <div class="mb-6 flex items-center justify-between"><h1 class="text-headline-01-normal-bold text-gray-800">제목</h1> <Button .../></div>
    — §1-2: 인라인 헤더(bold)는 기준 화면 다수파 → 허용. weight가 PageTitleSection(semibold)과 다름만 주의
BAD: <span class="text-headline-01-normal-semibold">제목</span>  (헤더 골격 없이 span만 — 우회, mb-6/우측 버튼 자리 없음)
BAD: <h1 class="text-headline-01-nomal-bold">  (오타 토큰 — §1-2 버그, normal로 수정)
BAD: <svelte:fragment slot="extraBtn">...</svelte:fragment>  (Svelte 4 slot, deprecated)
```

---

### 5-2. 필터 바 패턴

```svelte
<div class="mb-3 flex flex-wrap items-center gap-3">
  <!-- 검색창: 항상 h-11 -->
  <div class="flex h-11 w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4">
    <SearchIcon class="h-5 w-5 shrink-0 text-gray-400" />
    <input type="text" bind:value={filters.search}
      placeholder="검색어를 입력해주세요"
      class="text-body-02-normal-regular w-full bg-transparent outline-none placeholder:text-gray-400" />
  </div>

  <!-- Select 필터: h-11, showActiveHighlight 필수 -->
  <Select class="h-11 w-32 rounded-lg" options={statusOptions}
    bind:selected={filters.status}
    showActiveHighlight={true}
    defaultValue="전체"
    on:change={(e) => (filters.status = e.detail)} />

  <!-- 초기화 버튼: h-11 w-11 (클릭형 → focus-visible 링, §2-7) -->
  <button
    class="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
    onclick={filters.reset}
    aria-label="필터 초기화">
    <RefreshIcon class="h-5 w-5 text-gray-400" />
  </button>
</div>
```

**표준 수치**:
- 컨테이너 gap: `gap-3`
- 검색 input 높이: `h-11` (44px)
- 초기화 버튼: `h-11 w-11`
- 필터 Select 높이: `h-11`
- 필터 적용 표시: `showActiveHighlight={true}` + `defaultValue` 설정 필수

---

### 5-3. 테이블 페이지 전체 구조

섹션 3-2의 목록 페이지 패턴 참조. 핵심 순서:
1. PageTitleSection (`mb-6`)
2. 필터 바 (`mb-3`, `gap-3`, `h-11`)
3. TabBar (선택)
4. 카운트 + 정렬 (`my-2.5 flex items-center justify-between`)
5. 테이블 영역 (`flex min-h-0 flex-1 flex-col`)
   - 로딩 → 에러 → 데이터 → 빈 상태 순서로 분기
   - **콘텐츠 목록이면 도메인 테이블 컴포넌트**(예: `<AssessmentCaseTable data={rows} ... />`)를 렌더한다. 페이지는 컬럼·셀을 모른다 — generic `<Table>` + 인라인 컬럼 정의를 페이지에 두지 않는다(§4-2 레시피·§1-2 🔴).
   - 도메인 테이블은 래퍼(`rounded-lg border ... overflow-hidden`)를 자체 포함하므로 페이지에서 다시 감싸지 않는다.
6. 페이지네이션 (`mt-4 flex shrink-0 justify-center`)

> **밀도 기준**: 콘텐츠 목록 행 높이는 `h-[64px]`(2줄 셀 수용)이 다수파다. 셀·정렬·2줄 셀 관습은 §4-2 「셀·행 밀도 관습」 표를 따른다.

---

### 5-4. 상세 사이드 패널 패턴

```svelte
<div class="xl:grid xl:grid-cols-[1fr_360px] xl:gap-6 h-full">
  <!-- 메인 영역 -->
  <div class="flex flex-col min-h-0 overflow-auto">
    ...
  </div>

  <!-- 사이드 패널 -->
  <div class="rounded-lg border border-gray-200 bg-white p-6">
    ...
  </div>
</div>
```

패널 내부 섹션 구분:
```svelte
<div class="border-t border-gray-100 mt-6 pt-6">
  <h3 class="text-body-01-normal-semibold text-gray-700 mb-3">섹션 제목</h3>
  ...
</div>
```

---

### 5-5. 폼 섹션 패턴

```svelte
<div class="space-y-4">
  <!-- 필드 -->
  <div>
    <label for="name" class="block text-body-01-normal-medium text-gray-700 mb-2">
      이름 <span class="text-red-500">*</span>
    </label>
    <input
      id="name"
      type="text"
      bind:value={form.name}
      aria-invalid={!!errors.name}
      aria-describedby={errors.name ? 'name-error' : undefined}
      class="h-11 w-full rounded-lg border border-gray-200 px-4
        focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400
        {errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}"
    />
    <!-- 에러 메시지: min-h-4로 공간 항상 확보 -->
    <p id="name-error" class="mt-1 min-h-4 text-xs text-red-500">
      {errors.name ?? ''}
    </p>
  </div>

  <!-- textarea -->
  <div>
    <label class="block text-body-01-normal-medium text-gray-700 mb-2">메모</label>
    <textarea
      bind:value={form.note}
      class="h-30 min-h-30 w-full resize-none rounded-lg border border-gray-200 p-4
        focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
    />
  </div>

  <!-- 관련 필드 2열 배치 -->
  <div class="grid grid-cols-2 gap-2">
    <div>...</div>
    <div>...</div>
  </div>
</div>
```

**필드 표준**:
- label: `block text-body-01-normal-medium text-gray-700 mb-2`
- input 높이: `h-11`
- 정상 테두리: `border-gray-200 focus:border-primary-400 focus:ring-1 focus:ring-primary-400`
- 에러 테두리: `border-red-500 focus:border-red-500 focus:ring-red-200`
- 에러 메시지: `mt-1 min-h-4 text-xs text-red-500` (공간 항상 확보)
- 접근성: 에러 시 `aria-invalid={true}` + `aria-describedby`로 에러 `<p>`의 `id` 연결(스크린리더가 에러를 읽음)

> **inline 필드 에러 vs Snackbar 경계**: "모든 에러는 Snackbar"(§4-15)는 **API·제출 실패**에 적용된다. **제출 전 필드 단위 검증**(필수값·형식)은 위 inline `<p>` + `aria-invalid`로 표시하는 것이 표준이며 모순이 아니다. 즉 inline은 *필드 검증*, Snackbar는 *서버 응답 에러*다.

---

### 5-6. 로딩 상태 패턴

```svelte
<!-- 전체 페이지 초기 로딩 -->
<div class="flex-center h-full">
  <p class="text-body-01-reading-regular text-gray-400">로딩 중...</p>
</div>

<!-- 섹션 단위 로딩 -->
<div class="flex-center py-12">
  <p class="text-body-01-reading-regular text-gray-400">로딩 중...</p>
</div>

<!-- 모달 내부 로딩 (스피너 사용) -->
<div class="flex-center flex-col gap-3 py-8">
  <div class="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-500"></div>
  <p class="text-body-02-normal-regular text-gray-400">로딩 중...</p>
</div>
```

**문구**: §5-14 표준표(`로딩 중...`). `불러오는 중...`도 허용하나 **한 화면 안에서는 하나로 통일**하며, 기존 문구 일괄 교체는 하지 않는다.
**표준 variant**: `text-body-01-reading-regular text-gray-400`
모달 내부에서만 스피너 사용. 일반 페이지는 텍스트만.

---

### 5-7. 에러 상태 패턴

queryBuilder를 사용하는 모든 페이지는 `isError` 분기를 필수로 구현한다.

```svelte
{:else if isError}
  <div class="flex-center h-full flex-col gap-3">
    <p class="text-body-01-reading-regular text-gray-500">데이터를 불러오지 못했어요.</p>
    <button
      onclick={() => queryClient.invalidateQueries({ queryKey: [...] })}
      class="rounded-lg border border-gray-200 px-4 py-2 text-body-02-normal-medium
        text-gray-600 hover:bg-gray-50 focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2">
      다시 시도
    </button>
  </div>
```

에러 세부 메시지는 `snackbarStore.error()`로 병행 표시. 문구는 §5-14 표준표(`데이터를 불러오지 못했어요.` / 재시도 버튼 `다시 시도`).

---

### 5-8. 빈 상태 (Empty State) 패턴

```svelte
<!-- 데이터 없음 + write 권한 사용자 -->
<div class="flex-center h-full">
  <NoDataSection description="아직 등록된 상담실이 없어요">
    {#snippet actions()}
      {#if canWrite}
        <Button color="primary" size="md" onclick={openCreateModal}>상담실 추가하기</Button>
      {/if}
    {/snippet}
  </NoDataSection>
</div>

<!-- 검색/필터 결과 없음 -->
<div class="flex-center h-full">
  <NoDataSection description="검색 조건에 맞는 결과가 없어요. 필터를 초기화해보세요.">
    {#snippet actions()}
      <button onclick={filters.reset}
        class="text-body-02-normal-medium text-primary-500 hover:underline">
        필터 초기화
      </button>
    {/snippet}
  </NoDataSection>
</div>
```

---

### 5-9. 모달 내 폼 패턴

라벨·입력 높이는 `FormField`(§4-3-1)가 잡는다. 푸터는 BaseModal이 이미
`flex justify-end gap-2`라 버튼만 넣으면 되고, 버튼은 `Button`(§4-1)을 쓴다.

```svelte
<BaseModal {closeModal} title="내담자 등록" description="내담자 정보를 입력해주세요">
  {#snippet body()}
    <form class="flex flex-col gap-4" onsubmit={(e) => { e.preventDefault(); submit() }}>
      <FormField label="이름" id="client-name" required>
        <input id="client-name" bind:value={name} class={FIELD_INPUT_CLASS} />
      </FormField>

      <FormField label="성별">
        <Select options={GENDER_OPTIONS} bind:value={gender}
          placeholder="선택 안함" clearable fullWidth className="w-full" />
      </FormField>
    </form>
  {/snippet}

  {#snippet footer()}
    <Button variant="outlineSecondary" size="md" onclick={closeModal}>취소</Button>
    <Button variant="primary" size="md"
      loading={isSubmitting} disabled={!isValid} onclick={submit}>
      등록
    </Button>
  {/snippet}
</BaseModal>
```

> 제출 버튼은 `<form>` **밖**(푸터)에 있으므로 `type="submit"`이 아니라
> `onclick`으로 핸들러를 직접 부른다. form의 `onsubmit`은 Enter 키 제출용으로 남긴다.

**모달 제출 버튼 pending 표준**:
- API 호출 중 `disabled` + 인라인 스피너 표시 (중복 제출 방지 필수)
- Button 컴포넌트 사용 시 `loading={isSubmitting} disabled={isSubmitting}` prop 전달
- 버튼 텍스트는 변경하지 않는다 (예: '저장 중...' 변경 금지)

---

### 5-10. 확인/취소 다이얼로그 패턴

비가역적 액션(삭제, 복구 불가 상태 변경)은 반드시 확인 다이얼로그를 거친다. 제목·설명·성공 토스트 문구는 §5-14 표준표를 따른다(`삭제하시겠어요?` / `삭제된 데이터는 복구할 수 없어요.` / `삭제되었어요.`).

**컴포넌트 선택 기준**:

| 상황 | 컴포넌트 |
|-----|---------|
| 단순 삭제 | `DeleteConfirmModal` (title/description만) |
| 사유 입력 필요 | `CancelConfirmModal` |
| 복합 경고, 항목 나열 | `ConfirmModal` (type='danger', items 배열) |

```typescript
// 서비스에서 삭제 호출 패턴
const deleteItem = (id: string) => {
  modalStore.open({
    component: DeleteConfirmModal,
    props: {
      title: '삭제하시겠어요?',
      description: '삭제된 데이터는 복구할 수 없어요.',
      onConfirm: async () => {
        await deleteAction({ centerId: requireCenterId(), id })
        snackbarStore.success('삭제되었어요.')
        invalidateList()
      }
    },
    options: { size: 'sm' }
  })
}
```

---

### 5-11. 배지/상태 태그 패턴

```svelte
<!-- 표준 상태 배지 -->
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
  {statusColor}">
  {statusLabel}
</span>
```

`statusColor`는 ViewModel에서 완성된 클래스로 제공한다. **배경+텍스트 쌍은 §2-2 4색 정본의 "연한 배지" 가중치를 그대로 쓴다**(green/amber=`-700`, red=`-600`, gray=`-500`). off-palette(orange·emerald·yellow) 금지.

```typescript
// view-model.ts — §2-2 정본 쌍만 사용
const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  pending:   'bg-amber-50 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
  overdue:   'bg-red-50 text-red-600',
}
```

> 배지 텍스트는 `text-xs`(12px)로 작다 — §2-2 대비 최소선에 따라 **`-50` 배경 위에서는 위 진한 가중치만** 쓰고 `-400` 이하 옅은 색은 쓰지 않는다. 상태는 색과 **라벨 텍스트를 함께** 전달한다(색각 이상 대응).

---

### 5-12. 카드 컴포넌트 패턴

```svelte
<!-- 클릭 가능한 카드 -->
<div
  class="flex w-full cursor-pointer flex-col rounded-lg bg-white p-4
    ring-1 ring-inset ring-gray-200 duration-200 hover:ring-primary-400 hover:shadow-md"
  role="button"
  tabindex="0"
  onclick={handleClick}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
>
  <!-- 상단: 상태 배지 + 3점 메뉴 -->
  <div class="mb-2 flex items-center justify-between">
    <span class="...statusBadge">상태</span>
    <div class="relative">
      <button class="rounded p-1 hover:bg-gray-50" onclick={(e) => { e.stopPropagation(); openMenu() }}>
        <HorizontalityDotsIcon />
      </button>
      <!-- 드롭다운 메뉴 -->
    </div>
  </div>

  <!-- 정보 행들 -->
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <span class="text-body-02-normal-regular text-gray-600 shrink-0">라벨</span>
      <span class="text-body-02-normal-regular text-gray-800 truncate">값</span>
    </div>
  </div>

  <!-- 섹션 구분선 -->
  <hr class="border-gray-100 my-3" />
</div>
```

**접근성 필수**: `role="button"`, `tabindex="0"`, `onkeydown` 핸들러 (Enter/Space).

---

### 5-13. 3점 메뉴 드롭다운 패턴

```svelte
<div class="relative">
  <button
    class="rounded p-1 hover:bg-gray-50 focus-visible:outline-none
      focus-visible:ring-2 focus-visible:ring-primary-400"
    onclick={(e) => { e.stopPropagation(); toggleMenu() }}
    aria-label="메뉴 열기">
    <HorizontalityDotsIcon class="h-5 w-5 text-gray-400" />
  </button>

  {#if isMenuOpen}
    <div class="absolute right-0 top-full z-10 mt-1 min-w-30 rounded-lg
      border border-gray-200 bg-white shadow-md py-1">
      <button class="flex w-full items-center gap-2 px-3 py-2
        text-body-02-normal-regular text-gray-700 hover:bg-gray-50"
        onclick={handleEdit}>수정</button>
      <button class="flex w-full items-center gap-2 px-3 py-2
        text-body-02-normal-regular text-red-500 hover:bg-red-50"
        onclick={handleDelete}>삭제</button>
    </div>
  {/if}
</div>
```

---

### 5-14. ⭐ 마이크로카피·한글 보이스 표준

> 로딩·빈상태·에러·확인·토스트·placeholder 문구의 **단일 표준 출처**다. 각 패턴(§5-6~5-10, §4-15, §6-1)은 형태만 보여주고 문구는 여기를 따른다.

#### 보이스 — 한 화면, 한 톤

- **사용자에게 보이는 모든 UI 문구는 해요체**(`~어요`/`~아요`/`~예요`)로 쓴다. **존댓말·능동·간결.**
- 현실 보정(§1-2): 코드의 placeholder·빈상태는 사실상 전부 해요체이고, 토스트만 해요체/합쇼체가 반반(`습니다` 161 / `어요` 135)으로 섞여 있다. **해요체를 표준으로 단일화**한다 — 합쇼체(`~되었습니다`)는 틀린 게 아니라 *톤 불일치*이므로, 신규 코드는 해요체로 쓰고 기존 합쇼체는 해당 화면을 손댈 때 정리한다(일괄 교체 대상 아님).
- 문장부호: 평서문은 마침표 1개 또는 생략(둘 다 허용, 한 화면 내 통일). **느낌표는 축하 성격(가입 완료·추가 완료 등)에만 최소 사용**, 에러·경고엔 금지.
- 띄어쓰기: `입력해주세요`·`검색해주세요`·`다시 시도해주세요`처럼 **`~해주세요`를 붙여** 쓴다(코드 다수파).
- 금지: `에러가 발생하였습니다` 같은 합쇼체 과거형, `~하십시오`/`~하시기 바랍니다` 같은 격식체, 영문 잔재(`Loading...`, `No data`), 기술 용어 노출(`null`, `undefined`, status code 그대로).

#### 표준 문구표 (이 문구를 우선 사용)

| 맥락 | 표준 문구 | 비고 |
|-----|---------|------|
| 로딩 | `로딩 중...` | §5-6. `불러오는 중...`도 허용하나 화면 내 통일 |
| 조회 실패(영역) | `데이터를 불러오지 못했어요.` | §5-7. 재시도 버튼 `다시 시도` 병행 |
| 빈 상태(데이터 없음) | `아직 등록된 {대상}이 없어요` / `{대상}이 없어요` | §5-8·§4-10. `description` 필수 지정 |
| 빈 상태(검색·필터) | `검색 조건에 맞는 결과가 없어요. 필터를 초기화해보세요.` | 초기화 CTA 병행 |
| placeholder(입력) | `{대상}을 입력해주세요` | 예: `이름을 입력해주세요` |
| placeholder(검색) | `{대상}을 검색해주세요` / `이름, 검사 코드로 검색` | |
| 삭제 확인 제목 | `삭제하시겠어요?` | §5-10 |
| 삭제 확인 설명 | `삭제된 데이터는 복구할 수 없어요.` | 비가역 경고 |
| 저장/생성 성공 | `저장되었어요.` / `{대상}이 추가되었어요.` | 토스트 |
| 수정 성공 | `{대상}이 수정되었어요.` | 토스트 |
| 삭제 성공 | `삭제되었어요.` | 토스트 |
| 작업 실패(일반) | `{작업}에 실패했어요. 다시 시도해주세요.` | 토스트 error |
| 권한 없음(영역) | `이 기능은 {역할}만 사용할 수 있어요.` | §6-1 fallback |
| 형식 오류(필드) | `{대상}을 {형식} 형식으로 입력해주세요.` | inline(§5-5), 예: `생년월일을 YYYY-MM-DD 형식으로 입력해주세요.` |

> **버튼·라벨 동사**: 액션 버튼은 명령형 명사/동사(`저장`·`삭제`·`추가하기`·`다시 시도`)로 짧게. 진행 중에도 텍스트를 바꾸지 않는다(`저장 중...` 금지 — 스피너로 표현, §5-9).

> **`{대상}` 조사 처리**: 받침 유무로 `이/가`·`을/를`이 갈린다. 동적 명사를 끼울 땐 조사를 문구에 고정하지 말고 대상별 완성 문장을 쓰거나(`내담자가 추가되었어요`) 조사 분리 유틸을 사용한다. placeholder처럼 대상이 고정이면 완성형으로 둔다.

---

## 6. 역할 기반 UI 분기

### 6-1. 3계층 원칙

역할에 따른 UI 분기는 3계층으로 명확히 구분한다.

**1계층 — 사이드바 메뉴 노출**: `canShowSidebarMenu()` 사용

```typescript
// sidebar-permissions.ts에서 관리
// ROLE_EXCLUDED_MENUS: 역할별 숨김 메뉴 ID 목록
```

**2계층 — 페이지 전체 접근 제어**: `PermissionGuard` 컴포넌트로 래핑

```svelte
<!-- 관리자 전용 페이지 -->
<PermissionGuard requiredRole="manager" showError={true}>
  <!-- 페이지 콘텐츠 -->
</PermissionGuard>

<!-- 커스텀 접근 거부 UI가 필요한 경우에만 fallback snippet 사용 -->
<PermissionGuard requiredRole="manager">
  {#snippet fallback()}
    <div class="flex-center h-full">
      <p class="text-body-01-reading-regular text-gray-500">
        이 기능은 관리자만 사용할 수 있어요.
      </p>
    </div>
  {/snippet}
</PermissionGuard>
```

**3계층 — 페이지 내 버튼/섹션**: `$derived` 변수로 조건부 렌더

```svelte
<script lang="ts">
  const canWrite = $derived($currentRole === 'manager' || $currentRole === 'super_admin')
  const canDelete = $derived($currentRole === 'manager')
</script>

{#if canWrite}
  <Button color="primary" onclick={openCreateModal}>추가하기</Button>
{/if}
```

---

### 6-2. 숨김 vs 비활성화 기준

| 상황 | 처리 방식 |
|-----|---------|
| 역할 전용 기능 (다른 역할이 필요 없는 기능) | 숨김 (`{#if canWrite}`) |
| 동일 페이지에서 두 역할이 협업 (일부 기능만 제한) | 비활성화 (`disabled` + Tooltip) |

B2B SaaS에서 역할 전환이 빈번하지 않으므로 역할에 맞는 기능만 노출하는 것이 기본 원칙이다.

---

### 6-3. 역할별 주요 영역

| 기능 영역 | counselor | manager | super_admin |
|---------|-----------|---------|-------------|
| 내담자 관리 | O | O | O |
| 상담/검사 현황 | O | O | O |
| 일정 | O | O | O |
| 구성원 관리 | X | O | O |
| 청구/결제 | X | O | O |
| 센터 설정 | X | O | O |
| 플랫폼 관리 | X | X | O |

---

## 7. 금지 패턴

### 7-1. 절대 금지

| 금지 | 대신 | 이유 |
|-----|------|------|
| `style="color: #256EF4"` | `class="text-primary-500"` | 토큰 우회 |
| `class="text-[15px]"` | `class="text-body-02-normal-regular"` | 임의 크기 |
| `class="text-body-02-nomal-medium"` | `class="text-body-02-normal-medium"` | 오타 레거시 |
| `bg-blue-500` (브랜드 맥락) | `bg-primary-500` | 브랜드 이탈 |
| `bg-orange-50`·`bg-emerald-50`·`text-yellow-700` (상태색) | §2-2 4색(`green`/`red`/`amber`/`gray`) | 상태색 분산 |
| 옅은 의미색 텍스트 (`text-red-400`, `text-green-400`) | `-600`/`-700` 가중치(§2-2) | 대비 미달 |
| `border-[#4C87F6]`, `text-[#256EF4]` | `border-primary-400`, `text-primary-500` | 하드코딩 hex |
| `createEventDispatcher` + `dispatch()` | 콜백 prop (`onchange`, `onclick`) | Svelte 4 패턴 |
| `export let prop` (공유 컴포넌트) | `let { prop }: Props = $props()` | Svelte 4 문법 |
| `on:click={handler}` (이벤트 디렉티브) | `onclick={handler}` | Svelte 5에서 deprecated |
| `onclick\|stopPropagation={fn}` (이벤트 수식자) | `onclick={(e) => { e.stopPropagation(); fn() }}` | Svelte 5에서 제거됨 |
| `<slot name="x" />` | `{#snippet x()}` | Svelte 5에서 deprecated |
| `$$props` | `interface Props + $props()` | Svelte 4 패턴 |
| `requireCenterId()` at component top-level | `$centerId` 반응형 | SSR 에러 |
| 하드코딩 UUID (centerId 등) | `requireCenterId()` 또는 `$centerId` | 멀티 테넌트 격리 |
| `opacity-30`, `opacity-40` (disabled) | `disabled:opacity-50` | 불일치 |
| 임의 z-index (`z-[10002]`) | z-index 레이어 표 준수 | 충돌 위험 |
| 테이블 래퍼 없이 `<Table />` | `rounded-lg border border-gray-200 overflow-hidden`으로 감싸기 | 시각 규칙 |
| `hoverEnabled` 없이 클릭 가능 테이블 | `hoverEnabled={true}` | 피드백 누락 |
| NoDataSection 없이 빈 상태 직접 구현 | `<NoDataSection>` 사용 | 불일치 |
| isError 분기 없는 queryBuilder 사용 | `{:else if isError}` 분기 구현 | 사용자 혼란 |
| 삭제 액션 확인 다이얼로그 생략 | `DeleteConfirmModal` 사용 | 데이터 손실 위험 |
| `focus:outline-none` 단독 사용 | 입력류 `focus:ring-1` / 클릭형 `focus-visible:ring-2`(§2-7) 병행 | 접근성 위반 |
| `onclick` 있는 div에 role/keyboard 없음 | `role="button" tabindex="0" onkeydown` 추가 | 접근성 위반 |
| 더미 데이터로 완성된 페이지처럼 배포 | PermissionGuard 또는 Coming Soon 처리 | 사용자 오인 |
| 신규 문구를 합쇼체/격식체로 작성 (`삭제되었습니다`·`하십시오`) | 해요체 (`삭제되었어요`) — §5-14 | 보이스 불일치 |
| 에러·경고 문구에 느낌표 (`실패했습니다!`) | 평서 종결 (`실패했어요.`) | 톤 부적절 |
| UI에 영문/기술 용어 노출 (`Loading...`, `null`) | 해요체 한글 문구 — §5-14 | 비일관 |

---

## 8. 신규 화면 개발 체크리스트

새 페이지/컴포넌트 작성 전후로 이 목록을 확인한다.

### 8-0. 처음→끝 빌드 경로 (목록 화면 기준)

> 이 문서만 보고 이질감 없는 화면을 만들려면 아래 **순서**대로 만든다. 각 단계의 상세 규칙은 링크된 절을 본다. (Feature 5-레이어 파일 규칙은 `apps/web/CLAUDE.md`의 "새 도메인 추가 가이드"가 출처 — 여기서는 그 결과를 *화면 레이어*에 어떻게 꽂는지를 다룬다.)

1. **역할 정하기** — 이 화면을 쓰는 역할(counselor/manager)과 PermissionGuard 필요 여부를 먼저 정한다(§6, §8 "구현 전 확인"). write 권한 분기(`canWrite`)도 여기서 결정.
2. **Feature 파일 골격** — `src/lib/features/{domain}/{sub}/`에 `filters.ts`·`query-builders.ts`·`view-model.ts`·`{name}-service.ts`를 만든다(순서·패턴은 CLAUDE.md). 페이지는 이들을 **조합/렌더만** 한다 — 컬럼·API·토스트를 페이지에 직접 두지 않는다.
3. **도메인 테이블 컴포넌트** — 콘텐츠 목록이면 `src/lib/components/{domain}/{Domain}Table.svelte`를 §4-2 레시피로 만든다(generic `Table`을 감싸는 얇은 래퍼, `data`는 ViewModel 배열). 단순·부차 목록이면 이 단계를 건너뛰고 generic `Table`을 직접 쓴다(§4-2 판단표).
4. **페이지 골격 배치** — `+page.svelte`에 §3-2 **목록 페이지 패턴**을 그대로 복제: `PageTitleSection`(mb-6) → 필터 바(§5-2) → TabBar(선택) → 카운트+정렬 → `flex min-h-0 flex-1 flex-col` 테이블 영역. 골격은 베끼고 도메인 부분만 바꾼다.
5. **4-상태 분기** — 테이블 영역 안을 **로딩(§5-6) → 에러(§5-7) → 데이터 → 빈상태(§5-8)** 순으로 분기한다. 네 가지 중 하나라도 빠지면 미완성이다. 문구는 전부 §5-14 표준표에서 가져온다.
6. **인터랙션·접근성** — 클릭형 요소 포커스 링(§2-7), 행/카드 클릭 시 `role`/`onkeydown`(§5-12), 비가역 액션 확인 다이얼로그(§5-10), 모달 제출 pending(§5-9)을 붙인다.
7. **§8 체크리스트로 검수** — 아래 표를 위에서 아래로 확인한다.

> **설정/상세 화면**은 1·2·6·7만 따르고, 4단계 대신 §3-2 **카드 래퍼 패턴**(`rounded-lg border ... p-6 shadow-sm`)을 쓴다. 목록이 없으면 3·5단계는 생략.

> **"가장 가까운 기존 화면을 베껴라"**: 새 목록은 §1-2 기준 화면(`counseling/status`·`assessment/status`·`clients`)을, 새 설정 화면은 `subscription/billing`·일정 설정류를 열어 구조를 복제하고 도메인만 바꾸는 게 가장 빠르고 이질감이 없다. 문서 규칙과 그 화면이 어긋나면 **화면을 따른다**(§1-2).

### 구현 전 확인

- [ ] 어떤 역할(counselor/manager)이 사용하는 화면인가?
- [ ] PermissionGuard 2계층이 필요한가?
- [ ] 삭제/취소 등 비가역적 액션이 있는가?
- [ ] write 권한이 있는 역할이 빈 상태 CTA를 필요로 하는가?

### 타이포그래피

- [ ] 모든 텍스트가 `text-{category}-{number}-normal-{weight}` 형식 토큰을 사용하는가?
- [ ] `nomal` 오타 토큰을 사용하지 않았는가?
- [ ] `text-[Npx]` 임의 크기를 사용하지 않았는가?

### 색상

- [ ] 인라인 hex 색상을 사용하지 않았는가?
- [ ] `bg-blue-*`, `text-blue-*`를 브랜드 맥락에서 사용하지 않았는가?
- [ ] 인터랙티브 base 색상이 `primary-400` 또는 `primary-500`으로 일관되는가?
- [ ] 상태색이 §2-2 4색(green·red·amber·gray)·정본 가중치 쌍인가? (orange·emerald·yellow off-palette 금지)
- [ ] 의미색 텍스트가 대비 최소선을 지키고(옅은 `-400/-300` 의미 텍스트 금지), 상태를 색만이 아니라 라벨로도 전달하는가?

### 레이아웃

- [ ] 페이지 헤더가 `text-headline-01-normal-bold text-gray-800` + 우측 Button, 또는 `PageTitleSection`(내부 `semibold`) 형태인가? (§1-2 — 둘 다 허용, weight 차이 주의)
- [ ] **콘텐츠 목록이면 도메인 전용 테이블 컴포넌트**를 쓰는가? (generic `Table` 직접 사용 지양, §1-2)
- [ ] 테이블 래퍼 `rounded-lg border border-gray-200 overflow-hidden` + 클릭형이면 `hoverEnabled={true}`가 있는가?

### 상태 처리

- [ ] 로딩 상태를 `로딩 중...`(또는 화면 내 통일된 문구) + `text-body-01-reading-regular text-gray-400`로 표시하는가? (§1-2)
- [ ] `isError` 분기와 재시도 버튼이 구현되어 있는가?
- [ ] 빈 상태에 `NoDataSection`을 사용하고 `description`이 컨텍스트에 맞게 지정되어 있는가?
- [ ] write 권한 역할에서 빈 상태 CTA가 있는가?
- [ ] 모달 제출 버튼에 `loading` / `disabled` 처리가 되어 있는가?
- [ ] 모든 사용자 문구(로딩·빈상태·에러·확인·토스트·placeholder)가 §5-14 해요체 보이스를 따르는가? (합쇼체 `~습니다`·격식체 혼용, 에러에 느낌표 금지)

### 접근성

- [ ] `onclick`이 있는 div에 `role="button" tabindex="0" onkeydown`(Enter/Space) 핸들러가 있는가?
- [ ] 인터랙티브 요소에 `aria-label` 또는 visible 텍스트가 있는가?
- [ ] 포커스 표시가 §2-7 규칙대로인가? — 입력류 `focus:ring-1`, 버튼·클릭형 `focus-visible:ring-2`. `focus:outline-none` 단독 금지
- [ ] disabled 처리가 §2-7 표를 따르는가? (`opacity-30/40` 금지)
- [ ] Switch에 `role="switch" aria-checked` 속성이 있는가? (현재 컴포넌트 미충족 — 수정 시 추가)

### Svelte 5 문법

- [ ] `$props()`, `$state()`, `$derived()`, `onclick=`을 사용하는가?
- [ ] `export let`, `on:event`, `createEventDispatcher`, `$$props`를 사용하지 않았는가?
- [ ] `onclick|stopPropagation=` 이벤트 수식자를 사용하지 않았는가? (→ `onclick={(e) => { e.stopPropagation(); fn() }}`)
- [ ] slot 대신 `{#snippet}`을 사용하는가?

### SSR 안전

- [ ] 컴포넌트 top-level에서 `$centerId` (반응형)를 사용하는가?
- [ ] 이벤트 핸들러 내부에서만 `requireCenterId()`를 사용하는가?
- [ ] `onDestroy` 내 브라우저 전용 API에 `browser` guard가 있는가?

---

## 부록: 레거시 기술 부채 목록

아래 항목은 현재 코드베이스에 존재하는 알려진 부채이다. 해당 컴포넌트를 수정할 때 함께 정리한다 (보이스카우트 규칙).

| 컴포넌트 | 부채 내용 | 우선순위 |
|---------|---------|---------|
| ~~`Select.svelte`~~ | ~~Svelte 4~~ → 해소(2026-08-19). Runes + portal 패널, `desc`/`clearable` 지원(§4-3) | — |
| `Pagination.svelte` | Svelte 4 (`export let`, `$:` 반응형) | P1 |
| `Slider.svelte` | Svelte 4, SegmentTab과 기능 중복 — deprecated 처리 필요 | P1 |
| `CountStepper.svelte` | Svelte 4, SVG stroke `#256EF4` 하드코딩 → `currentColor` 교체 | P1 |
| `PageTitleSection.svelte` | `<slot name="extraBtn" />` deprecated → `{#snippet extraBtn()}` | P1 |
| `FilterTabs.svelte` | `border-[#4C87F6]`, `text-[#256EF4]` → `border-primary-500`, `text-primary-500` | P1 |
| `QuickLinkFilter.svelte` | `text-[#256EF4]` 하드코딩 + Svelte 4 on:change | P2 |
| `Snackbar.svelte` | `$:` 반응형 선언, `on:click` + 색상이 토큰 밖(`bg-[#ffffff]`·`bg-[#34363D]` 임의 hex, `bg-yellow-50`·`bg-blue-50` off-palette). 호출은 `snackbarStore`로만 하므로 페이지 영향은 없으나 컴포넌트 수정 시 §2-2 토큰화 | P2 |
| `Switch.svelte` | `bg-blue-500` → `bg-primary-500`, translate 버그 수정, **`role="switch" aria-checked` 누락**(§4-13) | P0 |
| ~~`ModalContainer` size 매핑~~ | ~~매핑 누락으로 조용히 md로 떨어짐~~ → 해소(2026-08-19). `ModalOptions.size` 타입과 `sizeClasses`가 같은 7개 | — |
| 모달 BaseModal 미적용 | `SecretModeActivate/Deactivate`는 중앙정렬·아이콘 주도 레이아웃이라 BaseModal을 쓰지 않는다(의도적). 나머지 6개는 이관 완료 | — |
| `nomal` 오타 타이포그래피 | 본문 대부분 교체했으나 **페이지 헤더 `text-headline-01-nomal-bold`는 다수 잔존**(검사·상담·구성원·청구 등). 헤더 수정 시 `normal`로 교체 | P2 |
| 인라인 hex 색상 | 191개 파일 — 빈도순 점진적 교체 | P2 |
| off-palette 상태색 | `orange`·`emerald`·`yellow` 계열이 상태색으로 혼재(`bg-orange-50`·`bg-emerald-50` 등) → §2-2 4색으로 매핑(`emerald→green`, `orange/yellow→amber`) | P2 |
| 토스트 보이스 혼용 | 토스트 문구 합쇼체/해요체 반반(`습니다` 161 / `어요` 135). §5-14대로 해당 화면 손댈 때 해요체로 정리 | P2 |
| 클릭형 요소 `focus-visible` 링 | 버튼·클릭형 div의 키보드 포커스 링이 거의 미적용(코드 2곳) → §2-7대로 점진 추가 | P2 |
