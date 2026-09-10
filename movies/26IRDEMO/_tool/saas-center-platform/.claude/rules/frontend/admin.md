---
paths:
  - "apps/admin/src/**"
---

# admin 프론트 아키텍처 + 디자인 시스템 (SvelteKit · 운영자 대시보드)

플랫폼 운영자(admin) 전용 대시보드 — 센터/사용자 관리, 구독·바우처, 감사 로그, AI Lab. **admin 외부 파일 수정 시 먼저 확인.** api 수정이 필요하면 admin route 외 부분은 손대지 말고 알린다.

> Plan 진입 시 `apps/admin/docs/platform-admin.md`(전체 설계)를 우선 참조. 백엔드 신규/리팩토링은 `apps/admin/docs/API_ARCHITECTURE.md`(Router→Handler→Service→Repository) + **감사 로그 체크리스트**(변경 행위 Handler엔 `audit.log` 필수, `apps/admin/docs/audit-log/plan.md`). 디자인 시스템 정식 스펙은 `apps/admin/docs/design-system-guide.md`.

---

## 1. Stack

SvelteKit 5 · Svelte 5 Runes · TS · **Tailwind CSS v4(`@theme`)** · TanStack Query v5 · Axios(interceptor) + SvelteKit 서버 프록시 · JWT(admin 전용 토큰, HTTP-only 쿠키).

```bash
pnpm dev    # 0.0.0.0:3504
pnpm check  # Svelte 타입 체크
```

---

## 2. 프로젝트 구조

```
src/
├── app.css                   ★ 디자인 토큰 단일 소스 (@theme) + 타이포 유틸
├── hooks.server.ts           토큰 검증/갱신, locals 설정
├── lib/
│   ├── features/{domain}/     도메인 모듈 (§3 패턴)
│   │   ai-lab · ai-usage · assessment · audit-logs · center-assessment
│   │   center-detail · center-terminations · dashboard · message-template
│   │   notices · subscription · voucher
│   ├── components/            공용 컴포넌트 (§7) + modal/
│   ├── hooks/
│   │   ├── actions/*.action.ts   endpoint 정의
│   │   └── queries/builder.ts    queryBuilder / mutationBuilder
│   ├── server/{auth,config}.ts   JWT 디코드·갱신, API_URL·쿠키
│   ├── services/api/{instances,interceptors}.ts
│   ├── stores/               auth · sidebar.svelte · snackbar · modal
│   ├── types/apiResponse.ts  ApiResponse · Action · Pagination
│   └── utils/{format,errorHandler}.ts
└── routes/
    ├── login/ · accept-admin-invitation/ · change-password/   public
    ├── api/{auth, proxy/[...path]}/   로그인·로그아웃 + 백엔드 프록시(토큰 주입)
    └── (protected)/          dashboard · center · account · vouchers · subscription
                              assessments · audit-logs · cs-memos · notices · ai-lab · settings …
```

---

## 3. Feature 아키텍처 — 3단 ("단순한 건 단순하게")

```
기본 (단순 CRUD):
  페이지 (+page.svelte) → queryBuilder/mutationBuilder 직접 → Action (*.action.ts)
복잡:
  페이지 → 서비스 ({name}-service.ts) → Action
```
web의 5단을 줄인 형태. **무조건 레이어를 만들지 않는다** — 필요할 때만 분리.

### 분리 기준
| 기준 | 페이지 직접 | 서비스 분리 |
|------|------------|-------------|
| API 호출 | 1~2개 빌더 | 3개 이상 / 연쇄 |
| 후처리 | successMessage로 충분 | invalidate 여럿 + 토스트 + 모달 조합 |
| 변환 | 3줄 이하 인라인 | 복잡하거나 재사용 |
| 상태 | `$state` 몇 개 | 필터/URL동기화/디바운스 복합 |

### Feature 디렉터리 (`src/lib/features/{domain}/`)
`constants.ts` · `{name}-service.ts`(복잡할 때만) · `hooks.svelte.ts`(URL동기화/복합필터 필요시만) · `components/`. 파일 200줄 넘으면 분리 검토.

---

## 4. Core 패턴

```ts
// Action = { key, request } — endpoint만
export const getCenterList = (): Action<R,R> => ({
  key: ['getCenterList'],
  request: async (p?) => get<R>('/admin/centers', p),
})
// 조회 / 변경
const list = $derived(queryBuilder(getCenterList, () => buildQueryInput(filters)))
const m = mutationBuilder(patchCenterStatus, ['getCenterList'], [], { successMessage: '상태가 변경되었습니다.' })
// 서비스 (복잡할 때): createXService({ queryClient }) → invalidate + API + 토스트 캡슐화
```
- **에러는 전부 Snackbar** — `showErrorSnackbar()/showSuccessSnackbar()` 또는 mutationBuilder 자동 처리.
- Runes: `$state` · `$derived` · `$effect` · `$props`.
- URL 동기화 3단계 패턴은 `design-system-guide.md §6` 참조.

