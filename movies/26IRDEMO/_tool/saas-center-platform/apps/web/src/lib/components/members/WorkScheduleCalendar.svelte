<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { DAYS_IN_KOREA, getDaysInMonth } from '$lib/utils/date'
  import {
    WEEKDAYS,
    type BreakTime,
    type WeeklySchedule
  } from '$lib/features/members/constants'
  import {
    toDateKey,
    type ScheduleCountMap
  } from '$lib/features/members/work-schedule'
  import ChevronIcon from '../../assets/ChevronIcon.svelte'
  import WarningCircleIcon16 from '$lib/assets/WarningCircleIcon16.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import { fade } from 'svelte/transition'

  interface Props {
    /** 표시 중인 연/월 — 페이지가 소유 (탭 전환 후 재마운트돼도 유지) */
    viewYear: number
    viewMonth: number // 0-based
    weeklySchedule: WeeklySchedule
    breakTime?: BreakTime | null
    /** 'YYYY-MM-DD' → 상담/검사 개수 */
    scheduleCounts?: ScheduleCountMap
    /** 월 이동 시 호출 (페이지가 viewYear/viewMonth 갱신 + 일정 재조회) */
    onMonthChange?: (year: number, month: number) => void
    /** 근무일정 미설정 여부 (true면 캘린더 상단에 안내 배너) */
    needsSetup?: boolean
    /** 근무일정 추가하기 클릭 */
    onAddSchedule?: () => void
  }

  let {
    viewYear,
    viewMonth,
    weeklySchedule,
    breakTime = null,
    scheduleCounts = {},
    onMonthChange,
    needsSetup = false,
    onAddSchedule
  }: Props = $props()

  // 오늘 (isToday 판정용)
  const today = new Date()

  // 각 일 박스 높이 고정(108px). 주 수와 무관하게 동일, 넘치면 그리드 내부 스크롤.
  // 셀 div의 min-h-27과 같은 값을 유지할 것 (min-h가 더 크면 축소가 안 먹음)
  const CELL_HEIGHT = 108

  // JS getDay()(일=0~토=6) → 한글 요일(월~일) 매핑
  // WEEKDAYS = ['월','화','수','목','금','토','일']
  const JS_DAY_TO_KR: Record<number, (typeof WEEKDAYS)[number]> = {
    0: '일',
    1: '월',
    2: '화',
    3: '수',
    4: '목',
    5: '금',
    6: '토'
  }

  interface CalendarCell {
    date: number | null // null = 빈 칸 (이전/다음 달 자리)
    isToday: boolean
    isWeekend: boolean
    work: { start: string; end: string } | null
    counseling: number
    assessment: number
    /** 근무일이 아닌데 상담/검사 일정이 잡혀 있음 (근무 외 일정) */
    offDaySchedule: boolean
  }

  // 월 그리드 계산 (일요일 시작, 6주 고정)
  const cells = $derived.by<CalendarCell[]>(() => {
    const firstDayIdx = new Date(viewYear, viewMonth, 1).getDay() // 0=일
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const result: CalendarCell[] = []

    const empty: CalendarCell = {
      date: null,
      isToday: false,
      isWeekend: false,
      work: null,
      counseling: 0,
      assessment: 0,
      offDaySchedule: false
    }

    // 앞쪽 빈 칸
    for (let i = 0; i < firstDayIdx; i++) {
      result.push({ ...empty })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cur = new Date(viewYear, viewMonth, d)
      const dow = cur.getDay()
      const krDay = JS_DAY_TO_KR[dow]
      const count = scheduleCounts[toDateKey(viewYear, viewMonth, d)]
      const work = weeklySchedule[krDay] ?? null
      const counseling = count?.counseling ?? 0
      const assessment = count?.assessment ?? 0
      result.push({
        date: d,
        isToday:
          viewYear === today.getFullYear() &&
          viewMonth === today.getMonth() &&
          d === today.getDate(),
        isWeekend: dow === 0 || dow === 6,
        work,
        counseling,
        assessment,
        offDaySchedule: count?.hasOffHours ?? false
      })
    }

    // 뒤쪽 빈 칸 (7의 배수로 맞추기)
    while (result.length % 7 !== 0) {
      result.push({ ...empty })
    }
    return result
  })

  const monthLabel = $derived(`${viewYear}년 ${viewMonth + 1}월`)
  const rowCount = $derived(cells.length / 7)

  function prevMonth() {
    const year = viewMonth === 0 ? viewYear - 1 : viewYear
    const month = viewMonth === 0 ? 11 : viewMonth - 1
    onMonthChange?.(year, month)
  }

  function nextMonth() {
    const year = viewMonth === 11 ? viewYear + 1 : viewYear
    const month = viewMonth === 11 ? 0 : viewMonth + 1
    onMonthChange?.(year, month)
  }
