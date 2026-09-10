<script lang="ts" module>
  import type { Snippet } from 'svelte'

  export interface TableColumn<T = any> {
    key: string
    label: string
    width?: string
    align?: 'left' | 'center' | 'right'
    headerClass?: string
    cellClass?: string
    stopPropagation?: boolean
    render?: Snippet<[{ item: T; index: number; isChecked: boolean }]>
    headerRender?: Snippet<[]>
  }
</script>

<script lang="ts">
  import Checkbox from '$lib/components/Checkbox.svelte'
  import Typography from '$components/Typography.svelte'

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
    rowClass?: string
    containerClass?: string
    bodyClass?: string
    hoverEnabled?: boolean
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
    hoverEnabled = false
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
    const columnWidths = columns.map((col) => col.width || 'auto').join(' ')
    return showCheckbox ? `${checkboxWidth} ${columnWidths}` : columnWidths
  })
</script>

<div class="flex flex-col h-full min-h-0 {containerClass}">
  <!-- 바디 (헤더 포함, 같은 스크롤 컨테이너) -->
  <div class="flex flex-col min-h-0 overflow-y-auto bg-white {bodyClass}">
    <!-- 헤더 (sticky) -->
    <div
      class="sticky top-0 z-10 grid h-14 shrink-0 items-center gap-4 bg-gray-50 px-6 {headerClass}"
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
          class="text-body-02-regular flex text-gray-600 {column.align ===
          'center'
            ? 'justify-center'
            : column.align === 'right'
              ? 'justify-end'
              : 'justify-start'} {column.headerClass || ''}"
        >
          {#if column.headerRender}
            {@render column.headerRender()}
          {:else}
            <Typography
              variant="body-01-regular"
              className="w-fit"
              color="text-gray-600"
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
        class="grid items-center min-h-18.5 gap-4 border-b border-gray-100 bg-white px-6 py-3 transition-colors {hoverEnabled
          ? 'cursor-pointer hover:bg-gray-50'
          : ''} {rowClass} {index === data.length - 1 ? 'border-b-0' : ''}"
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
          <div class="flex items-center">
            <Checkbox
              id="table-row-{item[keyField]}"
              checked={isChecked}
              onclick={(e) => {
                e.stopPropagation()
                toggleItem(item[keyField])
              }}
            />
          </div>
        {/if}

        {#each columns as column}
          <div
            class="min-w-0 {getAlignment(column.align)} {column.cellClass || ''}"
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
              <span class="text-body-02-regular text-gray-600">
                {item[column.key] || '-'}
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
