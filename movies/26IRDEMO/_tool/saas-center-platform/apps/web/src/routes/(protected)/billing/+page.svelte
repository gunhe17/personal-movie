<script lang="ts">
  import { getTitleIcon } from '$lib/config/title-icon'
  import { fade } from 'svelte/transition'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import DateRangeFilter from '$lib/components/common/DateRangeFilter.svelte'
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import Table from '$lib/components/Table.svelte'
  import type { TableColumn } from '$lib/components/Table.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import BillableCard from '$lib/components/cards/BillableCard.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import ListGridToggleButton from '$lib/components/ListGridToggleButton.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import SignalQueueBar from '$lib/components/dashboard/SignalQueueBar.svelte'
  import {
    queryBuilder,
    infiniteQueryBuilder
  } from '$lib/hooks/queries/builder'
  import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte'
  import {
    getBillableList,
    getTodayMissingBillables,
    type BillableTarget
  } from '$lib/hooks/actions/billable.action'
  import SessionBillingModal from '$lib/features/billing/components/create/SessionBillingModal.svelte'
  import { formatUtcToKst } from '$lib/utils/date'
  import { centerId } from '$lib/stores/center.store'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    mapToBillableListItemVM,
    type BillableListItemVM
  } from '$lib/features/billing/view-model'
  import { useBillableFilters } from '$lib/features/billing/hooks.svelte'
  import { buildBillableListInput } from '$lib/features/billing/query-builders'
  import {
    BILLABLE_STATUS_OPTIONS,
    BILLABLE_TYPE_OPTIONS,
    SORT_OPTIONS
  } from '$lib/features/billing/constants'
  import Select from '$lib/components/Select.svelte'
  import { hasPermission } from '$lib/stores/permission.view'
  import { responsive } from '$lib/stores/responsive.svelte'
  import { createBillableService } from '$lib/features/billing/billable-service'
  import BillableCreateModal from '$lib/features/billing/components/create/BillableCreateModal.svelte'
  import BillableDetailModal from './components/BillableDetailModal.svelte'
  import BulkBillingPreviewModal from '$lib/features/billing/components/BulkBillingPreviewModal.svelte'
  import { modalStore } from '$lib/stores/modal'

  const queryClient = useQueryClient()
  const billableService = createBillableService({ queryClient })

  function openBulkPreview() {
    modalStore.open({ component: BulkBillingPreviewModal, props: {} })
  }

  // 반응형 모드
  const isOverlayMode = $derived(!responsive.isDesktop)

  // 필터 (디바운스 검색 포함)
  const pathname = page.url.pathname
  const filters = useBillableFilters(page.url, pathname)

  // 권한 체크
  const canWrite = $derived($hasPermission('write:billing'))

  // 반응형 오버레이 모드 진입/이탈 시 viewType 강제 전환
  $effect(() => {
    filters.applyResponsiveMode(isOverlayMode)
  })

  const isGrid = $derived(filters.viewType === 'grid')
  // 미청구 탭 — 청구서 목록이 아니라 today-missing 대상 목록을 보여준다.
  // 그리드 뷰가 없어서 레이아웃·측정은 항상 리스트 취급(gridMode).
  const isUnbilled = $derived(filters.status === 'unbilled')
  const gridMode = $derived(isGrid && !isUnbilled)
  // 테이블 높이 측정으로 pageSize가 정해진 뒤에만 list 조회 (첫 조회 깜빡임 방지)
  let listPageSizeReady = $state(false)

  // URL → API 쿼리 (테이블: 기존 오프셋 페이지네이션, grid 일 땐 비활성)
  const listQuery = $derived(
    queryBuilder(
      getBillableList,
      () => buildBillableListInput($centerId, filters.buildFilters()),
      // 측정(listPageSizeReady) 전에는 조회하지 않음 → 처음부터 맞는 개수로 1회만
      () => ({ enabled: !isGrid && listPageSizeReady && !isUnbilled })
    )
  )

  // 카드(grid) 뷰 — 무한 스크롤 (list 일 땐 비활성)
  const listInfinite = infiniteQueryBuilder(getBillableList, {
    key: () => {
      const f = filters.buildFilters()
      return {
        center: $centerId,
        status: f.status,
        search: f.search,
        sort: f.sort
      }
    },
    // 이 엔드포인트는 1-based page/size 페이지네이션 → skip/limit 를 변환
    buildInput: (skip, limit) => ({
      ...buildBillableListInput($centerId, filters.buildFilters()),
      page: Math.floor(skip / limit) + 1,
      size: limit
    }),
    pageSize: () => filters.pageSize,
    enabled: () => isGrid && !isUnbilled
  })

  // ── 미청구 탭: 대시보드 시그널과 같은 엔드포인트(today-missing) — 건수가 항상 일치 ──
  // 탭 위 말풍선이 어느 탭에서든 건수를 알려야 해서 항상 조회한다(캐시 공유).
  const missingQuery = $derived(
    queryBuilder(
      getTodayMissingBillables,
      () => ({ centerId: $centerId }),
      () => ({ enabled: !!$centerId })
    )
  )
  const missingCount = $derived(
    ((missingQuery.data as BillableTarget[] | undefined) ?? []).length
  )
  // 말풍선 — 닫으면 이 화면에 머무는 동안 다시 뜨지 않는다
  let missingTipClosed = $state(false)
  type UnbilledRow = BillableTarget & { key: string }
  const unbilledFiltered = $derived.by<UnbilledRow[]>(() => {
    const targets = (missingQuery.data as BillableTarget[] | undefined) ?? []
    const needle = filters.debouncedSearchQuery.trim().toLowerCase()
    // 대상 유형(상담/검사) — 이 탭은 서버 필터를 타지 않는 클라이언트 목록이라
    // 필터 바의 선택을 여기서 직접 적용해야 한다(값이 BillableTarget.type과 동일 어휘)
    const type = filters.targetType
    const byType =
      type === 'all' ? targets : targets.filter((t) => t.type === type)
    const filtered = needle
      ? byType.filter((t) =>
          [t.client_name, t.title, t.case_code].some((v) =>
            v?.toLowerCase().includes(needle)
          )
        )
      : byType
    const dir = filters.sort === 'asc' ? 1 : -1
    return [...filtered]
      .sort((a, b) => {
        const av = a.scheduled_at ?? a.created_at
        const bv = b.scheduled_at ?? b.created_at
        return av < bv ? -dir : av > bv ? dir : 0
      })
      .map((t) => ({
        ...t,
        key: `${t.session_id ?? t.case_id}:${t.client_id ?? ''}`
      }))
  })
  const unbilledPaged = $derived(
    unbilledFiltered.slice(
      (filters.page - 1) * filters.pageSize,
      filters.page * filters.pageSize
    )
  )
  // 검색 등으로 목록이 줄어 현재 페이지가 범위를 벗어나면 1페이지로 보정
  $effect(() => {
    if (!isUnbilled || filters.page === 1) return
    if ((filters.page - 1) * filters.pageSize >= unbilledFiltered.length) {
      filters.page = 1
    }
  })

  function handleTargetBilling(target: BillableTarget) {
    if (!canWrite || !target.client_id) return
    billableService.openTargetBilling(SessionBillingModal, target)
  }

  const rawRows = $derived.by<any[]>(() => {
    if (isGrid) {
      const pages = listInfinite.data?.pages ?? []
      return pages.flatMap((p: any) => (Array.isArray(p?.items) ? p.items : []))
    }
    return listQuery.data?.items ?? []
  })
  const rows = $derived(rawRows.map(mapToBillableListItemVM))
  // 미청구 탭은 청구서 목록 쿼리(listQuery·listInfinite)가 비활성이라 total이 0으로 떨어진다
  // → 그 탭의 카운트는 today-missing 대상 수를 쓴다(행 수와 항상 일치)
  const total = $derived(
    isUnbilled
      ? unbilledFiltered.length
      : isGrid
        ? (listInfinite.data?.pages?.[0]?.total ?? 0)
        : (listQuery.data?.total ?? 0)
  )
  const unpaidTotal = $derived(
    isGrid
      ? (listInfinite.data?.pages?.[0]?.unpaid_total ?? 0)
      : (listQuery.data?.unpaid_total ?? 0)
  )
  const isLoading = $derived(listQuery.isLoading)
  const isFetching = $derived(listQuery.isFetching)

  const gridInitialLoading = $derived(isGrid && listInfinite.isLoading)
  const loadingMore = $derived(isGrid && listInfinite.isFetchingNextPage)
  const hasMore = $derived(isGrid && (listInfinite.hasNextPage ?? false))
  const loadMore = () => listInfinite.fetchNextPage()

  // ============ 테이블 뷰: 화면 높이에 맞춰 한 페이지 행 수 + 행 높이 자동 산정 ============
  // 내부 스크롤 없이 보이는 행 수 = 페이지당 아이템 수. 자투리는 행 높이에 흡수(모든 페이지 동일 높이).
  // billing은 테이블+페이지네이션을 함께 담는 바깥 컨테이너를 측정 → CHROME에 페이지네이션(80) 포함.
  // 기준: 행 80px + 페이지네이션 자리 80px + Table sticky 헤더 52px + 카드 테두리 2px.
  let tableAreaEl: HTMLDivElement | null = $state(null)
  let rowHeightPx = $state(80)
  const ROW_H = 80
  const TABLE_CHROME = 134 // 페이지네이션(80) + 헤더(52) + 테두리(2)
  const MIN_ROWS = 3

  $effect(() => {
    if (!browser || gridMode) return
    const el = tableAreaEl
    if (!el) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const recompute = () => {
      const h = el.clientHeight
      if (h <= 0) return
      const space = h - TABLE_CHROME
      const rows = Math.max(MIN_ROWS, Math.floor(space / ROW_H))
      filters.pageSize = rows // 동일 값이면 no-op. pageSize 읽지 않아 effect 의존 방지.
      // 자투리를 행에 흡수 → 꽉 찬 페이지는 여백 0, 모든 페이지 행 높이 동일
      rowHeightPx = Math.max(ROW_H, Math.floor(space / rows))
      listPageSizeReady = true
    }
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(recompute, 150)
    })
    ro.observe(el)
    recompute()
    return () => {
      if (timer) clearTimeout(timer)
      ro.disconnect()
    }
  })

  // 필터 활성 여부
  const hasActiveFilter = $derived(
    !!filters.debouncedSearchQuery || filters.status !== 'all'
  )
  const noDataMessage = $derived(
    hasActiveFilter ? '검색 조건에 맞는 청구가 없어요' : '청구 내역이 없어요'
  )

  // 탭 정의 — 미청구 탭에는 오늘까지 미청구 세션 건수를 말풍선으로 달아준다.
  // (이미 미청구 탭을 보고 있으면 중복이라 감춘다)
  const tabs = $derived(
    BILLABLE_STATUS_OPTIONS.map((o) => ({
      value: o.value,
      label: o.title,
      notice:
        o.value === 'unbilled' &&
        canWrite &&
        !missingTipClosed &&
        !isUnbilled &&
        missingCount > 0
          ? `미청구 ${missingCount}건이 있어요!`
          : undefined
    }))
  )

  function handleItemClick(item: BillableListItemVM) {
    billableService.openDetailModal(BillableDetailModal, item.id, canWrite, {
      name: item.clientName,
      birthDate: item.clientBirthDate,
      gender: item.clientGender,
      profileImageUrl: item.clientProfileImageUrl
    })
  }

  function handleAddBilling() {
    billableService.openCreateModal(BillableCreateModal)
  }

  // agent prefill — /billing?billable_id=…[&action=pay].
  // 필터 updateURL(goto replaceState)이 이 파라미터를 곧 지우므로 진입 시점에 붙잡아 둔다.
  const prefillBillableId = page.url.searchParams.get('billable_id')
  const prefillAutoPay = page.url.searchParams.get('action') === 'pay'
  let prefillOpened = false
  $effect(() => {
    // 권한 로드가 비동기 — canWrite가 true가 되는 시점에 연다
    if (!prefillBillableId || prefillOpened || !canWrite) return
    prefillOpened = true
    billableService.openDetailModal(
      BillableDetailModal,
      prefillBillableId,
      canWrite,
      undefined,
      { autoOpenPayment: prefillAutoPay }
    )
  })

  // 테이블 컬럼 정의
  const columns: TableColumn<BillableListItemVM>[] = [
    {
      key: 'clientName',
      label: '내담자',
      width: 'minmax(180px, 1fr)',
      render: clientCell
    },
    {
      key: 'createdByName',
      label: '청구자',
      width: 'minmax(120px, 1fr)',
      render: creatorCell
    },
    {
      key: 'itemSummary',
      label: '내역',
      width: '2.5fr',
      render: itemSummaryCell
    },
    {
      key: 'totalAmountFormatted',
      label: '총액',
      width: '120px',
      render: totalCell
    },
    {
      key: 'paidAmountFormatted',
      label: '납부액',
      width: '120px',
      render: paidCell
    },
    {
      key: 'unpaidAmountFormatted',
      label: '미수금',
      width: '120px',
      render: unpaidCell
    },
    {
      key: 'statusLabel',
      label: '상태',
      width: '100px',
      render: statusCell
    },
    {
      key: 'createdAt',
      label: '생성일',
      width: '150px',
      render: dateCell
    }
  ]

  // 미청구 탭 테이블 컬럼
  const unbilledColumns: TableColumn<UnbilledRow>[] = [
    {
      key: 'client_name',
      label: '내담자',
      width: 'minmax(140px, 1fr)',
      render: targetClientCell
    },
    {
      key: 'title',
      label: '내용',
      width: '2.5fr',
      render: targetContentCell
    },
    {
      key: 'scheduled_at',
      label: '일시',
      width: '140px',
      render: targetDateCell
    },
    {
      key: 'action',
      label: '',
      // 버튼 Medium(24 + 레이블 60 + 24 = 108) — 110이면 여백이 0이라 벌린다
      width: '132px',
      render: targetActionCell
    }
  ]

  const isResetDisabled = $derived.by(() => {
    const f = filters.buildFilters()
    return (
      !f.search &&
      f.status === 'all' &&
      !f.dateFrom &&
      !f.dateTo &&
      f.targetType === 'all'
    )
  })

  const TitleIcon = $derived(getTitleIcon(page.url.pathname))
