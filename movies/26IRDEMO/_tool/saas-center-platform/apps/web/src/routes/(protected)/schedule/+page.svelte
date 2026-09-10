<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'

  import Button from '$root/src/lib/components/Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ChevronIcon from '$root/src/lib/assets/ChevronIcon.svelte'
  import Calendar from '$root/src/lib/components/calendar/Calendar.svelte'
  import PageTitleSection from '$root/src/lib/components/PageTitleSection.svelte'
  import DailyCalendar from '$root/src/lib/components/calendar/DailyCalendar.svelte'
  import WeeklyCalendar from '$root/src/lib/components/calendar/WeeklyCalendar.svelte'
  import {
    DATE_RANGE_MODES,
    type DateRangeMode
  } from '$lib/features/schedule/calendar/constants'
  import {
    useCalendarState,
    useResourceFilters
  } from '$lib/features/schedule/calendar/hooks.svelte'
  import {
    getScheduleList,
    type ScheduleMapType
  } from '$lib/hooks/actions/schedule.action'
  import { formatUtcToKst } from '$lib/utils/date'
  import { formatHeaderText } from '$lib/features/schedule/calendar/view-model'
  import { queryBuilder } from '$root/src/lib/hooks/queries/builder'
  import { getMemberList } from '$root/src/lib/hooks/actions/member.action'
  import { page } from '$app/state'
  import { centerId } from '$root/src/lib/stores/center.store'
  import {
    ManagerSelectDropDown,
    ClientSelectDropDown,
    ProgramSelectDropDown
  } from '$lib/components/schedule/calendar'
  import { modalStore } from '$root/src/lib/stores/modal'
  import ScheduleRegisterModal from '$root/src/lib/components/modal/ScheduleRegisterModal.svelte'
  import {
    getClientList,
    type ClientListItem
  } from '$root/src/lib/hooks/actions/client.action'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { SCHEDULE_CREATE_RULE } from '$lib/features/schedule/permissions'

  const today = new Date()
  const calendar = useCalendarState(today)
  const pathname = page.url.pathname
  const resources = useResourceFilters(page.url, pathname, (v) => {
    calendar.dateRange = v
  })
  const memberQuery = $derived(
    queryBuilder(getMemberList, () => ({
      centerId: $centerId!
    }))
  )
  const managerList = $derived(memberQuery.data?.items ?? [])
  const clientsQuery = $derived(
    queryBuilder(getClientList, () => ({
      centerId: $centerId!
    }))
  )
  const clientsData = $derived<ClientListItem[]>(clientsQuery.data?.items || [])

  const scheduleQuery = $derived.by(() => {
    const month = calendar.month
    const year = calendar.year

    const baseDate = new Date(year, month, 1)
    const { start_date, end_date } = calendar.getMonthRangeWithPadding(baseDate)

    return queryBuilder(getScheduleList, () => ({
      center_id: $centerId!,
      counselor_ids: resources.selectedManagerNames,
      client_ids: resources.selectedClientNames,
      schedule_types: resources.selectedProgramNames,
      start_date,
      end_date
    }))
  })
  let scheduleList = $derived(scheduleQuery.data ?? [])

  const formatDateKey = (date: Date | string) => {
    return formatUtcToKst(date, 'YYYY-MM-DD')
  }

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

  const handleRegisterSchedule = () => {
    modalStore.open({
      component: ScheduleRegisterModal,
      props: {},
      options: {
        customWidth: 540
      }
    })
  }

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
  })
</script>

<div in:fade class="xl:h-full flex flex-col xl:overflow-hidden bg-gray-50">
  <!-- 타이틀 아래가 날짜 툴바(여백 가진 행) → 간격 8 -->
  <PageTitleSection title="스케줄" className="mb-2">
    <div slot="extraBtn">
      <PermissionGuard rule={SCHEDULE_CREATE_RULE}>
        <Button
          class="flex items-center rounded-lg h-11"
          onclick={handleRegisterSchedule}
        >
          <Typography variant="body-01-regular" color="text-white">
            스케줄 등록
          </Typography>
        </Button>
      </PermissionGuard>
    </div>
  </PageTitleSection>
  <div class="flex flex-col gap-4 flex-1 min-h-0">
    <div class="items-center grid gap-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="flex gap-2.5 items-center">
            <button onclick={calendar.goToPrevious} class="w-8 h-8 flex-center">
              <ChevronIcon
                class="stroke-[#AAAAAA] hover:scale-125 transition"
              />
            </button>
            <Typography variant="headline-02-medium">
              {headerText}
            </Typography>
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
            class="w-[56px] h-8 rounded-[8px] border border-gray-200 ml-2 hover:border-gray-300 duration-200"
          >
            <Typography variant="body-03-medium" color="text-gray-600">
              오늘
            </Typography>
          </button>
        </div>
        <div class="flex items-center gap-2">
          <ProgramSelectDropDown
            options={[
              { label: '검사', value: 'assessment' },
              { label: '상담', value: 'counseling' },
              { label: '운영', value: 'meeting' }
            ]}
            bind:selectedProgramOptions={resources.selectedProgramNames}
          />
          {#if managerList && managerList?.length}
            <ManagerSelectDropDown
              options={managerList}
              bind:selectedManagerNames={resources.selectedManagerNames}
            />
          {/if}
          <ClientSelectDropDown
            options={clientsData}
            bind:selectedClientNames={resources.selectedClientNames}
          />
          <div
            class="flex items-center rounded-lg border border-gray-200 overflow-hidden h-9"
          >
            {#each DATE_RANGE_MODES as mode, idx}
              <button
                onclick={() => (resources.dateRange = mode)}
                class="px-4 h-full text-sm font-medium transition-colors duration-150 {resources.dateRange ===
                mode
                  ? 'bg-gray-700 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'} {idx <
                DATE_RANGE_MODES.length - 1
                  ? 'border-r border-gray-200'
                  : ''}"
              >
                {mode}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>
    <div class="items-center grid flex-1 min-h-0 gap-4">
      {#if resources.dateRange === '월간'}
        <Calendar
          bind:selectedDate={calendar.selectedDate}
          monthlySchdule={groupedSchedulesByDate}
          {today}
          year={calendar.year}
          month={calendar.month}
        />
      {:else if resources.dateRange === '주간'}
        <WeeklyCalendar
          bind:selectedDate={calendar.selectedDate}
          currentSchedules={scheduleList}
          weekStart={calendar.weekStart}
          weekEnd={calendar.weekEnd}
        />
      {:else if resources.dateRange === '일간'}
        <DailyCalendar
          {managerList}
          bind:selectedDate={calendar.selectedDate}
          bind:currentSchedules={scheduleList}
          filteredMemberIds={resources.selectedManagerNames &&
          resources.selectedManagerNames.length < managerList.length
            ? resources.selectedManagerNames
            : null}
        />
      {/if}
    </div>
  </div>
</div>