### API 호출 / 인증
```ts
import { get, post } from '$services/api/instances'   // 프록시 경유만
const d = await get<R>('/admin/centers', params)
// ❌ fetch('http://localhost:3502/...') 직접 호출 금지
```
- 흐름: `Axios(/api/proxy/...) → SvelteKit 프록시(토큰 주입) → 백엔드`. 401 시 프록시가 갱신 → 실패면 interceptor 로그아웃 → `/login`.
- 쿠키 `admin_accessToken`/`admin_refreshToken`. `(protected)` 그룹으로 인증 강제.
- Path alias: `$stores $utils $types $services $components $hooks` → `src/lib/*`, `$root` → `src/`.

---

## 5. 디자인 시스템 — 토큰

**모든 토큰은 `src/app.css`의 `@theme` 블록에서 선언**된다 (Tailwind v4). 신규 코드는 토큰만 사용, hex·임의 크기 하드코딩 금지.

### 5.1 색상
| 그룹 | 값 / 비고 |
|------|----------|
| **Primary (Indigo)** | `primary-50`…`900`, `--color-primary` = `#4f46e5`(=primary-600). `bg-primary` CTA |
| **Semantic** | negative `#e83328` · warning `#f47500` · success `#017750` · info `#0176d0` |
| **Status** (뱃지·인디케이터) | red `#e20808` · orange `#f47500` · yellow `#fecb01` · green `#017750` · blue `#0176d0` · gray `#717171` |
| **Gray** | Tailwind 기본 gray 스케일 사용 (`gray-50`…`900`) |

### 5.2 타이포그래피
Pretendard, letter-spacing 전체 `-0.41px`. 클래스 네이밍 **`text-{category}-{number}-{type}-{weight}`**:
- `type`: `normal`(line-height=font-size) | `reading`(line-height=150%)
- `weight`: `regular`(400) · `medium`(500) · `semibold`(600) · `bold`(700)

| 카테고리 | 크기 | 카테고리 | 크기 |
|------|----|------|----|
| `display-01/02` | 44/32 | `body-01/02/03` | 16/15/14 |
| `headline-00/01/02` | 28/24/20 | `label-01/02` | 13/12 |
| `title-01` | 18 | `caption-01/02` | 10/8 |

> **레거시 alias 금지**: `text-body-02-medium`(구버전 14px)처럼 숫자 체계가 다른 클래스가 하위호환용으로 남아있다. 신규 코드는 현행 체계만.
> 색상은 `<Typography color="text-gray-800">` 또는 className으로. 직접 `fontSize`/`fontWeight` 금지.

### 5.3 간격 / radius / shadow
- 커스텀 spacing: `4.5`(18px) · `7.5`(30px) · `18`(72px) · `sidebar`(240px) · `sidebar-collapsed`(72px).
- `--radius-norm` = 10px. `--shadow-card`.
- **`.section-border`** 유틸: `rounded-2xl border border-gray-200 bg-[#FDFDFD]` + card shadow — 카드·테이블·로딩/빈 상태 래퍼 표준.

---

## 6. 페이지 레이아웃 — 목록 5단 표준

```svelte
<div in:fade class="p-6">
  <PageHeader title="..." description="... · 총 {total}개">
    {#snippet actions()}<Button color="primary" size="md" onclick={openCreateModal}>신규 등록</Button>{/snippet}
  </PageHeader>

  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">  <!-- 필터 바 -->
    <Input bind:value={search} placeholder="검색..." class="w-64" />
    <Select options={statusOptions} bind:selected={statusFilter} />
    <Button color="light" size="sm" onclick={resetFilters}>초기화</Button>
  </div>

  {#if isLoading}        <div class="section-border flex items-center justify-center py-16">…로딩…</div>
  {:else if !items.length}<div class="section-border py-16"><NoDataSection description="…" /></div>
  {:else}
    <div class="section-border overflow-hidden"><Table {columns} data={items} onRowClick={…} hoverEnabled /></div>
    <div class="mt-4"><Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage class="justify-end" /></div>
  {/if}
</div>
```

- **상태 뱃지 = Config 객체 분리** 패턴: `STATUS_CONFIG[status] = { label, bg, text, dot }` → `{#snippet}`에서 `rounded-full px-2.5 py-1` + dot.
- 상세 보기: 정보량으로 **모달**(필드 ≤8, 단순/상태변경) vs **디테일 페이지 `/resource/[id]`**(필드 ≥10, 보기↔수정 토글) 결정.
- 필터바: 검색 `w-64`/`w-75` 박스 + `Select`(`showActiveHighlight`) + `초기화`(`resetFilters()` — 검색·필터·페이지 초기화 + `url.reset()`).

---

## 7. 공용 컴포넌트

`PageHeader` · `Table`/`TableColumn`(커스텀 셀은 `{#snippet}`+`render`) · `Pagination` · `Select`(`{value,label}[]`|`string[]`) · `Input`/`Textarea` · `Button`(`size`,`color="primary"|"light"`) · `Checkbox`/`Switch`/`Slider` · `Typography` · `NoDataSection` · `KebabMenu` · `AutocompleteInput`/`DatePickerInput`/`Calendar` · `FileAttachment`/`FileDropZone`/`RichEditor` · `Snackbar`(`snackbarStore`) · `modal/`(`BaseModal`·`ConfirmModal`·`modalStore`). 새 화면 전 기존 컴포넌트 먼저 탐색.

```ts
// 모달: 서비스/페이지에서 열고 onConfirm에서 API + invalidate
modalStore.open({ component: ModalComponent, props: { onConfirm: async (data) => {…} }, options: { size: 'md' } })
```
