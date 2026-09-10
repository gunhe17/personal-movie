<script lang="ts" module>
  import type { Snippet } from 'svelte'

  export interface TableColumn<T = any> {
    key: string
    label: string
    width?: string
    align?: 'left' | 'center' | 'right'
    headerClass?: string
    /** 셀 클래스. 함수를 넘기면 행마다 다르게 준다(예: 비활성 행만 딤드) */
    cellClass?: string | ((item: T) => string)
    stopPropagation?: boolean
    render?: Snippet<[{ item: T; index: number; isChecked: boolean }]>
    headerRender?: Snippet<[]>
  }
</script>

<script lang="ts">
  import Checkbox from '$lib/components/Checkbox.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { tick } from 'svelte'

  interface Props {
    columns: TableColumn[]
    data: any[]
    keyField?: string
    showCheckbox?: boolean
    checkboxWidth?: string
    selectedIds?: string[]
    onCheckChange?: (selectedIds: string[]) => void
    onRowClick?: (item: any) => void
    headerClass?: string
    /** 행 클래스. 함수를 넘기면 행마다 다르게 준다(예: 비활성 행 딤드) */
    rowClass?: string | ((item: any) => string)
    containerClass?: string
    bodyClass?: string
    hoverEnabled?: boolean
    rowHeight?: string
    /** 이 값이 바뀌면 스크롤을 맨 위로 되돌린다(예: 페이지네이션 이동). */
    scrollResetKey?: string | number
  }

  let {
    columns,
    data,
    keyField = 'id',
    showCheckbox = false,
    checkboxWidth = '32px',
    selectedIds = $bindable([]),
    onCheckChange,
    onRowClick,
    headerClass = '',
    containerClass = '',
    rowClass = '',
    bodyClass = '',
    hoverEnabled = false,
    rowHeight = 'min-h-18.5',
    scrollResetKey = undefined
  }: Props = $props()

  let isAllChecked = $state(false)

  $effect(() => {
    isAllChecked = selectedIds.length > 0 && selectedIds.length === data.length
  })

  function toggleAll() {
    if (isAllChecked) {
      selectedIds = []
    } else {
      selectedIds = data.map((item) => item[keyField])
    }
    onCheckChange?.(selectedIds)
  }

  function toggleItem(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((selectedId) => selectedId !== id)
    } else {
      selectedIds = [...selectedIds, id]
    }
    onCheckChange?.(selectedIds)
  }

  // cellClass는 문자열 또는 (item)=>문자열. rowClass와 동일한 해소 규칙.
  function resolveCellClass(column: TableColumn, item: any) {
    return typeof column.cellClass === 'function'
      ? column.cellClass(item)
      : column.cellClass || ''
  }

  function getAlignment(align?: 'left' | 'center' | 'right') {
    const alignmentClasses = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right'
    }
    return alignmentClasses[align || 'left']
  }

  // Grid template columns 생성
  let gridTemplateColumns = $derived.by(() => {
    const columnWidths = columns
      .map((col) => col.width || 'minmax(0, 1fr)')
      .join(' ')
    return showCheckbox ? `${checkboxWidth} ${columnWidths}` : columnWidths
  })

  // 스크롤 인지: 더 내려볼 수 있는지 추적 (하단 화살표/fade 표시용)
  let scrollEl: HTMLDivElement | null = $state(null)
  let canScrollDown = $state(false)

  function updateScrollState() {
    if (!scrollEl) return
    // 남은 스크롤 거리. 분수 픽셀·sticky 헤더 누적 오차가 1px를 넘을 수 있어
    // 임계값을 여유있게(THRESHOLD) 둔다. 이 값 이하면 '맨 아래'로 간주.
    const SCROLL_END_THRESHOLD = 4
    const remaining =
      scrollEl.scrollHeight - (scrollEl.scrollTop + scrollEl.clientHeight)
    canScrollDown = remaining > SCROLL_END_THRESHOLD
  }

  // 데이터가 바뀌면 다음 렌더 후 스크롤 상태 재계산
  $effect(() => {
    data
    tick().then(updateScrollState)
  })

  // 컨테이너 크기 변화(반응형·창 리사이즈)에도 재계산 (클라이언트 전용)
  $effect(() => {
    if (!scrollEl) return
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(scrollEl)
    return () => ro.disconnect()
  })

  function scrollDown() {
    if (!scrollEl) return
    scrollEl.scrollBy({ top: scrollEl.clientHeight * 0.8, behavior: 'smooth' })
  }

  // scrollResetKey가 바뀌면(예: 페이지 이동) 스크롤을 맨 위로 되돌린다
  $effect(() => {
    scrollResetKey
    if (scrollEl) {
      scrollEl.scrollTop = 0
      tick().then(updateScrollState)
    }
  })