</script>

{#snippet targetDateCell({ item }: { item: UnbilledRow })}
  <Typography
    variant="body-01-normal-regular"
    color="text-body-default"
    tag="span"
  >
    {item.scheduled_at ? formatUtcToKst(item.scheduled_at, 'MM/DD HH:mm') : '-'}
  </Typography>
{/snippet}

{#snippet targetClientCell({ item }: { item: UnbilledRow })}
  <!-- 전체 탭 clientCell과 같은 규격 — 내담자 최소 단위(아바타 + 이름 + 생년월일|성별).
       한 테이블 안에서 탭마다 표기가 갈리지 않게 구조·토큰을 그대로 맞춘다 -->
  <div class="flex items-center gap-3 overflow-hidden">
    <ClientAvatar
      profileImageUrl={item.client_profile_image_url}
      name={item.client_name ?? ''}
      gender={item.client_gender}
      sizeClass="h-10 w-10"
      textClass="text-[15px]"
    />
    <div class="flex min-w-0 flex-col justify-center gap-2 overflow-hidden">
      <Typography
        variant="title-01-normal-semibold"
        color="text-body-strong"
        className="truncate-safe"
        tag="span"
      >
        {item.client_name ?? '-'}
      </Typography>
      {#if item.client_birth_date}
        <ClientBirthGender
          birthDate={item.client_birth_date}
          gender={item.client_gender}
        />
      {/if}
    </div>
  </div>
{/snippet}

{#snippet targetContentCell({ item }: { item: UnbilledRow })}
  <!-- 내용 = [상담/검사 코드] + 이름. 날짜는 '일시' 컬럼이 소유한다(중복 표기 금지).
       상담은 title이 "8/27 상담 회기"라 날짜가 박혀 있어 프로그램명(subtitle)을 쓰고,
       검사는 title이 곧 검사명·세트명이다. -->
  {@const contentLabel =
    item.type === 'counseling' ? (item.subtitle ?? item.title) : item.title}
  <div class="flex min-w-0 items-center gap-2">
    {#if item.case_code}
      <BadgeRectangle label={item.case_code} size="sm" />
    {/if}
    <span
      class="block truncate-safe text-body-01-normal-regular text-body-default"
      title={contentLabel}
    >
      {contentLabel}
    </span>
  </div>
{/snippet}

{#snippet targetActionCell({ item }: { item: UnbilledRow })}
  {#if canWrite}
    <button
      onclick={(e) => {
        e.stopPropagation()
        handleTargetBilling(item)
      }}
      disabled={!item.client_id}
      class="inline-flex h-10 shrink-0 items-center rounded-lg bg-white px-6 border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      <!-- 버튼 사이즈 Medium(40 × 좌우 24) — 레이블은 사이즈에 묶여 Body_02(15) -->
      <Typography
        variant="body-02-normal-medium"
        color="text-current"
        tag="span"
      >
        청구하기
      </Typography>
    </button>
  {/if}
{/snippet}

{#snippet clientCell({
  item
}: {
  item: BillableListItemVM
  index: number
  isChecked: boolean
})}
  <div class="flex items-center gap-3 overflow-hidden">
    <ClientAvatar
      profileImageUrl={item.clientProfileImageUrl}
      name={item.clientName}
      gender={item.clientGender}
      sizeClass="h-10 w-10"
      textClass="text-[15px]"
    />
    <div class="flex min-w-0 flex-col justify-center gap-2 overflow-hidden">
      <Typography
        variant="title-01-normal-semibold"
        color="text-gray-800"
        className="truncate-safe"
        tag="span"
      >
        {item.clientName}
      </Typography>
      {#if item.clientBirthDate}
        <ClientBirthGender
          birthDate={item.clientBirthDate}
          gender={item.clientGender}
        />
      {/if}
    </div>
  </div>
{/snippet}

{#snippet itemSummaryCell({
  item
}: {
  item: BillableListItemVM
  index: number
  isChecked: boolean
})}
  <div class="flex items-center gap-1.5 min-w-0">
    {#if item.isPackage}
      <BadgeRectangle label="패키지" color="blue" size="sm" />
    {/if}
    {#each item.caseCodes as code (code)}
      <BadgeRectangle label={code} size="sm" />
    {/each}
    <span
      class="block truncate-safe text-body-01-normal-regular text-gray-800"
      title={item.itemSummary}
    >
      {item.itemSummary}
    </span>
  </div>
{/snippet}

{#snippet unpaidCell({
  item
}: {
  item: BillableListItemVM
  index: number
  isChecked: boolean
})}
  <Typography
    variant="body-01-normal-regular"
    color={item.unpaidAmount > 0 ? 'text-red-600' : 'text-gray-800'}
    tag="span"
  >
    {item.unpaidAmountFormatted}
  </Typography>
{/snippet}

{#snippet statusCell({
  item
}: {
  item: BillableListItemVM
  index: number
  isChecked: boolean
})}
  <div class="flex items-center justify-start">
    <span
      class="inline-flex h-8 min-w-[60px] items-center justify-center rounded-[100px] px-3 text-body-03-normal-regular {item.statusColor}"
    >
      {item.statusLabel}
    </span>
  </div>
{/snippet}

{#snippet creatorCell({
  item
}: {
  item: BillableListItemVM
  index: number
  isChecked: boolean
})}
  {#if item.createdByName && item.createdByName !== '-'}
    <Typography
      variant="body-01-normal-regular"
      color="text-gray-800"
      tag="span"
    >
      {item.createdByName}
    </Typography>
  {:else}
    <Typography
      variant="body-01-normal-regular"
      color="text-gray-400"
      tag="span"
    >
      -
    </Typography>
  {/if}
{/snippet}

{#snippet dateCell({
  item
}: {
  item: BillableListItemVM
  index: number
  isChecked: boolean
})}
  <Typography variant="body-01-normal-regular" color="text-gray-800" tag="span">
    {item.createdAtDate}
  </Typography>
{/snippet}

