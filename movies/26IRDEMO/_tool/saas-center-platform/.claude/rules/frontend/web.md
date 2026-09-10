---
paths:
  - "apps/web/src/**"
---

# web 프론트 아키텍처 + 디자인 시스템 (SvelteKit · SaaS)

상담사·관리자 공용 SaaS — 내담자·심리검사·상담·일정·청구. **페이지는 조합/렌더만, 비즈니스 로직은 Feature 모듈에 캡슐화.** 두 앱 일관성은 web의 counselor 시점 기준(mobile이 따라잡음).

> 아키텍처 상세 `apps/web/docs/FRONTEND_ARCHITECTURE_V4.md`.
>
> 🔴 **디자인 규칙 정본 = `apps/web/Web_Design.md`.** 토큰·컴포넌트 실측값(패딩·높이·라운드·그림자·타이포)은 전부 이 문서가 소유한다.
> `apps/web/docs/design-system-guide.md`(패턴·현실 보정 원칙)와 **이 파일 §5의 요약**은 파생물이다 —
> 값이 어긋나면 **항상 Web_Design.md가 이긴다.** 아래 §5는 자주 쓰는 값의 발췌일 뿐이므로,
> 수치를 확정해야 하는 작업(간격·높이·패딩 등)은 §5만 보고 끝내지 말고 Web_Design.md의 해당 절을 연다.
> (실제 사고: §5.7의 "모달 패딩 사방 24"만 보고 작업해 헤더가 81이 됐다 — Web_Design.md는 2026-08-06에
> 헤더만 상하 16(높이 65)으로 개정돼 있었다. 2026-08-07 재개정으로 좌우 기준선은 20이 됐다.)

---

## 1. Stack

SvelteKit 5(SSR+SPA) · Svelte 5 Runes · TS strict · **Tailwind CSS v4(`@theme`)** · TanStack Query v5(svelte-query) · Axios(JWT interceptor) · Vitest/Playwright.

```bash
npm run dev    # 0.0.0.0:5173
npm run check  # Svelte 타입 체크
```

---

## 2. 프로젝트 구조

```
src/lib/
├── features/{domain}/{sub}/   도메인 모듈 (§3 패턴). 다수가 sub-domain 보유:
│   assessment(manage·receive·status·status-detail·statistics·transmission-history)
│   counseling(status·detail) · clients(register·detail) · schedule(calendar·counsel·
│   reservations·operation·settings·field-notes) · billing(price-list) · subscription
│   center(info·room·program·message-template) · members · voucher · credit · credentials
│   form · notice · notification · field-note · agent · common(공통 필터 유틸) …
├── components/                공용 컴포넌트 (도메인 폴더 + 루트 .svelte) + modal/
├── hooks/
│   ├── actions/*.action.ts    endpoint/HTTP 호출만 (순수)
│   └── queries/builder.ts     queryBuilder / mutationBuilder
├── services/api/instances.ts  Axios + JWT interceptor
├── stores/                    modal · snackbar · auth · center.store
├── types/ · utils/errorHandler.ts · server/ · config/ · constants/
```

---

## 3. Feature 아키텍처 — 5단 (V4)

```
1. 페이지 (+page.svelte)     훅 초기화 + 쿼리/서비스 주입 + 렌더/이벤트 연결만
2. 훅 (hooks.svelte.ts)      상태/디바운스/URL 동기화 (필요시만)
3. 서비스 (*-service.ts)     쿼리/뮤테이션 + invalidate + 토스트 + 모달 캡슐화
4. ViewModel (view-model.ts) API → UI 포맷 변환 (라벨/색상/이미지)
5. API 액션 (*.action.ts)    endpoint/HTTP 호출만 (순수)
```
아래로 갈수록 순수. **필요할 때만 생성** — ViewModel 변환 3줄 이하면 페이지 인라인, hooks는 URL 동기화/복합 필터 필요할 때만, 200줄 초과 시 분리.