</script>

<div class="relative flex flex-col h-full min-h-0 {containerClass}">
  <!-- 바디 (헤더 포함, 같은 스크롤 컨테이너) -->
  <div
    bind:this={scrollEl}
    onscroll={updateScrollState}
    class="flex flex-col min-h-0 overflow-y-auto bg-white {bodyClass}"
  >
    <!-- 헤더 (sticky) -->
    <div
      class="sticky top-0 z-10 grid h-[52px] shrink-0 items-center gap-4 bg-gray-50/80 backdrop-blur-sm px-6 {headerClass}"
      style="grid-template-columns: {gridTemplateColumns}"
    >
      {#if showCheckbox}
        <div class="flex items-center">
          <Checkbox
            id="table-select-all"
            checked={isAllChecked}
            onchange={toggleAll}
          />
        </div>
      {/if}

      {#each columns as column}
        <div
          class="flex min-w-0 {column.align === 'center'
            ? 'justify-center'
            : column.align === 'right'
              ? 'justify-end'
              : 'justify-start'} {column.headerClass || ''}"
        >
          {#if column.headerRender}
            {@render column.headerRender()}
          {:else}
            <Typography
              variant="body-02-normal-medium"
              className="w-fit"
              color="text-title-subtitle"
            >
              {column.label}
            </Typography>
          {/if}
        </div>
      {/each}
    </div>
    {#each data as item, index (item[keyField])}
      {@const isChecked = selectedIds.includes(item[keyField])}
      <div
        class="grid items-center {rowHeight} gap-4 border-b border-gray-100 bg-white px-6 py-3 transition-colors {hoverEnabled
          ? 'cursor-pointer hover:bg-gray-50'
          : ''} {typeof rowClass === 'function'
          ? rowClass(item)
          : rowClass} {index === data.length - 1 ? 'border-b-0' : ''}"
        style="grid-template-columns: {gridTemplateColumns}"
        onclick={() => onRowClick?.(item)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onRowClick?.(item)
          }
        }}
        role={onRowClick ? 'button' : undefined}
      >
        {#if showCheckbox}
          <div
            class="flex items-center h-full cursor-pointer"
            role="presentation"
            onclick={(e) => {
              e.stopPropagation()
              toggleItem(item[keyField])
            }}
          >
            <Checkbox id="table-row-{item[keyField]}" checked={isChecked} />
          </div>
        {/if}

        {#each columns as column}
          <div
            class="min-w-0 overflow-hidden {getAlignment(
              column.align
            )} {resolveCellClass(column, item)}"
            role={column.stopPropagation ? 'presentation' : undefined}
            onclick={(e) => {
              if (column.stopPropagation) {
                e.stopPropagation()
              }
            }}
            onkeydown={(e) => {
              if (
                column.stopPropagation &&
                (e.key === 'Enter' || e.key === ' ')
              ) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          >
            {#if column.render}
              {@render column.render({ item, index, isChecked })}
            {:else}
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-600"
                className="truncate-safe"
                tag="span"
              >
                {item[column.key] || '-'}
              </Typography>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <!-- 스크롤 인지: 더 내려볼 수 있을 때만 하단 fade + 떠다니는 화살표 -->
  <div
    class="pointer-events-none absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-300"
    style="height: 56px; background: linear-gradient(to top, white 30%, transparent); opacity: {canScrollDown
      ? 1
      : 0};"
  ></div>
  <button
    type="button"
    aria-label="아래로 더 보기"
    onclick={scrollDown}
    class="absolute bottom-2 left-1/2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-white text-gray-400 shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-gray-200 transition-all duration-300 hover:text-gray-600 {canScrollDown
      ? 'translate-y-0 opacity-100'
      : 'pointer-events-none translate-y-1 opacity-0'}"
  >
    <svg
      class="animate-bounce-soft h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path
        d="M17 9.5L12 14.5L7 9.5"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</div>
