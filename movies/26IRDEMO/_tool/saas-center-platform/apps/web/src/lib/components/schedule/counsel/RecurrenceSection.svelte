<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import {
    DAY_OF_WEEK_OPTIONS,
    RECURRENCE_TYPE_OPTIONS,
    RECURRENCE_UNIT_LABELS,
    type DayOfWeek,
    type MonthlyRepeatType,
    type RecurrenceEndType,
    type RecurrenceType
  } from '$root/src/lib/features/schedule/counsel/constants'
  import DateSelect from '../../searchInput/DateSelect.svelte'
  import { portal } from '$root/src/lib/utils/positionPortal'

  // 외부 클릭 감지 액션
  function clickOutside(node: HTMLElement, callback: () => void) {
    const handleClick = (event: MouseEvent) => {
      if (!node.contains(event.target as Node)) {
        callback()
      }
    }
    document.addEventListener('click', handleClick, true)

    return {
      destroy() {
        document.removeEventListener('click', handleClick, true)
      }
    }
  }

  // Props 인터페이스
  export interface RecurrenceState {
    isRecurrenceEnabled: boolean
    recurrenceType: RecurrenceType
    recurrenceInterval: number
    recurrenceEndType: RecurrenceEndType
    recurrenceEndCount: number
    recurrenceEndDate: Date | null
    selectedDaysOfWeek: DayOfWeek[]
    monthlyRepeatTypes: MonthlyRepeatType[]
    scheduledDates: Date[]
  }

  export interface RecurrenceActions {
    toggleRecurrence: () => void
    setRecurrenceType: (type: RecurrenceType) => void
    setRecurrenceInterval: (interval: number) => void
    setRecurrenceEndType: (type: RecurrenceEndType) => void
    setRecurrenceEndCount: (count: number) => void
    setRecurrenceEndDate: (date: Date | null) => void
    toggleDayOfWeek: (day: DayOfWeek) => void
    toggleMonthlyRepeatType: (type: MonthlyRepeatType) => void
  }

  interface Props {
    view: RecurrenceState
    actions: RecurrenceActions
    selectedDate: Date | null
    startTime: string | null
    endTime: string | null
  }

  let {
    view,
    actions,
    selectedDate = $bindable(),
    startTime = $bindable(),
    endTime = $bindable()
  }: Props = $props()

  // 월간 반복 드롭다운 상태
  let isMonthlyDropdownOpen = $state(false)
  let anchorRect = $state<DOMRect | null>(null)
  let triggerEl = $state<HTMLButtonElement | null>(null)

  // 월간 반복 옵션 생성
  function getMonthlyRepeatOptions(
    date: Date | null
  ): { label: string; value: MonthlyRepeatType }[] {
    if (!date) {
      return [{ label: '날짜 선택', value: 'day' }]
    }

    const day = date.getDate()
    const dayOfWeek = date.getDay()
    const weekOfMonth = Math.ceil(day / 7)

    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = dayNames[dayOfWeek]

    // 해당 월의 마지막 날 계산
    const lastDayOfMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    ).getDate()
    // 마지막 주인지 확인
    const isLastWeek = day + 7 > lastDayOfMonth

    // 마지막 날인지 확인
    const isLastDay = day === lastDayOfMonth

    // 기본 옵션
    const options: { label: string; value: MonthlyRepeatType }[] = [
      { label: `${day}일`, value: 'day' },
      { label: `${weekOfMonth}번째 ${dayName}요일`, value: 'weekday' }
    ]

    // 마지막 주에 포함되면
    if (isLastWeek) {
      options.push({ label: `마지막 ${dayName}요일`, value: 'last_weekday' })
    }

    // 마지막 날이면
    if (isLastDay) {
      options.push({ label: '마지막 날', value: 'last_day' })
    }

    return options
  }

  // 월간 옵션 파생값
  const monthlyOptions = $derived(getMonthlyRepeatOptions(selectedDate))
  const selectedMonthlyLabels = $derived(
    view.monthlyRepeatTypes
      .map((type) => monthlyOptions.find((o) => o.value === type)?.label)
      .filter(Boolean)
      .join(', ') || '개월 반복 선택'
  )

  // 요일 라벨 매핑
  const dayOfWeekLabels: Record<DayOfWeek, string> = {
    mon: '월',
    tue: '화',
    wed: '수',
    thu: '목',
    fri: '금',
    sat: '토',
    sun: '일'
  }

  const togglePopover = () => {
    if (!triggerEl) return
    anchorRect = triggerEl.getBoundingClientRect() || null
    isMonthlyDropdownOpen = !isMonthlyDropdownOpen
  }

  // 반복 설명 텍스트 생성
  const recurrenceSummaryText = $derived.by(() => {
    const interval = view.recurrenceInterval

    switch (view.recurrenceType) {
      case 'daily':
        if (interval === 1) return '매일 반복할게요'
        return `${interval}일마다 반복할게요`

      case 'weekly':
        const selectedDays = view.selectedDaysOfWeek
          .map((d) => dayOfWeekLabels[d])
          .join(', ')

        if (interval === 1) {
          return selectedDays
            ? `매주 ${selectedDays}요일에 반복할게요`
            : '매주 반복할게요'
        }
        return selectedDays
          ? `${interval}주마다 ${selectedDays}요일에 반복할게요`
          : `${interval}주마다 반복할게요`

      case 'monthly':
        const monthlyLabel = selectedMonthlyLabels
        if (interval === 1) {
          return `매월 ${monthlyLabel}에 반복할게요`
        }
        return `${interval}개월마다 ${monthlyLabel}에 반복할게요`
      default:
        return ''
    }
  })
