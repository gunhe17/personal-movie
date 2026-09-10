<script lang="ts">
  import { fade } from 'svelte/transition'
  import { page } from '$app/state'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { institutionId } from '$lib/stores/institution.store'
  import { goto } from '$app/navigation'
  import { modalStore } from '$lib/stores/modal'
  import Pagination from '$components/ui/Pagination.svelte'
  import Select from '$components/ui/Select.svelte'
  import Icon from '$components/ui/Icon.svelte'
  import PersonAvatar from '$components/ui/PersonAvatar.svelte'
  import PageTitleSection from '$components/ui/PageTitleSection.svelte'
  import ListCountHeader from '$components/ui/ListCountHeader.svelte'
  import EmptyState from '$components/ui/EmptyState.svelte'
  import FilterResetButton from '$components/ui/FilterResetButton.svelte'
  import DataTable, { type DataTableColumn } from '$components/ui/DataTable.svelte'
  import ClientFormModal from '$lib/features/clients/components/ClientFormModal.svelte'
  import { useClientFilters } from '$lib/features/clients/hooks.svelte'
  import { filtersToApiParams } from '$lib/features/clients/filters'
  import { getClientList } from '$lib/features/clients/query-builders'
  import { mapClientsToVM } from '$lib/features/clients/view-model'
  import { createClientsService } from '$lib/features/clients/clients-service'
  import {
    CLIENT_STATUS_OPTIONS,
    CLIENT_GENDER_OPTIONS,
  } from '$lib/features/clients/constants'
  import type { ClientListResponse } from '$lib/features/clients/types'
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import { maskName, maskPhone } from '$lib/utils/masking'

  const queryClient = useQueryClient()
  const service = createClientsService({ queryClient })
  const filters = useClientFilters(page.url, '/clients')

  const clientsQuery = queryBuilder<ClientListResponse, ClientListResponse>(
    getClientList,
    () => filtersToApiParams($institutionId!, filters.buildFilters())
  )

  // 상단 통계 카드를 걷어내면서 집계 쿼리(size=1 호출 2개)도 함께 없앴다.
  // 참조 프로젝트도 목록 화면에는 통계 카드를 두지 않는다 — 상단 정보는 "총 N명" 한 줄뿐.

  let clients = $derived(
    clientsQuery.data ? mapClientsToVM(clientsQuery.data.items) : []
  )
  let totalPages = $derived(clientsQuery.data?.pages ?? 1)
  let filteredTotal = $derived(clientsQuery.data?.total ?? 0)
  let isInitialLoading = $derived(clientsQuery.isLoading)

  function openCreateModal() {
    modalStore.open({
      component: ClientFormModal,
      props: {
        title: '내담자 등록',
        onConfirm: service.handleCreate
      },
      options: { size: 'lg' }
    })
  }

  let searchInput = $state(filters.search)

  // hook의 reset()은 필터 모델만 비운다. 검색 input은 로컬 $state라
  // 여기서 같이 비우지 않으면 초기화 후에도 글자가 남는다.
  function resetFilters() {
    searchInput = ''
    filters.reset()
  }

  let clientColumns = $derived<DataTableColumn[]>([
    { key: 'name', label: '이름', width: 'minmax(150px, 1.2fr)', render: nameCell },
    { key: 'genderLabel', label: '성별', width: '80px' },
    { key: 'birthDate', label: '생년월일', width: '120px' },
    { key: 'age', label: '나이', width: '80px', render: ageCell },
    { key: 'phone', label: '연락처', width: 'minmax(130px, 1fr)', render: phoneCell },
    { key: 'status', label: '상태', width: '110px', render: statusCell },
    { key: 'createdAt', label: '등록일', width: '120px', render: createdCell }
  ])
</script>

