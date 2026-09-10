<script lang="ts">
  import { getTitleIcon } from '$lib/config/title-icon'
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'

  import {
    queryBuilder,
    infiniteQueryBuilder
  } from '$lib/hooks/queries/builder'
  import {
    getCounselingsByCenterId,
    getCounselingDetailById
  } from '$lib/hooks/actions/counseling.action'
  import { createCounselingBillingService } from '$lib/features/counseling/detail/counseling-billing-service'
  import CaseBillingModal from '$lib/features/billing/components/create/CaseBillingModal.svelte'
  import { getBillableByRelated } from '$lib/hooks/actions/billable.action'
  import { hasPermission } from '$lib/stores/permission.view'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalStore } from '$lib/stores/modal'
  import CounselingCaseEditModal from '$lib/components/modal/CounselingCaseEditModal.svelte'
  import SignalQueueBar from '$lib/components/dashboard/SignalQueueBar.svelte'
  import type { SessionParticipant } from '$lib/types/counseling'

  import {
    useCounselingFilters,
    buildCounselingsQueryInput,
    sortOptions,
    COUNSELING_TABS,
    COUNSELING_SIGNAL_CHIPS,
    mapCounselingsToRows,
    createCounselingService,
    type CounselingStatusRow,
    type TabType
  } from '$lib/features/counseling/status'
  import { centerId } from '$lib/stores/center.store'
  import { responsive } from '$lib/stores/responsive.svelte'

  import { CounselingStatusTable } from '$lib/components/counseling/status'

  import Select from '$lib/components/Select.svelte'
  import DateRangeFilter from '$lib/components/common/DateRangeFilter.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import Typography from '@common/components/Typography.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import CounselingCard from '$lib/components/cards/CounselingCard.svelte'
  import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import LoadMoreButton from '$lib/components/LoadMoreButton.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import {
    mapCounselingToVM,
    mapRowPaginationToPagination,
    type CounselingVM
  } from '$root/src/lib/features/counseling/status/view-model'
  import ListGridToggleButton from '$root/src/lib/components/ListGridToggleButton.svelte'
  import { ManagerSelectDropDown } from '$root/src/lib/components/schedule/calendar'
  import {
    getMemberList,
    type MemberListResponse
  } from '$root/src/lib/hooks/actions/member.action'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import { CLIENT_TYPE_OPTIONS } from '$root/src/lib/features/schedule/counsel'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { COUNSELING_CREATE_RULE } from '$lib/features/counseling/permissions'
  import { permissionStore } from '$root/src/lib/stores/permission.store'
  import type { CounselingCaseItem } from '$lib/types/counseling'
  import type { RowPaginationRes } from '$lib/types/apiResponse'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'

  // ============ Filters ============
  const pathname = page.url.pathname
  const filters = useCounselingFilters(page.url, pathname)
  const isOverlayMode = $derived(!responsive.isDesktop)
  // 카드(grid) 뷰 여부 — 무한쿼리 정의보다 먼저 선언 (TDZ 주의)
  const isGrid = $derived(filters.viewType === 'grid')
  // 대시보드 시그널 딥링크 컨텍스트 (필터 UI 비노출 — URL로만 진입).
  // 큐가 있으면 순회 바, 없으면(공유 URL·새 탭) 같은 바의 축소 모드로 렌더된다.
  const signalFallback = $derived(
    filters.signal ? COUNSELING_SIGNAL_CHIPS[filters.signal] : null
  )
  // 테이블 높이 측정으로 pageSize가 정해진 뒤에만 list 조회 (첫 조회 깜빡임 방지)
  let listPageSizeReady = $state(false)

  // 카드(그리드) 뷰: 페이지네이션 대신 더보기로 누적 로드
  const GRID_LOAD_STEP = 12
  let gridLoadCount = $state(GRID_LOAD_STEP)

  // ============ Service ============
  const queryClient = useQueryClient()
  const counselingService = createCounselingService({ queryClient, centerId })
  const billingService = createCounselingBillingService({ queryClient })
  const canWriteBilling = $derived($hasPermission('write:billing'))

  // ============ Query ============
  const canUseManagerFilter = $derived(
    $permissionStore.context?.accessLevel === 'all'
  )
  // 테이블(list) 뷰 — 기존 오프셋 페이지네이션 그대로 (grid 일 땐 비활성)
  const counselingsQuery = queryBuilder(
    getCounselingsByCenterId,
    () => {
      const base = filters.buildFilters()
      const withManager = canUseManagerFilter
        ? base
        : { ...base, selectedManagerNames: [] }
      // 카드 뷰는 page=1 고정, pageSize를 gridLoadCount만큼 키워 누적 로드
      const effective =
        filters.viewType === 'grid'
          ? { ...withManager, page: 1, pageSize: gridLoadCount }
          : withManager
      return buildCounselingsQueryInput(effective, $centerId ?? '')
    },
    // 측정(listPageSizeReady) 전에는 조회하지 않음 → 처음부터 맞는 개수로 1회만 조회(깜빡임 방지)
    () => ({ enabled: !!$centerId && !isGrid && listPageSizeReady })
  )

  // 카드(grid) 뷰 — 무한 스크롤 (list 일 땐 비활성)
  const counselingsInfinite = infiniteQueryBuilder(getCounselingsByCenterId, {
    key: () => {
      const base = filters.buildFilters()
      const f = canUseManagerFilter
        ? base
        : { ...base, selectedManagerNames: [] }
      return {
        center: $centerId,
        search: f.search,
        sort: f.sort,
        status: f.status,
        counselingType: f.counselingType,
        managers: f.selectedManagerNames,
        startDate: f.startDate,
        endDate: f.endDate,
        signal: f.signal
      }
    },
    buildInput: (skip, limit) => {
      const base = filters.buildFilters()
      const effective = canUseManagerFilter
        ? base
        : { ...base, selectedManagerNames: [] }
      const input = buildCounselingsQueryInput(effective, $centerId ?? '')
      return {
        ...input,
        queryParams: {
          ...input.queryParams,
          page: Math.floor(skip / limit) + 1,
          size: limit
        }
      }
    },
    pageSize: 12,
    enabled: () => isGrid
  })

  const memberQuery = queryBuilder(
    getMemberList,
    () => ({ centerId: $centerId! }),
    () => ({
      enabled: !!$centerId && canUseManagerFilter
    })
  )
  const managerList = $derived(
    (memberQuery.data as MemberListResponse | undefined)?.items ?? []
  )

  // ============ Derived Data ============
  type CounselingsData = RowPaginationRes<CounselingCaseItem> | undefined
  const counselingsData = $derived(
    counselingsQuery.data as CounselingsData
  ) as CounselingsData
  const counselings = $derived.by((): CounselingCaseItem[] => {
    const data = counselingsQuery.data as
      | RowPaginationRes<CounselingCaseItem>
      | undefined
    return data?.items ?? []
  })
  const pagination = $derived(
    mapRowPaginationToPagination(counselingsData as CounselingsData)
  )
  const isLoading = $derived(counselingsQuery.isLoading)
  const isFetching = $derived(counselingsQuery.isFetching)

  // 테이블용 데이터 변환 (list 소스)
  const tableRows = $derived(mapCounselingsToRows(counselings))

  // 카드(grid) 소스 — 무한쿼리 페이지 평탄화
  const gridCounselings = $derived.by((): CounselingCaseItem[] => {
    const pages = counselingsInfinite.data?.pages ?? []
    return pages.flatMap((p) => (Array.isArray(p?.items) ? p.items : []))
  })

  // 카드용 데이터 변환 — 활성 소스(grid=무한쿼리 / list=오프셋쿼리) 기준
  const counselingVMs: CounselingVM[] = $derived(
    (isGrid ? gridCounselings : counselings).map((c: CounselingCaseItem) =>
      mapCounselingToVM(c)
    )
  )
  const totalCount = $derived(
    isGrid
      ? (counselingsInfinite.data?.pages?.[0]?.total ?? 0)
      : (pagination?.total ?? counselings.length)
  )

  // 무한 스크롤 제어
  const gridInitialLoading = $derived(isGrid && counselingsInfinite.isLoading)
  const loadingMore = $derived(isGrid && counselingsInfinite.isFetchingNextPage)
  const hasMore = $derived(isGrid && (counselingsInfinite.hasNextPage ?? false))
  const loadMore = () => counselingsInfinite.fetchNextPage()

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

  // ============ 카드 더보기 ============
  const hasMoreCards = $derived(counselingVMs.length < totalCount)

  // 조건(페이지·pageSize 제외) 또는 뷰가 바뀌면 로드 수 초기화
  const gridResetKey = $derived(
    JSON.stringify({
      tab: filters.activeTab,
      search: filters.debouncedSearchQuery,
      sort: filters.sortOrder,
      managers: filters.selectedManagerNames,
      type: filters.counselingType,
      start: filters.startDate,
      end: filters.endDate,
      view: filters.viewType,
      signal: filters.signal
    })
  )
  $effect(() => {
    gridResetKey
    gridLoadCount = GRID_LOAD_STEP
  })

  function handleLoadMore() {
    gridLoadCount += GRID_LOAD_STEP
  }

  // ============ Tabs ============
  const tabs = $derived(
    COUNSELING_TABS.map((tab) => ({ value: tab.value, label: tab.label }))
  )

  function handleRegisterClick() {
    goto('/counseling/receive')
  }

  function handleTabChange(tab: string) {
    if (filters.activeTab === tab) return
    filters.changeTab(tab as TabType)
  }

  // 테이블 핸들러
  function handleRowClick(row: CounselingStatusRow) {
    goto(`/counseling/status/${row.id}`)
  }

  function handleClose(row: CounselingStatusRow) {
    counselingService.closeCounseling(row)
  }

  function handleReopen(row: CounselingStatusRow) {
    counselingService.reopenCounseling(row)
  }

  const handleDelete = (counseling: CounselingStatusRow | CounselingVM) => {
    counselingService.deleteCounselingCase(counseling)
  }

  // 상담 수정 — 편집 모달은 케이스 상세 전체를 요구하므로 행 클릭 시 상세를 먼저 불러온다
  // (목록 행에는 회기·참여자 정보가 없다). 상세 페이지의 케밥과 같은 모달·같은 무효화.
  const handleEdit = async (counseling: CounselingStatusRow | CounselingVM) => {
    const cid = $centerId
    if (!cid) return
    try {
      const detail = await getCounselingDetailById().request({
        centerId: cid,
        counselingId: counseling.id
      })
      if (!detail) {
        snackbarStore.error('상담 정보를 불러오지 못했어요.')
        return
      }
      modalStore.open({
        component: CounselingCaseEditModal as any,
        props: {
          counselingData: detail,
          onSuccess: () => counselingService.invalidateCounselings()
        },
        options: { customWidth: 740, desktopOnly: true }
      })
    } catch {
      snackbarStore.error('상담 정보를 불러오지 못했어요.')
    }
  }

  // 청구하기: 케이스 상세를 불러와 패키지 청구 모달을 연다.
  // 그룹 케이스도 **이동 없이** 이 자리에서 연다 — 목록에서 누른 버튼이 화면을 바꾸면
  // 취소했을 때 사용자가 원치 않은 상세에 남는다(검사 현황 카드도 이동 없이 모달만 연다).
  // 대상 = 아직 청구되지 않은 첫 참여자. 한 명을 청구하면 다음 클릭이 그다음 참여자를
  // 집으므로, 반복 클릭으로 그룹 전원을 훑을 수 있다.
  async function handleBilling(row: CounselingStatusRow | CounselingVM) {
    const cid = $centerId
    if (!cid) return
    try {
      const detail = await getCounselingDetailById().request({
        centerId: cid,
        counselingId: row.id
      })
      const clients = detail?.clients ?? []
      if (clients.length === 0) return

      let target = clients[0]
      if (clients.length > 1) {
        // 이미 패키지 청구가 있는 참여자는 건너뛴다 — 안 그러면 청구된 사람에게
        // 생성 모달이 열린다(상세의 packageBillingMap과 같은 판정)
        const billables = await getBillableByRelated().request({
          centerId: cid,
          relatedType: ['counseling_case', 'counseling_session'],
          relatedCaseId: detail?.case_id
        })
        const billedIds = new Set(
          billables
            .filter((b: any) => b.is_package === true)
            .map((b: any) => b.client_id)
        )
        target = clients.find((c) => !billedIds.has(c.client_id)) ?? clients[0]
      }

      await billingService.openCaseBilling({
        caseData: detail,
        sessions: detail?.sessions ?? [],
        client: {
          participant_id: target.client_id,
          participant_name: target.name
        } as SessionParticipant,
        CaseBillingModal
      })
    } catch {
      snackbarStore.error('청구 정보를 불러오지 못했어요')
    }
  }

  // 카드 핸들러
  function handleCardClose(data: CounselingVM) {
    const row = tableRows.find((r) => r.id === data.id)
    if (row) counselingService.closeCounseling(row)
  }

  function handleCardReopen(data: CounselingVM) {
    const row = tableRows.find((r) => r.id === data.id)
    if (row) counselingService.reopenCounseling(row)
  }

  const onViewChange = (view: 'list' | 'grid') => {
    filters.viewType = view
    filters.pageSize = view === 'list' ? 20 : 12
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
      f.counselingType === 'all' &&
      !f.startDate &&
      !f.endDate &&
      (f.selectedManagerNames?.length ?? 0) === 0
    )
  })

  const TitleIcon = $derived(getTitleIcon(page.url.pathname))
