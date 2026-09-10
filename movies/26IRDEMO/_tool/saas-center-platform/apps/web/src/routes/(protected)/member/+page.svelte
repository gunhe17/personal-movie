<script lang="ts">
  import { getTitleIcon } from '$lib/config/title-icon'
  import { goto } from '$app/navigation'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'
  import CrownIcon from '$root/src/lib/assets/CrownIcon.svelte'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import Pagination from '$root/src/lib/components/Pagination.svelte'
  import Select from '$root/src/lib/components/Select.svelte'
  import TabBar from '$root/src/lib/components/TabBar.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import Table from '$root/src/lib/components/Table.svelte'
  import type { TableColumn } from '$root/src/lib/components/Table.svelte'
  import NoDataSection from '$root/src/lib/components/NoDataSection.svelte'
  import {
    getMemberList,
    getInvitationList,
    type InvitationSummary
  } from '$root/src/lib/hooks/actions/member.action'
  import { queryBuilder } from '$root/src/lib/hooks/queries/builder'
  import { fade } from 'svelte/transition'

  import {
    MEMBER_SORT_OPTIONS,
    MEMBER_TABS,
    MEMBER_ROLE_OPTIONS,
    MEMBER_EMPLOYMENT_OPTIONS,
    MEMBER_EMPLOYMENT_TYPE_MAP,
    useMemberFilters,
    buildMemberListInput,
    createMembersService,
    filterMembersByOptions,
    mapMembersToVM,
    paginateMembers,
    sortMembers,
    type MemberVM,
    type MemberTabType
  } from '$lib/features/members'
  import { centerId } from '$lib/stores/center.store'
  import { permissionStore } from '$lib/stores/permission.store'
  import { responsive } from '$lib/stores/responsive.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { MEMBER_PAGE_ACCESS_RULE } from '$lib/features/members/permissions'
  import ActiveToggle from '$lib/components/common/ActiveToggle.svelte'
  import ListGridToggleButton from '$lib/components/ListGridToggleButton.svelte'
  import MemberCard from '$lib/components/cards/MemberCard.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import Typography from '@common/components/Typography.svelte'
  import MemberAvatar from '$lib/components/MemberAvatar.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import { formatUtcToKst } from '$lib/utils/date'

  // 초대 만료 D-day ('D-3' | 'D-Day' | '만료' | null)
  function inviteDDay(expiresAt: string | null): string | null {
    if (!expiresAt) return null
    const target = new Date(expiresAt)
    if (isNaN(target.getTime())) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    target.setHours(0, 0, 0, 0)
    const diff = Math.round(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (diff < 0) return '만료'
    if (diff === 0) return 'D-Day'
    return `D-${diff}`
  }

  const pathname = page.url.pathname
  const queryClient = useQueryClient()
  const filters = useMemberFilters(page.url, pathname)
  const membersService = createMembersService({ queryClient })

  const isOverlayMode = $derived(!responsive.isDesktop)
  const isListView = $derived(filters.viewType === 'list')
  // 그리드(무한 스크롤) 뷰: pending 탭은 항상 테이블이므로 제외
  const isGrid = $derived(!isListView && filters.activeTab !== 'pending')

  // 리스트 테이블이 실제로 그려질 때만 박스(테두리)를 표시
  // (노데이터/로딩 상태에서는 다른 페이지처럼 박스 없이 중앙 안내만)
  const showListBox = $derived.by(() => {
    if (filters.activeTab === 'pending') return false // pending은 자식 박스가 따로 있음
    return isListView && filteredMembers.length > 0
  })

  const canDeleteMember = $derived(
    !!$permissionStore?.context?.permissions?.some(
      (p: string) => p === 'delete:member'
    )
  )

  const myMemberId = $derived($permissionStore?.context?.memberId ?? null)

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

  // 전체 구성원 쿼리
  // NOTE: enabled 사용 금지 — queryOptions는 정적 객체라 $centerId 변경에 반응 못함
  // action 내부에서 if (!params.centerId) return empty 가드가 있으므로 안전
  const membersQuery = queryBuilder(getMemberList, () =>
    buildMemberListInput($centerId!, filters.buildFilters())
  )

  // 수락 대기 초대 쿼리
  const invitationsQuery = queryBuilder(getInvitationList, () => ({
    centerId: $centerId!,
    status: 'pending'
  }))

  const isLoading = $derived(membersQuery.isLoading)
  const isFetching = $derived(membersQuery.isFetching)

  const members = $derived(mapMembersToVM(membersQuery.data?.items))

  const filteredMembers = $derived.by(() => {
    const f = filters.buildFilters()
    const filtered = filterMembersByOptions(members, f)
    const sorted = sortMembers(filtered, f.sort)
    return paginateMembers(sorted, f.page, f.pageSize)
  })

  const totalMembers = $derived.by(() => {
    const f = filters.buildFilters()
    return filterMembersByOptions(members, f).length
  })

  // 그리드 뷰: 클라이언트 페이지네이션 없이 필터+정렬된 전체를 렌더(페이지 전체 스크롤)
  const filteredMembersFull = $derived.by(() => {
    const f = filters.buildFilters()
    const filtered = filterMembersByOptions(members, f)
    return sortMembers(filtered, f.sort)
  })

  // ============ 테이블 뷰: 화면 높이에 맞춰 한 페이지 행 수 + 행 높이 자동 산정 ============
  // 내부 스크롤 없이 보이는 행 수 = 페이지당 아이템 수. 자투리는 행 높이에 흡수(모든 페이지 동일).
  // member는 클라이언트 페이지네이션(slice)이라 pageSize만 바꾸면 즉시 재슬라이스.
  // 행 80px 기준 — 이름 셀이 아바타+2줄이라 내담자 리스트와 같은 높이를 쓴다.
  // 측정 완료 전에는 로딩 표시(재슬라이스 깜빡임 방지). 페이지네이션은 표뷰에서 항상 80px 예약됨.
  let tableAreaEl: HTMLDivElement | null = $state(null)
  let rowHeightPx = $state(80)
  let listPageSizeReady = $state(false)
  const ROW_H = 80
  const TABLE_CHROME = 54 // sticky 헤더(52) + 여유(2)
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

  const allInvitations = $derived(invitationsQuery.data?.items ?? [])

  // 초대 목록 필터 + 정렬 + 페이지네이션 (클라이언트)
  const filteredInvitations = $derived.by(() => {
    const f = filters.buildFilters()
    let result = allInvitations
    if (f.role !== 'all') {
      result = result.filter((inv) => inv.role_code === f.role)
    }
    if (f.employmentType !== 'all') {
      result = result.filter((inv) => inv.employment_type === f.employmentType)
    }
    return result
  })

  const totalInvitations = $derived(filteredInvitations.length)

  const paginatedInvitations = $derived.by(() => {
    const f = filters.buildFilters()
    const sorted = [...filteredInvitations].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return f.sort === 'desc' ? dateB - dateA : dateA - dateB
    })
    const start = (f.page - 1) * f.pageSize
    return sorted.slice(start, start + f.pageSize)
  })

  function handleTabChange(tab: string) {
    if (filters.activeTab === tab) return
    filters.activeTab = tab as MemberTabType
  }

  function handleResetFilters() {
    filters.reset()
  }

  function handleResendInvite(e: Event, item: InvitationSummary) {
    e.stopPropagation()
    membersService.resendInvite(item)
  }

  const handleStatusChange = (memberId: string, status: string) =>
    membersService.changeStatus(memberId, status)

  const isResetDisabled = $derived.by(() => {
    const f = filters.buildFilters()
    return !f.search && f.role === 'all' && f.employmentType === 'all'
  })

  const allMembersColumns: TableColumn<MemberVM>[] = $derived([
    {
      key: 'name',
      label: '이름',
      // 아바타 40 + gap 12 + 이름. 남는 폭은 이메일·메모로
      width: 'minmax(140px, 1fr)',
      render: nameCell
    },
    // 나머지는 내용 폭에 맞춘 고정값으로 눌림(줄바꿈·잘림)을 막는다
    { key: 'role_name', label: '역할', width: '92px', render: roleCell },
    {
      key: 'employmentLabel',
      label: '고용형태',
      width: '92px',
      render: employmentCell
    },
    { key: 'phone', label: '연락처', width: '140px', render: phoneCell },
    {
      key: 'email',
      label: '이메일',
      width: 'minmax(150px, 1.5fr)',
      render: emailCell
    },
    {
      key: 'memo',
      label: '메모',
      width: 'minmax(120px, 1.5fr)',
      render: memoCell
    },
    {
      key: 'createdAt',
      label: '등록일',
      width: '110px',
      render: createdAtCell
    },
    {
      key: 'is_active',
      label: '상태',
      width: '72px',
      align: 'center',
      stopPropagation: true,
      render: statusCell
    },
    // 삭제 권한이 있을 때만 케밥 액션 컬럼 노출 (카드와 동일 기준)
    ...(canDeleteMember
      ? [
          {
            key: 'actions',
            label: '',
            width: '44px',
            stopPropagation: true,
            render: memberActionsCell
          } as TableColumn<MemberVM>
        ]
      : [])
  ])

  const pendingColumns: TableColumn<InvitationSummary>[] = [
    {
      key: 'name',
      label: '이름',
      width: 'minmax(140px, 1fr)',
      render: pendingNameCell
    },
    {
      key: 'role_name',
      label: '역할',
      width: '1fr',
      render: pendingRoleCell
    },
    {
      key: 'employment_type',
      label: '고용형태',
      width: '100px',
      render: pendingEmploymentCell
    },
    { key: 'email', label: '초대한 이메일', width: '2fr' },
    {
      key: 'created_at',
      label: '초대한 날짜',
      width: '150px',
      render: pendingDateCell
    },
    {
      key: 'expires_at',
      label: '만료일',
      width: '150px',
      render: pendingExpiresCell
    },
    {
      key: 'actions',
      label: '',
      width: '120px',
      align: 'right',
      render: pendingActionsCell
    }
  ]

  const TitleIcon = $derived(getTitleIcon(page.url.pathname))
