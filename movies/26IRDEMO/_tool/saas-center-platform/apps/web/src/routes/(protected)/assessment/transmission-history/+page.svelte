<script lang="ts">
  import { fade } from 'svelte/transition'
  import { page } from '$app/state'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import type { PaginationRes } from '$lib/types/apiResponse'

  import Select from '$lib/components/Select.svelte'
  import Calendar from '$lib/components/Calendar.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import Pagination from '$lib/components/Pagination.svelte'
  import Typography from '@common/components/Typography.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import Button from '$lib/components/Button.svelte'
  import Table from '$lib/components/Table.svelte'
  import CalendarIcon from '$lib/assets/CalendarIcon.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'

  import {
    getTransmissionHistory,
    type TransmissionData
  } from '$lib/hooks/actions/transmission.action'
  import {
    sortOptions,
    pageSizeOptions,
    type TabType
  } from '$lib/features/assessment/transmission-history/constants'
  import { useTransmissionFilters } from '$lib/features/assessment/transmission-history/hooks.svelte'
  import { buildTransmissionQueryInput } from '$lib/features/assessment/transmission-history/query-builders'
  import {
    mapToTransmissionVMList,
    type TransmissionVM
  } from '$lib/features/assessment/transmission-history/view-model'
  import { createTransmissionService } from '$lib/features/assessment/transmission-history/transmission-service'
  import { centerId } from '$lib/stores/center.store'

  const pathname = page.url.pathname
  const filters = useTransmissionFilters(page.url, pathname)
  const queryClient = useQueryClient()
  const transmissionService = createTransmissionService({
    centerId: $centerId!,
    queryClient
  })

  // 쿼리
  const transmissionsQuery = queryBuilder<
    TransmissionData,
    PaginationRes<TransmissionData>
  >(getTransmissionHistory, () =>
    buildTransmissionQueryInput(filters.buildFilters(), $centerId!)
  )

  // 파생 상태
  const transmissions = $derived(transmissionsQuery.data?.data ?? [])
  const pagination = $derived(transmissionsQuery.data?.pagination)
  const isLoading = $derived(transmissionsQuery.isLoading)

  // ViewModel 변환
  const tableData: TransmissionVM[] = $derived(
    mapToTransmissionVMList(transmissions)
  )

  // 탭 정의
  const tabs = $derived([
    { value: 'direct-link', label: '바로 링크' },
    { value: 'test-result', label: '검사 결과' }
  ])

  // 날짜 필터 상태
  let isDateFilterOpen: boolean = $state(false)

  const filterDateLabel = $derived.by(() => {
    if (filters.sendDate) {
      return filters.sendDate.replace(/-/g, '.')
    }
    return '전송일'
  })
  const hasDateFilter = $derived.by(() => !!filters.sendDate)
  const filterDateObj = $derived.by((): Date | null =>
    filters.sendDate ? new Date(filters.sendDate) : null
  )

  // UI 핸들러
  function toggleDateFilter() {
    isDateFilterOpen = !isDateFilterOpen
  }

  function handleDateSelect(date: Date) {
    filters.sendDate = date.toISOString().split('T')[0]
    isDateFilterOpen = false
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement
    // Calendar 내부 클릭 시 닫히지 않도록 처리
    if (!target.closest('.date-filter-container')) {
      isDateFilterOpen = false
    }
  }

  function handleTabChange(tab: string) {
    if (filters.activeTab === tab) return
    filters.changeTab(tab as TabType)
  }

  function handleRefresh() {
    filters.resetFilters()
  }

  async function handleResend(item: TransmissionVM) {
    await transmissionService.handleResend(item.id)
  }

  const isResetDisabled = $derived.by(() => {
    const f = filters.buildFilters()
    return !f.search && !f.sendDate
  })
</script>

