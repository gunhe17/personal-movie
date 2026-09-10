<style>
  .overlay-scroll-container {
    scrollbar-gutter: stable;
    overflow-y: auto;
  }

  .overlay-scroll-container::-webkit-scrollbar {
    width: 6px;
  }

  .overlay-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .overlay-scroll-container::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'

  import { isSameKstDateTime } from '../../utils/date'

  import TimeLine from './TimeLine.svelte'
  import ChevronIcon from '../../assets/ChevronIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import WeeklyScheduleLine from './WeeklyScheduleLine.svelte'
  import ScheduleRegisterModal from '../modal/ScheduleRegisterModal.svelte'
  import { modalStore } from '../../stores/modal'
  import type { ScheduleType } from '../../hooks/actions/schedule.action'
  import type { MemberListItem } from '../../hooks/actions/member.action'
  import type { OperatingTimeSummary } from '$lib/hooks/actions/center.action'
  import {
    getOperatingHoursForDate,
    isOperatingHourForDay,
    isBreakHourForDay
  } from '$lib/features/schedule/operating-hours'
  import { queryBuilder } from '../../hooks/queries/builder'
  import { getMe, type MeResponse } from '../../hooks/actions/auth.action'

  interface Props {
    managerList: MemberListItem[]
    selectedDate: Date | null
    currentSchedules: ScheduleType[]
    operatingTimes?: OperatingTimeSummary[]
    /** 필터에서 선택된 담당자 ID 목록 (접수 페이지로 전달용) */
    filteredMemberIds?: string[] | null
  }

  let {
    managerList,
    selectedDate = $bindable(),
    currentSchedules = $bindable(),
    operatingTimes = [],
    filteredMemberIds = null
  }: Props = $props()

  const SCROLL_STEP = 172

  let showLeftScrollButton = $state<boolean>(false)
  let showRightScrollButton = $state<boolean>(false)
  let headerScroll = $state<HTMLDivElement | null>(null)
  let scrollContainer = $state<HTMLDivElement | null>(null)
  let hours = $state(Array.from({ length: 17 }, (_, i) => i + 8))

  const meQuery = queryBuilder(getMe)

  const me: MeResponse = $derived(meQuery.data as MeResponse)

  const displayManagers = $derived.by(() => {
    if (managerList?.length) return managerList
    if (!me) return []
    return [
      {
        id: me.account.id,
        role_code: 'SELF',
        role_name: '본인',
        employment_type: 'SELF',
        memo: null,
        is_active: true,
        person: {
          name: me.person?.name,
          phone: me.person?.phone,
          email: me.account?.email
        }
      }
    ]
  })

  const handleScroll = () => {
    if (!scrollContainer) return
    const { scrollLeft, clientWidth, scrollWidth } = scrollContainer
    if (headerScroll) {
      headerScroll.scrollLeft = scrollLeft
    }
    const canScroll = scrollWidth > clientWidth
    showLeftScrollButton = canScroll && scrollLeft > 0
    showRightScrollButton =
      canScroll && scrollLeft + clientWidth < scrollWidth - 1
  }

  const scrollLeft = () => {
    scrollContainer?.scrollBy({
      left: -SCROLL_STEP,
      behavior: 'smooth'
    })
  }

  const scrollRight = () => {
    scrollContainer?.scrollBy({
      left: SCROLL_STEP,
      behavior: 'smooth'
    })
  }

  const isOverlap = (a: ScheduleType, b: ScheduleType) => {
    const aStart = new Date(a.start).getTime()
    const aEnd = new Date(a.end).getTime()
    const bStart = new Date(b.start).getTime()
    const bEnd = new Date(b.end).getTime()

    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd)
  }

  const groupOverlappingSchedules = (schedules: any[] = []) => {
    const groups: any[][] = []
    schedules.forEach((res) => {
      let placed = false
      for (const group of groups) {
        if (group.some((existing) => isOverlap(existing, res))) {
          group.push(res)
          placed = true
          break
        }
      }
      if (!placed) {
        groups.push([res])
      }
    })
    return groups
  }

  const dayHours = $derived(
    selectedDate
      ? getOperatingHoursForDate(operatingTimes, selectedDate)
      : getOperatingHoursForDate(operatingTimes, new Date())
  )

  const handleRegisterSchedule = (hour: number, memberId?: string) => {
    // 클릭한 담당자 컬럼의 ID를 우선, 없으면 필터된 목록 전달
    const memberIds = memberId ? [memberId] : filteredMemberIds
    modalStore.open({
      component: ScheduleRegisterModal,
      props: {
        selectedDate,
        selectedTime: `${hour - 1}:00`,
        selectedMemberIds: memberIds
      },
      options: {
        customWidth: 540
      }
    })
  }

  onMount(() => {
    if (!scrollContainer) return
    handleScroll()
    const resizeObserver = new ResizeObserver(() => {
      handleScroll()
    })
    resizeObserver.observe(scrollContainer)
    scrollContainer.addEventListener('scroll', handleScroll)
    return () => {
      resizeObserver.disconnect()
      scrollContainer?.removeEventListener('scroll', handleScroll)
    }
  })
