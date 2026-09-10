<script lang="ts">
  import { auth } from '$lib/stores/auth'
  import { ROLE_META } from '$lib/utils/permissions'
  import { modalStore } from '$lib/stores/modal'
  import Typography from '$components/Typography.svelte'
  import PageHeader from '$components/PageHeader.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Pagination from '$components/Pagination.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Select from '$components/Select.svelte'
  import Button from '$components/Button.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import AdminAccountDetailModal from '$lib/components/modal/AdminAccountDetailModal.svelte'
  import AdminAccountInviteModal from '$lib/components/modal/AdminAccountInviteModal.svelte'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getAdminAccountList,
    type AdminAccountSummary,
    type AdminRole
  } from '$hooks/actions/admin-account.action'
  import { useUrlFilters } from '$lib/utils/url-filters.svelte'
  import { formatDate } from '$lib/utils/format'
  import { fade } from 'svelte/transition'

  // ─── 필터 옵션 ───
  const ROLE_OPTIONS = [
    { value: 'all', title: '전체 역할' },
    { value: 'super_admin', title: '슈퍼관리자' },
    { value: 'admin', title: '관리자' },
    { value: 'customer_service', title: 'CS 담당자' }
  ]

  const STATUS_OPTIONS = [
    { value: 'all', title: '전체 상태' },
    { value: 'active', title: '활성' },
    { value: 'locked', title: '잠금' }
  ]

  // ─── 필터 상태 ───
  const url = useUrlFilters({
    search: '',
    role: 'all',
    status: 'all',
    page: 1
  })

  let search = $state(url.initial.search as string)
  let roleFilter = $state<AdminRole | 'all'>(url.initial.role as AdminRole | 'all')
  let statusFilter = $state<'all' | 'active' | 'locked'>(
    url.initial.status as 'all' | 'active' | 'locked'
  )
  let currentPage = $state(url.initial.page as number)
  const pageSize = 20

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

  $effect(() => {
    roleFilter
    statusFilter
    currentPage = 1
  })

  let initialized = false
  $effect(() => {
    const snapshot = { search: debouncedSearch, role: roleFilter, status: statusFilter, page: currentPage }
    if (!initialized) { initialized = true; return }
    url.sync(snapshot)
  })

  function resetFilters() {
    search = ''
    debouncedSearch = ''
    roleFilter = 'all'
    statusFilter = 'all'
    currentPage = 1
    url.reset()
  }

  // ─── 쿼리 ───
  const listQuery = $derived(
    queryBuilder<any, any>(getAdminAccountList, () => ({
      search: debouncedSearch || undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      page: currentPage,
      size: pageSize
    }))
  )

  const accounts = $derived<AdminAccountSummary[]>(listQuery.data?.items ?? [])
  const total = $derived<number>(listQuery.data?.total ?? 0)
  const isLoading = $derived(listQuery.isPending)

  const myId = $derived($auth.user?.id)

  // ─── 모달 ───
  function handleRowClick(item: AdminAccountSummary) {
    modalStore.open({
      component: AdminAccountDetailModal,
      props: { accountId: item.id },
      options: { size: 'lg' }
    })
  }

  function handleInvite() {
    modalStore.open({
      component: AdminAccountInviteModal,
      props: {},
      options: { size: 'md' }
    })
  }

  // ─── 역할 라벨 (ROLE_META 단일 소스 사용) ───
  const ROLE_LABELS = ROLE_META

  // ─── 테이블 컬럼 ───
  const columns: TableColumn<AdminAccountSummary>[] = [
    { key: 'name', label: '이름', width: '1fr', render: nameCell },
    { key: 'email', label: '이메일', width: '1.5fr', render: emailCell },
    { key: 'role', label: '역할', width: '120px', render: roleCell },
    { key: 'is_active', label: '상태', width: '100px', render: statusCell },
    { key: 'last_login_at', label: '최근 로그인', width: '130px', render: loginDateCell }
  ]
</script>

{#snippet nameCell({ item }: { item: AdminAccountSummary; index: number; isChecked: boolean })}
  <div class="flex items-center gap-2">
    <span class="text-sm text-gray-800">{item.name}</span>
    {#if item.id === myId}
      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">(나)</span>
    {/if}
  </div>
{/snippet}

{#snippet emailCell({ item }: { item: AdminAccountSummary; index: number; isChecked: boolean })}
  <span class="block truncate text-sm text-gray-600" title={item.email}>{item.email}</span>
{/snippet}

{#snippet roleCell({ item }: { item: AdminAccountSummary; index: number; isChecked: boolean })}
  {@const role = ROLE_LABELS[item.role]}
  {#if role}
    <span class="rounded-full px-2.5 py-1 text-xs font-medium {role.bg} {role.text}">
      {role.label}
    </span>
  {:else}
    <span class="text-sm text-gray-400">{item.role}</span>
  {/if}
{/snippet}

{#snippet statusCell({ item }: { item: AdminAccountSummary; index: number; isChecked: boolean })}
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

{#snippet loginDateCell({ item }: { item: AdminAccountSummary; index: number; isChecked: boolean })}
  <span class="text-sm text-gray-500">
    {item.last_login_at ? formatDate(item.last_login_at, 'YYYY-MM-DD') : '-'}
  </span>
{/snippet}

<div in:fade class="p-6">
  <PageHeader
    title="어드민 계정 관리"
    description="플랫폼 관리자 계정을 관리합니다 · 총 {total}명"
  >
    {#snippet actions()}
      <Button color="primary" content="새 계정 초대" size="md" onclick={handleInvite} />
    {/snippet}
  </PageHeader>

  <!-- 필터 바 -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div class="flex h-11 w-75 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4">
      <SearchIcon />
      <input
        type="text"
        placeholder="이름 / 이메일 검색"
        bind:value={search}
        class="w-full text-sm outline-none placeholder:text-gray-400"
      />
    </div>

    <Select
      class="h-11 w-32 rounded-lg bg-white"
      selected={roleFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (roleFilter = e.detail.value)}
      options={ROLE_OPTIONS}
    />

    <Select
      class="h-11 w-28 rounded-lg bg-white"
      selected={statusFilter}
      showActiveHighlight={true}
      defaultValue="all"
      on:change={(e) => (statusFilter = e.detail.value)}
      options={STATUS_OPTIONS}
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
      <Typography variant="body-03-normal-regular" color="text-gray-400">불러오는 중...</Typography>
    </div>
  {:else if accounts.length === 0}
    <div class="section-border py-16">
      <NoDataSection
        description={debouncedSearch ? '검색 결과가 없습니다' : '등록된 어드민 계정이 없습니다'}
      />
    </div>
  {:else}
    <div class="section-border overflow-hidden">
      <Table {columns} data={accounts} onRowClick={handleRowClick} hoverEnabled />
    </div>

    <div class="mt-4">
      <Pagination totalItems={total} itemsPerPage={pageSize} bind:currentPage />
    </div>
  {/if}
</div>
