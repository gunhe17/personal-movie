<script lang="ts">
  import ArrowBackIcon from '$lib/assets/ArrowBackIcon.svelte'
  import {
    getMemberDetail,
    getMemberWorkingTimes
  } from '$lib/hooks/actions/member.action'
  import type {
    MemberDetailResponse,
    MemberWorkingTimeItem
  } from '$lib/hooks/actions/member.action'
  import { getScheduleList } from '$lib/hooks/actions/schedule.action'
  import type { ScheduleType } from '$lib/hooks/actions/schedule.action'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { fade } from 'svelte/transition'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { centerId } from '$lib/stores/center.store'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { panelStore } from '$lib/stores/sidePanel'

  // Feature 모듈에서 임포트
  import {
    createMembersService,
    buildScheduleCountMap,
    WEEKDAYS,
    WEEKDAY_API_TO_KR,
    type MemberDetailTabType,
    type WeeklySchedule,
    type BreakTime
  } from '$lib/features/members'
  import MemberProfileCard from '$lib/components/members/MemberProfileCard.svelte'
  import MemberProfileCardPanel from '$lib/components/members/MemberProfileCardPanel.svelte'
  import MemberDetailTabs from '$lib/components/members/MemberDetailTabs.svelte'
  import Typography from '@common/components/Typography.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { MEMBER_PAGE_ACCESS_RULE } from '$lib/features/members/permissions'

  interface Props {
    params: { memberId: string }
  }

  let { params }: Props = $props()

  // 쿼리 클라이언트
  const queryClient = useQueryClient()

  // 쿼리 초기화
  const memberId = $derived(params.memberId)
  const memberDetailQuery = $derived(
    queryBuilder(getMemberDetail, () => ({
      centerId: $centerId!,
      memberId
    }))
  )
  const member = $derived(
    memberDetailQuery.data as MemberDetailResponse | undefined
  )
  const isLoading = $derived(memberDetailQuery.isLoading)

  const workingTimesQuery = $derived(
    queryBuilder(getMemberWorkingTimes, () => ({
      centerId: $centerId!,
      memberId
    }))
  )
  const workingTimes = $derived(
    workingTimesQuery.data as MemberWorkingTimeItem[] | undefined
  )

  // API 응답 → WeeklySchedule + BreakTime 변환
  function toWeeklyScheduleAndBreak(
    items: MemberWorkingTimeItem[] | undefined
  ): {
    weeklySchedule: WeeklySchedule | undefined
    breakTime: BreakTime | null
  } {
    if (!items || items.length === 0) {
      return { weeklySchedule: undefined, breakTime: null }
    }
    const schedule: WeeklySchedule = {}
    let breakTime: BreakTime | null = null
    for (const d of WEEKDAYS) {
      schedule[d] = null
    }
    for (const item of items) {
      const day = WEEKDAY_API_TO_KR[item.weekday]
      if (!day) continue
      const start = item.start_time ? item.start_time.slice(0, 5) : null
      const end = item.end_time ? item.end_time.slice(0, 5) : null
      if (start && end) {
        schedule[day] = { start, end }
        if (item.break_start_time && item.break_end_time) {
          breakTime = {
            start: item.break_start_time.slice(0, 5),
            end: item.break_end_time.slice(0, 5)
          }
        }
      } else {
        schedule[day] = null
      }
    }
    return { weeklySchedule: schedule, breakTime }
  }

  const { weeklySchedule, breakTime } = $derived(
    toWeeklyScheduleAndBreak(workingTimes)
  )

  // 로컬 UI 상태
  let activeTab = $state<MemberDetailTabType>('schedule')

  // ── 근무일정 캘린더: 해당 월 상담/검사 일정 집계 ──
  const now = new Date()
  let viewYear = $state(now.getFullYear())
  let viewMonth = $state(now.getMonth()) // 0-based

  // 월초 ~ 다음 달 1일 (KST 경계 여유를 위해 다음 달 1일까지 포함)
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthRange = $derived.by(() => {
    const start = `${viewYear}-${pad(viewMonth + 1)}-01`
    const endYear = viewMonth === 11 ? viewYear + 1 : viewYear
    const endMonth = viewMonth === 11 ? 0 : viewMonth + 1
    const end = `${endYear}-${pad(endMonth + 1)}-01`
    return { start, end }
  })

  const scheduleListQuery = $derived(
    queryBuilder(getScheduleList, () => ({
      center_id: $centerId!,
      counselor_ids: [memberId],
      client_ids: [],
      schedule_types: [],
      start_date: monthRange.start,
      end_date: monthRange.end
    }))
  )
  const scheduleCounts = $derived(
    buildScheduleCountMap(
      scheduleListQuery.data as ScheduleType[] | undefined,
      weeklySchedule
    )
  )

  // 일정 쿼리 활성 유지: scheduleCounts는 근무일정 탭일 때만 캘린더가 읽으므로,
  // 자격 탭으로 갔다 오면 구독자가 사라져 월 변경 시 재조회가 트리거되지 않는다.
  // 페이지 레벨에서 쿼리 상태를 항상 구독해 탭과 무관하게 살아있게 한다.
  $effect(() => {
    scheduleListQuery.isFetching
    void scheduleCounts
  })

  const handleMonthChange = (year: number, month: number) => {
    viewYear = year
    viewMonth = month
  }

  // 서비스 생성
  const service = createMembersService({
    queryClient
  })

  // ── 반응형 ──
  const isOverlayMode = $derived(!responsive.isDesktop)

  function openProfilePanel() {
    panelStore.open({
      component: MemberProfileCardPanel as any,
      props: {
        member,
        onModify: handleModify,
        onAvatarChange: handleAvatarChange
      },
      options: { width: 'w-[min(90vw,400px)]' }
    })
  }

  // 이벤트 핸들러
  const goBack = () => history.back()
  const handleTabChange = (tab: MemberDetailTabType) => (activeTab = tab)
  const handleEditSchedule = () => {
    if (isOverlayMode) panelStore.close()
    service.openWorkScheduleModal(weeklySchedule, breakTime, memberId)
  }
  const handleModify = () => {
    if (!member) return
    if (isOverlayMode) panelStore.close()
    service.openModifyModal(member)
  }
  const handleAvatarChange = (file: File) =>
    service.changeAvatar(memberId, file)
