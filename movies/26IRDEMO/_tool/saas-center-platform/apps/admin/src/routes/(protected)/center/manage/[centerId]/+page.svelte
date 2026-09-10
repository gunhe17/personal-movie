<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import Table, { type TableColumn } from '$components/Table.svelte'
  import Select from '$components/Select.svelte'
  import AccountDetailModal from '$lib/components/modal/AccountDetailModal.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { queryBuilder } from '$hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    getCenterDetail,
    getCenterClients,
    type CenterDetailResponse,
    type CenterMember,
    type CenterClientListResponse
  } from '$hooks/actions/center.action'
  import { fade } from 'svelte/transition'
  import MaleIcon from '$lib/assets/MaleIcon.svelte'
  import FemaleIcon from '$lib/assets/FemaleIcon.svelte'
  import { formatDate } from '$lib/utils/format'
  import { createCenterDetailService } from '$lib/features/center-detail/center-detail-service'
  import {
    CLIENT_STATUS_LABELS,
    CLIENT_STATUS_OPTIONS,
    CLIENT_STATUS_BADGE_CLASSES,
    CLIENT_PAGE_SIZE,
    MEMBER_PAGE_SIZE
  } from '$lib/features/center-detail/constants'
  import CenterAssessmentTab from './components/CenterAssessmentTab.svelte'

  // ─── 파라미터 ───
  const centerId = $derived(page.params.centerId)

  // ─── 서비스 ───
  const queryClient = useQueryClient()
  const service = createCenterDetailService({ queryClient })

  // ─── 상태 ───
  const VALID_TABS = ['overview', 'assessments', 'message-templates', 'subscription'] as const
  type TabType = typeof VALID_TABS[number]
  const initialTab = (VALID_TABS as readonly string[]).includes(page.url.searchParams.get('tab') ?? '')
    ? (page.url.searchParams.get('tab') as TabType)
    : 'overview'
  let activeTab = $state<TabType>(initialTab)
  let clientStatusFilter = $state<string>('')
  let clientPage = $state(1)
  let memberPage = $state(1)

  // ─── 쿼리 ───
  const detailQuery = $derived(
    queryBuilder<any, any>(getCenterDetail, () => ({ centerId }))
  )

  const clientsQuery = $derived(
    queryBuilder<any, any>(getCenterClients, () => ({
      centerId,
      page: clientPage,
      size: CLIENT_PAGE_SIZE,
      ...(clientStatusFilter ? { status: clientStatusFilter } : {})
    }))
  )

  const center = $derived<CenterDetailResponse | null>(detailQuery.data ?? null)
  const isLoading = $derived(detailQuery.isPending)
  const clientsData = $derived<CenterClientListResponse | null>(
    clientsQuery.data ?? null
  )

  // ─── 핸들러 ───
  function handleSuspend() {
    if (!center) return
    service.suspend(center.id, center.name)
  }

  function handleActivate() {
    if (!center) return
    service.activate(center.id, center.name)
  }

  function handleWarn() {
    if (!center) return
    service.warn(center.id, center.name)
  }

  function handleTerminate() {
    if (!center) return
    service.terminate(center.id, center.name)
  }

  function handleMemberClick(member: CenterMember) {
    modalStore.open({
      component: AccountDetailModal,
      props: { accountId: member.account_id },
      options: { size: 'lg' }
    })
  }

  function formatAddress(addr: CenterDetailResponse['address']): string {
    if (!addr) return '-'
    const parts = [addr.address, addr.detail].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : '-'
  }

  const clientColumns: TableColumn[] = [
    { key: 'code', label: '코드', width: '1fr' },
    { key: 'masked_name', label: '이름', width: '1fr' },
    { key: 'gender', label: '성별', width: '1fr' },
    { key: 'status', label: '상태', width: '1fr' },
    { key: 'created_at', label: '등록일', width: '1fr' }
  ]

  // Table 표시용 데이터 변환 (서버 페이지네이션)
  const clientTableData = $derived(
    (clientsData?.items ?? []).map((c) => ({
      ...c,
      created_at: formatDate(c.created_at)
    }))
  )
  const clientTotal = $derived(clientsData?.total ?? 0)
  const clientTotalPages = $derived(clientsData?.pages ?? 1)

  const memberTotalPages = $derived(
    Math.max(1, Math.ceil((center?.members.length ?? 0) / MEMBER_PAGE_SIZE))
  )
  const pagedMembers = $derived(
    (center?.members ?? []).slice(
      (memberPage - 1) * MEMBER_PAGE_SIZE,
      memberPage * MEMBER_PAGE_SIZE
    )
  )

  const canManage = $derived(canOperate($auth.user?.role))

  function handleClientStatusChange(e: CustomEvent) {
    const option = e.detail
    clientStatusFilter = typeof option === 'object' ? option.value : option
    clientPage = 1
  }