{#snippet totalCell({
  item
}: {
  item: BillableListItemVM
  index: number
  isChecked: boolean
})}
  <Typography variant="body-01-normal-regular" color="text-gray-800" tag="span">
    {item.totalAmountFormatted}
  </Typography>
{/snippet}

{#snippet paidCell({
  item
}: {
  item: BillableListItemVM
  index: number
  isChecked: boolean
})}
  <Typography variant="body-01-normal-regular" color="text-gray-800" tag="span">
    {item.paidAmountFormatted}
  </Typography>
{/snippet}

<div
  in:fade
  class="mx-auto flex flex-col {gridMode ? '' : 'overflow-x-hidden h-full'}"
>
  <!-- 헤더 -->
  <!-- 타이틀 바로 아래가 탭이면 간격 8(mb-2). 일반 콘텐츠일 때의 16보다 좁힌다 -->
  <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
    <div class="flex items-center gap-2">
      {#if TitleIcon}<TitleIcon />{/if}
      <h1 class="text-headline-01-normal-semibold text-gray-800">청구</h1>
    </div>
    {#if canWrite}
      <div class="flex items-center gap-2">
        <!-- 보조 액션(흰 버튼, §5.6) — 크기는 옆의 PageActionButton과 동일:
             높이 44(h-11) · 좌우 20(px-5) · radius 8 · 레이블 Body_01(16) Medium -->
        <button
          type="button"
          onclick={openBulkPreview}
          class="flex h-11 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-5 text-body-01-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800"
        >
          미청구 예상금액
        </button>
        <PageActionButton label="청구 추가" onclick={handleAddBilling} />
      </div>
    {/if}
  </div>

  <!-- 탭 필터 — 탭↔필터 간격은 FloatingFilterBar의 py-4가 담당.
       오늘까지 미청구건은 배너 대신 미청구 탭 위 말풍선으로 고지한다 -->
  <TabBar
    {tabs}
    activeTab={filters.status}
    onTabChange={(tab) => filters.changeTab(tab)}
    onNoticeClose={() => (missingTipClosed = true)}
  />

  <!-- 필터 영역 — 상단에 닿으면 플로팅으로 고정 -->
  <FloatingFilterBar reserveScroll={isGrid}>
    {#snippet children()}
      <!-- 검색 (디바운스) -->
      <div
        class="flex h-11 {isOverlayMode
          ? 'w-full'
          : 'w-90'} items-center gap-2 rounded-lg border border-gray-200 bg-white px-3"
      >
        <SearchIcon />
        <input
          type="text"
          bind:value={filters.searchQuery}
          placeholder="내담자 이름을 입력해주세요"
          class="text-body-01-normal-regular w-full bg-transparent outline-none placeholder:text-placeholder"
        />
      </div>

      <!-- 대상 유형 (상담/검사) — 기본 '전체 유형' -->
      <Select
        class="bg-white rounded-lg"
        options={BILLABLE_TYPE_OPTIONS}
        selected={filters.targetType}
        showActiveHighlight={true}
        defaultValue="all"
        on:change={(e) => (filters.targetType = e.detail.value)}
      />

      <!-- 청구 일자 기간 — 리스트 화면 공통 날짜 필터 규격 -->
      <DateRangeFilter
        start={filters.dateFrom}
        end={filters.dateTo}
        onChange={filters.setDateRange}
        placeholder="청구일"
      />

      <!-- 초기화 + 정렬 -->
      <div class="flex items-center gap-3">
        <FilterResetButton
          onclick={filters.resetFilters}
          disabled={isResetDisabled}
        />

        <div class="h-9 w-px bg-gray-200"></div>
        <Select
          class="bg-white rounded-lg border-none"
          options={SORT_OPTIONS.map((o) => ({
            value: o.value,
            title: o.title
          }))}
          selected={filters.sort}
          on:change={(e) => (filters.sort = e.detail.value)}
        />
      </div>
    {/snippet}
  </FloatingFilterBar>

  <!-- 총 건수 + 뷰 토글 -->
  <div class="mb-1 flex h-11 items-center justify-between">
    <!-- 카운트 헤더는 단일 톤이 정본 — 미수금도 총 N건과 같은 위계로 8 띄워 붙인다 -->
    <div class="flex items-center gap-2">
      <!-- 단위: 미청구 탭은 청구건(원자 = 상담 회기·검사 1개) → '건',
           그 외 탭은 청구서 목록 → '개'. 같은 자리에서 뜻이 갈리지 않게 단위로 구분한다 -->
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        총 {total}{isUnbilled ? '건' : '개'}
      </Typography>
      {#if unpaidTotal > 0}
        <div class="h-3 w-px bg-gray-300"></div>
        <Typography variant="body-01-normal-medium" color="text-body-strong">
          미수금 {unpaidTotal.toLocaleString()}원
        </Typography>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      {#if !isOverlayMode}
        <ListGridToggleButton
          viewType={filters.viewType}
          onViewChange={(v) => (filters.viewType = v)}
        />
      {/if}
    </div>
  </div>
  <!-- 테이블/그리드 뷰: 그리드=본문 전체 스크롤, 리스트=기존 높이 고정 -->
  <div
    bind:this={tableAreaEl}
    class="relative flex flex-col {gridMode ? '' : 'min-h-0 flex-1'}"
  >
    {#key `${filters.viewType}:${isUnbilled}`}
      <div
        class={gridMode ? '' : 'min-h-0 flex-1'}
        in:fade={{ duration: 200, delay: 100 }}
        out:fade={{ duration: 100 }}
      >
        {#if isUnbilled}
          {#if missingQuery.isLoading}
            <div class="flex-center h-full">
              <div class="text-body-01-normal-medium text-gray-500">
                로딩 중...
              </div>
            </div>
          {:else if unbilledPaged.length === 0}
            <div class="flex-center h-full">
              <NoDataSection
                description={filters.debouncedSearchQuery
                  ? '검색 조건에 맞는 미청구건이 없어요'
                  : '미청구건이 없어요'}
              />
            </div>
          {:else}
            <div
              class="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 overflow-hidden h-full"
              style="--row-h: {rowHeightPx}px"
            >
              <Table
                containerClass="flex-1 min-h-0"
                bodyClass="flex-1 min-h-0 overflow-auto"
                columns={unbilledColumns}
                data={unbilledPaged}
                keyField="key"
                onRowClick={handleTargetBilling}
                hoverEnabled={canWrite}
                rowHeight="h-[var(--row-h)] shrink-0"
                headerClass="bg-white border-b border-gray-200"
                rowClass="border-border-default !py-0"
              />
            </div>
          {/if}
        {:else if filters.viewType === 'list'}
          {#if !listPageSizeReady || ((isLoading || isFetching) && rows.length === 0)}
            <div class="flex-center h-full">
              <div class="text-body-01-normal-medium text-gray-500">
                로딩 중...
              </div>
            </div>
          {:else if rows.length === 0}
            <div class="flex-center h-full">
              <NoDataSection description={noDataMessage} />
            </div>
          {:else}
            <div
              class="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 overflow-hidden h-full"
              style="--row-h: {rowHeightPx}px"
            >
              <Table
                containerClass="flex-1 min-h-0"
                bodyClass="flex-1 min-h-0 overflow-auto"
                {columns}
                data={rows}
                keyField="id"
                onRowClick={handleItemClick}
                hoverEnabled={true}
                rowHeight="h-[var(--row-h)] shrink-0"
                headerClass="bg-white border-b border-gray-200"
                rowClass="border-gray-100 !py-0"
              />
            </div>
          {/if}
        {:else}
          <!-- 그리드 뷰: 무한 스크롤 (내부 스크롤 없음 → 본문 전체 스크롤) -->
          {#if rows.length > 0}
            <div>
              <div
                class="grid gap-5 pb-4"
                style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));"
              >
                {#each rows as item (item.id)}
                  <BillableCard data={item} onclick={handleItemClick} />
                {/each}
              </div>
              <InfiniteScrollSentinel
                onLoadMore={loadMore}
                {hasMore}
                loading={loadingMore || gridInitialLoading}
              />
            </div>
          {:else if gridInitialLoading}
            <div class="flex-center h-full">
              <div class="text-body-01-normal-medium text-gray-500">
                로딩 중...
              </div>
            </div>
          {:else}
            <div class="flex-center h-full">
              <NoDataSection description={noDataMessage} />
            </div>
          {/if}
        {/if}
      </div>
    {/key}

    <!-- 페이지네이션: list 뷰에선 자리 항상 예약(h-20) → 데이터 도착해도 영역 높이 불변(재측정·깜빡임 방지) -->
    {#if !gridMode}
      <div class="mt-auto flex h-20 shrink-0 items-center justify-center">
        {#if isUnbilled}
          {#if unbilledFiltered.length > filters.pageSize}
            <Pagination
              totalItems={unbilledFiltered.length}
              itemsPerPage={filters.pageSize}
              bind:currentPage={filters.page}
            />
          {/if}
        {:else if rows.length > 0 && total > filters.pageSize}
          <Pagination
            totalItems={total}
            itemsPerPage={filters.pageSize}
            bind:currentPage={filters.page}
          />
        {/if}
      </div>
    {/if}
  </div>
</div>
