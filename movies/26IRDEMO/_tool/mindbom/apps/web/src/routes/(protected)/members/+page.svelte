<script lang="ts">
  import { fade } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { auth } from '$lib/stores/auth'
  import { institutionId, requireInstitutionId } from '$lib/stores/institution.store'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import Pagination from '$components/ui/Pagination.svelte'
  import Badge from '$components/ui/Badge.svelte'
  import Select from '$components/ui/Select.svelte'
  import Icon from '$components/ui/Icon.svelte'
  import PersonAvatar from '$components/ui/PersonAvatar.svelte'
  import PageTitleSection from '$components/ui/PageTitleSection.svelte'
  import ListCountHeader from '$components/ui/ListCountHeader.svelte'
  import EmptyState from '$components/ui/EmptyState.svelte'
  import Tabs from '$components/ui/Tabs.svelte'
  import DataTable, { type DataTableColumn } from '$components/ui/DataTable.svelte'
  import MemberInviteModal from '$lib/features/members/components/MemberInviteModal.svelte'
  import PendingInvitationsTab from '$lib/features/members/components/PendingInvitationsTab.svelte'
  import { createInvitation } from '$lib/services/api/invitations'
  import { getMemberList } from '$lib/features/members/query-builders'
  import { useMemberFilters } from '$lib/features/members/hooks.svelte'
  import { filtersToApiParams } from '$lib/features/members/filters'
  import { MEMBER_ROLE_OPTIONS, MEMBER_ROLE_CONFIG } from '$lib/features/members/constants'
  import type { MemberListResponse } from '$lib/features/members/types'

  const queryClient = useQueryClient()
  const filters = useMemberFilters(page.url, '/members')

  // admin 외에는 직원 관리 접근 불가
  onMount(() => {
    if ($auth.user && $auth.user.role !== 'admin') {
      goto('/dashboard', { replaceState: true })
    }
  })

  const membersQuery = queryBuilder<MemberListResponse, MemberListResponse>(
    getMemberList,
    () => filtersToApiParams($institutionId!, filters.buildFilters()),
    () => ({ enabled: Boolean($institutionId) })
  )

  // 상단 통계 카드를 걷어내면서 집계 쿼리(role별 size=1 호출 4개)도 함께 없앴다.
  // 참조 프로젝트도 목록 화면에는 통계 카드를 두지 않는다 — 상단 정보는 "총 N명" 한 줄뿐.

  let members = $derived(membersQuery.data?.items ?? [])
  let totalPages = $derived(membersQuery.data?.pages ?? 1)
  let filteredTotal = $derived(membersQuery.data?.total ?? 0)
  let isInitialLoading = $derived(membersQuery.isLoading)

  // 열 폭은 grid-template-columns 값 — 이름/이메일은 가변, 나머지는 고정
  let memberColumns = $derived<DataTableColumn[]>([
    { key: 'name', label: '이름', width: 'minmax(160px, 1.2fr)', render: nameCell },
    { key: 'email', label: '이메일', width: 'minmax(180px, 1.5fr)' },
    { key: 'role', label: '역할', width: '120px', render: roleCell },
    { key: 'is_active', label: '상태', width: '110px', render: statusCell },
    { key: 'created_at', label: '등록일', width: '130px', render: dateCell }
  ])

  let searchInput = $state(filters.search)

  type Tab = 'members' | 'invitations'
  let activeTab = $state<Tab>('members')

  const TABS: { value: Tab; label: string }[] = [
    { value: 'members', label: '전체 직원' },
    { value: 'invitations', label: '초대 현황' }
  ]

  function openInviteModal() {
    modalStore.open({
      component: MemberInviteModal,
      props: {
        onConfirm: async (data: { name: string; email: string; role: string }) => {
          const instId = requireInstitutionId()
          try {
            await createInvitation(instId, {
              email: data.email,
              name: data.name,
              role: data.role as 'admin' | 'clinician' | 'researcher',
            })
            snackbarStore.success('초대 메일을 발송했습니다.')
            queryClient.invalidateQueries({ queryKey: ['listPendingInvitations'], exact: false })
            activeTab = 'invitations'
          } catch (err: any) {
            snackbarStore.error(err?.response?.data?.detail || '초대 발송에 실패했습니다.')
            throw err
          }
        }
      },
      options: { size: 'md' }
    })
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }
</script>