</script>

<div in:fade class="p-6">
  <!-- 뒤로가기 + 헤더 -->
  <div class="mb-3">
    <button
      onclick={() => goto('/center/manage')}
      class="mb-3 text-sm text-gray-500 transition-colors hover:text-gray-700"
    >
      ← 센터 목록
    </button>

    {#if isLoading}
      <Typography variant="headline-01-normal-bold" tag="h1">
        불러오는 중...
      </Typography>
    {:else if center}
      <div class="flex items-center gap-4">
        {#if center.logo_url}
          <img
            src={center.logo_url}
            alt="{center.name} 로고"
            class="h-12 w-12 rounded-lg object-contain"
          />
        {:else}
          <div
            class="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-lg font-semibold text-gray-400"
          >
            {center.name.charAt(0)}
          </div>
        {/if}
        <div class="flex items-center gap-2.5">
          <Typography variant="headline-01-normal-bold" tag="h1"
            >{center.name}</Typography
          >
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            class:bg-green-50={center.is_active}
            class:text-green-700={center.is_active}
            class:bg-red-50={!center.is_active}
            class:text-red-600={!center.is_active}
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              class:bg-green-500={center.is_active}
              class:bg-red-500={!center.is_active}
            ></span>
            {center.is_active ? '활성' : '정지'}
          </span>
        </div>
      </div>
    {/if}
  </div>

  {#if center}
    <!-- 탭 -->
    <div class="mb-4 flex gap-1 border-b border-gray-200">
      <button
        onclick={() => (activeTab = 'overview')}
        class="relative px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'overview'
          ? 'text-primary-600'
          : 'text-gray-500 hover:text-gray-700'}"
      >
        개요
        {#if activeTab === 'overview'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"></span>
        {/if}
      </button>
      <button
        onclick={() => (activeTab = 'assessments')}
        class="relative px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'assessments'
          ? 'text-primary-600'
          : 'text-gray-500 hover:text-gray-700'}"
      >
        검사 관리
        {#if activeTab === 'assessments'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"></span>
        {/if}
      </button>
      <button
        onclick={() => (activeTab = 'message-templates')}
        class="relative px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'message-templates'
          ? 'text-primary-600'
          : 'text-gray-500 hover:text-gray-700'}"
      >
        문자 양식
        {#if activeTab === 'message-templates'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"></span>
        {/if}
      </button>
      <button
        onclick={() => (activeTab = 'subscription')}
        class="relative px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'subscription'
          ? 'text-primary-600'
          : 'text-gray-500 hover:text-gray-700'}"
      >
        구독
        {#if activeTab === 'subscription'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"></span>
        {/if}
      </button>
    </div>

    {#if activeTab === 'overview'}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- 기본 정보 -->
      <div class="section-border p-6">
        <div class="mb-4 flex items-center justify-between">
          <Typography variant="title-01-normal-semibold" tag="h2"
            >기본 정보</Typography
          >
          {#if canManage}
            <div class="flex items-center gap-2">
              {#if center.is_active}
                <Button
                  size="sm"
                  color="light-red"
                  content="경고"
                  onclick={handleWarn}
                />
                <Button
                  size="sm"
                  color="stroke-delete"
                  content="센터 정지"
                  onclick={handleSuspend}
                />
              {:else}
                <Button
                  size="sm"
                  color="stroke-primary"
                  content="센터 활성화"
                  onclick={handleActivate}
                />
              {/if}
              <Button
                size="sm"
                color="stroke-delete"
                content="센터 해지"
                onclick={handleTerminate}
              />
            </div>
          {/if}
        </div>

        <dl class="space-y-3">
          <div class="flex">
            <dt class="w-32 shrink-0 text-sm text-gray-500">대표자</dt>
            <dd class="text-sm text-gray-900">
              {center.representative_name ?? '-'}
            </dd>
          </div>
          <div class="flex">
            <dt class="w-32 shrink-0 text-sm text-gray-500">연락처</dt>
            <dd class="text-sm text-gray-900">{center.phone ?? '-'}</dd>
          </div>
          <div class="flex">
            <dt class="w-32 shrink-0 text-sm text-gray-500">주소</dt>
            <dd class="text-sm text-gray-900">
              {formatAddress(center.address)}
            </dd>
          </div>
          <div class="flex">
            <dt class="w-32 shrink-0 text-sm text-gray-500">사업자번호</dt>
            <dd class="text-sm text-gray-900">
              {center.business_registration_number ?? '-'}
            </dd>
          </div>
          <div class="flex">
            <dt class="w-32 shrink-0 text-sm text-gray-500">가입일</dt>
            <dd class="text-sm text-gray-900">
              {formatDate(center.created_at)}
            </dd>
          </div>
        </dl>
      </div>

      <!-- 멤버 목록 -->
      <div class="section-border p-6">
        <Typography
          variant="title-01-normal-semibold"
          tag="h2"
          className="mb-4"
        >
          멤버 ({center.members.length}명)
        </Typography>

        {#if center.members.length === 0}
          <NoDataSection description="등록된 멤버가 없습니다" />
        {:else}
          <div class="space-y-1">
            {#each pagedMembers as member (member.id)}
              <button
                onclick={() => handleMemberClick(member)}
                class="flex w-full items-center justify-between rounded-lg border border-gray-100 px-3.5 py-2 text-left transition-colors hover:bg-gray-50"
              >
                <div>
                  <Typography variant="body-03-normal-medium" tag="span"
                    >{member.name}</Typography
                  >
                  <Typography
                    variant="label-02-normal-regular"
                    tag="p"
                    color="text-gray-400">{member.email}</Typography
                  >
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                  >
                    {member.role_name}
                  </span>
                  <span
                    class="h-2 w-2 rounded-full"
                    class:bg-green-500={member.status === 'active'}
                    class:bg-gray-300={member.status !== 'active'}
                  ></span>
                </div>
              </button>
            {/each}
          </div>

          {#if memberTotalPages > 1}
            <div
              class="flex items-center justify-center gap-1 border-t border-gray-100 mt-4 pt-3"
            >
              <button
                onclick={() => (memberPage = Math.max(1, memberPage - 1))}
                disabled={memberPage <= 1}
                class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                이전
              </button>
              <span class="px-2 text-xs text-gray-500">
                {memberPage} / {memberTotalPages}
              </span>
              <button
                onclick={() =>
                  (memberPage = Math.min(memberTotalPages, memberPage + 1))}
                disabled={memberPage >= memberTotalPages}
                class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                다음
              </button>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <!-- 내담자 목록 -->
    <div class="mt-4 section-border p-6">
      <div class="mb-4 flex items-center justify-between">
        <Typography variant="title-01-normal-semibold" tag="h2">
          내담자
          {#if clientsData?.stats}
            <span class="ml-1 text-sm font-normal text-gray-400">
              총 {clientsData.stats.total}명 (활성 {clientsData.stats.active} · 비활성
              {clientsData.stats.inactive})
            </span>
          {/if}
        </Typography>

        <Select
          options={CLIENT_STATUS_OPTIONS}
          selected={clientStatusFilter}
          placeholder="전체"
          showActiveHighlight={true}
          defaultValue=""
          class="h-9 w-28 rounded-lg"
          on:change={handleClientStatusChange}
        />
      </div>

      {#if clientsQuery.isPending}
        <div class="flex items-center justify-center py-16">
          <Typography variant="body-03-normal-regular" color="text-gray-400">
            불러오는 중...
          </Typography>
        </div>
      {:else if !clientsData?.items?.length}
        <NoDataSection description="등록된 내담자가 없습니다" />
      {:else}
        {#snippet codeCell({ item }: { item: any })}
          <span
            class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600"
          >
            {item.code}
          </span>
        {/snippet}

        {#snippet genderCell({ item }: { item: any })}
          <span class="inline-flex items-center gap-1">
            {#if item.gender === 'male'}
              <MaleIcon /><span class="text-sm text-blue-600">남</span>
            {:else if item.gender === 'female'}
              <FemaleIcon /><span class="text-sm text-pink-500">여</span>
            {:else}
              <span class="text-sm text-gray-400">-</span>
            {/if}
          </span>
        {/snippet}

        {#snippet statusCell({ item }: { item: any })}
          <span
            class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {CLIENT_STATUS_BADGE_CLASSES[
              item.status
            ] ?? 'bg-gray-100 text-gray-500'}"
          >
            {CLIENT_STATUS_LABELS[item.status] ?? item.status}
          </span>
        {/snippet}

        <div class="overflow-hidden rounded-lg border border-gray-100">
          <Table
            columns={[
              { ...clientColumns[0], render: codeCell },
              clientColumns[1],
              { ...clientColumns[2], render: genderCell },
              { ...clientColumns[3], render: statusCell },
              clientColumns[4]
            ]}
            data={clientTableData}
            rowClass="!min-h-14 !py-2"
            headerClass="!h-11"
          />
        </div>

        <!-- 페이지네이션 -->
        {#if clientTotalPages > 1}
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-gray-400">
              {clientTotal}명 중 {(clientPage - 1) * CLIENT_PAGE_SIZE +
                1}-{Math.min(clientPage * CLIENT_PAGE_SIZE, clientTotal)}
            </span>
            <div class="flex items-center gap-1">
              <button
                onclick={() => (clientPage = Math.max(1, clientPage - 1))}
                disabled={clientPage === 1}
                class="flex h-8 w-8 items-center justify-center rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ‹
              </button>
              {#each Array.from({ length: clientTotalPages }, (_, i) => i + 1) as p}
                <button
                  onclick={() => (clientPage = p)}
                  class="flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors {clientPage ===
                  p
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-500 hover:bg-gray-100'}"
                >
                  {p}
                </button>
              {/each}
              <button
                onclick={() =>
                  (clientPage = Math.min(clientTotalPages, clientPage + 1))}
                disabled={clientPage === clientTotalPages}
                class="flex h-8 w-8 items-center justify-center rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ›
              </button>
            </div>
          </div>
        {/if}
      {/if}
    </div>
    {:else if activeTab === 'assessments'}
      <CenterAssessmentTab centerId={centerId!} />
    {:else if activeTab === 'message-templates'}
      {#await import('./components/CenterMessageTemplateTab.svelte') then { default: CenterMessageTemplateTab }}
        <CenterMessageTemplateTab centerId={centerId!} />
      {/await}
    {:else if activeTab === 'subscription'}
      {#await import('./components/CenterSubscriptionTab.svelte') then { default: CenterSubscriptionTab }}
        <CenterSubscriptionTab centerId={centerId!} />
      {/await}
    {/if}
  {/if}
</div>