</script>

{#snippet nameCell({ item }: { item: MemberVM })}
  <!-- 이름 셀 규격 = 내담자 리스트와 동일: 아바타 40 + 이름 -->
  <div class="flex min-w-0 items-center gap-3">
    <MemberAvatar
      profileImageUrl={item.profileImageUrl}
      name={item.name}
      gender={item.gender}
      sizeClass="h-10 w-10"
      textClass="text-[15px]"
    />
    <Typography
      variant="title-01-normal-semibold"
      color="text-gray-800"
      className="truncate-safe"
      tag="span"
    >
      {item.name}
    </Typography>
  </div>
{/snippet}

{#snippet roleCell({ item }: { item: MemberVM })}
  {#if item.role_code === 'ADMIN'}
    <span
      class="flex h-6 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded bg-tag-orange-bg px-2 text-label-01-normal-medium text-tag-orange-fg"
    >
      <CrownIcon />
      {item.role_name}
    </span>
  {:else if item.role_code === 'MANAGER'}
    <span
      class="flex h-6 w-fit shrink-0 items-center whitespace-nowrap rounded bg-tag-green-bg px-2 text-label-01-normal-medium text-tag-green-fg"
    >
      {item.role_name}
    </span>
  {:else}
    <span
      class="flex h-6 w-fit shrink-0 items-center whitespace-nowrap rounded bg-tag-gray-bg px-2 text-label-01-normal-medium text-tag-gray-fg"
    >
      {item.role_name}
    </span>
  {/if}
{/snippet}

{#snippet employmentCell({ item }: { item: MemberVM })}
  <Typography
    variant="body-01-normal-regular"
    color={item.employmentLabel === '-' ? 'text-gray-400' : 'text-gray-900'}
    tag="span"
  >
    {item.employmentLabel}
  </Typography>
{/snippet}

{#snippet memoCell({ item }: { item: MemberVM })}
  <Typography
    variant="body-01-normal-regular"
    color={item.memo ? 'text-gray-900' : 'text-gray-400'}
    className="block w-full truncate-safe"
    tag="span"
  >
    {item.memo || '메모가 없습니다'}
  </Typography>
{/snippet}

{#snippet createdAtCell({ item }: { item: MemberVM })}
  <Typography variant="body-01-normal-regular" color="text-gray-900" tag="span">
    {item.createdAtDate}
  </Typography>
{/snippet}

{#snippet phoneCell({ item }: { item: MemberVM })}
  <Typography
    variant="body-01-normal-regular"
    color={item.phone ? 'text-gray-900' : 'text-gray-400'}
    className="whitespace-nowrap"
    tag="span"
  >
    {item.phone || '-'}
  </Typography>
{/snippet}

{#snippet emailCell({ item }: { item: MemberVM })}
  <Typography
    variant="body-01-normal-regular"
    color={item.email ? 'text-gray-900' : 'text-gray-400'}
    className="block w-full truncate-safe"
    tag="span"
  >
    {item.email || '-'}
  </Typography>
{/snippet}

{#snippet memberActionsCell({ item }: { item: MemberVM })}
  <KebabMenu
    items={[
      {
        label: '구성원 삭제',
        onClick: () => membersService.openDeleteConfirm(item),
        variant: 'danger'
      }
    ]}
  />
{/snippet}

{#snippet statusCell({ item }: { item: MemberVM })}
  <div class="flex justify-center">
    <ActiveToggle
      active={item.is_active}
      onToggle={(next) =>
        handleStatusChange(item.id, next ? 'active' : 'inactive')}
    />
  </div>
{/snippet}

{#snippet pendingNameCell({ item }: { item: InvitationSummary })}
  <Typography variant="body-02-normal-regular" color="text-gray-800" tag="span">
    {item.name}
  </Typography>
{/snippet}

{#snippet pendingEmploymentCell({ item }: { item: InvitationSummary })}
  {@const label =
    MEMBER_EMPLOYMENT_TYPE_MAP[
      item.employment_type as keyof typeof MEMBER_EMPLOYMENT_TYPE_MAP
    ]}
  <Typography
    variant="body-02-normal-regular"
    color={label ? 'text-gray-800' : 'text-gray-400'}
    tag="span"
  >
    {label ?? '-'}
  </Typography>
{/snippet}

{#snippet pendingRoleCell({ item }: { item: InvitationSummary })}
  {#if item.role_code === 'ADMIN'}
    <span
      class="flex h-6 w-fit items-center gap-1 rounded bg-tag-orange-bg px-2 text-label-01-normal-medium text-tag-orange-fg"
    >
      <CrownIcon />
      {item.role_name}
    </span>
  {:else if item.role_code === 'MANAGER'}
    <span
      class="flex h-6 w-fit items-center rounded bg-tag-green-bg px-2 text-label-01-normal-medium text-tag-green-fg"
    >
      {item.role_name}
    </span>
  {:else}
    <span
      class="flex h-6 w-fit items-center rounded bg-tag-gray-bg px-2 text-label-01-normal-medium text-tag-gray-fg"
    >
      {item.role_name}
    </span>
  {/if}
{/snippet}

{#snippet pendingDateCell({ item }: { item: InvitationSummary })}
  <div class="flex flex-col justify-center gap-0.5">
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-800"
      tag="span"
    >
      {formatUtcToKst(item.created_at, 'YYYY-MM-DD')}
    </Typography>
    <Typography
      variant="body-03-normal-regular"
      color="text-gray-400"
      tag="span"
    >
      {formatUtcToKst(item.created_at, '(d) HH:mm')}
    </Typography>
  </div>
{/snippet}

{#snippet pendingExpiresCell({ item }: { item: InvitationSummary })}
  {@const dday = inviteDDay(item.expires_at)}
  {#if !item.expires_at}
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-400"
      tag="span"
    >
      -
    </Typography>
  {:else}
    <div class="flex flex-col justify-center gap-0.5">
      <Typography
        variant="body-02-normal-regular"
        color={dday === '만료' ? 'text-semantic-negative' : 'text-gray-800'}
        tag="span"
      >
        {formatUtcToKst(item.expires_at, 'YYYY-MM-DD')}
      </Typography>
      <span
        class="text-body-03-normal-medium {dday === '만료' || dday === 'D-Day'
          ? 'text-semantic-negative'
          : 'text-primary-500'}"
      >
        {dday}
      </span>
    </div>
  {/if}
{/snippet}

{#snippet pendingActionsCell({ item }: { item: InvitationSummary })}
  <div class="flex items-center justify-end">
    <button
      class="h-9 rounded-lg border border-gray-200 bg-white px-4 text-body-03-normal-medium text-gray-700 transition hover:bg-gray-50"
      onclick={(e) => handleResendInvite(e, item)}
    >
      재전송
    </button>
  </div>
{/snippet}

<PermissionGuard rule={MEMBER_PAGE_ACCESS_RULE} showError>
  <div
    in:fade
    class="bg-gray-50 flex flex-col {isGrid
      ? ''
      : 'xl:h-full xl:overflow-hidden'}"
  >
    <!-- 타이틀 바로 아래가 탭이면 간격 8(mb-2). 일반 콘텐츠일 때의 16보다 좁힌다 -->
    <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
      <div class="flex items-center gap-2">
        {#if TitleIcon}<TitleIcon />{/if}
        <h1 class="text-headline-01-normal-semibold text-gray-800">구성원</h1>
      </div>
      <div class="flex items-center gap-2">
        <!-- 임시 비활성화 -->
        <!-- <button
            class="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-medium text-gray-700 transition hover:bg-gray-50"
            onclick={membersService.openExcelInviteModal}
          >
            엑셀로 일괄 초대
          </button> -->
        <PageActionButton
          label="구성원 초대"
          onclick={() => membersService.openInviteModal()}
        />
      </div>
    </div>

    <!-- 탭↔필터 간격은 FloatingFilterBar의 py-4가 담당 -->
    <TabBar
      tabs={MEMBER_TABS}
      activeTab={filters.activeTab}
      onTabChange={handleTabChange}
    />

    <!-- 검색 및 필터 — 상단에 닿으면 플로팅으로 고정 -->
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
            placeholder="구성원 이름을 입력해주세요"
            class="w-full bg-transparent text-body-01-normal-regular outline-none placeholder:text-placeholder"
          />
        </div>
        <Select
          class="rounded-lg bg-white"
          options={MEMBER_ROLE_OPTIONS}
          selected={filters.role}
          showActiveHighlight={true}
          defaultValue="all"
          on:change={(e) => (filters.role = e.detail.value)}
        />
        <Select
          class="rounded-lg bg-white"
          options={MEMBER_EMPLOYMENT_OPTIONS}
          selected={filters.employmentType}
          showActiveHighlight={true}
          defaultValue="all"
          on:change={(e) => (filters.employmentType = e.detail.value)}
        />
        <!-- 초기화 + 정렬 + 뷰 토글 -->
        <div class="flex items-center gap-3">
          <FilterResetButton
            onclick={handleResetFilters}
            disabled={isResetDisabled}
          />
          <div class="h-9 w-px bg-gray-200"></div>
          <Select
            class="rounded-lg bg-white"
            options={MEMBER_SORT_OPTIONS}
            selected={filters.sortOrder}
            on:change={(e) => (filters.sortOrder = e.detail.value)}
          />
        </div>
      {/snippet}
    </FloatingFilterBar>

    <!-- 총 개수 + 뷰 토글 -->
    <div class="mb-2 flex h-11 items-center justify-between">
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        총 {filters.activeTab === 'pending' ? totalInvitations : totalMembers}명
      </Typography>
      <div class="flex items-center gap-3">
        {#if !isOverlayMode && filters.activeTab !== 'pending'}
          <ListGridToggleButton
            bind:viewType={filters.viewType}
            onViewChange={(view) => (filters.viewType = view)}
          />
        {/if}
      </div>
    </div>
    <!-- 콘텐츠: 그리드는 자연 높이(본문 전체 스크롤), 리스트/pending은 기존 높이 고정 -->
    <div class="flex flex-col {isGrid ? '' : 'flex-1 min-h-0'}">
      <div
        bind:this={tableAreaEl}
        class="flex flex-col transition-opacity duration-150 {isGrid
          ? ''
          : 'min-h-0 flex-1 grow overflow-hidden'} {showListBox
          ? 'rounded-2xl border border-gray-200 bg-white'
          : ''}"
        style:opacity={isFetching && !isLoading ? 0.6 : 1}
        style:--row-h="{rowHeightPx}px"
      >
        {#if filters.activeTab === 'pending'}
          {#if filteredInvitations.length === 0}
            <div class="flex-center xl:h-full py-12">
              <NoDataSection description="대기중인 초대가 없어요" />
            </div>
          {:else}
            <div
              class="rounded-2xl border border-gray-200 bg-white flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <Table
                columns={pendingColumns}
                data={paginatedInvitations}
                headerClass="bg-white border-b border-gray-200"
                bodyClass="flex-1 min-h-0 overflow-auto"
                hoverEnabled={true}
                rowHeight="h-[var(--row-h)] shrink-0"
                rowClass="border-gray-100 !py-0"
              />
            </div>
          {/if}
        {:else if (!isGrid && !listPageSizeReady) || ((isLoading || isFetching) && filteredMembers.length === 0)}
          <div class="flex-center xl:h-full py-12">
            <p class="text-body-01-normal-medium text-gray-500">로딩 중...</p>
          </div>
        {:else if (isGrid ? filteredMembersFull.length : filteredMembers.length) === 0}
          <div class="flex-center xl:h-full py-12">
            <NoDataSection description="검색 결과가 없어요" />
          </div>
        {:else if isListView}
          <Table
            columns={allMembersColumns}
            data={filteredMembers}
            onRowClick={(row) => goto(`/member/${row.id}`)}
            headerClass="bg-white border-b border-gray-200"
            bodyClass="flex-1 min-h-0 overflow-auto"
            hoverEnabled={true}
            rowHeight="h-[var(--row-h)] shrink-0"
            rowClass="border-gray-100 !py-0"
          />
        {:else}
          <!-- 그리드 뷰: 전체 렌더(내부 스크롤 없음) → 본문 전체 스크롤 -->
          <div
            class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 pb-4"
          >
            {#each filteredMembersFull as member (member.id)}
              <MemberCard
                {member}
                showMenu={canDeleteMember}
                isMe={member.id === myMemberId}
                onStatusChange={handleStatusChange}
                onDelete={(m) => membersService.openDeleteConfirm(m)}
                class="w-full"
              />
            {/each}
          </div>
        {/if}
      </div>
      {#if !isGrid}
        <div class="shrink-0 flex justify-center">
          <Pagination
            totalItems={filters.activeTab === 'pending'
              ? totalInvitations
              : totalMembers}
            itemsPerPage={filters.pageSize}
            bind:currentPage={filters.currentPage}
          />
        </div>
      {/if}
    </div>
  </div>
</PermissionGuard>
