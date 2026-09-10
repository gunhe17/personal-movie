<script lang="ts">
  import { t, josa } from '$lib/ontology/terms'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import { fade } from 'svelte/transition'

  import Pagination from '$lib/components/Pagination.svelte'
  import PageTitleSection from '$root/src/lib/components/PageTitleSection.svelte'
  import Select from '$root/src/lib/components/Select.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import ClientCard from '$root/src/lib/components/ClientCard.svelte'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import {
    queryBuilder,
    infiniteQueryBuilder
  } from '$root/src/lib/hooks/queries/builder'
  import { getClientList } from '$root/src/lib/hooks/actions/client.action'
  import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte'
  import { buildClientListInput } from '$lib/features/clients/query-builders'
  import { centerId } from '$lib/stores/center.store'
  import { useQueryClient } from '@tanstack/svelte-query'

  import {
    CLIENT_GENDER_OPTIONS,
    CLIENT_ROLE_OPTIONS,
    CLIENT_SORT_OPTIONS,
    CLIENT_STATUS_OPTIONS
  } from '$lib/features/clients/constants'
  import { useClientFilters } from '$lib/features/clients/hooks.svelte'
  import type { ClientRoleFilter } from '$lib/features/clients/filters'
  import { mapClientsToVM } from '$lib/features/clients/view-model'
  import { createClientsService } from '$lib/features/clients/clients-service'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ListGridToggleButton from '$root/src/lib/components/ListGridToggleButton.svelte'
  import { page } from '$app/state'
  import ClientListTable from '$root/src/lib/components/table/ClientListTable.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { CLIENT_CREATE_RULE } from '$lib/features/clients/permissions'
  import NoDataSection from '$root/src/lib/components/NoDataSection.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { permissionStore } from '$lib/stores/permission.store'

  const pathname = page.url.pathname
  // /clients 목록 기본은 "최신 등록순"(created_at DESC) + 정렬 sticky 영속화
  const filters = useClientFilters(page.url, pathname, {
    defaultSort: 'desc',
    persistSort: true
  })
  const isOverlayMode = $derived(!responsive.isDesktop)

  const queryClient = useQueryClient()
  const clientsService = createClientsService({ queryClient })

  // 데이터 범위: 관리자(accessLevel=all)는 센터 전체, 상담사는 본인 담당만
  const isCenterWide = $derived($permissionStore.context?.accessLevel === 'all')
  // 총 건수 옆 부가 라벨. 센터 전체(=전수)는 표기하지 않고 좁혀진 범위만 알린다.
  const countScopeLabel = $derived(isCenterWide ? '' : '내 담당')
  // 삭제 권한(delete:client) 보유 시에만 카드 케밥에 '삭제' 노출
  const canDeleteClient = $derived(
    !!$permissionStore.context?.permissions?.some(
      (p: string) => p === 'delete:client'
    )
  )

  let viewType = $state(filters.viewType)

  $effect(() => {
    viewType = filters.viewType
  })
  $effect(() => {
    filters.viewType = viewType
  })
  // grid는 고정 16. list는 아래 화면 높이 측정 effect가 pageSize를 소유(20 강제 안 함).
  $effect(() => {
    if (viewType === 'grid') {
      filters.pageSize = 16
    }
  })

  // 반응형 viewType 전환: 줄일 때 grid 강제, 넓힐 때 원래 값 복원
  let viewTypeBeforeOverlay: 'list' | 'grid' | null = $state(null)

  $effect(() => {
    if (isOverlayMode && viewType === 'list') {
      viewTypeBeforeOverlay = 'list'
      viewType = 'grid'
    } else if (!isOverlayMode && viewTypeBeforeOverlay) {
      viewType = viewTypeBeforeOverlay
      viewTypeBeforeOverlay = null
    }
  })

  const onViewChange = (view: 'list' | 'grid') => {
    filters.viewType = view
    filters.pageSize = view === 'list' ? 20 : 16
  }

  const isGrid = $derived(viewType === 'grid')
  // 테이블 높이 측정으로 pageSize가 정해진 뒤에만 list 조회 (첫 조회 깜빡임 방지)
  let listPageSizeReady = $state(false)

  // 테이블(list) 뷰 — 기존 오프셋 페이지네이션 그대로 (grid 일 땐 비활성)
  const clientsQuery = $derived(
    queryBuilder(
      getClientList,
      () => buildClientListInput($centerId!, filters.buildFilters()),
      // 측정(listPageSizeReady) 전에는 조회하지 않음 → 처음부터 맞는 개수로 1회만 조회(깜빡임 방지)
      () => ({ enabled: !isGrid && listPageSizeReady })
    )
  )

  // 카드(grid) 뷰 — 무한 스크롤 (list 일 땐 비활성)
  const clientsInfinite = infiniteQueryBuilder(getClientList, {
    key: () => {
      const f = filters.buildFilters()
      return {
        center: $centerId,
        search: f.search,
        sort: f.sort,
        guardian: f.guardian,
        status: f.status,
        gender: f.gender
      }
    },
    buildInput: (skip, limit) => ({
      ...buildClientListInput($centerId!, filters.buildFilters()),
      skip,
      limit
    }),
    pageSize: 16,
    enabled: () => isGrid
  })

  const rawClients = $derived.by<any[]>(() => {
    if (isGrid) {
      const pages = clientsInfinite.data?.pages ?? []
      return pages.flatMap((p: any) => (Array.isArray(p?.items) ? p.items : []))
    }
    const d = clientsQuery.data
    return Array.isArray(d?.items) ? d.items : []
  })

  // 정렬은 전적으로 서버 순서를 따른다(활성 먼저 → 선택한 정렬).
  // 화면에서 현재 페이지만 다시 정렬하면 비활성이 "그 페이지의 맨 아래"까지만 가서
  // 페이지 경계에서 순서가 어긋난다. 리스트·카드 두 뷰가 이 배열을 공유한다.
  const clients = $derived(mapClientsToVM(rawClients))
  const totalClients = $derived(
    isGrid
      ? (clientsInfinite.data?.pages?.[0]?.total ?? 0)
      : (clientsQuery.data?.total ?? 0)
  )

  // 무한 스크롤 제어
  const gridInitialLoading = $derived(isGrid && clientsInfinite.isLoading)
  const loadingMore = $derived(isGrid && clientsInfinite.isFetchingNextPage)
  const hasMore = $derived(isGrid && (clientsInfinite.hasNextPage ?? false))
  const loadMore = () => clientsInfinite.fetchNextPage()

  // list 로딩 상태 (측정 전 빈상태 깜빡임 방지에 사용)
  const listLoading = $derived(clientsQuery.isLoading)
  const listFetching = $derived(clientsQuery.isFetching)

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
      // 동일 값이면 $state 세터가 no-op. pageSize를 읽지 않아 effect 의존 방지.
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

  const handleRegisterClient = () => {
    goto('/clients/register')
  }

  // 역할 필터 탭
  const roleTabs = CLIENT_ROLE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.title
  }))

  /** 초기화할 필터가 없으면 버튼을 죽인다 (탭·정렬·뷰는 필터가 아니다) */
  const isResetDisabled = $derived.by(() => {
    const f = filters.buildFilters()
    return !f.search && f.status === 'all' && f.gender === 'all'
  })