{#snippet nameCell({ item }: { item: (typeof clients)[number] })}
  <div class="flex min-w-0 items-center gap-2.5">
    <PersonAvatar name={item.name} gender={item.gender} role="client" size={40} />
    <span class="truncate text-body-02-normal-semibold text-gray-900">
      {secretModeStore.enabled ? maskName(item.name) : item.name}
    </span>
  </div>
{/snippet}

{#snippet ageCell({ item }: { item: (typeof clients)[number] })}
  <span class="text-body-02-normal-regular text-gray-600">
    {item.age !== null ? `${item.age}세` : '-'}
  </span>
{/snippet}

{#snippet phoneCell({ item }: { item: (typeof clients)[number] })}
  <span class="truncate text-body-02-normal-regular text-gray-600">
    {item.phone ? (secretModeStore.enabled ? maskPhone(item.phone) : item.phone) : '-'}
  </span>
{/snippet}

{#snippet statusCell({ item }: { item: (typeof clients)[number] })}
  <span
    class="inline-flex items-center gap-1.5 text-label-01-normal-semibold {item.status === 'active'
      ? 'text-green-600'
      : 'text-gray-400'}"
  >
    <span
      class="h-2 w-2 rounded-full {item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}"
    ></span>
    {item.statusLabel}
  </span>
{/snippet}

{#snippet createdCell({ item }: { item: (typeof clients)[number] })}
  <span class="text-body-02-normal-regular text-gray-500">{item.createdAt}</span>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!--
  한 화면에 담는다 — 페이지 자체는 스크롤하지 않고, 목록만 내부에서 스크롤한다.
  (카드 뷰는 예외 — 아래 목록 블록 주석 참고)
-->
<div in:fade class="flex h-full min-h-0 flex-col p-4 md:p-6 lg:p-8">
  <PageTitleSection title="내담자" description="내담자 정보를 관리합니다">
    {#snippet actions()}
      <button
        onclick={openCreateModal}
        class="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
      >
        <Icon name="add" size="md" />
        내담자 등록
      </button>
    {/snippet}
  </PageTitleSection>

  <!-- ===== 필터 바 — 모든 컨트롤 높이 44(h-11) ===== -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 transition-colors focus-within:border-primary-300 sm:w-75"
    >
      <Icon name="search" size="md" class="text-gray-400" />
      <input
        type="text"
        placeholder="이름으로 검색"
        bind:value={searchInput}
        oninput={() => filters.setSearch(searchInput)}
        class="w-full bg-transparent text-body-02-normal-regular text-gray-900 outline-none placeholder:text-gray-400"
      />
    </div>

    <Select
      options={CLIENT_STATUS_OPTIONS}
      value={filters.status}
      onChange={(v) => filters.setStatus(v as string)}
      className="h-11 w-32"
      ariaLabel="상태 필터"
    />
    <Select
      options={CLIENT_GENDER_OPTIONS}
      value={filters.gender}
      onChange={(v) => filters.setGender(v as string)}
      className="h-11 w-32"
      ariaLabel="성별 필터"
    />

    <FilterResetButton
      onclick={resetFilters}
      disabled={!filters.hasActiveFilter}
    />
  </div>

  <ListCountHeader total={filteredTotal} unit="명" />

  <!-- 한 화면에 담는다 — 페이지는 스크롤하지 않고 목록만 내부에서 스크롤한다. -->
  <div class="flex min-h-0 flex-1 flex-col">
    {#if isInitialLoading}
      <div
        class="flex min-h-60 flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white"
      >
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"
        ></div>
      </div>
    {:else if clients.length === 0}
      <div class="flex min-h-60 flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white">
        <EmptyState
          icon="groups"
          title="등록된 내담자가 없습니다"
          description="새 내담자를 등록해보세요"
        />
      </div>
    {:else}
      <div
        class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
      >
        <DataTable
          class="flex-1"
          columns={clientColumns}
          data={clients}
          onRowClick={(c) => goto(`/clients/${c.id}`)}
        />
      </div>
    {/if}

    <div class="shrink-0 pt-6">
      <Pagination page={filters.page} {totalPages} onPageChange={filters.setPage} />
    </div>
  </div>
</div>
