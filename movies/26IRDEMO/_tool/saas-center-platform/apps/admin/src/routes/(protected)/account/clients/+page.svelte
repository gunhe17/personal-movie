<script lang="ts">
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Pagination from '$components/Pagination.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import CertifiedExpertBadge from '$lib/components/CertifiedExpertBadge.svelte'
  import { goto } from '$app/navigation'
  import { formatDate } from '$lib/utils/format'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getAccountList,
    type AccountSummary,
    type AccountProvider
  } from '$hooks/actions/account.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { fade } from 'svelte/transition'

  // ─── 필터 옵션 ───
  const STATUS_OPTIONS = [
    { value: 'all', title: '전체 상태' },
    { value: 'active', title: '활성' },
    { value: 'inactive', title: '잠금' }
  ]

  const PROVIDER_OPTIONS = [
    { value: 'all', title: '전체 가입 방식' },
    { value: 'email', title: '이메일' },
    { value: 'kakao', title: '카카오' },
    { value: 'naver', title: '네이버' },
    { value: 'google', title: '구글' }
  ]

  const CREDENTIALS_OPTIONS = [
    { value: 'all', title: '전체 자격 상태' },
    { value: 'pending', title: '검증 대기 있음' }
  ]

  // ─── 필터 상태 (URL 동기화) ───
  const url = useUrlFilters({
    search: '',
    status: 'all',
    provider: 'all',
    credentials: 'all',
    page: 1
  })

  let search = $state(url.initial.search as string)
  let activeFilter = $state<'all' | 'active' | 'inactive'>(
    url.initial.status as 'all' | 'active' | 'inactive'
  )
  let providerFilter = $state<AccountProvider | 'all'>(
    url.initial.provider as AccountProvider | 'all'
  )
  let credentialsFilter = $state<'all' | 'pending'>(
    url.initial.credentials as 'all' | 'pending'
  )
  let currentPage = $state(url.initial.page as number)
  const pageSize = 10

  // ─── 검색 디바운스 ───
  let debouncedSearch = $state(url.initial.search as string)
  let searchTimeout: ReturnType<typeof setTimeout>

  $effect(() => {
    clearTimeout(searchTimeout)
    const q = search
    searchTimeout = setTimeout(() => {
      debouncedSearch = q
      currentPage = 1
    }, 300)
  })

  // 필터 변경 시 페이지 리셋
  $effect(() => {
    activeFilter
    providerFilter
    credentialsFilter
    currentPage = 1
  })

  // 모든 필터 변경 → URL 동기화
  let initialized = false
  $effect(() => {
    const snapshot = {
      search: debouncedSearch,
      status: activeFilter,
      provider: providerFilter,
      credentials: credentialsFilter,
      page: currentPage
    }
    if (!initialized) {
      initialized = true
      return
    }
    url.sync(snapshot)
  })

  function resetFilters() {
    search = ''
    debouncedSearch = ''
    activeFilter = 'all'
    providerFilter = 'all'
    credentialsFilter = 'all'
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const accountsQuery = $derived(
    queryBuilder<any, any>(getAccountList, () => ({
      search: debouncedSearch || undefined,
      is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
      provider: providerFilter !== 'all' ? providerFilter : undefined,
      has_pending_credentials: credentialsFilter === 'pending' ? true : undefined,
      page: currentPage,
      size: pageSize
    }))
  )

  const accounts = $derived<AccountSummary[]>(accountsQuery.data?.items ?? [])
  const total = $derived<number>(accountsQuery.data?.total ?? 0)
  const isLoading = $derived(accountsQuery.isPending)

  function handleRowClick(item: AccountSummary) {
    goto(`/account/clients/${item.id}`)
  }

  const providerLabel: Record<string, string> = {
    email: '이메일',
    kakao: '카카오',
    naver: '네이버',
    google: '구글'
  }

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<AccountSummary>[] = [
    { key: 'email', label: '이메일', width: '0.8fr', render: emailCell },
    { key: 'name', label: '이름', width: '0.8fr', render: nameCell },
    {
      key: 'provider',
      label: '가입 방식',
      width: '100px',
      render: providerCell
    },
    { key: 'centers', label: '소속 센터', width: '1fr', render: centersCell },
    {
      key: 'credentials',
      label: '자격 인증',
      width: '120px',
      render: credentialsCell
    },
    { key: 'is_active', label: '상태', width: '100px', render: statusCell },
    {
      key: 'last_login_at',
      label: '최근 로그인',
      width: '120px',
      render: loginDateCell
    }
  ]
</script>

{#snippet emailCell({ item }: { item: AccountSummary; index: number; isChecked: boolean })}
  <span class="block truncate text-sm text-gray-600" title={item.email}>{item.email}</span>
{/snippet}

{#snippet nameCell({
  item
}: {
  item: AccountSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-800">{item.name ?? '-'}</span>
{/snippet}

{#snippet providerCell({
  item
}: {
  item: AccountSummary
  index: number
  isChecked: boolean
})}
  <span
    class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
  >
    {providerLabel[item.provider] ?? item.provider}
  </span>
{/snippet}

{#snippet centersCell({
  item
}: {
  item: AccountSummary
  index: number
  isChecked: boolean
})}
  {#if item.centers.length > 0}
    <div class="flex flex-wrap gap-1">
      {#each item.centers.slice(0, 2) as c}
        <span class="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
          {c.center_name}
          {#if c.role_name}
            <span class="text-blue-400 mx-0.5"> - </span>
            <span class="text-blue-400">{c.role_name}</span>
          {/if}
        </span>
      {/each}
      {#if item.centers.length > 2}
        <span class="text-xs text-gray-400">
          외 {item.centers.length - 2}개
        </span>
      {/if}
    </div>
  {:else}
    <span class="text-body-02-regular text-gray-400">-</span>
  {/if}
{/snippet}

{#snippet credentialsCell({
  item
}: {
  item: AccountSummary
  index: number
  isChecked: boolean
})}
  {@const stats = item.credentials}
  {#if !stats || stats.total === 0}
    <span class="text-body-02-regular text-gray-400">-</span>
  {:else if stats.is_certified}
    <CertifiedExpertBadge size="sm" />
  {:else}
    <div class="flex items-center gap-1.5 text-xs">
      {#if stats.verified > 0}
        <span class="inline-flex items-center gap-0.5 text-emerald-600">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          {stats.verified}
        </span>
      {/if}
      {#if stats.pending > 0}
        <span class="inline-flex items-center gap-0.5 text-yellow-700 font-medium">
          <span class="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>
          {stats.pending}
        </span>
      {/if}
      {#if stats.rejected > 0}
        <span class="inline-flex items-center gap-0.5 text-red-500">
          <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
          {stats.rejected}
        </span>
      {/if}
      <span class="text-gray-400">/ {stats.total}</span>
    </div>
  {/if}
{/snippet}

{#snippet statusCell({
  item
}: {
  item: AccountSummary
  index: number
  isChecked: boolean
})}
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    class:bg-green-50={item.is_active}
    class:text-green-700={item.is_active}
    class:bg-red-50={!item.is_active}
    class:text-red-600={!item.is_active}
  >
    <span
      class="h-1.5 w-1.5 rounded-full"
      class:bg-green-500={item.is_active}
      class:bg-red-500={!item.is_active}
    ></span>
    {item.is_active ? '활성' : '잠금'}
  </span>
{/snippet}

{#snippet loginDateCell({
  item
}: {
  item: AccountSummary
  index: number
  isChecked: boolean
})}
  <span class="text-body-02-regular text-gray-500"
    >{formatDate(item.last_login_at, 'YYYY-MM-DD HH:mm')}</span
  >
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="계정 관리"
    description="전체 사용자 계정을 관리합니다 · 총 {total}개"
  />

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 h-11"
    >
      <SearchIcon />
      <input
        type="text"
        placeholder="이메일 / 이름 검색"
        bind:value={search}
        class="w-full text-sm placeholder:text-gray-400 outline-none"
      />
    </div>

    <Select
      class="h-11 w-28 bg-white rounded-lg"
      selected={activeFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (activeFilter = e.detail.value)}
      options={STATUS_OPTIONS}
    />

    <Select
      class="h-11 w-36 bg-white rounded-lg"
      selected={providerFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (providerFilter = e.detail.value)}
      options={PROVIDER_OPTIONS}
    />

    <Select
      class="h-11 w-40 bg-white rounded-lg"
      selected={credentialsFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (credentialsFilter = e.detail.value)}
      options={CREDENTIALS_OPTIONS}
    />

    <button
      class="group flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      onclick={resetFilters}
      aria-label="필터 초기화"
    >
      <RefreshIcon />
    </button>
  </div>

  <!-- 테이블 -->
  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400"
        >불러오는 중...</Typography
      >
    </div>
  {:else if accounts.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch
          ? '검색 결과가 없습니다'
          : '등록된 계정이 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table
        {columns}
        data={accounts}
        onRowClick={handleRowClick}
        hoverEnabled
      />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
