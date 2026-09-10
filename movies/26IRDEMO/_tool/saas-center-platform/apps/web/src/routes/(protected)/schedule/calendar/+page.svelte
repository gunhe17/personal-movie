<script lang="ts">
  import { getTitleIcon } from '$lib/config/title-icon'
  import { onMount } from 'svelte'
  import { fade, slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { browser } from '$app/environment'

  import Button from '$root/src/lib/components/Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ChevronIcon from '$root/src/lib/assets/ChevronIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import Calendar from '$root/src/lib/components/calendar/Calendar.svelte'
  import PageTitleSection from '$root/src/lib/components/PageTitleSection.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import WeeklyCalendar from '$root/src/lib/components/calendar/WeeklyCalendar.svelte'
  import DateRangeToggle from '$lib/components/schedule/calendar/DateRangeToggle.svelte'
  import DisplayModeToggle from '$lib/components/schedule/calendar/DisplayModeToggle.svelte'
  import WeeklySummaryCard from '$lib/components/schedule/calendar/WeeklySummaryCard.svelte'
  import ScheduleListView from '$lib/components/schedule/calendar/ScheduleListView.svelte'
  import ScheduleTimelineView from '$lib/components/schedule/calendar/ScheduleTimelineView.svelte'
  import {
    useCalendarState,
    useResourceFilters
  } from '$lib/features/schedule/calendar/hooks.svelte'
  import {
    getScheduleList,
    type ScheduleMapType
  } from '$lib/hooks/actions/schedule.action'
  import { formatUtcToKst, parseDateParam } from '$lib/utils/date'
  import {
    formatHeaderText,
    isToday,
    isTodayInRange,
    computeWeeklySummary
  } from '$lib/features/schedule/calendar/view-model'
  import { queryBuilder } from '$root/src/lib/hooks/queries/builder'
  import { getMemberList } from '$root/src/lib/hooks/actions/member.action'
  import { page } from '$app/state'
  import { centerId } from '$root/src/lib/stores/center.store'
  import {
    ManagerSelectDropDown,
    ClientSelectDropDown,
    ProgramSelectDropDown,
    RoomSelectDropDown
  } from '$lib/components/schedule/calendar'
  import { modalStore } from '$root/src/lib/stores/modal'
  import ScheduleRegisterModal from '$root/src/lib/components/modal/ScheduleRegisterModal.svelte'
  import {
    getClientList,
    type ClientListItem
  } from '$root/src/lib/hooks/actions/client.action'
  import { getOperatingTimes } from '$lib/hooks/actions/center.action'
  import { getRoomList } from '$lib/hooks/actions/room.action'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { SCHEDULE_CREATE_RULE } from '$lib/features/schedule/permissions'
  import { permissionStore } from '$lib/stores/permission.store'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    getScheduleChangeRequests,
    type ScheduleChangeRequestItem
  } from '$lib/hooks/actions/schedule.action'
  import { applyChangeRequests } from '$lib/features/schedule/calendar/change-requests'
  import { createReservationsService } from '$lib/features/schedule/reservations/reservations-service'
  import ScheduleChangeRequestModal from '$lib/components/schedule/reservations/ScheduleChangeRequestModal.svelte'
  import PendingActionBanner, {
    type PendingActionItem
  } from '$lib/components/dashboard/PendingActionBanner.svelte'

  const isOverlayMode = $derived(!responsive.isDesktop)

  const canUseManagerFilter = $derived(
    $permissionStore.context?.accessLevel === 'all' &&
      $permissionStore.context?.permissions?.includes('read:member')
  )

  const today = new Date()
  // 접수·등록을 마치고 돌아올 때 그 날짜로 연다(`?date=`) — 오늘로 열면 방금 만든
  // 일정이 화면 밖이라 등록이 안 된 것처럼 보인다. 없으면 오늘. (필터 훅이 마운트 후
  // URL을 필터 기준으로 다시 쓰므로 이 파라미터는 첫 렌더에만 쓰이고 사라진다)
  const dateParam = page.url.searchParams.get('date')
  const calendar = useCalendarState(
    dateParam ? parseDateParam(dateParam) : today
  )
  const pathname = page.url.pathname
  const resources = useResourceFilters(page.url, pathname, (v) => {
    calendar.dateRange = v
  })

  const memberQuery = $derived(
    queryBuilder(
      getMemberList,
      () => ({ centerId: $centerId! }),
      () => ({ enabled: !!$centerId && canUseManagerFilter })
    )
  )
  const managerList = $derived(memberQuery.data?.items ?? [])

  const clientsQuery = $derived(
    queryBuilder(getClientList, () => ({
      centerId: $centerId!
    }))
  )
  const clientsData = $derived<ClientListItem[]>(clientsQuery.data?.items || [])

  const operatingTimesQuery = $derived(
    queryBuilder(getOperatingTimes, () => ({ centerId: $centerId! }), {
      staleTime: 5 * 60 * 1000
    })
  )
  const operatingTimes = $derived(operatingTimesQuery.data ?? [])

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => ({
      center_id: $centerId!,
      active_only: true
    }))
  )
  const roomList = $derived(roomsQuery.data ?? [])
  let selectedRoomIds = $state<string[] | null>(null)

  const scheduleQuery = $derived.by(() => {
    const month = calendar.month
    const year = calendar.year

    const baseDate = new Date(year, month, 1)
    const { start_date, end_date } = calendar.getMonthRangeWithPadding(baseDate)

    return queryBuilder(getScheduleList, () => ({
      center_id: $centerId!,
      counselor_ids: canUseManagerFilter ? resources.selectedManagerNames : [],
      client_ids: resources.selectedClientNames,
      schedule_types: resources.selectedProgramNames,
      start_date,
      end_date
    }))
  })
  let scheduleList = $derived(scheduleQuery.data ?? [])

  // 담당자별 모드에서 장소 필터 적용
  const filteredScheduleList = $derived.by(() => {
    if (
      resources.dateRange !== '일간' ||
      resources.displayMode !== '담당자별' ||
      !selectedRoomIds ||
      selectedRoomIds.length === 0 ||
      selectedRoomIds.length === roomList.length
    ) {
      return scheduleList
    }
    const selectedRoomNames = new Set(
      roomList.filter((r) => selectedRoomIds!.includes(r.id)).map((r) => r.name)
    )
    return scheduleList.filter(
      (s) => s.room_name && selectedRoomNames.has(s.room_name)
    )
  })

  const formatDateKey = (date: Date | string) => {
    return formatUtcToKst(date, 'YYYY-MM-DD')
  }

  // ── 내담자 앱 일정 변경 요청 ──
  // 승인/반려는 대시보드 배너·변경요청 메뉴와 **같은 서비스**를 쓴다(표면만 늘고 로직은 하나).
  // 역할 게이팅은 걸지 않는다 — 대시보드 배너와 동일(작은 센터는 상담사가 관리를 겸한다).
  const changeRequestQueryClient = useQueryClient()
  const reservationsService = createReservationsService({
    queryClient: changeRequestQueryClient
  })
  const changeRequestsQuery = $derived(
    queryBuilder(
      getScheduleChangeRequests,
      () => ({ center_id: $centerId ?? '', status: 'pending' as const }),
      () => ({ enabled: !!$centerId })
    )
  )
  const pendingChangeRequests = $derived(
    (changeRequestsQuery.data as ScheduleChangeRequestItem[]) ?? []
  )

  /**
   * 고스트 블록은 **시간축이 있는 뷰(일간·주간)에만** 얹는다.
   * 월간은 칩이라 요청 시각·충돌을 담을 자리가 없어 상단 배너가 그 역할을 맡는다.
   */
  const schedulesWithChangeRequests = $derived(
    applyChangeRequests(scheduleList, pendingChangeRequests)
  )
  const filteredSchedulesWithChangeRequests = $derived(
    applyChangeRequests(filteredScheduleList, pendingChangeRequests)
  )

  function openChangeRequest(request: ScheduleChangeRequestItem) {
    modalStore.open({
      component: ScheduleChangeRequestModal,
      props: {
        request,
        onApprove: reservationsService.approve,
        onReject: reservationsService.reject
      }
    })
  }

  /** 배너에서 항목을 누르면 그 요청이 그려진 날짜로 캘린더를 옮긴다 */
  function goToRequestedDate(request: ScheduleChangeRequestItem) {
    calendar.selectedDate = new Date(request.requested_start)
  }

  /**
   * 배너 등장 모션 — 응답 대기함은 **지금 답을 기다리는 것**이라 눈에 걸려야 한다.
   * 이미 자리를 차지한 채 나타나면 페이지의 일부로 읽혀 지나친다. 높이 0에서 펼치며
   * 아래 본문을 밀어내면 "방금 생겼다"가 읽힌다.
   *
   * mounted 게이트가 필요한 이유 — 쿼리 캐시가 살아 있으면 첫 렌더에 이미 항목이 차 있어
   * `{#if}`가 false→true로 바뀌지 않고, 그러면 Svelte transition이 재생되지 않는다.
   * 게이트를 두면 진입·새로고침 어느 쪽이든 항상 한 번 재생된다.
   *
   * 지연을 두는 이유 — 첫 페인트와 동시에 밀고 들어오면 "로딩 중 레이아웃이 튀었다"로
   * 읽혀 등장 자체가 눈에 안 걸린다. 캘린더가 먼저 자리를 잡은 뒤에 들어와야
   * '새로 생긴 것'으로 보인다. (모션을 끈 사용자에겐 지연도 두지 않는다 —
   * 애니메이션 없이 시간만 끌면 그냥 늦게 튀어나오는 셈이다)
   */
  let bannerReady = $state(false)
  const BANNER_MOTION =
    browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 360
  const BANNER_ENTER_DELAY = BANNER_MOTION ? 350 : 0

  const pendingActionItems = $derived.by((): PendingActionItem[] =>
    pendingChangeRequests.map((r) => ({
      id: `change-${r.id}`,
      tone: 'request' as const,
      title: `${r.client_name ?? '내담자'} 님이 일정 변경을 요청했어요`,
      onOpen: () => {
        goToRequestedDate(r)
        openChangeRequest(r)
      },
      change: {
        from: formatUtcToKst(r.current_start, 'MM.DD HH:mm'),
        to: formatUtcToKst(r.requested_start, 'MM.DD HH:mm')
      },
      actions: [
        {
          label: '요청 날짜 보기',
          // 이동이라 '처리'(반려·승인)와 급이 다르다 — 면 없는 텍스트 액션
          variant: 'text' as const,
          run: () => {
            goToRequestedDate(r)
            // false = 배너에서 빼지 않는다. 이건 **이동**이지 처리가 아니다 —
            // 빼버리면 요청을 보러 간 순간 그 요청이 배너에서 사라지고 다음 건이
            // 올라와, 화면과 배너가 서로 다른 요청을 가리킨다.
            return false
          }
        },
        {
          label: '반려',
          variant: 'danger' as const,
          run: () => reservationsService.reject(r.id)
        },
        {
          label: '승인',
          variant: 'primary' as const,
          run: () => reservationsService.approve(r.id)
        }
      ]
    }))
  )

  let groupedSchedulesByDate = $derived.by<ScheduleMapType>(() => {
    return scheduleList.reduce<ScheduleMapType>((acc, cur) => {
      const key = formatDateKey(cur.start)
      if (!acc[key]) acc[key] = []
      acc[key].push({
        id: cur.id,
        client: cur.client_names.join(', '),
        counselor_color: cur.counselor_color ?? null,
        manager: cur.counselor_name,
        date: cur.start,
        start_at: formatUtcToKst(cur.start, 'HH:mm'),
        start_at_origin: cur.start,
        end_at: formatUtcToKst(cur.end, 'HH:mm'),
        end_at_origin: cur.end,
        title: cur.title,
        program_name: cur.program_name ?? null,
        schedule_type: cur.schedule_type,
        room: cur.room_name,
        status: cur.has_conflict,
        session_status: cur.session_status ?? null
      })
      return acc
    }, {})
  })

  const headerText = $derived(
    formatHeaderText({
      dateRange: resources.dateRange,
      year: calendar.year,
      month: calendar.month,
      selectedDate: calendar.selectedDate,
      weekStart: calendar.weekStart,
      weekEnd: calendar.weekEnd
    })
  )

  const isDaily = $derived(resources.dateRange === '일간')

  // 시간표 높이의 기준은 **타이틀 행 아래 전부**다 — 상단에 끼어드는 배너(응답 대기함) 같은
  // 삽입물은 카드를 아래로 밀 뿐 높이를 뺏지 않는다. 뺏게 두면 시간 셀이 조용히 줄어
  // 같은 화면이 날마다 다른 규격으로 보인다. 그래서 카드의 실제 top이 아니라
  // "타이틀 행 높이 + 아래 여백 16"만 뺀 값을 기준으로 삼고, 화면을 넘기면 셸이 스크롤한다.
  // 일간은 이 높이를 카드에 직접 주고 그 안에서 18칸 균등 분할, 주간은 같은 식으로 구한
  // 셀 높이(px)를 넘겨받아 일간과 셀 높이를 맞춘다.
  const CARD_HEADER_H = 64
  const TIMELINE_HEADER_H = 40
  const DAILY_SLOT_COUNT = 18
  const TITLE_ROW_GAP = 16 // 타이틀 행 mb-4 (정본 §Page grid & margins)
  let pageRootH = $state(0)
  let titleRowH = $state(0)
  const baselineCardH = $derived(
    pageRootH > 0 && titleRowH > 0 ? pageRootH - titleRowH - TITLE_ROW_GAP : 0
  )
  // 측정 전 첫 프레임은 기존 flex 레이아웃으로 둔다(고정 높이 0으로 카드가 붕괴하는 것 방지)
  const cardMeasured = $derived(baselineCardH > 0)
  const weeklyRowPx = $derived(
    cardMeasured
      ? Math.max(
          (baselineCardH - CARD_HEADER_H - TIMELINE_HEADER_H) /
            DAILY_SLOT_COUNT,
          0
        )
      : 0
  )

  const setSelectedDate = (targetDate?: Date) => {
    calendar.selectedDate = targetDate || today
  }

  const visibleScheduleCount = $derived.by(() => {
    if (resources.dateRange === '월간') {
      return scheduleList.filter((s) => {
        const d = new Date(s.start)
        return (
          d.getFullYear() === calendar.year && d.getMonth() === calendar.month
        )
      }).length
    } else if (resources.dateRange === '주간') {
      return scheduleList.filter((s) => {
        const d = new Date(s.start)
        return d >= calendar.weekStart && d <= calendar.weekEnd
      }).length
    } else {
      if (!calendar.selectedDate) return 0
      const sel = calendar.selectedDate
      return scheduleList.filter((s) => {
        const d = new Date(s.start)
        return (
          d.getFullYear() === sel.getFullYear() &&
          d.getMonth() === sel.getMonth() &&
          d.getDate() === sel.getDate()
        )
      }).length
    }
  })

  const weeklySummary = $derived.by(() => {
    if (resources.dateRange !== '주간') return null
    return computeWeeklySummary(
      scheduleList,
      calendar.weekStart,
      calendar.weekEnd
    )
  })

  // 오늘 뱃지 표시 여부
  const showTodayBadge = $derived.by(() => {
    if (resources.dateRange === '일간') {
      return isToday(calendar.selectedDate)
    }
    if (resources.dateRange === '주간') {
      return isTodayInRange(calendar.weekStart, calendar.weekEnd)
    }
    return false
  })

  const handleRegisterSchedule = () => {
    modalStore.open({
      component: ScheduleRegisterModal,
      props: {},
      options: {
        customWidth: 540
      }
    })
  }

  // 모바일 필터 패널 토글
  let showMobileFilters = $state(false)

  // 실제 필터가 적용된 경우만 카운트 (전체 선택 == 미적용)
  const PROGRAM_OPTIONS_TOTAL = 3 // 검사/상담/운영
  function isPartial(selected: string[] | null | undefined, total: number) {
    if (!selected) return false
    const len = selected.length
    return len > 0 && len < total
  }
  const activeFilterCount = $derived(
    (isPartial(resources.selectedProgramNames, PROGRAM_OPTIONS_TOTAL) ? 1 : 0) +
      (isPartial(resources.selectedManagerNames, managerList.length) ? 1 : 0) +
      (isPartial(resources.selectedClientNames, clientsData.length) ? 1 : 0) +
      (isPartial(selectedRoomIds, roomList.length) ? 1 : 0)
  )

  // 필터 초기화: 페이지 로컬 상태인 selectedRoomIds도 함께 리셋
  const handleResetFilters = () => {
    resources.reset()
    selectedRoomIds = null
  }

  // 주간 모바일: 요일별 스케줄 카운트
  const weekDays = $derived.by(() => {
    if (resources.dateRange !== '주간') return []
    const days: {
      date: Date
      dayLabel: string
      dayOfMonth: number
      count: number
      isToday: boolean
      isSunday: boolean
    }[] = []
    const current = new Date(calendar.weekStart)
    const DAYS = ['일', '월', '화', '수', '목', '금', '토']
    while (current <= calendar.weekEnd) {
      const date = new Date(current)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const count = scheduleList.filter(
        (s) => formatUtcToKst(s.start, 'YYYY-MM-DD') === dateStr
      ).length
      const todayNow = new Date()
      days.push({
        date,
        dayLabel: DAYS[date.getDay()],
        dayOfMonth: date.getDate(),
        count,
        isToday:
          date.getFullYear() === todayNow.getFullYear() &&
          date.getMonth() === todayNow.getMonth() &&
          date.getDate() === todayNow.getDate(),
        isSunday: date.getDay() === 0
      })
      current.setDate(current.getDate() + 1)
    }
    return days
  })

  $effect(() => {
    if (
      !resources.expertsInitialized &&
      managerList &&
      managerList.length > 0
    ) {
      resources.managersChecked = managerList.map(() => true)
      resources.expertsInitialized = true
    }
  })

  onMount(() => {
    calendar.dateRange = resources.dateRange
    const enterTimer = setTimeout(() => {
      bannerReady = true
    }, BANNER_ENTER_DELAY)
    return () => clearTimeout(enterTimer)
  })

  const TitleIcon = $derived(getTitleIcon(page.url.pathname))
