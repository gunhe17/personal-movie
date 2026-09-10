import { DATE_RANGE_MODES } from './constants'
import type { DateRangeMode, DisplayMode } from './constants'
import { writable } from 'svelte/store'
import {
  DEFAULT_FILTERS,
  parseFiltersFromUrl,
  toSearchParams,
  type CalendarFilters
} from './filters'
import { goto } from '$app/navigation'
import { onMount } from 'svelte'
import { dateToString } from '$root/src/lib/utils/date'

type ScheduleTimeRange = {
  start_at: string
  end_at: string
}

/**
 * DateTimePicker에서 참조하는 전역 일정 맵 스토어
 * key: YYYY-M-D, value: 해당 날짜의 예약 시간대
 */
export const schedulesGroupByDate = writable<
  Record<string, ScheduleTimeRange[]>
>({})

/**
 * 캘린더 상태 훅
 * - 날짜 범위(일간/주간/월간) 전환
 * - 날짜/주 범위 관리
 */
export function useCalendarState(initialDate = new Date()) {
  const baseDate = new Date(initialDate)
  let dateRange: DateRangeMode = $state('일간')
  let selectedDate: Date | null = $state(baseDate)

  let weekStart: Date = $state(new Date(baseDate)) // 월요일
  let weekEnd: Date = $state(new Date(baseDate)) // 일요일

  let month = $state(baseDate.getMonth())
  let year = $state(baseDate.getFullYear())

  function getMonthRangeWithPadding(baseDate: Date) {
    const year = baseDate.getFullYear()
    const month = baseDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // ±7일 패딩 — 월 경계에 걸친 주간 뷰(주는 최대 6일까지 이웃 달로 넘어감)와
    // 월간 그리드의 이웃 달 칸을 커버한다. 뷰별 절삭은 클라이언트 필터가 담당.
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - 7)

    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + 7)

    return {
      start_date: dateToString(startDate, 'YYYY-MM-DD'),
      end_date: dateToString(endDate, 'YYYY-MM-DD')
    }
  }

  // 완성된 Date를 한 번에 할당 (중간 mutation으로 인한 다중 reactive trigger 방지)
  function setWeek(targetDate: Date) {
    const dayOfWeek = targetDate.getDay()
    const y = targetDate.getFullYear()
    const m = targetDate.getMonth()
    const d = targetDate.getDate()

    // 월요일 시작 (dayOfWeek: 0=일 → offset 6, 1=월 → 0, 2=화 → 1, ...)
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStart = new Date(y, m, d - mondayOffset, 0, 0, 0, 0)
    weekEnd = new Date(y, m, d - mondayOffset + 6, 23, 59, 59, 999)
  }

  function setSelectedDate(targetDate?: Date) {
    const next = targetDate || new Date()
    selectedDate = next
    month = next.getMonth()
    year = next.getFullYear()
    if (dateRange === '주간') setWeek(next)
  }

  // 초기 주 계산
  setWeek(baseDate)

  // mutation 없이 새 Date 생성하여 할당
  function goToPrevious() {
    if (dateRange === '월간') {
      if (month === 0) {
        month = 11
        year -= 1
      } else {
        month -= 1
      }
    } else if (dateRange === '주간') {
      const prevStart = new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() - 7,
        0,
        0,
        0,
        0
      )
      const prevEnd = new Date(
        weekEnd.getFullYear(),
        weekEnd.getMonth(),
        weekEnd.getDate() - 7,
        23,
        59,
        59,
        999
      )
      weekStart = prevStart
      weekEnd = prevEnd
      // fetch 창(month/year 기준)도 따라가야 이웃 달로 넘어간 주가 빈 화면이 안 된다
      month = prevStart.getMonth()
      year = prevStart.getFullYear()
    } else if (dateRange === '일간' && selectedDate) {
      const prev = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate() - 1
      )
      selectedDate = prev
      month = prev.getMonth()
      year = prev.getFullYear()
    }
  }

  function goToNext() {
    if (dateRange === '월간') {
      if (month === 11) {
        month = 0
        year += 1
      } else {
        month += 1
      }
    } else if (dateRange === '주간') {
      const nextStart = new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + 7,
        0,
        0,
        0,
        0
      )
      const nextEnd = new Date(
        weekEnd.getFullYear(),
        weekEnd.getMonth(),
        weekEnd.getDate() + 7,
        23,
        59,
        59,
        999
      )
      weekStart = nextStart
      weekEnd = nextEnd
      month = nextStart.getMonth()
      year = nextStart.getFullYear()
    } else if (dateRange === '일간' && selectedDate) {
      const next = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate() + 1
      )
      selectedDate = next
      month = next.getMonth()
      year = next.getFullYear()
    }
  }

  const monthRange = $derived(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const start = new Date(firstDay)
    start.setDate(start.getDate() - 7)

    const end = new Date(lastDay)
    end.setDate(end.getDate() + 7)

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    }
  })

  return {
    get dateRangeModes() {
      return DATE_RANGE_MODES
    },
    get dateRange() {
      return dateRange
    },
    set dateRange(value: DateRangeMode) {
      dateRange = value
      if (value === '주간' && selectedDate) setWeek(selectedDate)
    },
    get selectedDate() {
      return selectedDate
    },
    set selectedDate(value: Date | null) {
      if (!value) return
      setSelectedDate(value)
    },
    get weekStart() {
      return weekStart
    },
    get weekEnd() {
      return weekEnd
    },
    get month() {
      return month
    },
    get year() {
      return year
    },
    get monthRange() {
      return monthRange
    },
    setWeek,
    setSelectedDate,
    goToPrevious,
    goToNext,
    getMonthRangeWithPadding
  }
}