</script>

<section>
  <div class="flex items-center justify-between">
    <Typography variant="body-01-medium" color="text-gray-700">
      회기 반복
    </Typography>
    <div class="flex items-center gap-2">
      <Typography
        variant="body-02-medium"
        color={view.isRecurrenceEnabled ? 'text-primary-500' : 'text-gray-400'}
      >
        {view.isRecurrenceEnabled ? '할게요' : '안할게요'}
      </Typography>
      <Switch
        checked={view.isRecurrenceEnabled}
        onclick={actions.toggleRecurrence}
      />
    </div>
  </div>

  {#if view.isRecurrenceEnabled}
    <div class="mt-4 space-y-2">
      <!-- 반복 타입 선택 -->
      <div
        class="flex h-11 w-full overflow-hidden rounded-lg border border-gray-200"
      >
        {#each RECURRENCE_TYPE_OPTIONS as option}
          <button
            type="button"
            onclick={() => actions.setRecurrenceType(option.value)}
            class="flex h-full w-full items-center justify-center border-r border-gray-200 transition-colors duration-200 last:border-r-0
            {view.recurrenceType === option.value
              ? 'bg-gray-600'
              : 'bg-gray-50 hover:bg-gray-100'}"
          >
            <Typography
              variant="body-01-medium"
              color={view.recurrenceType === option.value
                ? 'text-white'
                : 'text-gray-500'}
            >
              {option.label}
            </Typography>
          </button>
        {/each}
      </div>
      <!-- 반복 간격 + 요일/월간 옵션 -->
      <div class="flex flex-wrap items-center gap-3">
        <input
          type="number"
          min="1"
          max="100"
          value={view.recurrenceInterval}
          onchange={(e) =>
            actions.setRecurrenceInterval(parseInt(e.currentTarget.value) || 1)}
          class="h-11 w-20 rounded-lg placeholder:text-placeholder border border-gray-200 px-2.5 text-left text-gray-700 focus:border-border-active focus:outline-none"
        />
        <Typography variant="body-01-regular" color="text-gray-600">
          {RECURRENCE_UNIT_LABELS[view.recurrenceType]}
        </Typography>

        <!-- 매주: 요일 선택 -->
        {#if view.recurrenceType === 'weekly'}
          <div class="flex items-center gap-1">
            {#each DAY_OF_WEEK_OPTIONS as dayOption}
              <button
                type="button"
                onclick={() => actions.toggleDayOfWeek(dayOption.value)}
                class="flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors cursor-pointer
                {view.selectedDaysOfWeek.includes(dayOption.value)
                  ? 'bg-primary-500 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
              >
                {dayOption.label}
              </button>
            {/each}
          </div>
        {/if}
        <!-- 매월: 반복 옵션 드롭다운 (복수 선택) -->
        {#if view.recurrenceType === 'monthly'}
          <div
            class="relative w-48"
            use:clickOutside={() => (isMonthlyDropdownOpen = false)}
          >
            <button
              type="button"
              bind:this={triggerEl}
              onclick={togglePopover}
              class="flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 text-gray-700 hover:bg-gray-50"
            >
              <span class="truncate-safe text-sm">{selectedMonthlyLabels}</span>
              <svg
                class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 {isMonthlyDropdownOpen
                  ? 'rotate-180'
                  : ''}"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {#if isMonthlyDropdownOpen}
              <div
                use:portal={{
                  anchor: triggerEl,
                  anchorRect,
                  offset: 4,
                  callback: () => {
                    isMonthlyDropdownOpen = false
                  }
                }}
                class="dropdown-panel z-10"
              >
                {#each monthlyOptions as option}
                  <button
                    type="button"
                    onclick={() =>
                      actions.toggleMonthlyRepeatType(option.value)}
                    class="dropdown-item"
                  >
                    <span>{option.label}</span>
                    <Checkbox
                      id={`monthly-repeat-${option.value}`}
                      checked={view.monthlyRepeatTypes.includes(option.value)}
                      readonly
                    />
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
      <!-- 반복 종료 -->
      <div class="space-y-2 mt-4!">
        <div class="flex items-center justify-between">
          <Typography variant="body-01-medium" color="text-gray-700">
            반복 종료
          </Typography>
        </div>
        <div class="space-y-2">
          <!-- 라디오 버튼 -->
          <div class="flex items-center gap-6">
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="recurrenceEndType"
                value="count"
                checked={view.recurrenceEndType === 'count'}
                onchange={() => actions.setRecurrenceEndType('count')}
                class="h-5 w-5 accent-primary-500"
              />
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default"
              >
                횟수로 종료
              </Typography>
            </label>
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="recurrenceEndType"
                value="date"
                checked={view.recurrenceEndType === 'date'}
                onchange={() => actions.setRecurrenceEndType('date')}
                class="h-5 w-5 accent-primary-500"
              />
              <Typography
                variant="body-01-normal-medium"
                color="text-body-default"
              >
                날짜로 종료
              </Typography>
            </label>
          </div>
          <!-- 종료 조건 입력 -->
          {#if view.recurrenceEndType === 'count'}
            <div class="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={view.recurrenceEndCount}
                onchange={(e) =>
                  actions.setRecurrenceEndCount(
                    parseInt(e.currentTarget.value) || 1
                  )}
                class="h-12 w-20 rounded-lg border border-gray-200 px-2.5 text-center text-gray-700 focus:border-border-active focus:outline-none"
              />
              <Typography variant="body-01-regular" color="text-gray-600">
                회
              </Typography>
            </div>
          {:else if view.recurrenceEndType === 'date'}
            <DateSelect
              bind:selectedDate={view.recurrenceEndDate}
              onChangeDate={(date) =>
                actions.setRecurrenceEndDate(date ? new Date(date) : null)}
            />
          {/if}
          <!-- 예정된 일정 리스트 -->
        </div>
        <!-- 반복 종료 비활성화시 텍스트 표시 -->
        <Typography variant="body-02-regular" color="text-primary-500">
          {recurrenceSummaryText}
        </Typography>
      </div>
    </div>
  {/if}
</section>
