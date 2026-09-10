<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    selectedDate?: Date | null
    onDateSelect?: (date: Date) => void
    minDate?: Date | null
    maxDate?: Date | null
    highlightedDates?: Date[]
    conflictDates?: Date[]
    /** 'single'(기본) = 하루 선택 · 'range' = 시작~종료 범위 선택 */
    mode?: 'single' | 'range'
    /** range 모드 — 선택된 범위 시작/종료 */
    rangeStart?: Date | null
    rangeEnd?: Date | null
    /** range 모드 — 시작만 찍힌 중간 상태도 알린다(end=null) */
    onRangeSelect?: (start: Date | null, end: Date | null) => void
    class?: string
  }

  let {
    selectedDate = $bindable(null),
    onDateSelect,
    minDate = null,
    maxDate = null,
    highlightedDates = [],
    conflictDates = [],
    mode = 'single',
    rangeStart = null,
    rangeEnd = null,
    onRangeSelect,
    class: className = ''
  }: Props = $props()

  const isRange = $derived(mode === 'range')

  /** 범위 미리보기 — 시작만 찍힌 상태에서 마우스가 지나는 날 */
  let hoverDay = $state<number | null>(null)

  // 뷰 모드: 'days' | 'months' | 'years'
  type ViewMode = 'days' | 'months' | 'years'
  let viewMode = $state<ViewMode>('days')

  // 현재 표시 중인 월
  let currentMonth = $state(
    selectedDate
      ? new Date(selectedDate)
      : rangeStart
        ? new Date(rangeStart)
        : new Date()
  )

  // 연도 선택 범위 (현재 연도 기준 ±50년)
  let yearRangeStart = $derived(
    Math.floor(currentMonth.getFullYear() / 10) * 10 - 10
  )
  const YEARS_PER_PAGE = 20

  // 월 이름
  const MONTH_NAMES = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월'
  ]

  // 해당 월의 날짜 배열 생성
  function getDaysInMonth(date: Date): (number | null)[] {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    return days
  }

  function prevMonth() {
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1
    )
  }

  function nextMonth() {
    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1
    )
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
    const newDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    )

    if (isRange) {
      // 시작 없음 · 이미 범위 완성 → 새 시작점. 시작만 있으면 → 종료(역순이면 스왑)
      if (!rangeStart || (rangeStart && rangeEnd)) {
        hoverDay = null
        onRangeSelect?.(newDate, null)
      } else if (newDate < startOfDay(rangeStart)) {
        hoverDay = null
        onRangeSelect?.(newDate, rangeStart)
      } else {
        hoverDay = null
        onRangeSelect?.(rangeStart, newDate)
      }
      return
    }

    selectedDate = newDate
    onDateSelect?.(newDate)
  }

  function startOfDay(date: Date): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function dayToDate(day: number): Date {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
  }

  function isSameDate(day: number, target: Date | null): boolean {
    if (!target) return false
    return (
      day === target.getDate() &&
      currentMonth.getMonth() === target.getMonth() &&
      currentMonth.getFullYear() === target.getFullYear()
    )
  }

  /** 범위 끝점(시작·종료 또는 시작만 찍힌 상태의 시작) */
  function isRangeEdge(day: number): boolean {
    return isSameDate(day, rangeStart) || isSameDate(day, rangeEnd)
  }

  /** 끝점 사이(양끝 포함) — 배경 바를 그리는 구간. 시작만 있으면 hover까지 미리보기 */
  function isInRange(day: number): boolean {
    if (!rangeStart) return false
    const from = startOfDay(rangeStart)
    const to = rangeEnd
      ? startOfDay(rangeEnd)
      : hoverDay
        ? startOfDay(dayToDate(hoverDay))
        : null
    if (!to) return false
    const target = startOfDay(dayToDate(day))
    return (target >= from && target <= to) || (target >= to && target <= from)
  }

  /** 바의 좌/우 끝 라운딩 — 구간의 첫 날/마지막 날 */
  function isRangeBarStart(day: number): boolean {
    if (!isInRange(day)) return false
    return !isInRange(day - 1) || day === 1
  }

  function isRangeBarEnd(day: number): boolean {
    if (!isInRange(day)) return false
    const lastDay = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    ).getDate()
    return !isInRange(day + 1) || day === lastDay
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
      day === selectedDate?.getDate() &&
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
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    )
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

  function isHighlighted(day: number): boolean {
    if (!highlightedDates?.length) return false
    return highlightedDates.some(
      (d) =>
        d.getDate() === day &&
        d.getMonth() === currentMonth.getMonth() &&
        d.getFullYear() === currentMonth.getFullYear()
    )
  }

  function isConflict(day: number): boolean {
    if (!conflictDates?.length) return false
    return conflictDates.some(
      (d) =>
        d.getDate() === day &&
        d.getMonth() === currentMonth.getMonth() &&
        d.getFullYear() === currentMonth.getFullYear()
    )
  }

  function formatMonth(date: Date): string {
    return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월`
  }

  function formatYearRange(): string {
    return `${yearRangeStart} - ${yearRangeStart + YEARS_PER_PAGE - 1}`
  }

  // selectedDate가 외부에서 변경되면 해당 월로 캘린더 이동
  let prevSelectedTime = $state(selectedDate?.getTime() ?? null)
  $effect(() => {
    const currentTime = selectedDate?.getTime() ?? null
    if (
      selectedDate &&
      currentTime !== prevSelectedTime &&
      (selectedDate.getFullYear() !== currentMonth.getFullYear() ||
        selectedDate.getMonth() !== currentMonth.getMonth())
    ) {
      currentMonth = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        1
      )
    }
    prevSelectedTime = currentTime
  })

  const days = $derived(getDaysInMonth(currentMonth))
  const years = $derived(
    Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearRangeStart + i)
  )
</script>

<div
  class="w-75 bg-white shrink-0 rounded-lg border border-gray-200 p-4 {className}"
>
  <!-- 헤더: 요일 그리드와 맞추어 이전=일 위, 다음=토 위 -->
  <div class="mb-4 grid grid-cols-7 items-center">
    {#if viewMode === 'days'}
      <div class="flex justify-center">
        <Tooltip text="이전 달">
          <button
            type="button"
            onclick={prevMonth}
            aria-label="이전 달"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
      <div class="col-span-5 flex items-center justify-center">
        <button
          type="button"
          onclick={toggleYearMonthView}
          class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group"
        >
          <Typography variant="body-01-semibold" color="text-gray-800">
            {formatMonth(currentMonth)}
          </Typography>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="text-gray-400 group-hover:text-gray-600 transition-colors"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <div class="flex justify-center">
        <Tooltip text="다음 달">
          <button
            type="button"
            onclick={nextMonth}
            aria-label="다음 달"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M7.5 15L12.5 10L7.5 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
    {:else if viewMode === 'years'}
      <div class="flex justify-center">
        <Tooltip text="이전 연도">
          <button
            type="button"
            onclick={prevYearRange}
            aria-label="이전 연도"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
      <div class="col-span-5 flex items-center justify-center">
        <button
          type="button"
          onclick={toggleYearMonthView}
          class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group"
        >
          <Typography variant="body-01-semibold" color="text-gray-800">
            {formatYearRange()}
          </Typography>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="text-gray-400 group-hover:text-gray-600 transition-colors rotate-180"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <div class="flex justify-center">
        <Tooltip text="다음 연도">
          <button
            type="button"
            onclick={nextYearRange}
            aria-label="다음 연도"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M7.5 15L12.5 10L7.5 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
    {:else}
      <div class="flex justify-center">
        <button
          type="button"
          onclick={() => (viewMode = 'years')}
          aria-label="연도 선택"
          class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <div class="col-span-5 flex items-center justify-center">
        <button
          type="button"
          onclick={toggleYearMonthView}
          class="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors group"
        >
          <Typography variant="body-01-semibold" color="text-gray-800">
            {currentMonth.getFullYear()}년
          </Typography>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="text-gray-400 group-hover:text-gray-600 transition-colors rotate-180"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <div class="w-8"></div>
    {/if}
  </div>

  <!-- 연도 선택 뷰 -->
  {#if viewMode === 'years'}
    <div class="grid grid-cols-4 gap-2">
      {#each years as year}
        <button
          type="button"
          onclick={() => selectYear(year)}
          class="h-10 rounded-lg text-sm transition-colors
            {isCurrentYear(year)
            ? 'bg-primary-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'}"
        >
          {year}
        </button>
      {/each}
    </div>

    <!-- 월 선택 뷰 -->
  {:else if viewMode === 'months'}
    <div class="grid grid-cols-3 gap-2">
      {#each MONTH_NAMES as month, i}
        <button
          type="button"
          onclick={() => selectMonth(i)}
          class="h-10 rounded-lg text-sm transition-colors
            {isCurrentMonth(i)
            ? 'bg-primary-500 text-white'
            : 'text-gray-700 hover:bg-gray-100'}"
        >
          {month}
        </button>
      {/each}
    </div>

    <!-- 날짜 선택 뷰 (기본) -->
  {:else}
    <div>
      <!-- 한글 요일: 36x36 셀, 아래로 8px 간격 -->
      <div class="grid grid-cols-7 text-center mb-2">
        {#each ['일', '월', '화', '수', '목', '금', '토'] as day, i}
          <div
            class="text-label-01-normal-medium flex h-9 w-9 items-center justify-center {i ===
            0
              ? 'text-red-400'
              : 'text-gray-500'}"
          >
            {day}
          </div>
        {/each}
      </div>
      <!-- 숫자 일자: 36x36 셀, 행 간격 8px -->
      <div
        class="grid grid-cols-7 gap-y-2 text-center"
        onmouseleave={() => (hoverDay = null)}
        role="grid"
        tabindex="-1"
      >
        {#each days as day, i}
          <div
            class="relative flex h-9 items-center justify-center {isRange
              ? 'w-full'
              : 'w-9'}"
          >
            {#if day && isRange && isInRange(day)}
              <!-- 범위 배경 바 — 끝점(원) 아래 깔리고, 끝점 칸에서는 안쪽 절반만 -->
              {@const barStart = isRangeBarStart(day)}
              {@const barEnd = isRangeBarEnd(day)}
              {#if !(barStart && barEnd)}
                <span
                  class="absolute inset-y-0.5 bg-primary-50 {barStart
                    ? 'left-1/2 right-0'
                    : barEnd
                      ? 'left-0 right-1/2'
                      : 'inset-x-0'} {isSunday(i) && !barStart
                    ? 'rounded-l-full'
                    : ''} {i % 7 === 6 && !barEnd ? 'rounded-r-full' : ''}"
                  aria-hidden="true"
                ></span>
              {/if}
            {/if}
            {#if day}
              <button
                type="button"
                onclick={() => selectDate(day)}
                onmouseenter={() => {
                  if (isRange && rangeStart && !rangeEnd) hoverDay = day
                }}
                disabled={isDisabled(day)}
                class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm transition-colors
                  {isRange && isRangeEdge(day)
                  ? 'bg-primary-500 text-white'
                  : isRange && isInRange(day)
                    ? 'text-primary-700 font-medium'
                    : isSelected(day)
                      ? 'bg-primary-500 text-white'
                      : isDisabled(day)
                        ? 'cursor-not-allowed text-gray-300'
                        : isConflict(day)
                          ? 'bg-red-100 text-red-600 font-medium'
                          : isHighlighted(day)
                            ? 'bg-primary-100 text-primary-600 font-medium'
                            : isToday(day)
                              ? 'font-semibold text-gray-900'
                              : isSunday(i)
                                ? 'text-red-400 hover:bg-gray-50'
                                : 'text-gray-700 hover:bg-gray-50'}"
              >
                {day}
              </button>
              {#if isToday(day)}
                <span
                  class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-body-03-normal-regular text-gray-400 whitespace-nowrap"
                  >오늘</span
                >
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