### Feature 스캐폴드 (`features/{domain}/{sub}/`)
| 파일 | 책임 |
|------|------|
| `constants.ts` | 상수·타입·모달 사이즈 |
| `filters.ts` | URL ↔ 필터 모델 ↔ API 변환 (`common/filters` 확장) |
| `query-builders.ts` | 쿼리/뮤테이션 입력 빌더, 폼 데이터 타입 |
| `view-model.ts` | API → UI 표현 변환기 |
| `{name}-service.ts` | 서비스+핸들러 (모달/토스트/invalidate) |
| `hooks.svelte.ts` | (옵션) runes 훅 |
| `components/` | (옵션) 도메인 전용 컴포넌트 |

---

## 4. Core 패턴

```ts
// 조회 — queryBuilder 필수
const list = $derived(queryBuilder(getDomainList, () => buildQueryInput(filters)))
// 변경 — mutationBuilder 또는 서비스에서 직접
const m = mutationBuilder(postEntity, ['invalidateKey'], [], { successMessage: '성공' })
// Runes
let v = $state(''); let c = $derived(expr); $effect(() => {}); let { prop }: Props = $props()
```
- **에러는 전부 Snackbar(toast)** — inline validation 없음. 서비스에서 `snackbarStore.error()/.success()`.
- **모달**: `modalStore.open({ component, props:{ onConfirm }, options:{ size } })`. onConfirm 안에서 API + invalidate. size `sm|md|lg|xl|wide`. 헤더 규격은 §5.7.
- 쿼리 키 ↔ invalidate 키 일치 (`exact:false`로 프리픽스 무효화).
- 모든 API는 `fetch('/api/proxy/...')` 프록시 경유. 외부 서버 직접 호출 금지.

### 🔴 SSR / centerId 불변식
`centerStore`는 localStorage 기반 → **SSR에선 항상 null** (`initialize()`는 `(protected)/+layout.svelte` onMount).
- **컴포넌트 top-level**: `$centerId`(반응형, null 허용). `requireCenterId()` **금지**.
- **이벤트 핸들러/콜백**: `requireCenterId()` 가능 (클라이언트 전용).
- **서비스 deps**: `centerId` 캡처 말고 실행 시점에 `requireCenterId()`.
- **action.ts**: centerId 빈값이면 빈 결과 반환 (`if (!params.centerId) return []`).
- `onDestroy`는 SSR에서도 실행 → 브라우저 API는 `import { browser }` 가드.
- Svelte 5.16.x: 기본 콘텐츠 + named snippet 혼용 시 SSR 버그 → `export const ssr = false` 임시 회피.

---

## 5. 디자인 시스템 — 토큰

> ⚠️ **이 절은 `apps/web/Web_Design.md`의 발췌다.** 값이 다르면 Web_Design.md가 정본.
> 수치를 새로 정하거나 확인해야 하면 그 문서를 직접 연다.

**모든 토큰은 `src/app.css`의 `@theme` 블록**(Tailwind v4). hex·`bg-blue-*`·임의 크기 하드코딩 금지.

### 5.1 색상
| 그룹 | 값 / 비고 |
|------|----------|
| **imomtae (브랜드)** | `imomtae` `#ef4967`(+light/dark scale) — 핑크레드 브랜드 |
| **primary (블루 강조)** | `primary-400` `#68A0FF`(라이트 강조) · `primary-500` `#2979FF`(CTA·**활성 탭 텍스트**·토글 on·페이지네이션·인디케이터) · `600` `#1265F0`/`700` `#0E4DB7`/`800` `#07388B`(hover·pressed 단계). Web_Design.md Primitive palette 기준으로 정렬됨 |
| **mint (청구)** | 청구 **버튼**은 원시 mint를 직접 쓰지 않는다 — `billing-*` 시맨틱 토큰만 (`border-billing-line`(mint-300) · `text-billing-fg`(mint-500) · hover `billing-line-hover`(mint-400)/`billing-fg-hover`(mint-600)/`billing-surface-hover`(mint-50)). 정본 §Components>button-billing. 배지·입력 등 버튼 아닌 요소만 mint-* 직접 사용 |
| **Semantic 4색 정본** | 성공 `green-700`/`bg-green-50` · 오류 `red-600`/`bg-red-50` · 경고 `amber-700`/`bg-amber-50` · 비활성 `gray-500`/`bg-gray-100` |
| **etc / trans-bg** | `etc-*` 확장 팔레트 + `trans-bg-*` 반투명 배경(배지·태그용) |
| **Gray** | `gray-400` placeholder·빈상태, `gray-600` 셀 기본, `gray-800` 주 텍스트(금액·이름), `gray-900` 최상위 강조 |

