<script lang="ts">
  import { fade } from 'svelte/transition'
  import { useQueryClient } from '@tanstack/svelte-query'

  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import ScheduleChangeRequestTable from '$lib/components/schedule/reservations/ScheduleChangeRequestTable.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import Typography from '@common/components/Typography.svelte'

  import {
    RESERVATION_TAB_LABELS,
    RESERVATION_SEARCH_PLACEHOLDER,
    RESERVATION_TABS,
    type ReservationTab
  } from '$lib/features/schedule/reservations/constants'
  import { useReservationFilters } from '$lib/features/schedule/reservations/hooks.svelte'
  import {
    filterReservations,
    mapChangeRequestsToVM,
    type ReservationVM
  } from '$lib/features/schedule/reservations/view-model'
  import { createReservationsService } from '$lib/features/schedule/reservations/reservations-service'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getScheduleChangeRequests,
    type ScheduleChangeRequestItem
  } from '$lib/hooks/actions/schedule.action'
  import { centerId } from '$lib/stores/center.store'

  const queryClient = useQueryClient()
  const reservationsService = createReservationsService({ queryClient })

  const requestsQuery = queryBuilder(
    getScheduleChangeRequests,
    () => ({ center_id: $centerId ?? '' }),
    () => ({ enabled: !!$centerId })
  )

  let busyId = $state<string | null>(null)

  const filters = useReservationFilters()

  const reservationsVM = $derived.by(() =>
    mapChangeRequestsToVM(
      (requestsQuery.data as ScheduleChangeRequestItem[]) ?? []
    )
  )
  const filteredReservations = $derived.by(() =>
    filterReservations(reservationsVM, filters.buildFilters())
  )
  const tabs = $derived(
    RESERVATION_TABS.map((value) => ({
      value,
      label: RESERVATION_TAB_LABELS[value],
      count: reservationsVM.filter((item) => item.status === value).length
    }))
  )

  function handleTabChange(tab: string) {
    filters.changeTab(tab as ReservationTab)
  }

  // 빈 상태 문구 — 검색 중인지, 어느 탭인지에 따라 이유가 다르다.
  // (공용 NoDataSection의 기본 문구는 검사 목록용이라 이 화면에 맞지 않는다)
  const EMPTY_BY_TAB: Record<ReservationTab, string> = {
    pending: '대기 중인 변경 요청이 없어요',
    confirmed: '확정한 변경 요청이 없어요',
    cancelled: '반려한 변경 요청이 없어요'
  }
  const emptyDescription = $derived(
    filters.searchQuery.trim()
      ? '검색 조건에 맞는 변경 요청이 없어요'
      : EMPTY_BY_TAB[filters.activeTab as ReservationTab]
  )

  async function runAction(
    row: ReservationVM,
    action: (id: string) => Promise<unknown>
  ) {
    busyId = row.reservationId
    try {
      await action(row.reservationId)
    } finally {
      busyId = null
    }
  }
</script>

<div class="flex h-full flex-col" in:fade>
  <PageTitleSection title="변경 요청" className="mb-2" />

  <!-- 탭 아래 여백은 FloatingFilterBar의 py-4가 소유한다(§목록 화면 공통) -->
  <TabBar {tabs} activeTab={filters.activeTab} onTabChange={handleTabChange} />

  <!-- 필터 영역 — 상단에 닿으면 플로팅으로 고정.
       리스트(표) 뷰는 높이 고정 + 내부 스크롤이라 스크롤 여유를 예약하지 않는다 -->
  <FloatingFilterBar reserveScroll={false}>
    {#snippet children()}
      <!-- 검색 — 목록 화면 공통 규격(h44 · radius 8 · Body_01 · focus 보더) -->
      <div
        class="flex h-11 w-90 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 duration-200 focus-within:border-border-active"
      >
        <SearchIcon />
        <input
          type="text"
          bind:value={filters.searchQuery}
          placeholder={RESERVATION_SEARCH_PLACEHOLDER}
          class="w-full bg-transparent text-body-01-normal-regular outline-none placeholder:text-placeholder"
        />
      </div>
    {/snippet}
  </FloatingFilterBar>

  <!-- 카운트 헤더 — 목록 화면 공통(mb-1 · h-11 · Body_01/Regular gray-700) -->
  <div class="mb-1 flex h-11 shrink-0 items-center">
    <Typography variant="body-01-normal-regular" color="text-gray-700">
      총 {filteredReservations.length}건
    </Typography>
  </div>

  {#if filteredReservations.length === 0}
    <NoDataSection description={emptyDescription} />
  {:else}
    <div
      class="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200"
    >
      <ScheduleChangeRequestTable
        data={filteredReservations}
        {busyId}
        onApprove={(row) => runAction(row, reservationsService.approve)}
        onReject={(row) => runAction(row, reservationsService.reject)}
      />
    </div>
  {/if}
</div>