</script>

<div class="h-full flex flex-col gap-3">
  <!-- 월 네비게이션 -->
  <div class="relative flex items-end justify-center px-2">
    <div class="flex items-center gap-2">
      <button
        onclick={prevMonth}
        aria-label="이전 달"
        class="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
      >
        <ChevronIcon width={7} height={11} class="stroke-icon-secondary" />
      </button>
      <Typography variant="body-01-normal-semibold" color="text-gray-900">
        {monthLabel}
      </Typography>
      <button
        onclick={nextMonth}
        aria-label="다음 달"
        class="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
      >
        <ChevronIcon
          width={7}
          height={11}
          class="rotate-180 stroke-icon-secondary"
        />
      </button>
    </div>
    {#if breakTime}
      <div class="absolute right-2 bottom-0 flex items-end gap-2">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          휴식시간
        </Typography>
        <Typography variant="body-02-normal-medium" color="text-gray-700">
          {breakTime.start} ~ {breakTime.end}
        </Typography>
      </div>
    {/if}
  </div>

  <!-- 캘린더 그리드 -->
  <div
    class="relative flex-1 min-h-0 flex flex-col border border-gray-100 rounded-lg overflow-hidden"
  >
    <!-- 요일 헤더 -->
    <div class="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
      {#each DAYS_IN_KOREA as day, i}
        <div class="h-8 pl-1.5 flex items-center">
          <span class="inline-flex min-w-6 justify-center">
            <Typography
              variant="body-02-normal-medium"
              color={i === 0
                ? 'text-status-danger'
                : i === 6
                  ? 'text-blue-500'
                  : 'text-gray-600'}
            >
              {day}
            </Typography>
          </span>
        </div>
      {/each}
    </div>

    <!-- 근무일정 미설정 안내 배너 (요일 헤더 아래에 고정) -->
    {#if needsSetup}
      <div
        class="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-6 py-2.5 shadow-sm"
        in:fade
      >
        <Typography variant="body-02-normal-medium" color="text-status-danger">
          근무일정이 설정되지 않았어요.
        </Typography>
        <button
          onclick={onAddSchedule}
          aria-label="근무일정 추가"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-body-default border border-border-default hover:bg-gray-50 text-body-03-normal-medium transition-colors shrink-0"
        >
          <PlusIcon20 />
          추가
        </button>
      </div>
    {/if}

    <!-- 날짜 셀 (스크롤 가능 시 하단 fade + 원형 화살표로 안내) -->
    <ScrollFadeArea bounceArrow deps={[rowCount, viewYear, viewMonth]}>
      <div
        class="grid grid-cols-7"
        style={`grid-template-rows: repeat(${rowCount}, ${CELL_HEIGHT}px)`}
      >
        {#each cells as cell, i (i)}
          <div
            class="relative min-h-27 p-1.5 border-b border-r border-gray-100 flex flex-col items-start gap-1
            {i % 7 === 6 ? 'border-r-0' : ''}
            {i >= cells.length - 7 ? 'border-b-0' : ''}
            {cell.date === null ? 'bg-gray-50/40' : 'bg-white'}"
          >
            {#if cell.date !== null}
              <!-- 날짜 (좌측 정렬, 요일과 동일 정렬축) -->
              <span
                class="inline-flex items-center justify-center min-w-6 h-6 rounded-full text-body-03-normal-medium
                {cell.isToday
                  ? 'bg-primary-50 text-primary-500'
                  : cell.isWeekend
                    ? 'text-gray-400'
                    : 'text-gray-700'}"
              >
                {cell.date}
              </span>

              <!-- 근무시간 S-태그 (날짜 밑) -->
              {#if cell.work}
                <span
                  class="flex h-6 w-full items-center rounded bg-gray-100 px-2 text-label-01-normal-medium text-gray-600"
                >
                  <span class="truncate-safe">
                    {cell.work.start}~{cell.work.end}
                  </span>
                </span>
              {/if}

              <!-- 근무시간 외 일정 경고 -->
              {#if cell.offDaySchedule}
                <div class="flex items-center gap-1 text-status-warning">
                  <span
                    class="inline-flex w-3.5 h-3.5 shrink-0 [&>svg]:w-full [&>svg]:h-full"
                  >
                    <WarningCircleIcon16 />
                  </span>
                  <span class="text-label-01-reading-medium">
                    근무시간 외 일정
                  </span>
                </div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </ScrollFadeArea>
  </div>
</div>
