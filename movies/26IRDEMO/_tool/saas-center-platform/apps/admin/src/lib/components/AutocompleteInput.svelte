<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'

  interface Props extends Omit<HTMLInputAttributes, 'value' | 'class'> {
    label?: string
    required?: boolean
    value?: string
    suggestions?: string[]
    maxSuggestions?: number
    emptyHint?: string
    /** input 우측 내부에 렌더할 액션 영역 (예: "전체 적용" 버튼) */
    rightAction?: import('svelte').Snippet
  }

  let {
    label,
    required = false,
    value = $bindable(''),
    suggestions = [],
    maxSuggestions = 10,
    emptyHint = '일치하는 항목 없음',
    placeholder,
    disabled = false,
    type = 'text',
    rightAction,
    ...rest
  }: Props = $props()

  let isOpen = $state(false)
  let highlightIndex = $state(-1)
  let inputEl: HTMLInputElement | null = $state(null)
  let listEl: HTMLUListElement | null = $state(null)
  let blurTimer: ReturnType<typeof setTimeout> | null = null

  const filtered = $derived.by(() => {
    const q = value.trim().toLowerCase()
    const cleaned = suggestions.filter((s) => s && s.trim().length > 0)
    if (!q) return cleaned.slice(0, maxSuggestions)
    return cleaned
      .filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .slice(0, maxSuggestions)
  })

  function open() {
    if (disabled) return
    isOpen = true
    highlightIndex = -1
  }

  function close() {
    isOpen = false
    highlightIndex = -1
  }

  function select(s: string) {
    value = s
    close()
    inputEl?.blur()
  }

  function scrollHighlightedIntoView() {
    queueMicrotask(() => {
      const item = listEl?.children[highlightIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    })
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      if (!isOpen) {
        open()
        return
      }
      if (filtered.length === 0) return
      e.preventDefault()
      highlightIndex = (highlightIndex + 1) % filtered.length
      scrollHighlightedIntoView()
    } else if (e.key === 'ArrowUp') {
      if (!isOpen || filtered.length === 0) return
      e.preventDefault()
      highlightIndex =
        highlightIndex <= 0 ? filtered.length - 1 : highlightIndex - 1
      scrollHighlightedIntoView()
    } else if (e.key === 'Enter') {
      if (isOpen && highlightIndex >= 0 && filtered[highlightIndex]) {
        e.preventDefault()
        select(filtered[highlightIndex])
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault()
        close()
      }
    } else if (e.key === 'Tab') {
      close()
    }
  }

  function onFocus() {
    if (blurTimer) {
      clearTimeout(blurTimer)
      blurTimer = null
    }
    open()
  }

  function onBlur() {
    // 드롭다운 클릭이 처리될 시간을 줌 (mousedown으로 처리되지만 안전망)
    blurTimer = setTimeout(close, 120)
  }
</script>

<div>
  {#if label}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="mb-1.5 block text-sm font-medium text-gray-700">
      {label}
      {#if required}<span class="text-red-500">*</span>{/if}
    </label>
  {/if}
  <div class="relative">
    <input
      bind:this={inputEl}
      bind:value
      {type}
      {placeholder}
      {disabled}
      onfocus={onFocus}
      onblur={onBlur}
      onkeydown={onKeyDown}
      role="combobox"
      aria-expanded={isOpen}
      aria-autocomplete="list"
      aria-controls="autocomplete-list"
      class="w-full rounded-lg border border-gray-200 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-50 {rightAction
        ? 'pl-4 pr-28'
        : 'px-4'}"
      {...rest}
    />
    {#if rightAction}
      <div class="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <div class="pointer-events-auto">
          {@render rightAction()}
        </div>
      </div>
    {/if}

    {#if isOpen && filtered.length > 0}
      <ul
        bind:this={listEl}
        id="autocomplete-list"
        role="listbox"
        class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      >
        {#each filtered as s, i (s)}
          <li role="option" aria-selected={i === highlightIndex}>
            <button
              type="button"
              tabindex="-1"
              onmousedown={(e) => {
                // blur 전에 select되도록 mousedown + preventDefault
                e.preventDefault()
                select(s)
              }}
              onmouseenter={() => (highlightIndex = i)}
              title={s}
              class="block w-full truncate px-4 py-2 text-left text-sm transition-colors {i ===
              highlightIndex
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-700 hover:bg-gray-50'}"
            >
              {s}
            </button>
          </li>
        {/each}
      </ul>
    {:else if isOpen && value.trim().length > 0 && filtered.length === 0}
      <div
        class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs text-gray-400 shadow-lg"
      >
        {emptyHint}
      </div>
    {/if}
  </div>
</div>
