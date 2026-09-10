<script lang="ts">
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import type { PaginationRes } from '$lib/types/apiResponse'
  import type { CaseData } from '$lib/types/assessmentStatus'

  import Select from '$lib/components/Select.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import Typography from '@common/components/Typography.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'

  import AssessmentCaseCard from '$lib/components/cards/AssessmentCaseCard.svelte'
  import LoadMoreButton from '$lib/components/LoadMoreButton.svelte'
  import AssessmentCaseTable from '$root/src/lib/components/assessment/AssessmentCaseTable.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import Button from '$root/src/lib/components/Button.svelte'
  import { getCasesByCenterId } from '$root/src/lib/hooks/actions/case.action'
  import DateRangeFilter from '$lib/components/common/DateRangeFilter.svelte'

  import {
    clientTypeOptions,
    sortOptions,
    staffOptions,
    type TabType
  } from '$lib/features/assessment/status/constants'
  import { useStatusFilters } from '$lib/features/assessment/status/hooks.svelte'
  import { buildCasesQueryInput } from '$lib/features/assessment/status/query-builders'
  import {
    mapCasesToVM,
    getHasOnlineLink,
    getAssessmentCompletionStatusFromCase
  } from '$lib/features/assessment/status/view-model'
  import { createStatusService } from '$lib/features/assessment/status/status-service'
  import { centerId } from '$lib/stores/center.store'
  import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
  import AssessmentBatchSendModal from '$lib/components/modal/AssessmentBatchSendModal.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { showSuccessSnackbar } from '$lib/utils/errorHandler'
  import {
    deletedScheduleIds,
    deletedCaseIds,
    cancelledScheduleIds,
    cancelledCaseIds,
    syncDeleteService
  } from '$lib/stores/syncDelete'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { ASSESSMENT_DELETE_RULE } from '$lib/features/assessment/permissions'
  import Close40 from '$root/src/lib/assets/Close40.svelte'
  import CirclePlusBlueIcon from '$root/src/lib/assets/CirclePlusBlueIcon.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  const pathname = page.url.pathname
  const filters = useStatusFilters(page.url, pathname)
  const queryClient = useQueryClient()
  const statusService = createStatusService({ queryClient })

  // 카드(그리드) 뷰: 페이지네이션 대신 더보기로 누적 로드
  const GRID_LOAD_STEP = 12
  let gridLoadCount = $state(GRID_LOAD_STEP)

  // 쿼리
  const casesQuery = queryBuilder<CaseData, PaginationRes<CaseData>>(
    getCasesByCenterId,
    () => {
      const base = filters.buildFilters()
      const effective =
        filters.viewType === 'grid'
          ? { ...base, page: 1, pageSize: gridLoadCount }
          : base
      return buildCasesQueryInput(effective, $centerId!)
    }
  )

  // 탭별 개수 표시용 쿼리 (추후 사용)
  // const statusCountsQuery = queryBuilder<
  //   CaseStatusCounts,
  //   { data: CaseStatusCounts }
  // >(getCaseStatusCounts, () => buildStatusCountsInput($centerId!))

  // 파생 상태 (검사 현황/이력은 assessment-cases API만 사용, assessments API 호출 안 함)
  const cases = $derived(casesQuery.data?.data ?? [])
  // 탭 필터를 API 상태값으로 변환
  const tabToApiStatus: Record<string, string> = {
    pending: 'PENDING',
    processing: 'IN_PROGRESS',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED'
  }

  // 그리드용 필터링된 데이터 (삭제/취소 상태 반영 + 탭 필터링)
  const filteredCases = $derived(
    cases
      .filter(
        (c) => !$deletedScheduleIds.has(c.uid) && !$deletedCaseIds.has(c.uid)
      )
      .map((c) => {
        // 취소된 항목의 상태를 'CANCELLED'로 변경 (API 형식)
        if ($cancelledScheduleIds.has(c.uid) || $cancelledCaseIds.has(c.uid)) {
          return { ...c, status: 'CANCELLED' as const }
        }
        return c
      })
      .filter((c) => {
        // 탭 필터링 (API 상태값과 비교)
        if (filters.activeTab === 'all') return true
        return c.status === tabToApiStatus[filters.activeTab]
      })
  )
  const pagination = $derived(casesQuery.data?.pagination)
  const isLoading = $derived(casesQuery.isLoading)
  const isFetching = $derived(casesQuery.isFetching)

  // statusCounts와 tabCounts는 추후 탭별 카운트 표시에 사용 가능
  // const statusCounts = $derived(statusCountsQuery.data?.data)
  // const tabCounts = $derived({
  //   all: statusCounts?.total ?? 0,
  //   pending: statusCounts?.pending ?? 0,
  //   processing: statusCounts?.processing ?? 0,
  //   completed: statusCounts?.completed ?? 0,
  //   cancelled: statusCounts?.cancelled ?? 0
  // })

  const tableData: AssessmentStatusRow[] = $derived(mapCasesToVM(cases))
  // 삭제된 ID 필터링 + 취소된 ID 상태 변경 + 탭 필터링
  const filteredData = $derived(
    tableData
      .filter(
        (row) =>
          !$deletedScheduleIds.has(row.id) && !$deletedCaseIds.has(row.id)
      )
      .map((row) => {
        // 취소된 항목의 상태를 'cancelled'로 변경
        if (
          $cancelledScheduleIds.has(row.id) ||
          $cancelledCaseIds.has(row.id)
        ) {
          return { ...row, status: 'cancelled' as const }
        }
        return row
      })
      .filter((row) => {
        // 탭 필터링 (client-side cancelled 항목 포함)
        if (filters.activeTab === 'all') return true
        return row.status === filters.activeTab
      })
  )
  const isListView = $derived(filters.viewType === 'list')

  // ===== 카드 더보기 =====
  const hasMoreCards = $derived(cases.length < (pagination?.total ?? 0))

  const gridResetKey = $derived.by(() => {
    const { page: _p, pageSize: _ps, ...rest } = filters.buildFilters()
    return JSON.stringify(rest)
  })
  $effect(() => {
    gridResetKey
    gridLoadCount = GRID_LOAD_STEP
  })

  function handleLoadMore() {
    gridLoadCount += GRID_LOAD_STEP
  }

  let selectedIds: string[] = $state([])
  const selectedRows = $derived(
    filteredData.filter((row) => selectedIds.includes(row.id))
  )
  const hasSelection = $derived(isListView && selectedIds.length > 0)

  const tabs = $derived([
    { value: 'all', label: '전체' },
    { value: 'pending', label: '진행전' },
    { value: 'processing', label: '진행중' },
    { value: 'completed', label: '완료' },
    { value: 'cancelled', label: '취소' }
  ])

  const handleReceiveClick = () => {
    goto('/assessment/receive')
  }

  function handleTabChange(tab: string) {
    if (filters.activeTab === tab) return
    filters.changeTab(tab as TabType)
  }

  function openSendModalForRow(row: AssessmentStatusRow) {
    const caseData = cases.find((c) => c.uid === row.id)
    if (!caseData) return

    const completionStatuses = getAssessmentCompletionStatusFromCase(
      row.id,
      caseData
    )

    const assessments = completionStatuses.map((asm) => ({
      id: `${row.id}:${asm.uid}`,
      caseId: row.id,
      assessment: asm.name,
      clientName: row.clientName,
      isCompleted: asm.isCompleted
    }))

    modalStore.open({
      component: AssessmentBatchSendModal,
      props: {
        assessments,
        onSend: (data: {
          ids: string[]
          recipients: { relation: string; name: string; phone: string }[]
        }) => {
          console.log('전송 선택된 검사', data.ids)
          console.log('수신자 목록', data.recipients)
          // TODO: 실제 API 연동 시 결과 전송 로직 추가
          syncDeleteService.markResultSent(row.id)
          showSuccessSnackbar(
            `${data.ids.length}개 검사 결과가 전송되었습니다.`
          )
        }
      },
      options: {
        customWidth: 540
      }
    })
  }

  function handleSend(row: AssessmentStatusRow) {
    openSendModalForRow(row)
  }

  function handleSendLink(row: AssessmentStatusRow) {
    statusService.handleSendLink(row)
  }

  function handleCancelAssessment(row: AssessmentStatusRow) {
    statusService.cancelCase(row)
  }

  function handleDeleteAssessment(row: AssessmentStatusRow) {
    statusService.deleteCase(row)
  }

  function handleRowClick(row: AssessmentStatusRow) {
    goto(`/assessment/status/${row.id}`)
  }

  function handleCheckChange(ids: string[]) {
    selectedIds = ids
  }

  function handleBulkCancel() {
    if (!selectedRows.length) return
    selectedRows.forEach((row) => statusService.cancelCase(row))
    selectedIds = []
  }

  function handleBulkDelete() {
    if (!selectedRows.length) return
    selectedRows.forEach((row) => statusService.deleteCase(row))
    selectedIds = []
  }

  // 그리드 카드용 핸들러 (filteredData에서 매칭되는 row 찾아서 사용)
  function handleCardSendLink(caseData: CaseData) {
    const row = filteredData.find((r) => r.id === caseData.uid)
    if (row) {
      statusService.handleSendLink(row)
    }
  }

  function handleCardCancel(caseData: CaseData) {
    const row = filteredData.find((r) => r.id === caseData.uid)
    if (row) {
      statusService.cancelCase(row)
    }
  }

  function handleCardDelete(caseData: CaseData) {
    const row = filteredData.find((r) => r.id === caseData.uid)
    if (row) {
      statusService.deleteCase(row)
    }
  }

  function handleCardSendResult(caseData: CaseData) {
    const row = filteredData.find((r) => r.id === caseData.uid)
    if (row) {
      openSendModalForRow(row)
    }
  }

  // 그리드 전환 시 선택 상태 초기화
  $effect(() => {
    if (!isListView && selectedIds.length) {
      selectedIds = []
    }
  })

  // 필터 변경 시 존재하지 않는 선택 제거
  $effect(() => {
    const next = selectedIds.filter((id) =>
      filteredData.some((row) => row.id === id)
    )
    if (next.length !== selectedIds.length) {
      selectedIds = next
    }
  })

  const isResetDisabled = $derived.by(() => {
    const f = filters.buildFilters()
    return (
      !f.search &&
      f.clientType === 'all' &&
      (f.counselorIds?.length ?? 0) === 0 &&
      !f.dateFrom &&
      !f.dateTo
    )
  })
