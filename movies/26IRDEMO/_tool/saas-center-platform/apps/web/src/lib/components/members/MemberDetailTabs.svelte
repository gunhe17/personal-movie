<script lang="ts">
  import {
    MEMBER_DETAIL_TABS,
    type MemberDetailTabType,
    type BreakTime,
    type WeeklySchedule
  } from '$lib/features/members/constants'
  import type { ScheduleCountMap } from '$lib/features/members/work-schedule'
  import TabBar from '$lib/components/TabBar.svelte'
  import WorkScheduleTab from './WorkScheduleTab.svelte'
  import CounselingHistoryTab from './CounselingHistoryTab.svelte'
  import CredentialsTab from './CredentialsTab.svelte'

  interface Props {
    activeTab: MemberDetailTabType
    memberId: string
    weeklySchedule?: WeeklySchedule
    breakTime: BreakTime | null
    onTabChange: (tab: MemberDetailTabType) => void
    onEditSchedule: () => void
    scheduleCounts?: ScheduleCountMap
    viewYear: number
    viewMonth: number
    onMonthChange?: (year: number, month: number) => void
  }

  let {
    activeTab,
    memberId,
    weeklySchedule,
    breakTime,
    onTabChange,
    onEditSchedule,
    scheduleCounts = {},
    viewYear,
    viewMonth,
    onMonthChange
  }: Props = $props()

  const tabs = MEMBER_DETAIL_TABS.map(({ key, label }) => ({
    value: key,
    label
  }))

  const handleTabChange = (tab: string) =>
    onTabChange(tab as MemberDetailTabType)
</script>

<section
  class="bg-white xl:rounded-2xl xl:border xl:border-gray-200 flex flex-col min-h-0 p-6 pt-3"
>
  <TabBar {tabs} {activeTab} onTabChange={handleTabChange} class="h-13.5" />

  <!-- 탭 콘텐츠 — 탭바 아래 간격 16 고정(세 탭 동일).
       각 탭의 타이틀 행 높이도 24로 통일돼 있어 탭 전환 시 첫 줄이 흔들리지 않는다 -->
  <!-- 탭 ↔ 탭 콘텐츠 타이틀 간격 24 (pt-6) -->
  <div class="flex-1 min-h-0 px-4 pt-6 xl:px-0">
    {#if activeTab === 'schedule'}
      <WorkScheduleTab
        {weeklySchedule}
        {breakTime}
        {onEditSchedule}
        {scheduleCounts}
        {viewYear}
        {viewMonth}
        {onMonthChange}
      />
    {:else if activeTab === 'history'}
      <CounselingHistoryTab {memberId} />
    {:else}
      <CredentialsTab {memberId} />
    {/if}
  </div>
</section>