<!-- 테이블 셀 렌더 스니펫 -->
{#snippet sentAtCell({ item }: { item: TransmissionVM })}
  <Typography variant="body-01-medium" color="text-gray-800">
    {item.sentAt}
  </Typography>
{/snippet}

{#snippet methodCell({ item }: { item: TransmissionVM })}
  <Typography variant="body-01-medium" color="text-gray-00">
    {item.methodLabel}
  </Typography>
{/snippet}

{#snippet clientCell({ item }: { item: TransmissionVM })}
  <div class="flex flex-col gap-2 min-w-0">
    <div class="flex items-center gap-1 min-w-0">
      <Typography
        variant="body-01-medium"
        color="text-gray-900"
        tag="span"
        className="truncate-safe min-w-0">{item.clientName}</Typography
      >
      <Typography
        variant="body-01-medium"
        color="text-gray-700"
        tag="span"
        className="shrink-0 whitespace-nowrap">({item.clientCode})</Typography
      >
    </div>
    <div class="flex items-center gap-1 whitespace-nowrap">
      <Typography
        variant="body-02-normal-medium"
        color="text-gray-500"
        tag="span">{item.clientBirthDate}</Typography
      >
      <Typography
        variant="body-02-normal-medium"
        color="text-gray-500"
        tag="span">{item.clientAge}</Typography
      >
      <svg class="w-3 h-3 text-red-400" viewBox="0 0 12 12" fill="currentColor">
        <path
          d="M6 0C3.79 0 2 1.79 2 4c0 3 4 7 4 7s4-4 4-7c0-2.21-1.79-4-4-4zm0 5.5c-.83 0-1.5-.67-1.5-1.5S5.17 2.5 6 2.5s1.5.67 1.5 1.5S6.83 5.5 6 5.5z"
        />
      </svg>
    </div>
  </div>
{/snippet}

{#snippet recipientCell({ item }: { item: TransmissionVM })}
  <div class="flex items-center gap-1.5 overflow-hidden">
    <span
      class="px-1.5 py-0.5 bg-gray-100 rounded text-label-02-normal-medium text-gray-500"
    >
      {item.recipientRelation}
    </span>
    <span class="text-body-02-normal-regular text-gray-700 truncate-safe"
      >{item.recipientName}</span
    >
    <span class="text-body-02-normal-regular text-gray-500 shrink-0"
      >{item.recipientPhone}</span
    >
  </div>
{/snippet}

{#snippet assessmentCell({ item }: { item: TransmissionVM })}
  <Typography
    variant="body-02-regular"
    color="text-gray-700"
    className="truncate-safe"
  >
    {item.assessmentName}
  </Typography>
{/snippet}

{#snippet statusCell({ item }: { item: TransmissionVM })}
  <span class="text-body-02-normal-regular {item.statusColor}">
    {item.statusLabel}
  </span>
{/snippet}

{#snippet actionCell({ item }: { item: TransmissionVM })}
  {#if item.canResend}
    <Button
      variant="outline"
      size="sm"
      class="h-10 w-[76px] flex justify-center items-center rounded-lg bg-white border border-primary-300 text-primary-500 hover:bg-primary-50"
      onclick={() => handleResend(item)}
    >
      <span class="text-body-03-normal-medium text-primary-500">재전송</span>
    </Button>
  {/if}
{/snippet}

<svelte:window onclick={handleClickOutside} />

<div in:fade class="mx-auto bg-gray-50 flex h-full flex-col">
  <!-- 헤더 -->
  <!-- 타이틀 바로 아래가 여백 가진 행(탭·카운트·필터)이면 간격 8. 면 컨테이너면 16 -->
  <div class="flex h-11 shrink-0 items-center justify-between mb-2">
    <h1 class="text-headline-01-normal-semibold text-gray-800">전송 내역</h1>
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

    <!-- 날짜 필터 -->
    <div class="date-filter-container relative">
      <button
        onclick={toggleDateFilter}
        class="flex h-11 items-center gap-2 rounded-lg border bg-white px-4 transition-colors {hasDateFilter
          ? 'border-border-active'
          : 'border-gray-200 hover:bg-gray-50'}"
      >
        <span
          class="text-body-02-normal-regular max-w-40 truncate-safe {hasDateFilter
            ? 'text-primary-600'
            : 'text-gray-700'}"
        >
          {filterDateLabel}
        </span>
        <CalendarIcon />
      </button>

      <!-- 날짜 선택 드롭다운 -->
      {#if isDateFilterOpen}
        <div
          class="absolute top-full left-0 z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="dialog"
        >
          <Calendar
            selectedDate={filterDateObj}
            onDateSelect={handleDateSelect}
          />
        </div>
      {/if}
    </div>

    <!-- 초기화 버튼 -->
    <FilterResetButton onclick={handleRefresh} disabled={isResetDisabled} />
  </div>

  <!-- 탭 영역 -->
  <TabBar {tabs} activeTab={filters.activeTab} onTabChange={handleTabChange} />

  <!-- 총 개수 및 정렬 -->
  <div class="my-2.5 flex items-center justify-between">
    <div>
      <Typography
        variant="body-01-semibold"
        color="text-gray-500"
        className="flex items-center gap-1"
      >
        총 <Typography variant="body-01-semibold" color="text-primary-400"
          >{pagination?.total ?? 0}건</Typography
        >
      </Typography>
    </div>

    <!-- 정렬 드롭다운 -->
    <div class="flex items-center gap-3">
      <Select
        class="w-[110px] rounded-lg border border-gray-200 bg-white"
        options={sortOptions}
        selected={filters.sortOrder}
        on:change={(e) => (filters.sortOrder = e.detail.value)}
      />
    </div>
  </div>

  <!-- 테이블 영역 -->
  <div class="flex-1 min-h-0 overflow-hidden">
    {#if isLoading}
      <div
        class="flex h-full items-center justify-center bg-white rounded-2xl border border-gray-200"
      >
        <Typography variant="body-01-regular" color="text-gray-400">
          로딩 중...
        </Typography>
      </div>
    {:else if tableData.length === 0}
      <div class="h-full bg-white rounded-2xl border border-gray-200">
        <NoDataSection description="전송 내역이 없습니다." />
      </div>
    {:else}
      {#key filters.activeTab}
        <div class="h-full rounded-2xl border border-gray-200 overflow-hidden">
          <Table
            columns={[
              {
                key: 'sentAt',
                label: '전송 일시',
                width: '160px',
                render: sentAtCell
              },
              {
                key: 'method',
                label: '전송 방식',
                width: '100px',
                render: methodCell
              },
              {
                key: 'client',
                label: '내담자',
                width: '200px',
                render: clientCell
              },
              {
                key: 'recipient',
                label: '수신인',
                width: '220px',
                render: recipientCell
              },
              {
                key: 'assessment',
                label: '검사명',
                width: '1fr',
                render: assessmentCell
              },
              {
                key: 'status',
                label: '상태',
                width: '100px',
                render: statusCell
              },
              {
                key: 'action',
                label: '',
                width: '80px',
                stopPropagation: true,
                render: actionCell
              }
            ]}
            data={tableData}
            keyField="id"
            showCheckbox={true}
            containerClass="h-full"
            headerClass="bg-white border-b border-gray-200"
            bodyClass="flex-1 bg-white"
            rowClass="border-gray-100"
          />
        </div>
      {/key}
    {/if}
  </div>

  <!-- 페이지네이션 -->
  {#if pagination && (pagination.total ?? 0) > filters.pageSize}
    <div class="mt-4 flex items-center justify-center gap-4">
      <Pagination
        bind:currentPage={filters.page}
        totalItems={pagination.total ?? 0}
        itemsPerPage={filters.pageSize}
      />
      <Select
        class="rounded-lg border border-gray-200 bg-white"
        options={pageSizeOptions}
        selected={String(filters.pageSize)}
        on:change={(e) => filters.setPageSize(Number(e.detail.value))}
      />
    </div>
  {/if}
</div>