</script>

<!-- 카드=페이지 전체 스크롤(무한) / 테이블=기존 높이 고정. 헤더는 xl에서 sticky 고정 -->
<div
  in:fade
  class="mx-auto flex flex-col bg-gray-50 {isGrid
    ? ''
    : 'xl:h-full xl:min-h-0'}"
>
  <div class="shrink-0">
    <!-- 타이틀 바로 아래가 탭이면 간격 8(mb-2). 일반 콘텐츠일 때의 16보다 좁힌다 -->
    <PageTitleSection title={t('subject')} className="mb-2">
      <PermissionGuard slot="extraBtn" rule={CLIENT_CREATE_RULE}>
        <PageActionButton
          label={`${t('subject')} 등록`}
          onclick={handleRegisterClient}
        />
      </PermissionGuard>
    </PageTitleSection>
  </div>
  <!-- 역할 탭 필터 — 탭↔필터 간격은 FloatingFilterBar의 py-4가 담당 -->
  <TabBar
    tabs={roleTabs}
    activeTab={filters.guardian}
    onTabChange={(tab) => (filters.guardian = tab as ClientRoleFilter)}
  />
  <!-- 검색 및 필터 — 상단에 닿으면 플로팅으로 고정 -->
  <FloatingFilterBar reserveScroll={isGrid}>
    {#snippet children()}
      <div
        class="flex items-center {isOverlayMode
          ? 'w-full'
          : 'w-90'} rounded-lg border border-gray-200 bg-white px-3 h-11 focus:border-[#4C87F6] gap-2"
      >
        <SearchIcon />
        <input
          type="text"
          bind:value={filters.searchQuery}
          placeholder={`${t('subject')} 이름을 입력해주세요`}
          class="w-full text-body-01-normal-regular placeholder:text-placeholder outline-none"
        />
      </div>
      <Select
        class="bg-white rounded-lg"
        selected={filters.status}
        showActiveHighlight={true}
        defaultValue="all"
        on:change={(e) => (filters.status = e.detail.value)}
        options={CLIENT_STATUS_OPTIONS}
      />
      <Select
        class="bg-white rounded-lg"
        selected={filters.gender}
        showActiveHighlight={true}
        defaultValue="all"
        on:change={(e) => (filters.gender = e.detail.value)}
        options={CLIENT_GENDER_OPTIONS}
      />
      <div class="flex items-center gap-3">
        <FilterResetButton
          onclick={() => filters.reset()}
          disabled={isResetDisabled}
        />
        <div class="h-9 w-px bg-gray-200"></div>
        <Select
          class="bg-white rounded-lg"
          selected={filters.sortOrder}
          on:change={(e) => (filters.sortOrder = e.detail.value)}
          options={[...CLIENT_SORT_OPTIONS]}
        />
      </div>
    {/snippet}
  </FloatingFilterBar>

  <div class="mb-1 flex h-11 shrink-0 items-center justify-between">
    <div class="flex items-baseline gap-2">
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        총 {totalClients}명
      </Typography>
      {#if countScopeLabel}
        <span class="text-body-03-normal-regular text-gray-400">
          {countScopeLabel}
        </span>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      {#if !isOverlayMode}
        <ListGridToggleButton bind:viewType {onViewChange} />
      {/if}
    </div>
  </div>
  {#if isGrid}
    <!-- 카드(grid): 페이지 흐름대로 늘어남(내부 스크롤 없음) → 본문 전체 스크롤 -->
    {#if clients.length === 0 && !gridInitialLoading}
      <div class="flex flex-1 items-center justify-center py-12">
        <NoDataSection
          description={`일치하는 ${josa(t('subject'), '이/가')} 없어요`}
        />
      </div>
    {:else}
      <div in:fade>
        <div
          class="grid gap-4 pb-4"
          style="grid-template-columns: repeat(auto-fill, minmax(306px, 1fr));"
        >
          {#each clients as client}
            <ClientCard
              {...client}
              onStatusChange={clientsService.changeStatus}
              onDelete={canDeleteClient
                ? clientsService.deleteClient
                : undefined}
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
        {#if !listPageSizeReady || ((listLoading || listFetching) && clients.length === 0)}
          <!-- 로딩 중 (측정 전 포함 → 빈 상태 깜빡임 방지) -->
          <div class="flex xl:h-full items-center justify-center py-12">
            <div class="text-body-01-normal-medium text-gray-500">
              로딩 중...
            </div>
          </div>
        {:else if clients.length === 0}
          <!-- 데이터 없음 -->
          <div class="flex xl:h-full items-center justify-center py-12">
            <NoDataSection
              description={`일치하는 ${josa(t('subject'), '이/가')} 없어요`}
            />
          </div>
        {:else}
          <!-- 데이터 있음 -->
          <ClientListTable
            filteredClients={clients}
            onStatusChange={clientsService.changeStatus}
            {rowHeightPx}
          />
        {/if}
      </div>

      <!-- 페이지네이션: 항상 자리 예약(h-20) → 데이터 도착 시 영역 높이 변화 없음(재측정·깜빡임 방지) -->
      <div class="mt-auto flex h-20 shrink-0 items-center justify-center">
        {#if clients.length > 0}
          <Pagination
            totalItems={totalClients}
            itemsPerPage={filters.pageSize}
            bind:currentPage={filters.currentPage}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>