</script>

<PermissionGuard rule={MEMBER_PAGE_ACCESS_RULE} showError>
  {#if isLoading}
    <div class="flex h-full items-center justify-center">
      <Typography variant="body-01-medium" color="text-gray-500">
        로딩 중...
      </Typography>
    </div>
  {:else if !member}
    <div class="flex h-full items-center justify-center">
      <Typography variant="body-01-medium" color="text-gray-500">
        데이터를 불러올 수 없습니다.
      </Typography>
    </div>
  {:else}
    <div in:fade class="h-full flex flex-col bg-gray-50">
      <!-- 메인 콘텐츠 -->
      <div class="flex flex-col h-full">
        <!-- 타이틀 영역: 브레드크럼이어도 XL 타이틀 영역 높이(44) 고정.
             하단 gap은 브레드크럼일 때 8(일반 타이틀의 16보다 좁힘).
             shrink-0 필수 — 이 행은 세로 flex 아이템이라 없으면 아래 콘텐츠가
             공간을 더 요구할 때 h-11이 44 미만으로 찌그러진다(탭마다 높이가
             달라 보이던 원인). 남는 공간 흡수는 아래 grid(grow min-h-0)가 맡는다. -->
        <div class="flex shrink-0 items-center justify-between h-11 mb-2">
          <div class="flex items-center gap-2">
            <button
              onclick={goBack}
              aria-label="뒤로가기"
              class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowBackIcon />
            </button>

            <!-- 브레드크럼 — 부모 크럼 Regular, 현재 페이지명 Medium. 항목 간격 8 -->
            <nav class="flex items-center gap-2" aria-label="breadcrumb">
              <a
                href="/member"
                class="text-body-02-normal-regular text-body-subtle hover:text-body-default transition-colors"
              >
                구성원
              </a>
              <span
                class="text-body-02-normal-regular text-gray-300"
                aria-hidden="true">/</span
              >
              <span class="text-body-02-normal-medium text-body-default">
                {member.person.name}
              </span>
            </nav>
          </div>
          {#if isOverlayMode}
            <button
              onclick={openProfilePanel}
              class="flex-center h-8 px-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Typography variant="body-02-medium" color="text-gray-700">
                구성원 정보
              </Typography>
            </button>
          {/if}
        </div>
        <div
          class="grow min-h-0 grid {isOverlayMode
            ? 'grid-cols-1'
            : 'grid-cols-[var(--spacing-detail-side)_1fr]'} gap-4"
        >
          <!-- 좌측 프로필 카드 -->
          {#if !isOverlayMode}
            <MemberProfileCard
              {member}
              onModify={handleModify}
              onAvatarChange={handleAvatarChange}
            />
          {/if}

          <!-- 우측 탭 콘텐츠 -->
          <MemberDetailTabs
            {activeTab}
            {memberId}
            {weeklySchedule}
            {breakTime}
            {scheduleCounts}
            {viewYear}
            {viewMonth}
            onMonthChange={handleMonthChange}
            onTabChange={handleTabChange}
            onEditSchedule={handleEditSchedule}
          />
        </div>
      </div>
    </div>
  {/if}
</PermissionGuard>