> 상태색은 **green·red·amber·gray 4계열로 단일화**가 정본. `emerald→green`, `orange/yellow→amber`로 매핑(신규 금지). 색만으로 상태 구분하지 말고 라벨/`aria-label` 동반(L1 접근성, WCAG AA). `-400`/`-300` 옅은 색을 의미 텍스트로 쓰지 않는다.

### 5.2 타이포그래피
Pretendard(9 weight), letter-spacing 전체 `-0.41px`. 클래스 **`text-{category}-{number}-{type}-{weight}`** (type `normal`|`reading`, weight regular/medium/semibold/bold) — admin과 동일 체계.
카테고리: `display-01/02`(44/32) · `headline-00/01/02`(28/24/20) · `title-01/02`(18/16) · `body-01~04`(16/15/14/–) · `label-01~03`(13/12) · `caption-01/02`(10/8).
> 페이지 제목 weight: 인라인 헤더 `text-headline-01-normal-bold`(700) vs `PageTitleSection`(semibold 600) — 둘 다 허용하나 한 맥락에선 통일. 오타 토큰 `...nomal...`은 수정 대상.

### 5.3 간격 / radius / shadow / z-index
- spacing: `aside`(240px) · `header`(64px) + 커스텀(`4.5`,`7.5`,`18`,`td`,`th` 등).
- `--radius-norm` 10px. shadow: `overlay`·`button-active`·`switch` 등. z-index·focus 표준은 가이드 §2-6/§2-7.

### 5.4 카드/섹션 래퍼 표준
```svelte
<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">…</div>   <!-- 흰 카드 -->
<div class="rounded-lg border border-gray-200 overflow-hidden"><Table … /></div> <!-- 테이블 래퍼 -->
<div class="rounded-lg bg-white p-4 ring-1 ring-inset ring-gray-200 hover:ring-primary-400 hover:shadow-md">…</div> <!-- 클릭 카드 -->
```
- 공유 컴포넌트(Button·Select·Checkbox·Pagination): `ring-1 ring-inset`. 페이지 카드/테이블/입력 외곽: `border border-gray-200`. 카드 내부 구분: `<hr class="border-gray-100 my-3">`.

### 5.5 폼 라벨 (전 폼 공통 · 단일 규격)
- `text-body-02-normal-medium`(15/500) + `text-gray-700` + 라벨↔입력 `mb-2`(8). 필수 `*`는 `text-status-danger`.
- 그룹 머리글(`내담자 정보`·`요일`)도 같은 라벨 규격 — Title 사다리(XL 24/L 20/M 18)에 "S"는 없다.
- 금지: `text-sm font-medium`(14) 임의 조합, 레거시 별칭 `body-01-medium`(16), 라벨용 semibold.

### 5.6 흰 버튼(button-white / `white-action`)
- 흰 배경 + **회색 텍스트**(`gray-600`, hover `gray-800`). 파란 텍스트 금지 — primary CTA와 위계 충돌(2026-08-04 재정의).
- 회색 빈 상태 박스 위 액션은 `bg-gray-100`(배경과 3% 차) 대신 이 흰 버튼을 쓴다.
- `gray-50` 면 위에서는 hover에 bg를 쓰지 않는다(같은 색이라 버튼이 사라짐) — `ring-1 ring-inset ring-transparent hover:ring-gray-200`로 표시. gray-50보다 연한 단계는 없다(white가 기본 상태).
- 동반 아이콘 색은 `var(--color-icon-primary)`. SVG prop에 hex 하드코딩 금지.

