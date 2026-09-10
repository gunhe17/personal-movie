<script lang="ts">
  /**
   * 리스트 검색 영역의 날짜 필터 단일 규격 — 인풋 하나에서 기간(시작~종료)을 고른다.
   * 첫 클릭 = 시작일, 두 번째 클릭 = 종료일(역순 클릭이면 자동 스왑).
   * 하루만 보려면 같은 날을 두 번 찍는다.
   * 달력 클릭은 draft만 바꾸고, 조회 반영은 '적용'을 눌러야 일어난다.
   */
  import Calendar from '$lib/components/Calendar.svelte'
  import CalendarIcon24 from '$lib/assets/CalendarIcon24.svelte'

  interface Props {
    /** 'YYYY-MM-DD' | null */
    start?: string | null
    end?: string | null
    /** '적용'·'초기화'를 눌렀을 때만 호출 (달력 클릭 중에는 호출하지 않는다) */
    onChange: (start: string | null, end: string | null) => void
    /** 값이 없을 때 버튼에 보이는 문구 */
    placeholder?: string
    /** 드롭다운 정렬 기준 */
    align?: 'left' | 'right'
    class?: string
  }

  let {
    start = null,
    end = null,
    onChange,
    placeholder = '기간',
    align = 'left',
    class: className = ''
  }: Props = $props()

  let isOpen = $state(false)
  let containerEl = $state<HTMLDivElement | null>(null)

  // 드롭다운이 열려 있는 동안의 임시 선택(시작만 찍힌 중간 상태 포함)
  let draftStart = $state<Date | null>(null)
  let draftEnd = $state<Date | null>(null)

  const toDate = (value: string | null): Date | null => {
    if (!value) return null
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }

  const toValue = (date: Date | null): string | null => {
    if (!date) return null
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const hasValue = $derived(!!start || !!end)

  const label = $derived.by(() => {
    const from = start?.replace(/-/g, '.')
    const to = end?.replace(/-/g, '.')
    if (from && to) return from === to ? from : `${from} ~ ${to}`
    if (from) return `${from} ~`
    if (to) return `~ ${to}`
    return placeholder
  })

  function open() {
    draftStart = toDate(start)
    draftEnd = toDate(end)
    isOpen = true
  }

  function toggle() {
    if (isOpen) isOpen = false
    else open()
  }

  // 달력 클릭은 draft만 움직인다 — 조회 반영은 '적용'을 눌러야 일어난다
  function handleRangeSelect(next: Date | null, nextEnd: Date | null) {
    draftStart = next
    draftEnd = nextEnd
  }

  // 날짜를 하나도 고르지 않은 상태에서는 적용할 값이 없다 (열 때 기존 값이 있으면 활성)
  const canApply = $derived(!!draftStart || !!draftEnd)

  function apply() {
    onChange(toValue(draftStart), toValue(draftEnd))
    isOpen = false
  }

  function reset(event?: MouseEvent) {
    event?.stopPropagation()
    draftStart = null
    draftEnd = null
    onChange(null, null)
    isOpen = false
  }

  $effect(() => {
    if (!isOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerEl?.contains(event.target as Node)) isOpen = false
    }
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') isOpen = false
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeydown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeydown)
    }
  })
</script>

<div bind:this={containerEl} class="relative {className}">
  <button
    type="button"
    onclick={toggle}
    class="flex h-11 min-w-30 items-center gap-2 rounded-lg border bg-white px-3 transition-colors {hasValue
      ? 'border-primary-500'
      : isOpen
        ? 'border-primary-400'
        : 'border-border-default hover:border-border-strong'}"
  >
    <span class="flex shrink-0" aria-hidden="true">
      <CalendarIcon24 />
    </span>
    <span
      class="text-body-02-normal-regular truncate-safe {hasValue
        ? 'text-primary-600'
        : 'text-gray-600'}"
    >
      {label}
    </span>
    {#if hasValue}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        onclick={reset}
        aria-label="기간 초기화"
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-primary-600 hover:bg-primary-50"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </span>
    {/if}
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      class="absolute top-full z-50 mt-1 {align === 'right'
        ? 'right-0'
        : 'left-0'}"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
    >
      <div
        class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
      >
        <Calendar
          mode="range"
          rangeStart={draftStart}
          rangeEnd={draftEnd}
          onRangeSelect={handleRangeSelect}
          class="border-0! rounded-none! shadow-none!"
        />
        <!-- 액션만 우측 정렬 — Small(32) 사이즈, 초기화=레이블만 / 적용=회색 solid -->
        <!-- 액션 바 규격은 .dropdown-footer가 소유한다(Web_Design.md §Components>dropdown) -->
        <div class="dropdown-footer mt-0 px-4 pb-3">
          <button
            type="button"
            class="dropdown-footer-reset"
            onclick={() => reset()}
          >
            초기화
          </button>
          <button
            type="button"
            class="dropdown-footer-apply"
            onclick={apply}
            disabled={!canApply}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