/**
 * 필터 상태 훅
 */
export function useResourceFilters(
  initialUrl: URL,
  pathname: string,
  onDateRangeChange?: (dateRange: DateRangeMode) => void
) {
  const initial = parseFiltersFromUrl(initialUrl)

  let managersChecked = $state<boolean[]>([])
  let programsChecked = $state<boolean[]>([])
  let selectedClientNames: string[] | null = $state(initial.selectedClientNames)
  let selectedManagerNames: string[] | null = $state(
    initial.selectedManagerNames
  )
  let selectedProgramNames: string[] | null = $state(
    initial.selectedProgramNames
  )
  let dateRange: DateRangeMode = $state(initial.dateRange)
  let displayMode: DisplayMode = $state(initial.displayMode)

  let mounted = $state(false)
  let expertsInitialized = $state<boolean>(false)
  let searchTimeout: ReturnType<typeof setTimeout> | null = null

  const buildFilters = (): CalendarFilters => ({
    selectedManagerNames,
    selectedProgramNames,
    selectedClientNames,
    dateRange,
    displayMode
  })

  const updateURL = () => {
    const params = toSearchParams(buildFilters())
    const queryString = params.toString()
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true })
  }

  onMount(() => {
    mounted = true
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout)
    }
  })

  // 필터 변경 시 URL 반영
  $effect(() => {
    selectedManagerNames
    selectedProgramNames
    selectedClientNames
    dateRange
    displayMode

    if (!mounted) return
    updateURL()
  })

  function reset() {
    selectedManagerNames = DEFAULT_FILTERS.selectedManagerNames
    selectedProgramNames = DEFAULT_FILTERS.selectedProgramNames
    selectedClientNames = DEFAULT_FILTERS.selectedClientNames
  }

  return {
    get managersChecked() {
      return managersChecked
    },
    set managersChecked(value) {
      managersChecked = [...value]
    },
    get programsChecked() {
      return programsChecked
    },
    set programsChecked(value) {
      programsChecked = [...value]
    },
    get selectedManagerNames() {
      return selectedManagerNames
    },
    set selectedManagerNames(value) {
      if (!value) return
      selectedManagerNames = [...value]
    },
    get selectedClientNames() {
      return selectedClientNames
    },
    set selectedClientNames(value) {
      if (!value) return
      selectedClientNames = [...value]
    },
    get selectedProgramNames() {
      return selectedProgramNames
    },
    set selectedProgramNames(value) {
      if (!value) return
      selectedProgramNames = [...value]
    },
    get dateRange() {
      return dateRange
    },
    set dateRange(value: DateRangeMode) {
      dateRange = value
      onDateRangeChange?.(value)
    },
    get displayMode() {
      return displayMode
    },
    set displayMode(value: DisplayMode) {
      displayMode = value
    },
    get expertsInitialized() {
      return expertsInitialized
    },
    set expertsInitialized(value: boolean) {
      expertsInitialized = value
    },
    buildFilters,
    reset
  }
}
