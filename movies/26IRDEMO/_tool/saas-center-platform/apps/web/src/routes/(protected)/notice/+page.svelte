<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { fade } from 'svelte/transition'
  import Table from '$lib/components/Table.svelte'
  import type { TableColumn } from '$lib/components/Table.svelte'
  import PinIcon24 from '$lib/assets/PinIcon24.svelte'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import PageTitleSection from '$root/src/lib/components/PageTitleSection.svelte'
  import Pagination from '$root/src/lib/components/Pagination.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getNoticeList } from '$lib/hooks/actions/notice.action'
  import { useNoticeFilters } from '$lib/features/notice/hooks.svelte'
  import {
    mapNoticesToRows,
    type NoticeRow
  } from '$lib/features/notice/view-model'
  import {
    NOTICE_PAGE_SIZE,
    CATEGORY_FILTER_OPTIONS,
    DATE_FILTER_OPTIONS
  } from '$lib/features/notice/constants'

  const filters = useNoticeFilters($page.url)

  const listQuery = $derived(
    queryBuilder(getNoticeList, () => filters.toQueryParams())
  )

  const rows = $derived(mapNoticesToRows(listQuery.data?.items ?? []))
  const total = $derived(listQuery.data?.total ?? 0)

  // 읽음 여부·상단 고정은 값이 아니라 **행의 표시**다 — 폼 컨트롤(체크박스)로 두지 않고
  // 제목 왼쪽 고정폭 마커 칸에 모은다. 칸 폭이 항상 같아야 고정글이 섞여도 제목 시작선이 어긋나지 않는다.
  const columns: TableColumn<NoticeRow>[] = [
    {
      key: 'marker',
      // 읽음점과 압정은 같은 24 칸을 나눠 쓴다(둘이 나란히 서지 않음) — 아이콘 크기에 딱 맞춘 폭
      width: '24px',
      label: '',
      // 마커는 행의 값이 아니라 가장자리 표식 — 셀 패딩(24)을 12만큼 되돌려
      // 테이블 좌측 경계에 더 붙인다
      cellClass: '-ml-3',
      render: markerCell
    },
    { key: 'title', label: '제목', render: titleCell },
    {
      key: 'authorName',
      label: '작성자',
      width: '128px',
      render: authorCell
    },
    {
      key: 'publishedAt',
      label: '등록일',
      width: '112px',
      render: dateCell
    }
  ]

  const hasActiveFilter = $derived(
    Boolean(filters.searchInput || filters.category || filters.dateRange)
  )
  const isResetDisabled = $derived(!hasActiveFilter)
</script>

{#snippet markerCell({
  item
}: {
  item: NoticeRow
  index: number
  isChecked: boolean
})}
  <!-- 마커 칸은 하나(24) — 압정과 읽음점이 같은 자리에 겹쳐 서고, 빈 행에서도 칸은 유지된다.
       상단 고정글이 안 읽은 상태면 압정이 이긴다(읽음 여부는 제목 굵기가 이미 말해준다) -->
  <div class="flex size-6 shrink-0 items-center justify-center">
    {#if item.isPinned}
      <span role="img" aria-label="상단 고정" title="상단 고정">
        <PinIcon24 />
      </span>
    {:else if !item.isRead}
      <span
        class="size-[7px] rounded-full bg-primary-500"
        role="img"
        aria-label="읽지 않음"
      ></span>
    {/if}
  </div>
{/snippet}

{#snippet titleCell({
  item
}: {
  item: NoticeRow
  index: number
  isChecked: boolean
})}
  <div class="flex min-w-0 items-center gap-2">
    <!-- 유형은 별도 칼럼이 아니라 제목의 머리표 — 제목 앞에 붙여 한 덩어리로 읽힌다 -->
    <BadgeRectangle label={item.categoryLabel} color={item.categoryColor} />
    <!-- 읽음/안 읽음은 굵기와 색으로 가른다(메일함 관행). 고정 배지는 마커 칸으로 옮겨
         제목 시작선을 모든 행에서 같게 유지한다 -->
    <span
      class="truncate-safe {item.isRead
        ? 'text-body-01-normal-regular text-body-default'
        : 'text-body-01-normal-semibold text-body-strong'}">{item.title}</span
    >
  </div>
{/snippet}

