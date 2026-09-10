# Admin Design System Guide

> admin 앱의 디자인 시스템 완전 레퍼런스. UI 코드 작성/수정 시 이 문서를 기준으로 한다.
> 분석 대상: 구독관리·AI 사용량·AI Lab 제외한 전 기능

---

## 목차

1. [Design Tokens](#1-design-tokens)
2. [Component API — 입력](#2-component-api--입력)
3. [Component API — 레이아웃·테이블·네비게이션](#3-component-api--레이아웃테이블네비게이션)
4. [Component API — 모달·피드백·파일](#4-component-api--모달피드백파일)
5. [페이지 레이아웃 패턴](#5-페이지-레이아웃-패턴)
6. [Query·Mutation 패턴](#6-querymutation-패턴)
7. [유틸리티 함수](#7-유틸리티-함수)
8. [Usage Rules — 금지 및 필수 규칙](#8-usage-rules--금지-및-필수-규칙)
9. [대시보드 UI 패턴](#9-대시보드-ui-패턴)

---

## 1. Design Tokens

모든 토큰은 `src/app.css`의 `@theme` 블록에서 선언된다 (Tailwind CSS v4 방식).

### 1-1. Colors

#### Primary (Indigo)

| CSS 변수 | 값 | Tailwind 클래스 |
|---|---|---|
| `--color-primary-50` | `#eef2ff` | `bg-primary-50` |
| `--color-primary-100` | `#e0e7ff` | `bg-primary-100` |
| `--color-primary-200` | `#c7d2fe` | `bg-primary-200` |
| `--color-primary-300` | `#a5b4fc` | `bg-primary-300` |
| `--color-primary-400` | `#818cf8` | `bg-primary-400` |
| `--color-primary-500` | `#6366f1` | `bg-primary-500` |
| `--color-primary-600` | `#4f46e5` | `bg-primary-600` |
| `--color-primary-700` | `#4338ca` | `bg-primary-700` |
| `--color-primary-800` | `#3730a3` | `bg-primary-800` |
| `--color-primary-900` | `#312e81` | `bg-primary-900` |
| `--color-primary` | `#4f46e5` | `bg-primary` (= primary-600) |

#### Semantic

| CSS 변수 | 값 | 용도 |
|---|---|---|
| `--color-semantic-negative` | `#e83328` | 오류·삭제·위험 |
| `--color-semantic-warning` | `#f47500` | 경고 |
| `--color-semantic-success` | `#017750` | 성공·완료 |
| `--color-semantic-info` | `#0176d0` | 정보·안내 |

#### Status (뱃지·인디케이터용)

| CSS 변수 | 값 |
|---|---|
| `--color-status-red` | `#e20808` |
| `--color-status-orange` | `#f47500` |
| `--color-status-yellow` | `#fecb01` |
| `--color-status-green` | `#017750` |
| `--color-status-blue` | `#0176d0` |
| `--color-status-gray` | `#717171` |

### 1-2. Typography Scale

**네이밍 규칙**: `text-{category}-{number}-{type}-{weight}`
- `type`: `normal` (line-height = font-size) | `reading` (line-height = 150%)
- `weight`: `regular`(400) | `medium`(500) | `semibold`(600) | `bold`(700)
- `letter-spacing`: 전 클래스 공통 `-0.41px`
- `font-family`: Pretendard (`font-pretendard`)

| 카테고리 | 크기 | 사용 가능한 클래스 (예시) |
|---|---|---|
| `display-01` | 44px | `text-display-01-normal-bold` |
| `display-02` | 32px | `text-display-02-reading-bold` |
| `headline-00` | 28px | `text-headline-00-normal-medium` / `-bold` |
| `headline-01` | 24px | `text-headline-01-normal-{regular/medium/semibold/bold}`, `-reading-{semibold/bold}` |
| `headline-02` | 20px | `text-headline-02-normal-{regular/medium/semibold/bold}`, `-reading-{semibold/bold}` |
| `title-01` | 18px | `text-title-01-normal-{regular/medium/semibold/bold}`, `-reading-{regular/semibold}` |
| `body-01` | 16px | `text-body-01-normal-{regular/medium/semibold/bold}`, `-reading-{regular/semibold}` |
| `body-02` | 15px | `text-body-02-normal-{regular/medium/semibold}`, `-reading-{regular/semibold}` |
| `body-03` | 14px | `text-body-03-normal-{regular/medium/semibold/bold}`, `-reading-{regular/semibold}` |
| `label-01` | 13px | `text-label-01-normal-{regular/medium/bold}` |
| `label-02` | 12px | `text-label-02-normal-{regular/medium/bold}` |
| `caption-01` | 10px | `text-caption-01-normal-{regular/medium/bold}` |
| `caption-02` | 8px | `text-caption-02-normal-{regular/medium/bold}` |

> **레거시 alias 사용 금지**: `text-body-02-medium`(구버전, 14px)처럼 숫자 체계가 다른 구버전 클래스들이 하위 호환용으로 존재한다. 신규 코드에서는 반드시 현행 체계를 사용할 것.

### 1-3. Spacing

| CSS 변수 | 값 | 용도 |
|---|---|---|
| `--spacing-4\.5` | `18px` | 보조 간격 |
| `--spacing-7\.5` | `30px` | 보조 간격 |
| `--spacing-18` | `72px` | 섹션 간격 |
| `--spacing-sidebar` | `240px` | 사이드바 펼침 너비 |
| `--spacing-sidebar-collapsed` | `72px` | 사이드바 접힘 너비 |

### 1-4. 기타 토큰

| 종류 | 변수 | 값 |
|---|---|---|
| Border Radius | `--radius-norm` | `10px` |
| Shadow | `--shadow-card` | `0px 4px 12px 0px rgba(200,200,200,0.1)` |
| Font | `--font-sans` | Pretendard → system fallback |

---

## 2. Component API — 입력

### Typography

파일: `src/lib/components/Typography.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `TypographyVariant` | **필수** | 타이포 스타일. `text-{variant}` CSS 클래스로 매핑 |
| `tag` | `'h1'~'h6' \| 'p' \| 'span' \| 'div' \| 'label'` | `'p'` | 렌더링할 HTML 태그 |
| `className` | `string` | `''` | 추가 Tailwind 클래스 |
| `color` | `string` | `'text-gray-900'` | Tailwind 텍스트 색상 클래스 |
| `whitespace` | `'normal' \| 'pre-line' \| 'pre-wrap' \| 'pre'` | `'normal'` | `whitespace-{value}` 클래스로 매핑 |
| `children` | `Snippet` | - | 내부 콘텐츠 |

```svelte
<Typography variant="headline-01-normal-bold" tag="h1">페이지 제목</Typography>
<Typography variant="body-03-normal-medium" tag="span" color="text-gray-500">부연 설명</Typography>
<Typography variant="body-01-reading-regular" whitespace="pre-line" className="mt-4">멀티라인 본문</Typography>
```

---

### Button

파일: `src/lib/components/Button.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `color` | `'primary' \| 'dark' \| 'light' \| 'light-red' \| 'tertiary' \| 'white-action' \| 'primary-dark' \| 'stroke-primary' \| 'stroke-secondary' \| 'stroke-delete' \| 'expense'` | `'primary'` | 버튼 색상 테마 |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'lg'` | 크기 (높이·패딩·폰트) |
| `weight` | `'bold' \| 'medium' \| 'normal'` | `'bold'` | 폰트 굵기 |
| `content` | `string` | `'Button'` | `children` 없을 때 표시할 텍스트 |
| `contentClass` | `string` | `''` | 내부 flex 래퍼 추가 클래스 |
| `disabled` | `boolean` | `false` | 비활성화 |
| `loading` | `boolean` | `false` | 로딩 스피너 표시 + pointer-events-none |
| `outline` | `boolean` | `false` | 아웃라인(테두리) 스타일 |
| `pill` | `boolean` | `false` | 완전히 둥근 모서리 (rounded-full) |
| `href` | `string` | - | 지정 시 `<a>` 태그로 렌더링 |
| `class` | `string` | - | 추가 클래스 (twMerge 적용) |
| `onclick` | `(e: MouseEvent) => void` | - | 클릭 핸들러 |
| `children` | `Snippet` | - | 버튼 내부 콘텐츠 자유 구성 |

```svelte
<Button color="primary" size="md" onclick={() => save()}>저장</Button>
<Button color="stroke-delete" size="sm" content="삭제" loading={isDeleting} />
<Button color="light" size="sm" href="/dashboard">대시보드로 이동</Button>
```

---

### Input

파일: `src/lib/components/Input.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | - | 레이블 텍스트 |
| `required` | `boolean` | `false` | 필수 표시 (*) |
| `value` | `string` | `''` | 입력값 (`$bindable`) |
| `class` | `string` | - | input 요소 추가 클래스 |
| `...rest` | `HTMLInputAttributes` | - | placeholder, disabled, type 등 네이티브 속성 전부 지원 |

```svelte
<Input label="이름" required bind:value={name} placeholder="이름을 입력하세요" />
<Input type="number" bind:value={amount} min={0} class="w-32" />
```

---

### Textarea

파일: `src/lib/components/Textarea.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | - | 레이블 텍스트 |
| `required` | `boolean` | `false` | 필수 표시 (*) |
| `value` | `string` | `''` | 텍스트 값 (`$bindable`) |
| `class` | `string` | - | textarea 추가 클래스 |
| `...rest` | `HTMLTextareaAttributes` | - | rows, placeholder, disabled 등 전부 지원 |

```svelte
<Textarea label="메모" required bind:value={memo} rows={5} placeholder="내용을 입력하세요" />
```

---

### Select

파일: `src/lib/components/Select.svelte`
> Svelte 4 스타일(`export let`) — `on:change` 이벤트 사용

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `(string \| SelectOptionType)[]` | `[]` | 선택지 목록 |
| `selected` | `string \| number \| SelectOptionType \| undefined` | - | 현재 선택값 |
| `placeholder` | `string` | - | 미선택 시 표시 텍스트. 미지정 시 첫 옵션 자동 선택 |
| `disabled` | `boolean` | `false` | 비활성화 |
| `showCheck` | `boolean` | `false` | 선택 항목에 체크 아이콘 표시 |
| `iconType` | `'chevron' \| 'fill'` | `'chevron'` | 드롭다운 화살표 스타일 |
| `showActiveHighlight` | `boolean` | `false` | 기본값과 다를 때 primary 하이라이트 |
| `defaultValue` | `string` | - | 활성 하이라이트 기준 기본값 |
| `hoverBoxClass` | `string` | `'right-0'` | 드롭다운 패널 추가 클래스 |
| `dropdownZIndex` | `number` | `10001` | 드롭다운 포털 z-index |
| `initialScrollValue` | `string` | - | 열릴 때 스크롤할 옵션 value |
| `class` | `string` | - | 컨테이너 추가 클래스 |
| `btnClass` | `string` | - | 트리거 버튼 추가 클래스 |

**이벤트**: `on:change` — `dispatch('change', option)` (Svelte 4 이벤트)

```svelte
<Select
  options={['전체', '활성', '비활성']}
  bind:selected={status}
  placeholder="상태 선택"
  showActiveHighlight
  defaultValue="전체"
  on:change={(e) => handleChange(e.detail)}
/>
```

---

### Checkbox

파일: `src/lib/components/Checkbox.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | **필수** | input id (label for 연결) |
| `checked` | `boolean` | `false` | 체크 상태 (`$bindable`) |
| `disabled` | `boolean` | `false` | 비활성화 |
| `readonly` | `boolean` | `false` | 읽기 전용 |
| `boxClass` | `string` | `''` | input 요소 추가 클래스 |
| `labelClass` | `string` | `''` | label 요소 추가 클래스 |
| `checkedClass` | `string` | `''` | 체크 시 배경/아이콘 색상 (hex 권장) |
| `containerClass` | `string` | `''` | 감싸는 div 추가 클래스 |
| `onchange` | `(checked: boolean) => void` | - | 체크 상태 변경 콜백 |
| `onclick` | `(e: MouseEvent) => void` | - | 클릭 핸들러 |

```svelte
<Checkbox id="agree" bind:checked={agreed} onchange={(v) => console.log(v)} />
```

---

### Switch

파일: `src/lib/components/Switch.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `checked` | `boolean` | `false` | 토글 상태 (`$bindable`) |
| `disabled` | `boolean` | `false` | 비활성화 (opacity-50) |
| `onclick` | `() => void` | `() => {}` | 토글 시 실행 콜백 |
| `ariaLabel` | `string` | `''` | 버튼 aria-label |
| `className` | `string` | `''` | 버튼 추가 클래스 |

```svelte
<Switch bind:checked={isActive} onclick={() => handleToggle()} ariaLabel="활성화 여부" />
```

---

### Slider (Segmented Control)

파일: `src/lib/components/Slider.svelte`
> 이름은 Slider이지만 실제로는 **세그먼트 탭 버튼(Segmented Control)** 컴포넌트.
> Svelte 4 스타일 — `bind:value` 사용

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `Array<{ label: string; value: string }>` | `[]` | 탭 목록 |
| `value` | `string` | **필수** | 현재 선택된 value (`bind:value` 가능) |
| `class` | `string` | - | 컨테이너 추가 클래스 |

```svelte
<Slider
  options={[{ label: '월간', value: 'monthly' }, { label: '연간', value: 'yearly' }]}
  bind:value={period}
/>
```

---

### AutocompleteInput

파일: `src/lib/components/AutocompleteInput.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | - | 레이블 텍스트 |
| `required` | `boolean` | `false` | 필수 표시 (*) |
| `value` | `string` | `''` | 입력값 (`$bindable`) |
| `suggestions` | `string[]` | `[]` | 자동완성 후보 목록 |
| `maxSuggestions` | `number` | `10` | 드롭다운에 표시할 최대 수 |
| `emptyHint` | `string` | `'일치하는 항목 없음'` | 일치 항목 없을 때 표시 메시지 |
| `placeholder` | `string` | - | input placeholder |
| `disabled` | `boolean` | `false` | 비활성화 |
| `rightAction` | `Snippet` | - | input 우측 내부 스니펫 영역 |
| `...rest` | `HTMLInputAttributes` | - | 나머지 네이티브 input 속성 |

**키보드**: `ArrowDown/Up` 탐색 · `Enter` 선택 · `Escape/Tab` 닫기

```svelte
<AutocompleteInput
  label="소속 센터"
  bind:value={centerName}
  suggestions={centerNames}
  placeholder="센터명 입력"
>
  {#snippet rightAction()}
    <button class="text-xs text-primary-500" onclick={applyAll}>전체 적용</button>
  {/snippet}
</AutocompleteInput>
```

---

### DatePickerInput

파일: `src/lib/components/DatePickerInput.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | **필수** (`$bindable`) | 선택된 날짜 (`'YYYY-MM-DD'`) |
| `placeholder` | `string` | `'YYYY-MM-DD'` | 미선택 시 표시 텍스트 |
| `disabled` | `boolean` | `false` | 비활성화 |
| `showActiveHighlight` | `boolean` | `false` | 값이 있을 때 primary 하이라이트 |
| `class` | `string` | `''` | 컨테이너 추가 클래스 |

```svelte
<DatePickerInput bind:value={startDate} showActiveHighlight placeholder="시작일 선택" />
```

---

### Calendar

파일: `src/lib/components/Calendar.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `selectedDate` | `Date \| null` | `null` (`$bindable`) | 선택된 날짜 |
| `onDateSelect` | `(date: Date) => void` | - | 날짜 선택 콜백 |
| `minDate` | `Date \| null` | `null` | 최소 선택 가능 날짜 |
| `maxDate` | `Date \| null` | `null` | 최대 선택 가능 날짜 |
| `class` | `string` | `''` | 추가 클래스 |

뷰 전환 흐름: `days` → 헤더 클릭 → `years` → 연도 선택 → `months` → 월 선택 → `days`

```svelte
<Calendar
  bind:selectedDate={form.birthDate}
  minDate={new Date('1900-01-01')}
  maxDate={new Date()}
  onDateSelect={(date) => console.log(date.toISOString())}
/>
```

---

## 3. Component API — 레이아웃·테이블·네비게이션

### AdminSidebar

파일: `src/lib/components/AdminSidebar.svelte`

Props 없음. 의존 스토어: `sidebar`(접힘 상태), `auth`(로그인 유저), `page`(현재 URL). 레이아웃에 한 번만 배치.

```svelte
<AdminSidebar />
```

---

### PageHeader

파일: `src/lib/components/PageHeader.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | **필수** | 페이지 제목 |
| `description` | `string` | - | 제목 아래 부연 설명 |
| `actions` | `Snippet` | - | 우측에 렌더할 액션 버튼 영역 |

```svelte
<PageHeader title="센터 목록" description="등록된 센터를 관리합니다. · 총 {total}개">
  {#snippet actions()}
    <Button color="primary" size="md" onclick={openCreateModal}>센터 등록</Button>
  {/snippet}
</PageHeader>
```

---

### Table

파일: `src/lib/components/Table.svelte`

**TableColumn 타입**

```typescript
export interface TableColumn<T = any> {
  key: string
  label: string
  width?: string               // CSS grid 너비 (예: '1fr', '120px')
  align?: 'left' | 'center' | 'right'
  headerClass?: string
  cellClass?: string
  stopPropagation?: boolean    // 셀 클릭 시 row 클릭 전파 차단
  render?: Snippet<[{ item: T; index: number; isChecked: boolean }]>
  headerRender?: Snippet<[]>
}
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `TableColumn[]` | **필수** | 컬럼 정의 배열 |
| `data` | `any[]` | **필수** | 테이블 데이터 |
| `keyField` | `string` | `'id'` | 행 고유 식별자 필드명 |
| `showCheckbox` | `boolean` | `false` | 행 선택 체크박스 표시 |
| `checkboxWidth` | `string` | `'32px'` | 체크박스 컬럼 너비 |
| `selectedIds` | `string[]` | `[]` | 선택된 행 ID 배열 (`$bindable`) |
| `onCheckChange` | `(selectedIds: string[]) => void` | - | 체크박스 변경 콜백 |
| `onRowClick` | `(item: any) => void` | - | 행 클릭 콜백 |
| `headerClass` | `string` | `''` | 헤더 행 추가 클래스 |
| `rowClass` | `string` | `''` | 데이터 행 추가 클래스 |
| `containerClass` | `string` | `''` | 최외곽 컨테이너 추가 클래스 |
| `bodyClass` | `string` | `''` | 스크롤 바디 영역 추가 클래스 |
| `hoverEnabled` | `boolean` | `false` | 행 hover 하이라이트 + cursor-pointer |

```svelte
<script lang="ts">
  import Table, { type TableColumn } from '$components/Table.svelte'

  const columns: TableColumn<Center>[] = [
    { key: 'name', label: '센터명', width: '1fr' },
    { key: 'status', label: '상태', width: '100px', align: 'center', render: statusCell }
  ]
</script>

{#snippet statusCell({ item }: { item: Center; index: number; isChecked: boolean })}
  <span class="badge">{item.status}</span>
{/snippet}

<Table {columns} data={centers} onRowClick={(item) => goto(`/center/${item.id}`)} hoverEnabled />
```

---

### Pagination

파일: `src/lib/components/Pagination.svelte`
> Svelte 4 스타일 — `bind:currentPage` 사용. `totalPages === 0`이면 미렌더.

| Prop | Type | Default | Description |
|---|---|---|---|
| `totalItems` | `number` | `0` | 전체 아이템 수 |
| `itemsPerPage` | `number` | `10` | 페이지당 아이템 수 |
| `currentPage` | `number` | `1` | 현재 페이지 (`bind:currentPage` 가능) |
| `maxVisiblePages` | `number` | `5` | 한 번에 표시할 페이지 번호 수 |
| `class` | `string` | - | 추가 클래스 (`$$props['class']`로 수신) |

```svelte
<Pagination
  totalItems={response.total}
  itemsPerPage={20}
  bind:currentPage
  class="mt-4 justify-end"
/>
```

---

### NoDataSection

파일: `src/lib/components/NoDataSection.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `description` | `string` | `'일치하는 검사가 없어요'` | 빈 상태 안내 문구 |

```svelte
<NoDataSection description="등록된 센터가 없어요." />
```

---

### KebabMenu

파일: `src/lib/components/KebabMenu.svelte`

```typescript
export interface KebabMenuItem {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'  // danger = 빨간 텍스트
}
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `KebabMenuItem[]` | `[]` | 메뉴 아이템 배열 |

- 메뉴는 `portal`로 `body`에 마운트 (z-index 9999, 오버플로 무관)
- 아이템 클릭 시 `stopPropagation` 처리 (테이블 row 클릭 전파 차단)

```svelte
<KebabMenu
  items={[
    { label: '수정', onClick: () => openEditModal(row) },
    { label: '삭제', onClick: () => deleteItem(row.id), variant: 'danger' }
  ]}
/>
```

---

### LinesIndicator (로딩 스피너)

파일: `src/lib/components/LinesIndicator.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `aniDur` | `string` | `'750ms'` | 애니메이션 주기 |
| `disableScreen` | `boolean` | `false` | `true`이면 body pointer-events: none |
| `class` | `string` | `'w-16 stroke-slate-900'` | SVG 크기·색상 오버라이드 |

```svelte
<LinesIndicator disableScreen class="stroke-primary-500 w-12" />
```

---

### Svg

파일: `src/lib/components/Svg.svelte`
> SVG 래퍼. 아이콘 컴포넌트들이 내부적으로 사용.

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | **필수** | SVG width 및 viewBox 너비 |
| `height` | `number` | **필수** | SVG height 및 viewBox 높이 |

기본 슬롯에 `<path>` 등 SVG 자식 요소 주입. `$$restProps` 전체를 SVG 엘리먼트로 전달.

```svelte
<Svg width={24} height={24} class="stroke-gray-500">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16M4 12h16" />
</Svg>
```

---

## 4. Component API — 모달·피드백·파일

### BaseModal

파일: `src/lib/components/modal/BaseModal.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `modalId` | `string` | `''` | 모달 ID (ModalContainer가 자동 주입) |
| `closeModal` | `() => void` | `() => {}` | 닫기 콜백 (자동 주입) |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'wide' \| 'full' \| 'fit'` | `'md'` | 크기 힌트 (ModalContainer가 레이아웃 처리) |
| `showCloseButton` | `boolean` | `true` | 우상단 X 버튼 표시 |
| `showHeaderBorder` | `boolean` | `true` | header 하단 보더 표시 |
| `showFooterBorder` | `boolean` | `true` | footer 상단 보더 표시 |
| `bodyScrollable` | `boolean` | `true` | body 스크롤 허용 |
| `bodyClass` | `string` | `''` | body 영역 추가 클래스 |
| `headerClass` | `string` | `''` | header 영역 추가 클래스 |
| `footerClass` | `string` | `'py-5 px-6'` | footer 영역 추가 클래스 |
| `containerClass` | `string` | `''` | 최상위 div 추가 클래스 |

**스니펫**: `header` · `body` · `footer` (footer 없으면 미렌더)

```svelte
<BaseModal closeModal={closeModal} size="lg">
  {#snippet header()}<h2 class="px-6 py-4 text-headline-01-normal-semibold">제목</h2>{/snippet}
  {#snippet body()}<div class="p-6">본문 내용</div>{/snippet}
  {#snippet footer()}
    <div class="flex justify-end gap-2">
      <Button color="light" onclick={closeModal}>취소</Button>
      <Button color="primary" onclick={handleConfirm}>확인</Button>
    </div>
  {/snippet}
</BaseModal>
```

---

### ConfirmModal

파일: `src/lib/components/modal/ConfirmModal.svelte`

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `'확인'` | 다이얼로그 제목 |
| `message` | `string` | `''` | 본문 메시지 (`\n` 개행 지원) |
| `cancelText` | `string` | `'취소'` | 취소 버튼 텍스트 |
| `confirmText` | `string` | `'확인'` | 확인 버튼 텍스트 |
| `onCancel` | `() => void` | `() => {}` | 취소 클릭 콜백 |
| `onConfirm` | `() => void` | `() => {}` | 확인 클릭 콜백 |
| `type` | `'info' \| 'warning' \| 'danger'` | `'info'` | 확인 버튼 스타일 (`danger` = 빨간색) |

```typescript
// Promise 방식 권장
const result = await modalStore.openWithPromise(ConfirmModal, {
  title: '삭제 확인',
  message: '정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
  confirmText: '삭제',
  type: 'danger'
}, { size: 'sm' })

if (result === 'confirmed') { /* 삭제 실행 */ }
```

---

### ModalContainer

파일: `src/lib/components/modal/ModalContainer.svelte`

Props 없음. `modalStore`를 구독하는 전역 컨테이너. **레이아웃 루트에 한 번만 배치**.

- ESC 키 → 최상단 모달 닫기 (`options.closeOnEscape !== false`)
- 백드롭 클릭 → 최상단 모달 닫기 (`options.closeOnBackdropClick !== false`)
- 모달 열림 시 body 스크롤 잠금

```svelte
<!-- +layout.svelte -->
<ModalContainer />
```

---

### modalStore

파일: `src/lib/stores/modal.ts`

**ModalOptions 타입**

```typescript
interface ModalOptions {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'wide' | 'full' | 'fit'
  customWidth?: number
  customHeight?: number
  closeOnBackdropClick?: boolean  // 기본 true
  closeOnEscape?: boolean         // 기본 true
  persistent?: boolean
  className?: string
}
```

| 메서드 | 반환 | 설명 |
|---|---|---|
| `open({ component, props, options? })` | `string` (모달 id) | 모달 열기 |
| `openWithPromise(component, props, options?)` | `Promise<R>` | Promise 기반 (결과 await 가능) |
| `close(id?)` | `void` | id 없으면 최상단 모달 닫기 |
| `closeAll()` | `void` | 모든 모달 닫기 |
| `resolve(id, result)` | `void` | 특정 모달을 결과값과 함께 닫기 |

```typescript
import { modalStore } from '$stores/modal'

// 단순 열기
modalStore.open({ component: MyModal, props: { title: '제목' }, options: { size: 'md' } })

// Promise 방식
const result = await modalStore.openWithPromise(ConfirmModal, { message: '확인?' }, { size: 'sm' })
```

---

### Snackbar

파일: `src/lib/components/Snackbar.svelte`

Props 없음. `snackbarStore` 구독. 화면 하단 중앙 고정. **레이아웃 루트에 한 번만 배치**.

```svelte
<Snackbar />
```

---

### snackbarStore

파일: `src/lib/stores/snackbar.ts`

| 메서드 | 설명 |
|---|---|
| `success(message)` | 초록 토스트 (3초) |
| `error(message)` | 빨간 토스트 (3초) |
| `info(message)` | 파란 토스트 (3초) |
| `warning(message)` | 주황 토스트 (3초) |

```typescript
import { snackbarStore } from '$stores/snackbar'
snackbarStore.success('저장되었습니다.')
snackbarStore.error('오류가 발생했습니다.')
```

---

### FileAttachment

파일: `src/lib/components/FileAttachment.svelte`

파일 업로드 + 목록 표시 통합. 드래그앤드롭 + 클릭 업로드. API 즉시 업로드 방식.

| Prop | Type | Default | Description |
|---|---|---|---|
| `attachments` | `AttachmentItem[]` | `[]` (`$bindable`) | 첨부파일 목록 |
| `noticeId` | `string` | `'draft'` | 업로드 API에 전달할 공지 ID |
| `maxFiles` | `number` | `5` | 최대 첨부 파일 수 |
| `readonly` | `boolean` | `false` | 다운로드 링크만 표시 |
| `onchange` | `(attachments: AttachmentItem[]) => void` | - | 파일 추가/삭제 콜백 |

허용 확장자: jpg·jpeg·png·gif·webp·pdf·doc·docx·xls·xlsx·ppt·pptx·hwp·hwpx / 최대 10MB

```svelte
<FileAttachment bind:attachments={form.attachments} noticeId={notice.id} maxFiles={3} />
```

---

### FileDropZone

파일: `src/lib/components/FileDropZone.svelte`

범용 드롭존. 파일을 선택해서 콜백으로만 전달 (즉시 업로드 없음).

| Prop | Type | Default | Description |
|---|---|---|---|
| `multiple` | `boolean` | `false` | 다중 파일 선택 허용 |
| `accept` | `string` | - | 허용 MIME/확장자 (예: `'.pdf,.docx'`) |
| `disabled` | `boolean` | `false` | 비활성화 |
| `title` | `string` | `'파일을 여기로 드래그하거나'` | 주 안내 문구 |
| `description` | `string` | - | 보조 설명 |
| `hint` | `string` | - | 하단 힌트 (용량/형식 안내) |
| `size` | `'sm' \| 'lg'` | `'sm'` | 드롭존 크기 |
| `onFilesPicked` | `(files: File[]) => void` | **필수** | 파일 선택 완료 콜백 |

```svelte
<FileDropZone
  multiple
  accept=".pdf,.hwp"
  hint="PDF, HWP · 최대 10MB"
  size="lg"
  onFilesPicked={(files) => handleUpload(files)}
/>
```

---

### RichEditor

파일: `src/lib/components/RichEditor.svelte`

`contenteditable` 기반 WYSIWYG. 볼드·밑줄·하이라이트·목록·링크·이미지 지원.

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `''` | 에디터 DOM id. 변경 시 content 초기화 트리거 |
| `value` | `string` | `''` (`$bindable`) | HTML 문자열 |
| `readonly` | `boolean` | `false` | 읽기 전용 (툴바 숨김) |
| `hasLinkOption` | `boolean` | `false` | 링크 삽입 버튼 표시 |
| `hasImageOption` | `boolean` | `false` | 이미지 업로드 버튼 표시 |
| `imageCategory` | `string` | `'notice'` | 이미지 업로드 API category |
| `imageEntityId` | `string` | `''` | 이미지 업로드 API entity_id |
| `placeholder` | `string` | `'내용을 입력하세요'` | 빈 상태 플레이스홀더 |
| `label` | `string` | - | 에디터 상단 라벨 |
| `required` | `boolean` | `false` | 라벨에 필수 표시 (*) |
| `class` | `string` | - | 에디터 div 추가 클래스 |
| `onchange` | `(value: string) => void` | - | 내용 변경 콜백 |

```svelte
<RichEditor
  bind:value={form.content}
  label="공지 내용"
  required
  hasLinkOption
  hasImageOption
  imageCategory="notice"
  imageEntityId={noticeId}
/>
```

---

### CertifiedExpertBadge

파일: `src/lib/components/CertifiedExpertBadge.svelte`

인증 심리 전문가 배지 (파란 원 + Ψ 기호).

| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | `'sm' \| 'md'` | `'md'` | 배지 크기 (`sm`: 20px, `md`: 24px) |
| `iconOnly` | `boolean` | `false` | `true`면 텍스트 라벨 숨김 |
| `title` | `string` | `'인증된 심리 전문가'` | 호버 툴팁 |

```svelte
<CertifiedExpertBadge />
<CertifiedExpertBadge size="sm" iconOnly />
```

---

### FloatingMemoButton / FloatingMemoPanel

파일: `src/lib/components/FloatingMemoButton.svelte`, `FloatingMemoPanel.svelte`

**FloatingMemoButton**: Props 없음. 화면 우하단 고정 FAB. 클릭하면 FloatingMemoPanel 토글.

**FloatingMemoPanel**:

| Prop | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | **필수** | 패널 표시 여부 |
| `onClose` | `() => void` | **필수** | 닫기 콜백 |

```svelte
<!-- 레이아웃에 한 번 배치 -->
<FloatingMemoButton />
```

---

## 5. 페이지 레이아웃 패턴

### 목록 페이지 (List Page) — 표준 5단 구조

모든 목록 페이지가 동일한 구조를 따른다.

```svelte
<div in:fade class="p-6">
  <!-- 1. 헤더 -->
  <PageHeader title="..." description="... · 총 {total}개">
    {#snippet actions()}
      <Button color="primary" size="md" onclick={openCreateModal}>신규 등록</Button>
    {/snippet}
  </PageHeader>

  <!-- 2. 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <Input bind:value={search} placeholder="검색..." class="w-64" />
    <Select options={statusOptions} bind:selected={statusFilter} placeholder="상태" on:change={...} />
    <Button color="light" size="sm" onclick={resetFilters}>초기화</Button>
  </div>

  <!-- 3. 콘텐츠 영역 -->
  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-500">불러오는 중...</Typography>
    </div>
  {:else if items.length === 0}
    <div class="section-border py-16">
      <NoDataSection description="등록된 항목이 없어요." />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table {columns} data={items} onRowClick={handleRowClick} hoverEnabled />
    </div>
    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage class="justify-end" />
    </div>
  {/if}
</div>
```

### 상태 뱃지 패턴 — Config 객체 분리

```typescript
const STATUS_CONFIG = {
  pending:  { label: '대기',   bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-500' },
  approved: { label: '승인',   bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500' },
  rejected: { label: '거절',   bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
} as const
```

```svelte
{#snippet statusCell({ item })}
  {@const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending}
  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 {cfg.bg} {cfg.text}">
    <span class="h-1.5 w-1.5 rounded-full {cfg.dot}"></span>
    {cfg.label}
  </span>
{/snippet}
```

---

## 6. Query·Mutation 패턴

파일: `src/lib/hooks/queries/builder.ts`

### queryBuilder

```typescript
const query = $derived(
  queryBuilder<ItemType, ApiResponse<ItemType>>(
    getItemList,           // action 함수
    () => ({               // 반응형 파라미터 (반드시 getter 함수로 감싸기)
      search: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      page: currentPage,
      size: pageSize
    }),
    () => ({ staleTime: 60_000 })  // queryOptions (선택)
  )
)

const items = $derived(query.data?.items ?? [])
const total = $derived(query.data?.total ?? 0)
const isLoading = $derived(query.isPending)
```

**핵심 동작**:
- `keyId`는 반드시 `() => ({})` getter 함수로 전달해야 반응형이 보장됨
- `placeholderData: keepPreviousData` — 페이지 전환 시 이전 데이터 유지
- `refetchOnMount: 'always'` — 진입 시 항상 최신 데이터 fetch
- `throwOnError: true` — 에러는 전역 핸들러로 전파

### mutationBuilder

```typescript
const mutation = mutationBuilder(
  patchItemStatus,          // action 함수
  ['getItemList'],          // 성공 후 무효화할 쿼리 키
  [],                       // 추가 무효화 키들
  { successMessage: '상태가 변경되었습니다.' }
)

// 사용
await mutation.mutateAsync({ id, status })
```

### URL 동기화 3단계 패턴 (필수)

```typescript
// 1. 초기값 읽기
const url = useUrlFilters({ search: '', status: 'all', page: 1 })
let search = $state(url.initial.search as string)
let statusFilter = $state(url.initial.status as string)
let currentPage = $state(Number(url.initial.page) || 1)

// 2. 검색 디바운스 (300ms)
let debouncedSearch = $state(search)
let searchTimeout: ReturnType<typeof setTimeout>
$effect(() => {
  clearTimeout(searchTimeout)
  const q = search
  searchTimeout = setTimeout(() => { debouncedSearch = q; currentPage = 1 }, 300)
})

// 3. 단일 $effect로 URL 동기화 (initialized 플래그로 최초 실행 스킵)
let initialized = false
$effect(() => {
  const snapshot = { search: debouncedSearch, status: statusFilter, page: currentPage }
  if (!initialized) { initialized = true; return }
  url.sync(snapshot)
})

// 4. 필터 변경 시 페이지 리셋
$effect(() => {
  statusFilter  // 의존성 추적용
  currentPage = 1
})
```

---

## 7. 유틸리티 함수

### format.ts

파일: `src/lib/utils/format.ts`

| 함수 | 시그니처 | 설명 |
|---|---|---|
| `formatDate` | `(date: Date \| string \| null \| undefined, format?: string) => string` | UTC naive 서버 시간 → KST 변환 후 포맷. 기본 `'YYYY-MM-DD'`. 토큰: `YYYY YY MM DD HH mm SS`. 유효하지 않으면 `'-'` |
| `formatAddress` | `(address: any) => string` | `{ address, detail }` 객체를 공백으로 합쳐 반환. 빈 값이면 `'-'` |

```typescript
formatDate(item.created_at)                       // '2025-06-11'
formatDate(item.created_at, 'YYYY-MM-DD HH:mm')  // '2025-06-11 14:30'
formatAddress({ address: '서울시', detail: '101호' }) // '서울시 101호'
```

### errorHandler.ts

파일: `src/lib/utils/errorHandler.ts`

**에러 메시지 추출 우선순위**: `response.data.meta.message` → `response.data.detail` → `response.data.message` → `error.message` → 폴백 메시지

| 함수 | 설명 |
|---|---|
| `extractErrorMessage(error)` | 메시지 추출만 (스낵바 미호출) |
| `showErrorSnackbar(error, defaultMessage?)` | 에러 → 메시지 추출 → `snackbarStore.error()` 호출 |
| `showSuccessSnackbar(message)` | `snackbarStore.success()` 래퍼 |
| `showErrorMessage(message)` | `snackbarStore.error()` 래퍼 |
| `showWarningMessage(message)` | `snackbarStore.warning()` 래퍼 |
| `showInfoMessage(message)` | `snackbarStore.info()` 래퍼 |

> `mutationBuilder`는 `onError`에서 `showErrorSnackbar`를 자동 호출하므로, 뮤테이션 사용 코드에서 별도 try-catch 불필요.

---

## 8. Usage Rules — 금지 및 필수 규칙

### 금지 사항

| 금지 패턴 | 올바른 대안 |
|---|---|
| `style="color: red"` 인라인 스타일 | Tailwind 유틸리티 클래스 사용 |
| 하드코딩 색상값 (`#FF0000`, `rgb(...)`) | `text-red-500`, `bg-green-50` 등 Tailwind 팔레트 |
| 레거시 타이포 클래스 (`text-body-02-medium` 구버전) | 현행 체계 (`text-body-02-normal-medium`) |
| `queryBuilder` keyId에 값 직접 전달 | 반드시 `() => ({})` getter 함수로 감싸기 |
| 외부 서버 직접 호출 (`http://localhost:3502/...`) | SvelteKit 프록시 `/api/proxy/...` 경유 |
| 컴포넌트 최상위 레벨에서 `requireCenterId()` 호출 | 이벤트 핸들러 내부에서만 호출 |
| 테이블/목록 페이지에서 try-catch로 뮤테이션 에러 처리 | `mutationBuilder`의 자동 에러 핸들러 위임 |
| 같은 `$effect` 안에서 URL 동기화 + 초기화 혼용 | `initialized` 플래그 패턴 적용 |

### 필수 준수 사항

| 패턴 | 설명 |
|---|---|
| **`section-border` CSS 클래스** | Table 감싸는 컨테이너에 항상 적용 |
| **페이지 진입 트랜지션** | `in:fade` 항상 추가 (`<div in:fade class="p-6">`) |
| **description에 총 건수 포함** | `PageHeader description="... · 총 {total}개"` |
| **필터 `'all'` → API 파라미터 제외** | `status !== 'all' ? status : undefined` |
| **검색 디바운스 300ms** | 검색 input은 반드시 300ms 디바운스 후 API 호출 |
| **필터 변경 시 페이지 1로 리셋** | 필터가 바뀌면 `currentPage = 1` |
| **상태 뱃지 Config 객체 분리** | 인라인 삼항식 대신 config 객체로 분리 |
| **Table 커스텀 셀은 snippet으로** | `columns[].render = snippetRef` 패턴 |
| **ModalContainer + Snackbar는 레이아웃 루트에 한 번** | 중복 배치 금지 |
| **Button `color="stroke-delete"`** | 삭제 액션 버튼의 표준 스타일 |
| **모달 열기는 `modalStore.open()` / `openWithPromise()`** | 컴포넌트 직접 렌더 금지 |

---

## 9. 대시보드 UI 패턴

> 메트릭 카드·차트·복합 테이블이 혼합된 분석/운영 대시보드 화면에 적용하는 조립 규칙.
> 기존 가이드(1~8섹션)의 컴포넌트를 기반으로 하되, 가이드에 없는 신규 요소는 이 섹션의 규칙으로 구성한다.

---

### 9-1. 대시보드 페이지 기본 구조

```svelte
<div in:fade class="p-6">
  <!-- 1. 페이지 헤더 -->
  <PageHeader title="AI 사용량" description="월간 API 비용·호출량 현황" />

  <!-- 2. 경고 배너 (조건부 — 9-5 참고) -->
  {#if hasWarning}...{/if}

  <!-- 3. KPI 카드 행 (9-2 참고) -->
  <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <!-- KPI 카드들 -->
  </div>

  <!-- 4. 차트 섹션 (9-3 참고) -->
  <div class="mb-6 section-border bg-white">
    <!-- Chart.js 컴포넌트 -->
  </div>

  <!-- 5. 데이터 테이블 섹션(들) -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- 테이블들 -->
  </div>
</div>
```

---

### 9-2. KPI 카드 패턴

모든 KPI 카드는 `section-border` 래퍼를 기본으로 사용한다. 복잡도에 따라 두 가지 형태로 구분한다.

#### 단순 카드 (메인 숫자 + 전월 대비 뱃지)

```svelte
<div class="section-border flex flex-col gap-1.5 px-5 py-4">
  <p class="text-label-01-normal-regular text-gray-500">총 API 비용</p>
  <div class="flex items-end justify-between gap-2">
    <p class="tabular-nums text-headline-01-normal-bold text-gray-900">234만원</p>
    {#if badge}
      <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5
        text-label-01-normal-medium {badge.bg} {badge.text}">
        <span class="h-1.5 w-1.5 rounded-full {badge.dot}"></span>
        {badge.label}
      </span>
    {/if}
  </div>
  <p class="text-label-01-normal-regular text-gray-400">전월 대비</p>
</div>
```

#### 복합 카드 (메인 숫자 + 하단 서브 지표 그리드)

카드 안에 2개 이상의 연관 지표를 나란히 표시해야 할 때 `divide-x divide-gray-100 border-t border-gray-100`으로 구분한다.

```svelte
<div class="section-border flex flex-col">
  <!-- 상단: 메인 지표 -->
  <div class="px-5 py-4">
    <p class="text-label-01-normal-regular text-gray-500">카드 제목</p>
    <p class="mt-1 tabular-nums text-headline-01-normal-bold text-gray-900">{메인값}</p>
  </div>
  <!-- 하단: 서브 지표 2열 -->
  <div class="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
    <div class="px-5 py-3">
      <p class="text-label-02-normal-regular text-gray-400">서브 라벨 1</p>
      <p class="mt-0.5 tabular-nums text-body-03-normal-bold text-gray-700">{서브값1}</p>
    </div>
    <div class="px-5 py-3">
      <p class="text-label-02-normal-regular text-gray-400">서브 라벨 2</p>
      <p class="mt-0.5 tabular-nums text-body-03-normal-bold {색상클래스}">{서브값2}</p>
    </div>
  </div>
</div>
```

**타이포그래피 규칙**:

| 역할 | 클래스 |
|---|---|
| 카드 레이블 | `text-label-01-normal-regular text-gray-500` |
| 메인 숫자 | `text-headline-01-normal-bold text-gray-900 tabular-nums` |
| 서브 레이블 | `text-label-02-normal-regular text-gray-400` |
| 서브 숫자 | `text-body-03-normal-bold text-gray-700 tabular-nums` |
| 보조 설명 | `text-label-01-normal-regular text-gray-400` |

**뱃지 Config 패턴**: 섹션 5의 Status Badge Config와 동일하게 `{ label, bg, text, dot }` 구조를 사용한다. 인라인 삼항식으로 색상을 직접 결정하지 않는다.

```typescript
// ✅ Config 함수로 분리
function costChangeBadge(pct: number | null) {
  if (pct == null)     return null
  if (Math.abs(pct) < 1) return { label: '유지',         bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400' }
  if (pct > 0)           return { label: `↑ +${Math.round(pct)}%`, bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' }
  return                  { label: `↓ ${Math.round(pct)}%`, bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' }
}
```

---

### 9-3. 차트 표준 (Chart.js)

**라이브러리**: `chart.js` (admin에 설치됨)

**색상 표준**:

| 용도 | 색상값 | Tailwind 대응 |
|---|---|---|
| 선택/활성 바 | `#6366f1` | `primary-500` |
| hover 바 | `#a5b4fc` | `primary-300` |
| 기본 바 | `#e5e7eb` | `gray-200` |
| 라인 차트 주선 | `#6366f1` | `primary-500` |
| 라인 차트 보조선 | `#a5b4fc` | `primary-300` |
| tooltip 배경 | `#1f2937` | `gray-800` |
| tooltip 제목 | `#9ca3af` | `gray-400` |
| tooltip 값 | `#f9fafb` | `gray-50` |

**폰트 전역 설정** (차트 컴포넌트 최상단에서 한 번):

```typescript
Chart.defaults.font.family = "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
```

**바 차트 컴포넌트 뼈대**:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import {
    Chart, BarController, BarElement,
    CategoryScale, LinearScale, Tooltip,
  } from 'chart.js'

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)
  Chart.defaults.font.family = "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

  interface Props {
    data: { label: string; value: number }[]
    selectedLabel?: string
    height?: number
    onSelect?: (label: string) => void
  }
  let { data, selectedLabel, height = 160, onSelect }: Props = $props()

  const SEL   = '#6366f1'  // primary-500
  const HOVER = '#a5b4fc'  // primary-300
  const DEF   = '#e5e7eb'  // gray-200

  let canvas: HTMLCanvasElement | undefined = $state()
  let chart: Chart | null = null

  onMount(() => {
    if (!canvas) return
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.label === selectedLabel ? SEL : DEF),
          hoverBackgroundColor: data.map(d => d.label === selectedLabel ? SEL : HOVER),
          borderRadius: 4,
          borderSkipped: 'bottom',
          maxBarThickness: 40,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        onClick: (_e, elements) => {
          if (elements.length > 0) onSelect?.(data[elements[0].index].label)
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2937', titleColor: '#9ca3af', bodyColor: '#f9fafb',
            padding: 10, cornerRadius: 8,
            titleFont: { size: 11 }, bodyFont: { size: 13, weight: 'bold' },
          },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
          y: { display: false, beginAtZero: true },
        },
      },
    })
  })

  onDestroy(() => { if (browser) chart?.destroy() })

  $effect(() => {
    if (!chart) return
    chart.data.datasets[0].backgroundColor = data.map(d =>
      d.label === selectedLabel ? SEL : DEF
    )
    chart.update('none')
  })
</script>

<div style="height:{height}px; cursor:pointer">
  <canvas bind:this={canvas}></canvas>
</div>
```

**차트 섹션 래퍼 규칙**:

```svelte
<!-- ✅ 올바른 래퍼 — overflow-hidden 없음 -->
<div class="section-border bg-white">
  <div class="px-6 py-5">
    <MyBarChart {data} {selectedLabel} onSelect={(l) => (selectedLabel = l)} />
  </div>
</div>

<!-- ❌ 금지 — Chart.js tooltip이 클리핑됨 -->
<div class="section-border overflow-hidden bg-white">...</div>
```

> Chart.js tooltip은 canvas 외부로 오버플로할 수 있다. `section-border`에 `overflow-hidden`을 추가하면 tooltip이 잘린다.

---

### 9-4. 테이블 내부 커스텀 UI

Table 컴포넌트의 `render` snippet 안에서 사용하는 패턴들. 컴포넌트를 새로 만들지 않고 snippet 내부에 인라인으로 작성한다.

#### 인라인 프로그레스 바 (비율 비중)

```svelte
{#snippet shareCell({ item }: { item: FeatureRow })}
  <div class="flex items-center justify-end gap-2">
    <div class="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
      <div
        class="h-full rounded-full bg-primary-400 transition-all"
        style="width:{Math.min(item.share, 100)}%"
      ></div>
    </div>
    <span class="w-9 text-right tabular-nums text-label-01-normal-medium text-gray-500">
      {item.share.toFixed(0)}%
    </span>
  </div>
{/snippet}
```

- 프로그레스 바 컨테이너: 반드시 `overflow-hidden` 적용 (bar가 컨테이너 밖으로 넘치지 않도록)
- 너비 고정: `w-16` (64px), 높이 `h-1.5` (6px)
- 채움 색상: `bg-primary-400`

#### 범위별 색상 뱃지 (에러율·마진율·급증 등)

수치 범위에 따라 색상이 달라지는 지표는 반드시 **config 함수**로 분리한다. snippet 내부 삼항식 금지.

```typescript
// 에러율 config: ≥2% 빨강 | ≥0.5% 노랑 | 정상 회색
function errorRateConfig(count: number, pct: number) {
  if (pct >= 2)   return { label: `실패 ${count}건 (${pct.toFixed(1)}%)`, bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500'    }
  if (pct >= 0.5) return { label: `실패 ${count}건 (${pct.toFixed(1)}%)`, bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' }
  return           { label: `실패 ${count}건 (${pct.toFixed(1)}%)`,       bg: 'bg-gray-100',  text: 'text-gray-400',   dot: 'bg-gray-300'   }
}

// 마진율 config: ≥20% 초록 | ≥0% 노랑 | 음수 빨강
function marginConfig(pct: number) {
  if (pct >= 20) return { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  }
  if (pct >= 0)  return { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' }
  return          { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500'    }
}

// 급증 탐지 config: ≥100% 빨강 | ≥50% 노랑 | null (배지 숨김)
function spikeConfig(pct: number) {
  if (pct >= 100) return { label: `급증 +${Math.round(pct)}%`, bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500'    }
  if (pct >= 50)  return { label: `급증 +${Math.round(pct)}%`, bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' }
  return null
}
```

```svelte
{#snippet errorCell({ item })}
  {@const cfg = errorRateConfig(item.errorCount, item.errorRatePct)}
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5
    text-label-01-normal-medium {cfg.bg} {cfg.text}">
    <span class="h-1 w-1 rounded-full {cfg.dot}"></span>
    {cfg.label}
  </span>
{/snippet}
```

#### 드릴다운 링크 (셀 내 anchor)

테이블 `onRowClick`과 별개로 특정 셀을 클릭해 다른 페이지로 이동할 때.

```svelte
{#snippet nameCell({ item })}
  <a
    href="/centers/{item.id}"
    class="text-body-03-normal-medium text-gray-800 hover:text-primary-600 hover:underline"
    onclick={(e) => e.stopPropagation()}
  >
    {item.name}
  </a>
{/snippet}
```

`e.stopPropagation()` 필수 — `onRowClick` 전파를 차단하지 않으면 링크 이동과 행 클릭이 동시에 발생한다.

---

### 9-5. 경고·이상 배너

페이지 상단에 조건부로 표시하는 알림 배너. 데이터 이상·임계값 초과 등 사용자 주의가 필요할 때만 렌더한다. `mb-6`으로 하단 요소와 간격을 둔다.

```svelte
{#if hasWarning}
  <div class="mb-6 flex items-start gap-3 rounded-xl border {borderCls} {bgCls} px-5 py-4">
    <!-- 경고 아이콘 -->
    <svg class="mt-0.5 h-4 w-4 shrink-0 {iconCls}" fill="none" stroke="currentColor"
         stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
    <div class="min-w-0 flex-1">
      <p class="text-body-03-normal-semibold {titleCls}">배너 제목</p>
      <p class="mt-0.5 text-body-03-normal-regular {bodyCls}">배너 내용</p>
    </div>
  </div>
{/if}
```

**심각도별 색상**:

| 심각도 | `borderCls` | `bgCls` | `iconCls` | `titleCls` | `bodyCls` |
|---|---|---|---|---|---|
| 위험(error) | `border-red-200` | `bg-red-50` | `text-red-500` | `text-red-700` | `text-red-600` |
| 경고(warning) | `border-yellow-200` | `bg-yellow-50` | `text-yellow-500` | `text-yellow-800` | `text-yellow-700` |
| 정보(info) | `border-blue-200` | `bg-blue-50` | `text-blue-500` | `text-blue-700` | `text-blue-600` |

---

### 9-6. 대시보드 레이아웃 그리드

대시보드는 반응형 grid를 기본으로 한다. 아래 표준 패턴을 우선 적용하고, 새로운 변형이 필요할 때만 추가한다.

| 구간 | grid 클래스 | 사용처 |
|---|---|---|
| KPI 카드 4열 | `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` | 4개 단일 지표 균등 배치 |
| KPI 카드 2열 (복합) | `grid grid-cols-1 gap-4 lg:grid-cols-2` | 복합 카드 2개 가로 배치 |
| 차트 + 사이드패널 | `grid grid-cols-1 divide-y lg:grid-cols-[1fr_220px] lg:divide-x lg:divide-y-0` | 차트 좌측, 선택 데이터 패널 우측 |
| 차트 + 기능 목록 | `grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]` | 차트 넓게, 비중 목록 좁게 |
| 테이블 2열 | `grid grid-cols-1 gap-6 lg:grid-cols-2` | 기능별/센터별 테이블 병렬 |

섹션 간 간격은 `mb-6`으로 통일한다.
