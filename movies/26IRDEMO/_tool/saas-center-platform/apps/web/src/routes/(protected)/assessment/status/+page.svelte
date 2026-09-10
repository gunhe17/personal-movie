<script lang="ts">
  import { getTitleIcon } from '$lib/config/title-icon'
  import { fade } from 'svelte/transition'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import {
    queryBuilder,
    infiniteQueryBuilder
  } from '$lib/hooks/queries/builder'
  import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import type { PaginationRes } from '$lib/types/apiResponse'
  import type { CaseData } from '$lib/types/assessmentStatus'

  import Select from '$lib/components/Select.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import Typography from '@common/components/Typography.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'

  import AssessmentCaseCard from '$lib/components/cards/AssessmentCaseCard.svelte'
  import AssessmentCaseTable from '$root/src/lib/components/assessment/AssessmentCaseTable.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import Button from '$root/src/lib/components/Button.svelte'
  import {
    getCaseById,
    getCasesByCenterId,
    getCasesPageByCenterId
  } from '$root/src/lib/hooks/actions/case.action'
  import { hasPermission } from '$lib/stores/permission.view'
  import { createAssessmentBillingService } from '$lib/features/assessment/status-detail/assessment-billing-service'
  import BillableCreateModal from '$lib/features/billing/components/create/BillableCreateModal.svelte'
  import SessionBillingModal from '$lib/features/billing/components/create/SessionBillingModal.svelte'
  import DateRangeFilter from '$lib/components/common/DateRangeFilter.svelte'

  import {
    sortOptions,
    type TabType
  } from '$lib/features/assessment/status/constants'
  import { useStatusFilters } from '$lib/features/assessment/status/hooks.svelte'
  import { buildCasesQueryInput } from '$lib/features/assessment/status/query-builders'
  import {
    mapCasesToVM,
    getHasOnlineLink,
    setAssessmentsData
  } from '$lib/features/assessment/status/view-model'
  import { getLinkAssessments } from '$lib/hooks/actions/link-assessments'
  import { createStatusService } from '$lib/features/assessment/status/status-service'
  import { createStatusDetailService } from '$lib/features/assessment/status-detail/status-detail-service'
  import { centerId } from '$lib/stores/center.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
  import {
    deletedScheduleIds,
    deletedCaseIds,
    cancelledScheduleIds,
    cancelledCaseIds
  } from '$lib/stores/syncDelete'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import {
    getMemberList,
    type MemberListResponse
  } from '$root/src/lib/hooks/actions/member.action'
  import { ManagerSelectDropDown } from '$root/src/lib/components/schedule/calendar'
  import { permissionStore } from '$root/src/lib/stores/permission.store'
  import ListGridToggleButton from '$root/src/lib/components/ListGridToggleButton.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'

  // 검사 현황은 테이블 컬럼이 많아 2xl(1536px) 미만에서 카드 뷰로 전환
  const isOverlayMode = $derived(responsive.breakpoint !== '2xl')
  // 필터/검색 레이아웃은 데스크탑(1280px) 미만에서만 모바일 레이아웃
  const isMobileLayout = $derived(!responsive.isDesktop)

  const pathname = page.url.pathname
  const filters = useStatusFilters(page.url, pathname)
  const queryClient = useQueryClient()
  const statusService = createStatusService({ queryClient })
  // 검사 정보 수정 모달은 상세 서비스가 소유 — 목록에서도 같은 경로를 쓴다
  const detailService = createStatusDetailService({ queryClient })
  const billingService = createAssessmentBillingService({ queryClient })

  const canWriteBilling = $derived($hasPermission('write:billing'))

  // 목록에서 청구 — 케이스 상세를 받아 검사 상세와 동일한 청구 모달을 연다
  async function openBillingByCaseId(caseId: string) {
    const cid = $centerId
    if (!cid) return
    const res = await getCaseById().request({ centerId: cid, caseId })
    const caseData = res?.data
    if (!caseData) return
    billingService.openCreateBilling({
      caseData,
      SessionBillingModal,
      BillableCreateModal
    })
  }
  const handleBilling = (row: AssessmentStatusRow) =>
    openBillingByCaseId(row.id)
  const handleCardBilling = (caseInfo: CaseData) =>
    openBillingByCaseId(caseInfo.uid || caseInfo.case_id)

  // 검사 마스터 목록 — 카드 바로링크(온라인 검사) 판정용 캐시 주입
  const assessmentsQuery = $derived(
    queryBuilder(getLinkAssessments, () => ({}))
  )
  // 백엔드 필드(id/supports_online) → FE Assessment(uid/is_online_available) 어댑터
  const assessmentDefs = $derived.by(() => {
    const data = assessmentsQuery.data as
      | { items?: Record<string, unknown>[] }
      | Record<string, unknown>[]
      | undefined
    const raw = Array.isArray(data) ? data : (data?.items ?? [])
    return raw.map((it) => ({
      ...it,
      uid: (it.uid ?? it.id) as string,
      is_online_available: (it.is_online_available ??
        it.supports_online ??
        false) as boolean
    }))
  })
  $effect(() => {
    if (assessmentDefs.length) setAssessmentsData(assessmentDefs as never[])
  })

  // 카드(grid) 뷰 여부 — 무한 스크롤 활성 기준
  const isGrid = $derived(filters.viewType === 'grid')
  // 테이블 높이 측정으로 pageSize가 정해진 뒤에만 list 조회 (첫 조회 깜빡임 방지)
  let listPageSizeReady = $state(false)

  // 테이블(list) 뷰 — 기존 오프셋 페이지네이션 그대로 (grid 일 땐 비활성)
  const casesQuery = queryBuilder<CaseData, PaginationRes<CaseData>>(
    getCasesByCenterId,
    () => buildCasesQueryInput(filters.buildFilters(), $centerId!),
    // 측정(listPageSizeReady) 전에는 조회하지 않음 → 처음부터 맞는 개수로 1회만 조회(깜빡임 방지)
    () => ({ enabled: !isGrid && listPageSizeReady })
  )

  const casesQueryData = $derived(
    casesQuery.data as PaginationRes<CaseData> | undefined
  )

  // 카드(grid) 뷰 — 무한 스크롤 (list 일 땐 비활성). 서버 네이티브 Page<CaseData> 반환.
  const casesInfinite = infiniteQueryBuilder(getCasesPageByCenterId, {
    key: () => {
      const f = filters.buildFilters()
      return {
        center: $centerId,
        search: f.search,
        sort: f.sort,
        tab: f.tab,
        counselorIds: f.counselorIds,
        clientType: f.clientType,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo
      }
    },
    buildInput: (skip, limit) => {
      const base = buildCasesQueryInput(filters.buildFilters(), $centerId!)
      return {
        centerId: base.centerId,
        queryParams: {
          ...base.queryParams,
          page: Math.floor(skip / limit) + 1,
          size: limit
        }
      }
    },
    pageSize: 16,
    enabled: () => isGrid
  })

  // 무한 스크롤 제어
  const gridInitialLoading = $derived(isGrid && casesInfinite.isLoading)
  const loadingMore = $derived(isGrid && casesInfinite.isFetchingNextPage)
  const hasMore = $derived(isGrid && (casesInfinite.hasNextPage ?? false))
  const loadMore = () => casesInfinite.fetchNextPage()

  const canUseManagerFilter = $derived(
    $permissionStore.context?.accessLevel === 'all'
  )
  const memberQuery = queryBuilder(
    getMemberList,
    () => ({ centerId: $centerId! }),
    () => ({ enabled: !!$centerId && canUseManagerFilter })
  )
  const memberList = $derived(
    (memberQuery.data as MemberListResponse | undefined)?.items ?? []
  )
  // 탭별 개수 표시용 쿼리 (추후 사용)
  // const statusCountsQuery = queryBuilder<
  //   CaseStatusCounts,
  //   { data: CaseStatusCounts }
  // >(getCaseStatusCounts, () => buildStatusCountsInput($centerId!))

  // 파생 상태 (검사 현황은 assessment-cases API만 사용, assessments API 호출 안 함)
  // 활성 소스: grid → 무한쿼리 페이지 평탄화, list → 테이블 페이지 데이터
  const cases = $derived.by<CaseData[]>(() => {
    if (isGrid) {
      const pages = casesInfinite.data?.pages ?? []
      return pages.flatMap((p) => (Array.isArray(p?.items) ? p.items : []))
    }
    return casesQueryData?.data ?? []
  })

  // 그리드용 필터링된 데이터 (삭제/취소 상태 반영 - 서버 사이드 필터링 후 낙관적 UI)
  const filteredCases = $derived(
    cases
      .filter(
        (c: CaseData) =>
          !$deletedScheduleIds.has(c.uid) && !$deletedCaseIds.has(c.uid)
      )
      .map((c: CaseData) => {
        // 취소된 항목의 상태를 'CANCELLED'로 변경 (API 형식)
        if ($cancelledScheduleIds.has(c.uid) || $cancelledCaseIds.has(c.uid)) {
          return { ...c, status: 'CANCELLED' as const }
        }
        return c
      })
  )
  const pagination = $derived(casesQueryData?.pagination)
  // 총 개수 — grid 는 무한쿼리 total, list 는 페이지네이션 total
  const totalCount = $derived(
    isGrid
      ? (casesInfinite.data?.pages?.[0]?.total ?? 0)
      : (pagination?.total ?? 0)
  )
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

  const tableData: AssessmentStatusRow[] = $derived(
    mapCasesToVM(cases, assessmentDefs as never[])
  )
  // 삭제된 ID 필터링 + 취소된 ID 상태 변경 (서버 사이드 필터링 후 낙관적 UI)
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
  )
  const isListView = $derived(filters.viewType === 'list')

  // 필터가 적용된 상태인지 판별 (검색, 날짜, 담당자, 탭)
  const hasActiveFilter = $derived(
    !!filters.debouncedSearchQuery ||
      !!filters.dateFrom ||
      !!filters.dateTo ||
      filters.counselorIds.length > 0 ||
      filters.activeTab !== 'all'
  )
  const noDataMessage = $derived(
    hasActiveFilter ? '검색 조건에 맞는 검사가 없어요' : '등록된 검사가 없어요'
  )

  // ============ 테이블 뷰: 화면 높이에 맞춰 한 페이지 행 수 + 행 높이 자동 산정 ============
  // 목표: 내부 스크롤 없이 보이는 행 수 = 페이지당 아이템 수.
  // 행 수는 80px 기준으로 정하고, 남는 자투리를 행 높이에 반영해 "모든 페이지 동일 높이 + 여백 없음".
  // 기준: 최소 행 80px + Table sticky 헤더 52px + 카드 테두리 2px. 리사이즈는 디바운스.
  let tableAreaEl: HTMLDivElement | null = $state(null)
  let rowHeightPx = $state(80) // 계산된 행 높이(모든 페이지 공통)
  const ROW_H = 80
  const TABLE_CHROME = 54 // 테두리(2) + sticky 헤더(52)
  const MIN_ROWS = 3

  $effect(() => {
    if (!browser || isGrid) return
    const el = tableAreaEl
    if (!el) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const recompute = () => {
      const h = el.clientHeight
      if (h <= 0) return
      const space = h - TABLE_CHROME
      const rows = Math.max(MIN_ROWS, Math.floor(space / ROW_H))
      // 동일 값이면 $state 세터가 no-op (알림 없음). pageSize를 읽지 않아 effect 의존 방지.
      filters.pageSize = rows
      // 자투리를 행에 흡수 → 꽉 찬 페이지는 여백 0, 모든 페이지 행 높이 동일
      rowHeightPx = Math.max(ROW_H, Math.floor(space / rows))
      listPageSizeReady = true // 측정 완료 → 이제 list 조회 허용
    }
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(recompute, 150)
    })
    ro.observe(el)
    recompute() // 초기 1회 즉시
    return () => {
      if (timer) clearTimeout(timer)
      ro.disconnect()
    }
  })

  const tabs = $derived([
    { value: 'all', label: '전체' },
    { value: 'pending', label: '진행전' },
    { value: 'processing', label: '진행중' },
    { value: 'completed', label: '완료' }
  ])

  const handleReceiveClick = () => {
    goto('/assessment/receive')
  }

  function handleTabChange(tab: string) {
    if (filters.activeTab === tab) return
    filters.changeTab(tab as TabType)
  }

  function handleSend(row: AssessmentStatusRow) {
    statusService.handleSendResult(row)
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

  // 검사 수정 — 편집 모달은 케이스 상세를 요구하므로 먼저 불러온다(목록 행에는 없다).
  // 상세 화면의 '수정'과 같은 모달·같은 무효화 경로.
  async function handleEditAssessment(row: { id?: string; case_id?: string }) {
    const cid = $centerId
    const caseId = row.case_id ?? row.id
    if (!cid || !caseId) return
    try {
      const res = await getCaseById().request({ centerId: cid, caseId })
      const detail = (res as any)?.data
      if (!detail) {
        snackbarStore.error('검사 정보를 불러오지 못했어요.')
        return
      }
      detailService.openEditCaseModal(detail)
    } catch {
      snackbarStore.error('검사 정보를 불러오지 못했어요.')
    }
  }

  function handleRollbackCancel(row: AssessmentStatusRow) {
    statusService.rollbackCancel(row)
  }

  function handleCompleteCase(row: AssessmentStatusRow) {
    statusService.completeCase(row)
  }

  function handleRollbackComplete(row: AssessmentStatusRow) {
    statusService.rollbackComplete(row)
  }

  function handleRowClick(row: AssessmentStatusRow) {
    goto(`/assessment/status/${row.id}`)
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

  function handleCardRollbackCancel(caseData: CaseData) {
    const row = filteredData.find((r) => r.id === caseData.uid)
    if (row) {
      statusService.rollbackCancel(row)
    }
  }

  function handleCardComplete(caseData: CaseData) {
    const row = filteredData.find((r) => r.id === caseData.uid)
    if (row) {
      statusService.completeCase(row)
    }
  }

  function handleCardRollbackComplete(caseData: CaseData) {
    const row = filteredData.find((r) => r.id === caseData.uid)
    if (row) {
      statusService.rollbackComplete(row)
    }
  }

  function handleCardSendResult(caseData: CaseData) {
    const row = filteredData.find((r) => r.id === caseData.uid)
    if (row) {
      statusService.handleSendResult(row)
    }
  }

  function handleCardViewHistory(caseData: CaseData) {
    statusService.viewCaseSendHistory(caseData)
  }

  // 반응형 viewType 전환: 줄일 때 grid 강제, 넓힐 때 원래 값 복원
  let viewTypeBeforeOverlay: 'list' | 'grid' | null = $state(null)

  $effect(() => {
    if (isOverlayMode && filters.viewType === 'list') {
      viewTypeBeforeOverlay = 'list'
      filters.viewType = 'grid'
    } else if (!isOverlayMode && viewTypeBeforeOverlay) {
      filters.viewType = viewTypeBeforeOverlay
      viewTypeBeforeOverlay = null
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

  const TitleIcon = $derived(getTitleIcon(page.url.pathname))
</script>

<!-- 카드=페이지 전체 스크롤(무한) / 테이블=기존 높이 고정. 헤더는 xl에서 sticky 고정 -->
<div
  in:fade
  class="mx-auto flex flex-col {isGrid ? '' : 'overflow-x-hidden xl:h-full'}"
>
  <!-- 헤더 -->
  <!-- 타이틀 바로 아래가 탭이면 간격 8(mb-2). 일반 콘텐츠일 때의 16보다 좁힌다 -->
  <div class="flex h-11 shrink-0 items-center justify-between mb-2">
    <div class="flex items-center gap-2">
      {#if TitleIcon}<TitleIcon />{/if}
      <h1 class="text-headline-01-normal-semibold text-gray-800">검사 현황</h1>
    </div>
    <div class="flex items-center gap-2">
      <PageActionButton label="검사 접수" onclick={handleReceiveClick} />
    </div>
  </div>

  <!-- 탭 영역 — 탭↔필터 간격은 FloatingFilterBar의 py-4가 담당 -->
  <TabBar {tabs} activeTab={filters.activeTab} onTabChange={handleTabChange} />

  <!-- 필터 영역 — 상단에 닿으면 플로팅으로 고정 -->
  <FloatingFilterBar reserveScroll={isGrid}>
    {#snippet children()}
      <!-- 검색 -->
      <div
        class="flex h-11 {isMobileLayout
          ? 'w-full'
          : 'w-90'} bg-white items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-border-active duration-200"
      >
        <SearchIcon />
        <input
          type="text"
          bind:value={filters.searchQuery}
          placeholder="내담자 이름을 입력해주세요"
          class="w-full bg-transparent text-body-01-normal-regular outline-none placeholder:text-placeholder"
        />
      </div>

      <!-- 접수일 필터 — 인풋 하나에서 기간(시작~종료) 선택 -->
      <DateRangeFilter
        start={filters.dateFrom}
        end={filters.dateTo}
        onChange={filters.setDateRange}
        placeholder="접수일"
      />

      <!-- 담당자 드롭다운 — accessLevel=all일 때만 표시 -->
      {#if canUseManagerFilter}
        <!-- containerClass에 bg-* 금지 — 래퍼 div는 radius가 없어 트리거(rounded-lg)
             뒤로 흰 사각 모서리가 비친다. 배경은 .dropdown-trigger가 이미 갖고 있다 -->
        <ManagerSelectDropDown
          options={memberList}
          containerClass={'text-body-02-normal-regular'}
          bind:selectedManagerNames={filters.counselorIds}
        />
      {/if}

      <!-- 초기화 + 정렬 + 뷰 토글 -->
      <div class="flex items-center gap-3">
        <FilterResetButton
          onclick={filters.resetFilters}
          disabled={isResetDisabled}
        />
        <div class="h-9 w-px bg-gray-200"></div>
        <Select
          class="bg-white rounded-lg border-none"
          options={sortOptions}
          selected={filters.sortOrder}
          on:change={(e) => (filters.sortOrder = e.detail.value)}
        />
      </div>
    {/snippet}
  </FloatingFilterBar>

  <!-- 총 개수 + 뷰 토글 -->
  <div class="mb-1 flex h-11 items-center justify-between">
    <div class="flex items-baseline gap-2">
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        총 {totalCount}건
      </Typography>
      {#if !canUseManagerFilter}
        <span class="text-body-03-normal-regular text-gray-400">내 담당</span>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      {#if !isOverlayMode}
        <ListGridToggleButton
          bind:viewType={filters.viewType}
          onViewChange={(view) => (filters.viewType = view)}
        />
      {/if}
    </div>
  </div>

  {#if isGrid}
    <!-- 카드(grid): 페이지 흐름대로 늘어남(내부 스크롤 없음) → 본문 전체 스크롤 -->
    {#if filteredCases.length === 0 && !gridInitialLoading}
      <div class="flex flex-1 items-center justify-center py-12">
        <NoDataSection description={noDataMessage} />
      </div>
    {:else}
      <div in:fade>
        <div
          class="grid grid-cols-1 gap-5 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {#each filteredCases as caseItem (caseItem.uid + '-' + caseItem.status)}
            <AssessmentCaseCard
              caseInfo={caseItem}
              class="w-full"
              onEdit={handleEditAssessment}
              onComplete={handleCardComplete}
              onRollbackComplete={handleCardRollbackComplete}
              onDelete={handleCardDelete}
              onBilling={handleCardBilling}
              canBill={canWriteBilling}
              onSendLink={handleCardSendLink}
              canSendLink={$hasPermission('write:send_link')}
              hasOnlineLink={filteredData.find((row) => row.id === caseItem.uid)
                ?.hasOnlineLink ?? false}
            />
          {/each}
        </div>
        <InfiniteScrollSentinel
          onLoadMore={loadMore}
          {hasMore}
          loading={loadingMore || gridInitialLoading}
        />
      </div>
    {/if}
  {:else}
    <!-- 테이블(list): 화면 높이에 맞춰 페이지당 행 수 자동(내부 스크롤 없음) -->
    <div class="relative flex xl:min-h-0 flex-1 flex-col">
      <div bind:this={tableAreaEl} class="xl:min-h-0 flex-1">
        {#if !listPageSizeReady || ((isLoading || isFetching) && filteredData.length === 0)}
          <!-- 로딩 중 (측정 전 포함 → 빈 상태 깜빡임 방지) -->
          <div class="flex-center xl:h-full py-12">
            <div class="text-body-01-normal-medium text-gray-500">
              로딩 중...
            </div>
          </div>
        {:else if filteredData.length === 0}
          <!-- 데이터 없음 -->
          <div class="flex-center xl:h-full py-12">
            <NoDataSection description={noDataMessage} />
          </div>
        {:else}
          <!-- 데이터 있음 -->
          <AssessmentCaseTable
            class="xl:h-full"
            data={filteredData}
            onSendResult={handleSend}
            onSendLink={handleSendLink}
            canSendLink={$hasPermission('write:send_link')}
            onCancel={handleCancelAssessment}
            onEdit={handleEditAssessment}
            onDelete={handleDeleteAssessment}
            onRollbackCancel={handleRollbackCancel}
            onComplete={handleCompleteCase}
            onRollbackComplete={handleRollbackComplete}
            onRowClick={handleRowClick}
            onBilling={handleBilling}
            canBill={canWriteBilling}
            {rowHeightPx}
          />
        {/if}
      </div>

      <!-- 페이지네이션: 항상 자리 예약(h-20) → 데이터 도착 시 영역 높이 변화 없음(재측정·깜빡임 방지) -->
      <div class="mt-auto flex h-20 shrink-0 items-center justify-center">
        {#if filteredData.length > 0}
          <Pagination
            totalItems={pagination?.total ?? 0}
            itemsPerPage={filters.pageSize}
            bind:currentPage={filters.page}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>