</script>

<div class="w-full h-full ring ring-gray-200 rounded-lg overflow-hidden">
  <div class="grid grid-rows-[40px_1fr] w-full h-full min-h-0">
    <div
      class="grid grid-cols-[80px_1fr] relative bg-gray-50 border-b border-gray-200 overlay-scroll-container overflow-hidden!"
    >
      {#if showLeftScrollButton}
        <button
          transition:fade={{ duration: 200 }}
          class="absolute z-10 left-1 top-2 w-6 h-6 rounded-full bg-gray-500 flex-center hover:scale-105 transition"
          onclick={scrollLeft}
        >
          <ChevronIcon strokeColor="#FDFDFD" class="w-1.5 h-2.5" />
        </button>
      {/if}
      {#if showRightScrollButton}
        <button
          transition:fade={{ duration: 200 }}
          class="absolute z-10 right-1 top-2 w-6 h-6 rounded-full bg-gray-500 flex-center hover:scale-105 transition"
          onclick={scrollRight}
        >
          <ChevronIcon strokeColor="#FDFDFD" class="rotate-180 w-1.5 h-2.5" />
        </button>
      {/if}
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <div class="border-r border-gray-200" />
      <div bind:this={headerScroll} class="overflow-hidden">
        <div class="flex min-w-fit">
          {#each displayManagers as manager}
            <div
              class={twMerge(
                'h-10 px-5 flex-1 min-w-43 border-r last:border-r-0',
                'border-gray-200 odd:bg-gray-50 flex items-center'
              )}
            >
              <Typography color="text-gray-600" variant="body-02-medium">
                {manager.person.name}
              </Typography>
            </div>
          {/each}
        </div>
      </div>
    </div>
    <div
      class="grid grid-cols-[80px_1fr] h-full min-h-0 overlay-scroll-container bg-white"
    >
      <div class="grid grid-rows-[repeat(17,1fr)] border-r border-gray-200">
        {#each hours as hour}
          <div class="relative min-h-15">
            <Typography
              color="text-gray-600"
              variant="body-02-regular"
              className="absolute bottom-0 right-4 translate-y-1/2"
            >
              {hour}:00
            </Typography>
          </div>
        {/each}
      </div>
      <div bind:this={scrollContainer} class="min-h-0 overflow-x-hidden">
        <div class="relative flex min-w-fit">
          {#each displayManagers as manager}
            <div class="min-w-43 grow grid grid-rows-[repeat(17,1fr)]">
              {#each hours as hour}
                {@const filteredSchedules = currentSchedules.filter(
                  (r) =>
                    selectedDate &&
                    (r.counselor_name === manager.person.name ||
                      !r.counselor_name) &&
                    isSameKstDateTime(
                      r.start.toString(),
                      selectedDate,
                      hour - 1
                    )
                )}
                {@const groupedSchedules =
                  groupOverlappingSchedules(filteredSchedules)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  onclick={() => handleRegisterSchedule(hour, manager.id)}
                  class={twMerge(
                    'relative min-h-15 px-1.5 border-t border-r first:border-t-0 border-gray-200 transition',
                    'cursor-pointer',
                    isOperatingHourForDay(hour - 1, dayHours)
                      ? isBreakHourForDay(hour - 1, dayHours)
                        ? 'bg-gray-50/50 hover:bg-gray-100'
                        : 'bg-white hover:bg-gray-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                  )}
                >
                  {#each groupedSchedules as group}
                    {#each group as schedule, index}
                      <WeeklyScheduleLine
                        {schedule}
                        {hour}
                        {index}
                        total={group.length}
                      />
                    {/each}
                  {/each}
                </div>
              {/each}
            </div>
          {/each}
          <TimeLine />
        </div>
      </div>
    </div>
  </div>
</div>