</script>

<!-- 카드=페이지 전체 스크롤(무한) / 테이블=기존 높이 고정.
     타이틀·탭은 스크롤과 함께 올라가고, 검색+필터만 상단에 플로팅으로 남는다. -->
<div
  in:fade
  class="mx-auto flex flex-col bg-gray-50 {isGrid ? '' : 'xl:h-full'}"
>
  <!-- 헤더 -->
  <!-- 타이틀 바로 아래가 탭이면 간격 8(mb-2). 일반 콘텐츠일 때의 16보다 좁힌다 -->
  <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
    <div class="flex items-center gap-2">
      {#if TitleIcon}<TitleIcon />{/if}
      <h1 class="text-headline-01-normal-semibold text-gray-800">상담 현황</h1>
    </div>
    <PermissionGuard rule={COUNSELING_CREATE_RULE}>
      <PageActionButton label="상담 접수" onclick={handleRegisterClick} />
    </PermissionGuard>
  </div>

  <!-- 탭 영역 — 탭↔필터 간격은 아래 FloatingFilterBar의 py-4가 담당한다(고정 시 여백으로 전환) -->
  <TabBar {tabs} activeTab={filters.activeTab} onTabChange={handleTabChange} />

  <!-- 검색 + 필터 — 상단에 닿으면 플로팅으로 고정(스크롤 중에도 검색·필터 조작 가능) -->
  <FloatingFilterBar reserveScroll={isGrid}>
    {#snippet children()}
      <div
        class="flex h-11 {isOverlayMode
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
        start={filters.startDate}
        end={filters.endDate}
        onChange={filters.setDateRange}
        placeholder="접수일"
      />

      <!-- 담당자 필터 — accessLevel=all일 때만 표시 -->
      {#if canUseManagerFilter}
        <!-- containerClass에 bg-* 금지 — 래퍼 div는 radius가 없어 트리거(rounded-lg)
             뒤로 흰 사각 모서리가 비친다. 배경은 .dropdown-trigger가 이미 갖고 있다 -->
        <ManagerSelectDropDown
          options={managerList}
          containerClass={'text-body-02-normal-regular'}
          bind:selectedManagerNames={filters.selectedManagerNames}
        />
      {/if}

      <Select
        class="bg-white rounded-lg"
        selected={filters.counselingType}
        showActiveHighlight={true}
        defaultValue="all"
        textClass="text-body-02-normal-regular"
        on:change={(e) => (filters.counselingType = e.detail.value)}
        options={CLIENT_TYPE_OPTIONS}
      />
      <!-- 초기화 + 정렬 + 뷰 토글 -->
      <div class="flex items-center gap-3">
        <FilterResetButton
          onclick={filters.resetFilters}
          disabled={isResetDisabled}
        />
        <div class="h-9 w-px bg-gray-200"></div>
        <Select
          class="rounded-lg border-none bg-white"
          options={sortOptions}
          selected={filters.sortOrder}
          on:change={(e) => (filters.sortOrder = e.detail.value)}
        />
      </div>
    {/snippet}
  </FloatingFilterBar>

  <!-- 총 개수 + 뷰 토글 -->
  <div class="mb-1 flex h-11 items-center justify-between">
    <Typography variant="body-01-normal-regular" color="text-gray-700">
      총 {totalCount}건
    </Typography>
    <div class="flex items-center gap-3">
      {#if !isOverlayMode}
        <ListGridToggleButton bind:viewType={filters.viewType} {onViewChange} />
      {/if}
    </div>
  </div>

  {#if isGrid}
    <!-- 카드(grid): 페이지 흐름대로 늘어남(내부 스크롤 없음) → 본문 전체 스크롤 -->
    {#if counselingVMs.length === 0 && !gridInitialLoading}
      <div class="flex flex-1 items-center justify-center py-12">
        <NoDataSection description="일치하는 상담이 없어요" />
      </div>
    {:else}
      <div in:fade>
        <!-- 한 줄 4장 고정(데스크탑) — 좁아지면 3 → 2 → 1로 단계 축소 -->
        <div
          class="grid grid-cols-1 gap-5 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {#each counselingVMs as item (item.id)}
            <CounselingCard
              onEdit={handleEdit}
              data={item}
              class="w-full"
              onClose={handleCardClose}
              onReopen={handleCardReopen}
              onDelete={handleDelete}
              onBilling={handleBilling}
              canBill={canWriteBilling}
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
        {#if !listPageSizeReady || ((isLoading || isFetching) && tableRows.length === 0)}
          <!-- 로딩 중 (측정 전 포함 → 빈 상태 깜빡임 방지) -->
          <div class="flex xl:h-full items-center justify-center py-12">
            <div class="text-body-01-normal-medium text-gray-500">
              로딩 중...
            </div>
          </div>
        {:else if tableRows.length === 0}
          <!-- 데이터 없음 -->
          <div class="flex xl:h-full items-center justify-center py-12">
            <NoDataSection description={'일치하는 상담이 없어요'} />
          </div>
        {:else}
          <!-- 데이터 있음 -->
          <CounselingStatusTable
            class="xl:h-full"
            data={tableRows}
            onEdit={handleEdit}
            onClose={handleClose}
            onReopen={handleReopen}
            onDelete={handleDelete}
            onRowClick={handleRowClick}
            onBilling={handleBilling}
            canBill={canWriteBilling}
            {rowHeightPx}
          />
        {/if}
      </div>

      <!-- 페이지네이션: 항상 자리 예약(h-20) → 데이터 도착 시 영역 높이 변화 없음(재측정·깜빡임 방지) -->
      <div class="mt-auto flex h-20 shrink-0 items-center justify-center">
        {#if tableRows.length > 0}
          <Pagination
            totalItems={totalCount}
            itemsPerPage={filters.pageSize}
            bind:currentPage={filters.page}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>