{#snippet authorCell({
  item
}: {
  item: NoticeRow
  index: number
  isChecked: boolean
})}
  <Typography variant="body-02-normal-regular" color="text-body-default">
    {item.authorName}
  </Typography>
{/snippet}

{#snippet dateCell({
  item
}: {
  item: NoticeRow
  index: number
  isChecked: boolean
})}
  <Typography variant="body-02-normal-regular" color="text-body-default">
    {item.publishedAt}
  </Typography>
{/snippet}

<div in:fade class="h-full flex flex-col">
  <!-- 타이틀 바로 아래가 필터 바(여백 가진 행) → 간격 8(mb-2) -->
  <PageTitleSection title="공지사항" className="mb-2" />

  <!-- 검색 및 필터 — 상단에 닿으면 플로팅으로 고정.
       py-4가 타이틀↔필터·필터↔카운트 간격을 함께 담당한다 -->
  <FloatingFilterBar reserveScroll={false}>
    {#snippet children()}
      <div
        class="flex h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 focus-within:border-border-active duration-200 sm:w-90"
      >
        <SearchIcon />
        <input
          type="text"
          placeholder="검색어를 입력해주세요"
          class="w-full min-w-0 bg-transparent text-body-01-normal-regular outline-none placeholder:text-placeholder"
          value={filters.searchInput}
          oninput={filters.onSearchInput}
        />
      </div>

      <!-- 유형 필터 -->
      <Select
        class="bg-white rounded-lg"
        options={CATEGORY_FILTER_OPTIONS}
        selected={CATEGORY_FILTER_OPTIONS.find(
          (o) => o.value === filters.category
        ) ?? CATEGORY_FILTER_OPTIONS[0]}
        showActiveHighlight={true}
        defaultValue=""
        on:change={(e) => filters.setCategory(e.detail.value)}
      />

      <!-- 날짜 필터 -->
      <Select
        class="bg-white rounded-lg"
        options={DATE_FILTER_OPTIONS}
        selected={DATE_FILTER_OPTIONS.find(
          (o) => o.value === filters.dateRange
        ) ?? DATE_FILTER_OPTIONS[0]}
        showActiveHighlight={true}
        defaultValue=""
        on:change={(e) => filters.setDateRange(e.detail.value)}
      />

      <FilterResetButton
        onclick={filters.resetFilters}
        disabled={isResetDisabled}
      />
    {/snippet}
  </FloatingFilterBar>

  <!-- 총 건수 — 리스트 카운트 헤더(§반복 패턴): 높이 44 · Body_02/Medium · title-subtle(15 Medium 기본 색) · 아래 gap 4 -->
  <div class="mb-1 flex h-11 shrink-0 items-center justify-between">
    <Typography variant="body-02-normal-medium" color="text-title-subtitle">
      총 {total}건
    </Typography>
  </div>

  <!-- 테이블 -->
  {#if listQuery.isLoading}
    <div
      class="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white"
    >
      <Typography variant="body-01-normal-regular" color="text-body-default">
        로딩 중...
      </Typography>
    </div>
  {:else if rows.length === 0}
    <NoDataSection
      description={hasActiveFilter
        ? '검색 조건에 맞는 공지사항이 없어요'
        : '등록된 공지사항이 없어요'}
    />
  {:else}
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      <Table
        {columns}
        data={rows}
        hoverEnabled
        rowHeight="h-16 shrink-0"
        headerClass="bg-white border-b border-gray-200"
        bodyClass="flex-1 min-h-0 overflow-auto"
        rowClass={(item: NoticeRow) =>
          item.isPinned ? 'bg-status-info-bg/50! hover:bg-status-info-bg!' : ''}
        onRowClick={(item) => goto(`/notice/${item.id}`)}
      />
    </div>
  {/if}

  <!-- 페이지네이션 — 높이 80·가운데 정렬은 컴포넌트가 소유한다(래퍼 여백 금지) -->
  <Pagination
    totalItems={total}
    bind:currentPage={filters.currentPage}
    itemsPerPage={NOTICE_PAGE_SIZE}
  />
</div>