### 5.7 모달 헤더 표준 (전 모달 공통)
- **타이틀 = `headline-02-normal-semibold`(20/600) 고정.** `headline-01`(24)은 페이지 제목 전용 — 모달은 페이지 하위 컨텍스트라 한 단계 낮춘다. bold(700) 금지. 커스텀 `{#snippet header()}`에도 같은 variant를 쓴다.
- **세로 정렬 = `items-center`** (BaseModal 기본). 닫기 아이콘(32)이 타이틀보다 커서 상단 정렬하면 타이틀이 위로 뜬다. 예외는 타이틀+부제 **2줄 헤더**뿐 — `headerClass="... items-start!"`.
- `headerClass`는 twMerge 맨 뒤 병합이라 `!` 없이도 오버라이드된다.
- **패딩 — header `px-5 py-4`(좌우 20 · 상하 16) · body `p-5`(사방 20) · footer `px-5 pt-4 pb-5`(좌우·하 20 · 상 16)** (2026-08-07 개정, 옛 24 전면 폐기. 정본 = Web_Design.md §Components>modal). 좌우선은 셋 다 20으로 맞추고 **header 상하·footer 상단만 16**으로 줄인다 — 닫기 아이콘(32)이 타이틀(20)보다 커서 헤더 높이를 결정하고(상하 16이면 65), 푸터 상단은 body 하단 패딩 20이 이미 벌려주기 때문. `p-6`·`px-6`·`px-8`·`py-5`·`pt-10` 등 그 밖의 개별 조정 금지. 섹션 분할이 필요한 body만 `p-0!` + 내부 최상위 섹션이 `p-5`. 커스텀 header 스니펫은 자체 패딩을 갖지 않고 `headerClass="px-5 py-4"`로 준다(중복 시 두 배). **footer 없는 조회 전용 모달은 본문 하단만 40(`pb-10`)** — 좌우·상단은 20 그대로. 판정은 footer 스니펫이 아니라 '본문 맨 아래 액션 버튼 바' 유무. 2026-08-18 등재, 정본 §Components>modal.
- **푸터 구조는 BaseModal 소유** — `flex items-center justify-end gap-3`(버튼 간 12) + 상단 1px `border-gray-100`. 버튼 높이 44(`h-11`). 삭제 버튼 동반 시만 `justify-between`, 확인·삭제 다이얼로그만 `grid grid-cols-2` 전폭.
- 폼 그룹 간격: 구분되는 필드 그룹 사이 24(`space-y-6`), 위 그룹에 딸린 보조 컨트롤(체크박스 등)은 그 필드와 함께 `space-y-3` 컨테이너로 묶어 12. `구분 > 그룹 내부` 2배 부등식 유지.
- 간격을 뒤 요소의 `mt-*`로 좁히지 않는다 — Tailwind v4 `space-y-*`는 **앞 형제의 margin-bottom**으로 간격을 만들어(v3와 반대) `mt`는 상쇄가 아니라 가산(24+12=36)된다. 좁히려면 더 작은 `space-y-*`로 감싼다.

---

## 6. 🟡 현실 보정 원칙 (디자인 가이드 §1-2 — 최우선)

문서의 이상론과 실제 다수파 화면이 어긋나면 → **화면(현실)을 표준으로 채택**. (단 오타·접근성 결함 같은 *버그*는 다수파여도 채택 안 함)

- **L1 품질 규칙(불변)**: 색·간격·타이포 토큰, hex 금지, Svelte 5 문법, 접근성, z-index, 에러·빈상태 — 무조건 준수. 이질감의 원인이 아님.
- **L2 구조 관습(현실 표준)**: 페이지 헤더, Typography 사용, 로딩 문구, **테이블 형태** — 다수파 화면을 표준으로.
- 기준 화면: `assessment/status` · `counseling/status` · `clients` · `members`(구조 관습 표준).
- 🔴 화면 간 이질감의 주원인 = **테이블**. 콘텐츠 목록은 **도메인 전용 커스텀 테이블**(아바타·2줄 셀·진행바·액션·케밥) + 리스트/그리드 카드 토글이 표준. generic `Table`은 단순·부차 목록에만.
- 로딩 문구 표준 = `로딩 중...`(다수파). 화면 내 통일이 핵심.

---

## 7. 역할 / 권한

counselor·manager·super_admin 공용. 같은 화면도 역할로 섹션·액션이 달라질 수 있다. 관리자 전용 운영 영역(멤버·결제·운영)은 web에만 둔다. 공통 생성 컴포넌트(`ClientSearchDropdown` 등)의 인라인 생성은 `write:client`로 게이팅.

상세: `docs/design-system-guide.md`(토큰·컴포넌트 레퍼런스·패턴) · `docs/FRONTEND_ARCHITECTURE_V4.md` · `docs/frontend-model-and-layers.md`.
