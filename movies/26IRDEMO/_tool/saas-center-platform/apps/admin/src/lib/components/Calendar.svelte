<script lang="ts">
  import Typography from '$components/Typography.svelte'

  interface Props {
    selectedDate?: Date | null
    onDateSelect?: (date: Date) => void
    minDate?: Date | null
    maxDate?: Date | null
    class?: string
  }

  let {
    selectedDate = $bindable(null),
    onDateSelect,
    minDate = null,
    maxDate = null,
    class: className = ''
  }: Props = $props()

  type ViewMode = 'days' | 'months' | 'years'
  let viewMode = $state<ViewMode>('days')

  let currentMonth = $state(selectedDate ? new Date(selectedDate) : new Date())

  let yearRangeStart = $derived(
    Math.floor(currentMonth.getFullYear() / 10) * 10 - 10
  )
  const YEARS_PER_PAGE = 20

  const MONTH_NAMES = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ]

  function getDaysInMonth(date: Date): (number | null)[] {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  function prevMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
  }

  function nextMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
  }

  function prevYearRange() {
    yearRangeStart -= YEARS_PER_PAGE
  }

  function nextYearRange() {
    yearRangeStart += YEARS_PER_PAGE
  }

  function selectYear(year: number) {
    currentMonth = new Date(year, currentMonth.getMonth(), 1)
    viewMode = 'months'
  }

  function selectMonth(month: number) {
    currentMonth = new Date(currentMonth.getFullYear(), month, 1)
    viewMode = 'days'
  }

  function selectDate(day: number) {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    selectedDate = newDate
    onDateSelect?.(newDate)
  }

  function toggleYearMonthView() {
    if (viewMode === 'days') {
      yearRangeStart = Math.floor(currentMonth.getFullYear() / 10) * 10 - 10
      viewMode = 'years'
    } else {
      viewMode = 'days'
    }
  }

  function isToday(day: number): boolean {
    const today = new Date()
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    )
  }

  function isSelected(day: number): boolean {
    if (!selectedDate) return false
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    )
  }

  function isCurrentYear(year: number): boolean {
    return year === currentMonth.getFullYear()
  }

  function isCurrentMonth(month: number): boolean {
    return month === currentMonth.getMonth()
  }

  function isSunday(index: number): boolean {
    return index % 7 === 0
  }

  function isDisabled(day: number): boolean {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    date.setHours(0, 0, 0, 0)
    if (minDate) {
      const min = new Date(minDate)
      min.setHours(0, 0, 0, 0)
      if (date < min) return true
    }
    if (maxDate) {
      const max = new Date(maxDate)
      max.setHours(0, 0, 0, 0)
      if (date > max) return true
    }
    return false
  }

  function formatMonth(date: Date): string {
    return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월`
  }

  function formatYearRange(): string {
    return `${yearRangeStart} - ${yearRangeStart + YEARS_PER_PAGE - 1}`
  }

  let prevSelectedTime = $state(selectedDate?.getTime() ?? null)
  $effect(() => {
    const currentTime = selectedDate?.getTime() ?? null
    if (
      selectedDate &&
      currentTime !== prevSelectedTime &&
      (selectedDate.getFullYear() !== currentMonth.getFullYear() ||
        selectedDate.getMonth() !== currentMonth.getMonth())
    ) {
      currentMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    }
    prevSelectedTime = currentTime
  })

  const days = $derived(getDaysInMonth(currentMonth))
  const years = $derived(
    Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearRangeStart + i)
  )
</script>

<div class="w-75 shrink-0 rounded-xl border border-gray-200 bg-white p-4 {className}">
  <!-- 헤더 -->
  <div class="mb-4 grid grid-cols-7 items-center">
    {#if viewMode === 'days'}
      <div class="flex justify-center">
        <button
          type="button"
          onclick={prevMonth}
          aria-label="이전 달"
          class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 text-gray-400 hover:text-gray-600"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="col-span-5 flex items-center justify-center">
        <button
          type="button"
          onclick={toggleYearMonthView}
          class="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100"
        >
          <Typography variant="body-01-semibold" color="text-gray-800">
            {formatMonth(currentMonth)}
          </Typography>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-gray-400">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="flex justify-center">
        <button
          type="button"
          onclick={nextMonth}
          aria-label="다음 달"
          class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    {:else if viewMode === 'years'}
      <div class="flex justify-center">
        <button
          type="button"
          onclick={prevYearRange}
          aria-label="이전 연도"
          class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 text-gray-400 hover:text-gray-600"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="col-span-5 flex items-center justify-center">
        <button
          type="button"
          onclick={toggleYearMonthView}
          class="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100"
        >
          <Typography variant="body-01-semibold" color="text-gray-800">
            {formatYearRange()}
          </Typography>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="rotate-180 text-gray-400">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="flex justify-center">
        <button
          type="button"
          onclick={nextYearRange}
          aria-label="다음 연도"
          class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    {:else}
      <div class="flex justify-center">
        <button
          type="button"
          onclick={() => (viewMode = 'years')}
          aria-label="연도 선택"
          class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 text-gray-400 hover:text-gray-600"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="col-span-5 flex items-center justify-center">
        <button
          type="button"
          onclick={toggleYearMonthView}
          class="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100"
        >
          <Typography variant="body-01-semibold" color="text-gray-800">
            {currentMonth.getFullYear()}년
          </Typography>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="rotate-180 text-gray-400">
            <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="w-8"></div>
    {/if}
  </div>

  <!-- 연도 선택 -->
  {#if viewMode === 'years'}
    <div class="grid grid-cols-4 gap-2">
      {#each years as year}
        <button
          type="button"
          onclick={() => selectYear(year)}
          class="h-10 rounded-lg text-sm transition-colors
            {isCurrentYear(year) ? 'bg-primary-500 text-white' : 'text-gray-700 hover:bg-gray-100'}"
        >
          {year}
        </button>
      {/each}
    </div>

  <!-- 월 선택 -->
  {:else if viewMode === 'months'}
    <div class="grid grid-cols-3 gap-2">
      {#each MONTH_NAMES as month, i}
        <button
          type="button"
          onclick={() => selectMonth(i)}
          class="h-10 rounded-lg text-sm transition-colors
            {isCurrentMonth(i) ? 'bg-primary-500 text-white' : 'text-gray-700 hover:bg-gray-100'}"
        >
          {month}
        </button>
      {/each}
    </div>

  <!-- 날짜 선택 -->
  {:else}
    <div>
      <div class="mb-2 grid grid-cols-7 text-center">
        {#each ['일', '월', '화', '수', '목', '금', '토'] as day, i}
          <div class="flex h-9 w-9 items-center justify-center text-xs font-medium {i === 0 ? 'text-red-400' : 'text-gray-500'}">
            {day}
          </div>
        {/each}
      </div>
      <div class="grid grid-cols-7 gap-y-4 text-center">
        {#each days as day, i}
          <div class="relative flex h-9 w-9 items-center justify-center">
            {#if day}
              <button
                type="button"
                onclick={() => selectDate(day)}
                disabled={isDisabled(day)}
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm transition-colors
                  {isSelected(day)
                  ? 'bg-primary-500 text-white'
                  : isDisabled(day)
                    ? 'cursor-not-allowed text-gray-300'
                    : isToday(day)
                      ? 'font-semibold text-gray-900'
                      : isSunday(i)
                        ? 'text-red-400 hover:bg-gray-50'
                        : 'text-gray-700 hover:bg-gray-50'}"
              >
                {day}
              </button>
              {#if isToday(day)}
                <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400">오늘</span>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