{#snippet nameCell({ item }: { item: (typeof members)[number] })}
  <div class="flex min-w-0 items-center gap-2.5">
    <!--
      구성원에는 아직 성별 데이터가 없다(DB·API·타입 모두). PersonAvatar가 이름 해시로
      일러스트를 배정하므로 사람마다 일관되게 보인다 — 실제 성별을 뜻하지 않는다.
      백엔드에 gender가 생기면 `gender={item.gender}` 한 줄만 추가하면 된다.
    -->
    <PersonAvatar name={item.name} role="counselor" size={40} />
    <span class="truncate text-body-02-normal-semibold text-gray-900">{item.name}</span>
  </div>
{/snippet}

{#snippet roleCell({ item }: { item: (typeof members)[number] })}
  {@const cfg = MEMBER_ROLE_CONFIG[item.role] ?? { label: item.role, color: 'gray' as const }}
  <Badge label={cfg.label} color={cfg.color} />
{/snippet}

{#snippet statusCell({ item }: { item: (typeof members)[number] })}
  <span
    class="inline-flex items-center gap-1.5 text-label-01-normal-semibold {item.is_active
      ? 'text-green-600'
      : 'text-gray-400'}"
  >
    <span class="h-2 w-2 rounded-full {item.is_active ? 'bg-green-500' : 'bg-gray-300'}"></span>
    {item.is_active ? '활성' : '비활성'}
  </span>
{/snippet}

{#snippet dateCell({ item }: { item: (typeof members)[number] })}
  <span class="text-body-02-normal-regular text-gray-500">{formatDate(item.created_at)}</span>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!--
  한 화면에 담는다 — 페이지 자체는 스크롤하지 않고, 목록만 내부에서 스크롤한다.
  (상위 layout의 main이 overflow-y-auto라 h-full로 그 높이를 그대로 받는다)
-->
<div in:fade class="flex h-full min-h-0 flex-col p-4 md:p-6 lg:p-8">
  <PageTitleSection title="직원 관리" description="기관 구성원을 관리합니다" class="mb-2">
    {#snippet actions()}
      <button
        onclick={openInviteModal}
        class="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
      >
        <Icon name="person_add" size="md" />
        직원 초대
      </button>
    {/snippet}
  </PageTitleSection>

  <!-- ===== 탭 ===== -->
  <Tabs
    tabs={TABS}
    selected={activeTab}
    onChange={(v) => (activeTab = v as Tab)}
    size="sm"
    fixedWidth={false}
    class="mb-4 shrink-0"
  />

  {#if activeTab === 'invitations'}
    {#if $institutionId}
      <div class="min-h-0 flex-1 overflow-y-auto">
        <PendingInvitationsTab institutionId={$institutionId} />
      </div>
    {/if}
  {:else}

  <!-- ===== 필터 바 — 모든 컨트롤 높이 44(h-11) ===== -->
  <div class="mb-4 flex shrink-0 flex-wrap items-center gap-2">
    <div
      class="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 transition-colors focus-within:border-primary-300 sm:w-75"
    >
      <Icon name="search" size="md" class="text-gray-400" />
      <input
        type="text"
        placeholder="이름 또는 이메일로 검색"
        bind:value={searchInput}
        oninput={() => filters.setSearch(searchInput)}
        class="w-full bg-transparent text-body-02-normal-regular text-gray-900 outline-none placeholder:text-gray-400"
      />
    </div>

    <Select
      options={MEMBER_ROLE_OPTIONS}
      value={filters.role}
      onChange={(v) => filters.setRole(v as string)}
      className="h-11 w-32"
      ariaLabel="역할 필터"
    />
  </div>

  <ListCountHeader total={filteredTotal} unit="명" />

  <!-- ===== 테이블 + 페이지네이션 — 목록만 내부 스크롤, 페이지는 스크롤하지 않는다 ===== -->
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      {#if isInitialLoading}
        <div class="flex min-h-60 flex-1 items-center justify-center">
          <div
            class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"
          ></div>
        </div>
      {:else}
        <DataTable
          class="flex-1"
          columns={memberColumns}
          data={members}
          onRowClick={(m) => goto(`/members/${m.id}`)}
        >
          {#snippet empty()}
            <EmptyState
              icon="group"
              title="등록된 직원이 없습니다"
              description="새 직원을 초대해보세요"
            />
          {/snippet}
        </DataTable>
      {/if}
    </div>

    <div class="shrink-0 pt-6">
      <Pagination page={filters.page} {totalPages} onPageChange={filters.setPage} />
    </div>
  </div>
  {/if}
</div>
