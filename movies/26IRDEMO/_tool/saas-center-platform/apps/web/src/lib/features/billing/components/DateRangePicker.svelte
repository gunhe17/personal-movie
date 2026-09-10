<script lang="ts">
  import Calendar from '$lib/components/Calendar.svelte'
  import CalendarIcon from '$lib/assets/CalendarIcon.svelte'

  interface Props {
    /** YYYY-MM-DD 문자열 */
    dateFrom: string
    dateTo: string
    onChange: (next: { dateFrom: string; dateTo: string }) => void
    fullWidth?: boolean
    fromLabel?: string
    toLabel?: string
  }

  let {
    dateFrom,
    dateTo,
    onChange,
    fullWidth = false,
    fromLabel = '시작일',
    toLabel = '종료일'
  }: Props = $props()

  let isFromOpen = $state(false)
  let isToOpen = $state(false)

  const fromDisplay = $derived(
    dateFrom ? dateFrom.replace(/-/g, '.') : fromLabel
  )
  const toDisplay = $derived(dateTo ? dateTo.replace(/-/g, '.') : toLabel)
  const hasFrom = $derived(!!dateFrom)
  const hasTo = $derived(!!dateTo)
  const fromDateObj = $derived<Date | null>(
    dateFrom ? new Date(dateFrom) : null
  )
  const toDateObj = $derived<Date | null>(dateTo ? new Date(dateTo) : null)

  function toIsoDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  function handleFromSelect(date: Date) {
    onChange({ dateFrom: toIsoDate(date), dateTo })
    isFromOpen = false
  }

  function handleToSelect(date: Date) {
    onChange({ dateFrom, dateTo: toIsoDate(date) })
    isToOpen = false
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (!target.closest('.drp-from')) isFromOpen = false
    if (!target.closest('.drp-to')) isToOpen = false
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="flex items-center gap-2 {fullWidth ? 'w-full' : ''}">
  <!-- 시작일 -->
  <div class="drp-from relative {fullWidth ? 'flex-1' : ''}">
    <button
      onclick={() => {
        isFromOpen = !isFromOpen
        isToOpen = false
      }}
      class="flex h-11 w-full min-w-32 items-center gap-x-6 rounded-lg border bg-white px-4 transition-colors {hasFrom
        ? 'border-border-active'
        : 'border-gray-200 hover:bg-gray-50'}"
    >
      <span
        class="text-body-02-normal-regular truncate-safe {hasFrom
          ? 'text-primary-600'
          : 'text-gray-700'}"
      >
        {fromDisplay}
      </span>
      <CalendarIcon />
    </button>

    {#if isFromOpen}
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        class="absolute top-full left-0 z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <Calendar
          selectedDate={fromDateObj}
          onDateSelect={handleFromSelect}
          maxDate={toDateObj}
        />
      </div>
    {/if}
  </div>

  <span class="shrink-0 text-gray-400">~</span>

  <!-- 종료일 -->
  <div class="drp-to relative {fullWidth ? 'flex-1' : ''}">
    <button
      onclick={() => {
        isToOpen = !isToOpen
        isFromOpen = false
      }}
      class="flex h-11 w-full min-w-32 items-center gap-x-6 rounded-lg border bg-white px-4 transition-colors {hasTo
        ? 'border-border-active'
        : 'border-gray-200 hover:bg-gray-50'}"
    >
      <span
        class="text-body-02-normal-regular truncate-safe {hasTo
          ? 'text-primary-600'
          : 'text-gray-700'}"
      >
        {toDisplay}
      </span>
      <CalendarIcon />
    </button>

    {#if isToOpen}
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        class="absolute top-full {fullWidth
          ? 'right-0'
          : 'left-0'} z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <Calendar
          selectedDate={toDateObj}
          onDateSelect={handleToSelect}
          minDate={fromDateObj}
        />
      </div>
    {/if}
  </div>
</div>