</script>

<div in:fade class="mx-auto bg-gray-50 flex h-full flex-col">
  <!-- 헤더 -->
  <!-- 타이틀 바로 아래가 여백 가진 행(탭·카운트·필터)이면 간격 8. 면 컨테이너면 16 -->
  <div class="flex h-11 shrink-0 items-center justify-between mb-2">
    <h1 class="text-headline-01-normal-semibold text-gray-800">검사 현황</h1>
    <div class="flex items-center gap-2">
      <Button
        class="h-11 rounded-lg border border-gray-200 bg-gray-50 px-8 text-gray-500 duration-200 hover:bg-gray-100"
        onclick={handleReceiveClick}
      >
        <Typography variant="body-01-medium" color="text-gray-600"
          >전송 내역보기</Typography
        >
      </Button>
      <PageActionButton label="검사 접수" onclick={handleReceiveClick} />
    </div>
  </div>

  <!-- 필터 영역 -->
  <div class="filter-bar mb-2 flex items-center gap-2">
    <!-- 검색 -->
    <div
      class="flex h-11 w-90 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3"
    >
      <SearchIcon />
      <input
        type="text"
        bind:value={filters.searchQuery}
        placeholder="검색어를 입력해주세요"
        class="text-body-01-normal-regular w-full bg-transparent outline-none placeholder:text-placeholder"
      />
    </div>

    <!-- 예약일 필터 — 인풋 하나에서 기간(시작~종료) 선택 -->
    <DateRangeFilter
      start={filters.dateFrom}
      end={filters.dateTo}
      onChange={filters.setDateRange}
      placeholder="예약일"
    />

    <!-- 담당자 드롭다운 -->
    <Select
      class="bg-white rounded-lg"
      options={staffOptions}
      selected={filters.counselorIds[0] ?? 'all'}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) =>
        (filters.counselorIds =
          e.detail.value === 'all' ? [] : [e.detail.value])}
    />

    <!-- 개인/단체 드롭다운 -->
    <Select
      class="bg-white rounded-lg"
      options={clientTypeOptions}
      selected={filters.clientType}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (filters.clientType = e.detail.value)}
    />

    <!-- 초기화 버튼 -->
    <FilterResetButton
      onclick={filters.resetFilters}
      disabled={isResetDisabled}
    />
  </div>

  <!-- 탭 영역 -->
  <TabBar {tabs} activeTab={filters.activeTab} onTabChange={handleTabChange} />

  <!-- 총 개수 및 뷰 토글 -->
  <div class="my-2.5 flex items-center justify-between">
    <div>
      <Typography
        variant="body-01-semibold"
        color="text-gray-500"
        className="flex items-center gap-1"
      >
        총 <Typography variant="body-01-semibold" color="text-primary-400"
          >{filteredData.length}</Typography
        >
      </Typography>
    </div>

    <!-- 리스트/그리드 토글 + 등록순 -->
    <div class="flex items-center gap-3">
      <div class="flex h-11 items-center gap-1 rounded-lg bg-gray-100 p-2">
        <Tooltip text="리스트 보기">
          <button
            onclick={() => (filters.viewType = 'list')}
            aria-label="리스트 보기"
            class="rounded p-1.5 {filters.viewType === 'list'
              ? 'bg-white'
              : 'hover:bg-gray-50'}"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              class="text-gray-600"
            >
              <path
                d="M3 5H17M3 10H17M3 15H17"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </Tooltip>
        <Tooltip text="그리드 보기">
          <button
            onclick={() => (filters.viewType = 'grid')}
            aria-label="그리드 보기"
            class="rounded p-1.5 {filters.viewType === 'grid'
              ? 'bg-white'
              : 'hover:bg-gray-50'}"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              class="text-gray-600"
            >
              <rect
                x="3"
                y="3"
                width="6"
                height="6"
                rx="1"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <rect
                x="11"
                y="3"
                width="6"
                height="6"
                rx="1"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <rect
                x="3"
                y="11"
                width="6"
                height="6"
                rx="1"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <rect
                x="11"
                y="11"
                width="6"
                height="6"
                rx="1"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </button>
        </Tooltip>
      </div>

      <Select
        class="bg-white rounded-lg border-none"
        options={sortOptions}
        selected={filters.sortOrder}
        on:change={(e) => (filters.sortOrder = e.detail.value)}
      />
    </div>
  </div>

  <!-- 테이블/그리드 뷰 -->
  <div class="relative flex min-h-0 flex-1 flex-col">
    {#key filters.viewType}
      <div
        class="min-h-0 flex-1"
        in:fade={{ duration: 200, delay: 100 }}
        out:fade={{ duration: 100 }}
      >
        {#if filters.viewType === 'list'}
          {#if (isLoading || isFetching) && filteredData.length === 0}
            <!-- 로딩 중 (초기 로딩 또는 탭 전환) -->
            <div class="flex-center h-full">
              <div class="text-body-01-normal-medium text-gray-500">
                로딩 중...
              </div>
            </div>
          {:else if filteredData.length === 0}
            <!-- 데이터 없음 -->
            <div class="flex-center h-full">
              <NoDataSection />
            </div>
          {:else}
            <!-- 데이터 있음 -->
            <div class="relative h-full overflow-y-auto pb-6">
              <AssessmentCaseTable
                data={filteredData}
                showCheckbox={isListView}
                {selectedIds}
                onCheckChange={handleCheckChange}
                onSendResult={handleSend}
                onCancel={handleCancelAssessment}
                onDelete={handleDeleteAssessment}
                onRowClick={handleRowClick}
              />
            </div>
          {/if}
        {:else}
          <!-- 그리드 뷰 -->
          {#if casesQuery.isSuccess && filteredCases?.length}
            <div class="h-full overflow-y-auto">
              <div
                class="grid grid-cols-1 gap-5 pb-4 md:grid-cols-2 2xl:grid-cols-4"
              >
                {#each filteredCases as caseItem (caseItem.uid + '-' + caseItem.status)}
                  <AssessmentCaseCard
                    caseInfo={caseItem}
                    class="w-full"
                    onDelete={handleCardDelete}
                  />
                {/each}
              </div>
            </div>
          {:else if isLoading || isFetching}
            <div class="flex-center h-full">
              <div class="text-body-01-normal-medium text-gray-500">
                로딩 중...
              </div>
            </div>
          {:else}
            <div class="flex-center h-full">
              <NoDataSection />
            </div>
          {/if}
        {/if}
      </div>
    {/key}

    <!-- 하단: 리스트=페이지네이션 / 카드=더보기 -->
    {#if filters.viewType === 'grid'}
      {#if hasMoreCards}
        <div class="shrink-0">
          <LoadMoreButton onclick={handleLoadMore} loading={isFetching} />
        </div>
      {/if}
    {:else if filteredData.length > 0}
      <div class="mt-auto flex shrink-0 justify-center py-4">
        <Pagination
          totalItems={pagination?.total || filteredData.length}
          itemsPerPage={filters.pageSize}
          bind:currentPage={filters.page}
        />
      </div>
    {/if}

    {#if hasSelection}
      <div
        class="fixed bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white py-3 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
        style="
          left: var(--sidebar-width, 240px);
          right: 0;
          width: calc(100% - var(--sidebar-width, 240px));
          padding-left: 1rem;
          
          padding-right: 3.75rem;
        "
      >
        <div class="flex items-center gap-4">
          <Button
            onclick={() => {
              selectedIds = []
            }}
            class="h-10 w-10 rounded-lg bg-white  text-gray-700 transition hover:bg-gray-50"
          >
            <Close40 />
          </Button>
          <div class="flex items-center gap-1">
            <Typography variant="body-01-semibold" color="text-primary-400">
              {selectedIds.length}
            </Typography>
            <Typography variant="body-02-medium" color="text-gray-500">
              선택
            </Typography>
          </div>
          <Button
            class="w-20.75 h-8 px-0 rounded-lg border border-gray-200 bg-white transition hover:bg-gray-50"
            onclick={handleBulkCancel}
          >
            <Typography variant="body-03-medium" color="text-gray-600">
              검사 취소
            </Typography>
          </Button>
          <PermissionGuard rule={ASSESSMENT_DELETE_RULE}>
            <Button
              class="w-20.75 h-8 px-0 rounded-lg border border-gray-200 bg-white transition hover:bg-gray-50"
              onclick={handleBulkDelete}
            >
              <Typography
                variant="body-03-medium"
                color="text-semantic-negative"
              >
                검사 삭제
              </Typography>
            </Button>
          </PermissionGuard>
        </div>
      </div>
    {/if}
  </div>
</div>