</script>

{#if isOverlayMode}
  <!-- ==================== 모바일/태블릿 레이아웃 ==================== -->
  <div
    in:fade
    class="flex flex-col bg-gray-50 h-[calc(100dvh-6rem)] md:h-full min-h-0 overflow-hidden"
  >
    <!-- Row 1: 타이틀 + 등록 버튼 -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        {#if TitleIcon}<TitleIcon />{/if}
        <Typography variant="headline-01-normal-semibold">일정</Typography>
      </div>
      <PermissionGuard rule={SCHEDULE_CREATE_RULE}>
        <button
          class="w-10 md:w-auto md:px-5 h-10 md:h-11 rounded-lg bg-primary-500 text-white flex items-center justify-center gap-2"
          onclick={handleRegisterSchedule}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 4V16M4 10H16"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span class="hidden md:inline text-body-01-normal-medium"
            >신규 등록</span
          >
        </button>
      </PermissionGuard>
    </div>
    {#if bannerReady && pendingActionItems.length > 0}
      <!-- 응답 대기함 — 대시보드와 같은 컴포넌트·같은 서비스.
           월간 뷰는 칩이라 요청 시각이 안 보이므로 그 사각을 이 배너가 덮는다.
           등장 모션은 데스크톱과 동일(래퍼가 높이+여백을 펼치고 안쪽이 페이드) -->
      <div
        transition:slide={{ duration: BANNER_MOTION, easing: cubicOut }}
        class="mb-3 shrink-0"
      >
        <div
          in:fade={{
            duration: BANNER_MOTION,
            delay: Math.round(BANNER_MOTION / 4)
          }}
        >
          <PendingActionBanner
            items={pendingActionItems}
            class="mt-0 mb-0 max-w-none"
          />
        </div>
      </div>
    {/if}
    <!-- Row 2: DateRangeToggle -->
    <div class="mb-3">
      <DateRangeToggle
        selected={resources.dateRange}
        onchange={(mode) => (resources.dateRange = mode)}
      />
    </div>
    <!-- Row 3: 날짜 네비 + 오늘 + 건수 + 필터 -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-1 min-w-0 flex-1">
        <button
          onclick={calendar.goToPrevious}
          class="w-8 h-8 shrink-0 flex-center"
        >
          <ChevronIcon class="stroke-[#AAAAAA]" />
        </button>
        <Typography variant="body-01-normal-semibold" className="truncate-safe"
          >{headerText}</Typography
        >
        <button
          onclick={calendar.goToNext}
          class="w-8 h-8 shrink-0 flex-center"
        >
          <ChevronIcon class="rotate-180 stroke-[#AAAAAA]" />
        </button>
        <Typography
          variant="body-03-medium"
          color="text-primary-500"
          className="shrink-0 ml-1"
        >
          {visibleScheduleCount}건
        </Typography>
        <button
          onclick={() => setSelectedDate()}
          class="shrink-0 h-7 px-2 rounded-md border border-gray-200 ml-1 hover:bg-gray-50"
        >
          <Typography variant="label-02-normal-medium" color="text-gray-600"
            >오늘</Typography
          >
        </button>
      </div>
      <div class="flex items-center gap-1.5 shrink-0 ml-2">
        <!-- 필터 토글 버튼 -->
        <button
          onclick={() => (showMobileFilters = !showMobileFilters)}
          class="h-8 px-2.5 rounded-lg border border-gray-200 flex items-center gap-1 hover:bg-gray-50"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h12M4 8h8M6 12h4"
              stroke="#6B7280"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          {#if activeFilterCount > 0}
            <span
              class="w-4 h-4 rounded-full bg-primary-500 text-white text-caption-01-normal-medium flex-center"
            >
              {activeFilterCount}
            </span>
          {/if}
        </button>
        <!-- 필터 초기화 버튼 -->
        {#if activeFilterCount > 0}
          <button
            onclick={handleResetFilters}
            class="group flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 hover:bg-gray-50"
          >
            <span
              class="text-gray-500 transition-transform duration-300 group-hover:-rotate-180"
            >
              <RefreshIcon className="h-4 w-4" />
            </span>
            <Typography
              variant="label-02-normal-medium"
              color="text-gray-600"
              tag="span"
            >
              초기화
            </Typography>
          </button>
        {/if}
      </div>
    </div>
    <!-- Row 4: 접이식 필터 패널 -->
    {#if showMobileFilters}
      <div
        class="flex flex-col md:flex-row md:flex-wrap gap-2 mb-3 p-3 bg-white rounded-2xl border border-gray-200"
      >
        <ProgramSelectDropDown
          options={[
            { label: '검사', value: 'assessment' },
            { label: '상담', value: 'counseling' },
            { label: '운영', value: 'meeting' }
          ]}
          bind:selectedProgramOptions={resources.selectedProgramNames}
        />
        {#if canUseManagerFilter && managerList && managerList?.length}
          <ManagerSelectDropDown
            options={managerList}
            bind:selectedManagerNames={resources.selectedManagerNames}
          />
        {/if}
        <ClientSelectDropDown
          options={clientsData}
          bind:selectedClientNames={resources.selectedClientNames}
        />
      </div>
    {/if}

    <!-- Body: 모드별 본문 -->
    <div class="flex-1 flex flex-col min-h-0">
      {#if resources.dateRange === '월간'}
        <!-- 월간: Calendar (viewport 높이에 맞춰 행 자동 분배) -->
        <div
          class="flex-1 min-h-0 border border-gray-200 rounded-2xl overflow-hidden bg-white"
        >
          <Calendar
            bind:selectedDate={calendar.selectedDate}
            monthlySchdule={groupedSchedulesByDate}
            {today}
            year={calendar.year}
            month={calendar.month}
          />
        </div>
      {:else}
        <!-- 일간/주간: 카드 리스트 -->
        <div
          class="flex flex-col md:min-h-0 md:flex-1 border border-gray-200 rounded-2xl overflow-hidden bg-white"
        >
          {#if resources.dateRange === '주간'}
            <!-- 요일 선택 스트립 (sticky) -->
            <div
              class="flex border-b border-gray-200 shrink-0 sticky top-0 z-10 bg-white"
            >
              {#each weekDays as day}
                {@const isSelected =
                  calendar.selectedDate &&
                  calendar.selectedDate.getFullYear() ===
                    day.date.getFullYear() &&
                  calendar.selectedDate.getMonth() === day.date.getMonth() &&
                  calendar.selectedDate.getDate() === day.date.getDate()}
                <button
                  class="flex-1 py-2 text-center transition-colors {isSelected
                    ? 'bg-primary-50'
                    : 'hover:bg-gray-50'} {day.isSunday
                    ? 'text-[#D23E46]'
                    : ''}"
                  onclick={() => {
                    calendar.selectedDate = day.date
                  }}
                >
                  <div
                    class="text-xs font-medium {day.isToday
                      ? 'text-primary-500'
                      : day.isSunday
                        ? 'text-[#D23E46]'
                        : 'text-gray-500'}"
                  >
                    {day.dayLabel}
                  </div>
                  <div
                    class="text-sm font-semibold {day.isToday
                      ? 'text-primary-500'
                      : day.isSunday
                        ? 'text-[#D23E46]'
                        : 'text-gray-800'}"
                  >
                    {day.dayOfMonth}
                  </div>
                  {#if day.count > 0}
                    <div class="text-body-03-normal-medium text-primary-500">
                      {day.count}건
                    </div>
                  {:else}
                    <div class="text-body-03-normal-regular text-gray-300">
                      -
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
          <!-- 스케줄 카드 리스트 (flatMode: 예약 있는 것만) -->
          <div class="md:flex-1 md:min-h-0 md:overflow-y-auto">
            <ScheduleListView
              schedules={scheduleList}
              selectedDate={calendar.selectedDate}
              {operatingTimes}
              compact={true}
              flatMode={true}
            />
          </div>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <!-- ==================== 데스크톱 레이아웃 (기존) ==================== -->
  <!-- h-full은 기준 높이 측정용. overflow는 잠그지 않는다 — 배너 등으로 콘텐츠가
       뷰포트를 넘치면 영역이 아니라 셸(페이지) 전체가 스크롤한다 -->
  <div
    bind:clientHeight={pageRootH}
    in:fade
    class="h-full flex flex-col bg-gray-50"
  >
    <!-- Row 1: 타이틀 + 날짜 범위 토글 + 등록 버튼 -->
    <div
      bind:clientHeight={titleRowH}
      class="flex items-center justify-between mb-4"
    >
      <div class="flex items-center gap-2">
        {#if TitleIcon}<TitleIcon />{/if}
        <Typography variant="headline-01-normal-semibold">일정</Typography>
      </div>
      <div class="flex items-center gap-3">
        <DateRangeToggle
          selected={resources.dateRange}
          onchange={(mode) => (resources.dateRange = mode)}
        />
        <PermissionGuard rule={SCHEDULE_CREATE_RULE}>
          <PageActionButton
            label="신규 등록"
            onclick={handleRegisterSchedule}
          />
        </PermissionGuard>
      </div>
    </div>
    {#if bannerReady && pendingActionItems.length > 0}
      <!-- 응답 대기함 — 대시보드와 같은 컴포넌트·같은 서비스.
           월간 뷰는 칩이라 요청 시각이 안 보이므로 그 사각을 이 배너가 덮는다.
           static — 대시보드와 달리 이 페이지의 주인공은 시간표라, 배너가 상단에 눌러앉으면
           스크롤로 벌어야 하는 시간표 자리를 계속 잠식한다. 제자리에서 같이 밀려 올라간다.
           바깥 래퍼가 높이·아래 여백(16)까지 함께 펼쳐 본문을 밀어내고, 안쪽이 페이드로
           따라 들어온다(높이만 열면 반쯤 잘린 배너가 먼저 보인다) -->
      <!-- 🔴 shrink-0 필수 — 펼치는 동안 래퍼는 overflow-hidden이 되는데, 그러면 flex 아이템의
           `min-height: auto`가 0으로 풀린다. 부모(h-full flex-col)는 이미 꽉 차 있어 배너가
           끼는 순간 넘치므로, 막지 않으면 flex-shrink가 높이를 0으로 눌러 **여백만 열리고
           높이는 끝에서 툭 튀는** 모션이 된다(실측). -->
      <div
        transition:slide={{ duration: BANNER_MOTION, easing: cubicOut }}
        class="mb-4 shrink-0"
      >
        <div
          in:fade={{
            duration: BANNER_MOTION,
            delay: Math.round(BANNER_MOTION / 4)
          }}
        >
          <PendingActionBanner
            items={pendingActionItems}
            class="static mt-0 mb-0 max-w-none"
          />
        </div>
      </div>
    {/if}

    <!-- pb-5: 셸의 padding-bottom은 넘친 콘텐츠의 스크롤 영역에 포함되지 않아 직접 준다 -->
    <div
      class={cardMeasured
        ? 'flex flex-col gap-4 shrink-0 pb-5'
        : 'flex flex-col gap-4 flex-1 min-h-0'}
    >
      {#if resources.dateRange === '일간' || resources.dateRange === '주간'}
        <!-- 일간/주간: 헤더 + 서머리 + 본문을 하나의 카드로 -->
        <!-- overflow-clip — hidden은 sticky 요일 헤더를 무력화 -->
        <!-- 일간은 기준 높이(baselineCardH)를 직접 받는다: 배너가 있어도 시간 셀이 줄지 않고,
             넘치는 만큼은 셸이 스크롤한다 -->
        <div
          class={cardMeasured
            ? 'flex flex-col border border-gray-200 rounded-2xl overflow-clip bg-white'
            : 'flex flex-col flex-1 min-h-0 border border-gray-200 rounded-2xl overflow-hidden bg-white'}
          style:height={isDaily && cardMeasured
            ? `${baselineCardH}px`
            : undefined}
        >
          <!-- Row 2: 날짜 + 필터 -->
          <div
            class="flex items-center justify-between px-4 h-16 shrink-0 border-b border-gray-200"
          >
            <div class="flex items-center gap-1">
              <div class="flex gap-2.5 items-center">
                <button
                  onclick={calendar.goToPrevious}
                  class="w-8 h-8 flex-center"
                >
                  <ChevronIcon
                    class="stroke-[#AAAAAA] hover:scale-125 transition"
                  />
                </button>
                <Typography variant="headline-02-normal-semibold"
                  >{headerText}</Typography
                >
                <button onclick={calendar.goToNext} class="w-8 h-8 flex-center">
                  <ChevronIcon
                    class="rotate-180 stroke-[#AAAAAA] hover:scale-125 transition"
                  />
                </button>
              </div>
              <Typography variant="body-01-medium" color="text-primary-500">
                총 {visibleScheduleCount}건
              </Typography>
              <button
                onclick={() => setSelectedDate()}
                class="w-14 h-8 rounded-lg border border-gray-200 ml-2 hover:bg-gray-50 duration-200"
              >
                <Typography
                  variant="body-03-normal-medium"
                  color="text-gray-600"
                >
                  오늘
                </Typography>
              </button>
            </div>
            <div class="flex items-center gap-2">
              <div class="filter-bar flex items-center gap-2">
                <ProgramSelectDropDown
                  options={[
                    { label: '검사', value: 'assessment' },
                    { label: '상담', value: 'counseling' },
                    { label: '운영', value: 'meeting' }
                  ]}
                  bind:selectedProgramOptions={resources.selectedProgramNames}
                />
                {#if resources.dateRange === '일간' && resources.displayMode === '담당자별'}
                  <RoomSelectDropDown
                    options={roomList}
                    bind:selectedRoomNames={selectedRoomIds}
                  />
                {:else if canUseManagerFilter && managerList && managerList?.length}
                  <ManagerSelectDropDown
                    options={managerList}
                    bind:selectedManagerNames={resources.selectedManagerNames}
                  />
                {/if}
                <ClientSelectDropDown
                  options={clientsData}
                  bind:selectedClientNames={resources.selectedClientNames}
                />
                <FilterResetButton
                  onclick={handleResetFilters}
                  disabled={activeFilterCount === 0}
                />
              </div>
              {#if resources.dateRange === '일간' && canUseManagerFilter}
                <DisplayModeToggle
                  selected={resources.displayMode}
                  onchange={(mode) => (resources.displayMode = mode)}
                />
              {/if}
            </div>
          </div>
          {#if resources.dateRange === '주간' && weeklySummary}
            <WeeklySummaryCard summary={weeklySummary} />
          {/if}
          {#if resources.dateRange === '일간' && resources.displayMode === '장소별'}
            <ScheduleTimelineView
              schedules={schedulesWithChangeRequests}
              rooms={roomList}
              selectedDate={calendar.selectedDate}
              {operatingTimes}
            />
          {:else if resources.dateRange === '일간' && resources.displayMode === '담당자별' && canUseManagerFilter}
            <ScheduleTimelineView
              mode="counselor"
              schedules={filteredSchedulesWithChangeRequests}
              rooms={roomList}
              counselors={managerList.map((m) => ({
                id: m.id,
                name: m.person.name
              }))}
              selectedDate={calendar.selectedDate}
              {operatingTimes}
            />
          {:else}
            <!-- 주간 -->
            <WeeklyCalendar
              bind:selectedDate={calendar.selectedDate}
              currentSchedules={schedulesWithChangeRequests}
              weekStart={calendar.weekStart}
              weekEnd={calendar.weekEnd}
              {operatingTimes}
              pageScroll
              rowHeight={weeklyRowPx}
            />
          {/if}
        </div>
      {:else}
        <!-- 월간 모드 -->
        <div
          class="flex flex-col border border-gray-200 rounded-2xl overflow-clip bg-white"
        >
          <!-- 헤더 높이는 일간/주간과 동일(h-16) -->
          <div
            class="flex items-center justify-between px-4 h-16 shrink-0 border-b border-gray-200"
          >
            <div class="flex items-center gap-1">
              <div class="flex gap-2.5 items-center">
                <button
                  onclick={calendar.goToPrevious}
                  class="w-8 h-8 flex-center"
                >
                  <ChevronIcon
                    class="stroke-[#AAAAAA] hover:scale-125 transition"
                  />
                </button>
                <Typography variant="headline-02-normal-semibold"
                  >{headerText}</Typography
                >
                <button onclick={calendar.goToNext} class="w-8 h-8 flex-center">
                  <ChevronIcon
                    class="rotate-180 stroke-[#AAAAAA] hover:scale-125 transition"
                  />
                </button>
              </div>
              <Typography variant="body-01-medium" color="text-primary-500">
                총 {visibleScheduleCount}건
              </Typography>
              <button
                onclick={() => setSelectedDate()}
                class="w-14 h-8 rounded-lg border border-gray-200 ml-2 hover:border-gray-300 duration-200"
              >
                <Typography
                  variant="body-03-normal-medium"
                  color="text-gray-600"
                >
                  오늘
                </Typography>
              </button>
            </div>
            <div class="filter-bar flex items-center gap-2">
              <ProgramSelectDropDown
                options={[
                  { label: '검사', value: 'assessment' },
                  { label: '상담', value: 'counseling' },
                  { label: '운영', value: 'meeting' }
                ]}
                bind:selectedProgramOptions={resources.selectedProgramNames}
              />
              {#if canUseManagerFilter && managerList && managerList?.length}
                <ManagerSelectDropDown
                  options={managerList}
                  bind:selectedManagerNames={resources.selectedManagerNames}
                />
              {/if}
              <ClientSelectDropDown
                options={clientsData}
                bind:selectedClientNames={resources.selectedClientNames}
              />
              <FilterResetButton
                onclick={handleResetFilters}
                disabled={activeFilterCount === 0}
              />
            </div>
          </div>
          <Calendar
            bind:selectedDate={calendar.selectedDate}
            monthlySchdule={groupedSchedulesByDate}
            {today}
            year={calendar.year}
            month={calendar.month}
            pageScroll
          />
        </div>
      {/if}
    </div>
  </div>
{/if}
