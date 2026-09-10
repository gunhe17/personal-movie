<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import {
    getCenterRoles,
    getAllPermissions,
    getRoleMembers,
    getRolePermissions
  } from '$lib/hooks/actions/role.action'
  import { getMemberList } from '$lib/hooks/actions/member.action'
  import {
    buildRolesQueryInput,
    buildRolePermissionsQueryInput,
    buildAuthorizationVM,
    groupCategories,
    createAuthorizationService,
    useAuthorizationState,
    getRoleDisplayName,
    getRoleDisplayCount,
    getGroupDisplayLabel,
    getCategoryDisplayLabel,
    formatMemberDate,
    ROLE_CODES,
    CATEGORY_GROUPS,
    AUTHORIZATION_PERMISSIONS,
    type AssignableMember,
    type MemberRowVM,
    type AuthGroupVM
  } from '$lib/features/authorization'

  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'

  import Button from '$lib/components/Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import TabBar from '$root/src/lib/components/TabBar.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import { permissionStore } from '$lib/stores/permission.store'
  import { permissionEngine } from '$lib/utils/permission-engine'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import PageTitleSection from '$root/src/lib/components/PageTitleSection.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'

  const queryClient = useQueryClient()
  const service = createAuthorizationService({ queryClient })
  const authState = useAuthorizationState()

  let groups = $state<AuthGroupVM[]>([])
  let activeTab = $state<'permissions' | 'members'>('permissions')
  let memberSearchQuery = $state('')
  let roleMenuOpen = $state(false)

  function handleRoleMenuClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement
    if (
      !target.closest('.role-menu-container') &&
      !target.closest('.role-dropdown-menu')
    ) {
      roleMenuOpen = false
    }
  }

  $effect(() => {
    if (roleMenuOpen) {
      document.addEventListener('click', handleRoleMenuClickOutside, true)
      return () => {
        document.removeEventListener('click', handleRoleMenuClickOutside, true)
      }
    }
  })

  const currentMemberId = $derived($permissionStore.context?.memberId ?? null)
  const isAdmin = $derived($permissionStore.context?.role === 'super_admin')

  const isCurrentUserInSelectedRole = $derived.by(() => {
    if (!currentMemberId) return false
    return memberRows.some((m) => m.id === currentMemberId)
  })

  const isOwnRoleLocked = $derived(isAdmin && isCurrentUserInSelectedRole)

  const tabs = [
    { value: 'permissions', label: '권한 설정' },
    { value: 'members', label: '구성원' }
  ]

  const canManageRole = $derived(
    !!$permissionStore.context &&
      permissionEngine.hasPermission('write:role', $permissionStore.context)
  )

  const rolesQuery = $derived(
    queryBuilder(getCenterRoles, () => buildRolesQueryInput($centerId!), {
      enabled: !!$centerId && canManageRole
    })
  )

  const permissionsQuery = $derived(queryBuilder(getAllPermissions))

  const rolePermissionsQuery = $derived(
    authState.selectedRoleCode
      ? queryBuilder(
          getRolePermissions,
          () =>
            buildRolePermissionsQueryInput(
              $centerId!,
              authState.selectedRoleCode!
            ),
          { enabled: !!$centerId && !!authState.selectedRoleCode }
        )
      : null
  )

  const membersQuery = $derived(
    queryBuilder(
      getMemberList,
      () => ({ centerId: $centerId!, page: 1, size: 100 }),
      { enabled: !!$centerId }
    )
  )

  const allMembers = $derived(membersQuery.data?.items ?? [])

  const selectedRole = $derived.by(() => {
    const list = rolesQuery.data ?? []
    return list.find((r) => r.code === authState.selectedRoleCode) ?? null
  })

  const selectedRoleAccessLevel = $derived(selectedRole?.access_level ?? 'own')

  const roleList = $derived(rolesQuery.data ?? [])

  const roleMembersQuery = $derived(
    authState.selectedRoleCode
      ? queryBuilder(
          getRoleMembers,
          () => ({
            centerId: $centerId!,
            roleCode: authState.selectedRoleCode!,
            page: 1,
            size: 100,
            search: memberSearchQuery.trim() || undefined
          }),
          {
            enabled:
              !!$centerId &&
              !!authState.selectedRoleCode &&
              activeTab === 'members'
          }
        )
      : null
  )

  const memberRows = $derived.by((): MemberRowVM[] => {
    const items = roleMembersQuery?.data?.items ?? []
    return items.map((member) => ({
      id: member.id,
      name: member.name || '-',
      email: member.email ?? '-',
      isActive: member.is_active,
      lastLoginAt: member.last_login_at
    }))
  })

  const filteredMemberRows = $derived(memberRows)

  const assignableMembers = $derived.by((): AssignableMember[] => {
    return allMembers.map((m) => ({
      id: m.id,
      name: m.person.name,
      email: m.person.email ?? '-',
      roleCode: m.role_code,
      roleName: m.role_name,
      isActive: m.is_active
    }))
  })

  $effect(() => {
    if (roleList.length > 0 && !authState.selectedRoleCode) {
      authState.selectRole(roleList[0].code)
    }
  })

  $effect(() => {
    const allPerms = permissionsQuery.data
    const rolePerms = rolePermissionsQuery?.data
    if (allPerms && rolePerms && rolePerms.permissions) {
      authState.setCategories(
        buildAuthorizationVM(allPerms, rolePerms.permissions)
      )
    }
  })

  $effect(() => {
    if (authState.localCategories.length > 0) {
      groups = groupCategories(authState.localCategories, CATEGORY_GROUPS)
    }
  })

  function handleCreateRole() {
    const allPerms = permissionsQuery.data
    if (!allPerms) return
    service.openCreateRoleModal(allPerms)
  }

  function handleCopyRole() {
    if (!selectedRole || authState.localCategories.length === 0) return
    service.openRoleCopyModal(selectedRole, authState.localCategories)
  }

  function handleEditRole() {
    if (!selectedRole || authState.localCategories.length === 0) return
    roleMenuOpen = false
    service.openEditRoleModal({
      selectedRole,
      localCategories: authState.localCategories,
      isOwnRoleLocked,
      onUpdate: (categories) => authState.setCategories(categories)
    })
  }

  async function handleDeleteRole() {
    roleMenuOpen = false
    if (!selectedRole) return
    await service.openDeleteRoleModal({ selectedRole, isOwnRoleLocked })
  }

  function handleAssignMembers() {
    if (!selectedRole) return
    service.openAssignMembersModal({
      selectedRole,
      assignableMembers,
      currentMemberId
    })
  }

  function getAccessLevelLabel(level: string) {
    return level === 'all' ? '모든 내담자' : '담당 내담자만'
  }

  function getMemberMenuItems(member: MemberRowVM) {
    if (selectedRole?.code === ROLE_CODES.ADMIN) return []
    if (member.id === currentMemberId) return []
    return [
      {
        label: '역할 변경',
        onClick: () => {
          if (!selectedRole) return
          service.openMemberRoleChangeModal({ member, selectedRole, roleList })
        }
      }
    ]
  }
</script>

<PermissionGuard permission={AUTHORIZATION_PERMISSIONS.access}>
  <div in:fade class="flex h-full flex-col bg-gray-50">
    <PageTitleSection title="권한 설정" className="mb-4 h-11" />

    <div class="flex min-h-0 flex-1">
      <div
        class="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card md:flex-row"
      >
        <!-- 좌측: 역할 사이드바 — 폭 280(§Layout Patterns > 목록 레일). 상세 2분할
             좌측 패널(--spacing-detail-side)이 아니라 '목록 전환 전용 레일' 규격이다 -->
        <div
          class="shrink-0 border-b border-gray-200 md:border-b-0 md:border-r md:w-70 md:overflow-y-auto"
        >
          <!-- 역할 추가 버튼 -->
          <div class="p-3 md:p-5">
            <!-- 컨테이너 안의 추가 버튼 = button-tertiary(Gray solid).
                 primary solid는 페이지 우상단 메인 CTA 전용 -->
            <button
              onclick={handleCreateRole}
              class="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-100 text-body-01-normal-medium text-gray-600 duration-200 hover:bg-gray-200"
            >
              <PlusIcon20 />
              역할 추가
            </button>
          </div>

          <!-- 역할 목록 -->
          {#if rolesQuery.isLoading}
            <div class="flex flex-col gap-2 px-3 md:px-5">
              {#each Array(4) as _}
                <!-- svelte-ignore element_invalid_self_closing_tag -->
                <div class="h-12 rounded-lg bg-gray-100 animate-pulse" />
              {/each}
            </div>
          {:else if roleList.length > 0}
            <div
              class="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-col md:gap-2 md:px-5 md:pb-5 md:overflow-x-visible"
            >
              {#each roleList as role}
                {@const active = role.code === authState.selectedRoleCode}
                <button
                  onclick={() => authState.selectRole(role.code)}
                  class="flex shrink-0 items-center gap-2 rounded-lg p-3 text-left transition-colors
                    md:w-full md:justify-between
                    {active
                    ? 'bg-primary-50'
                    : 'bg-gray-50 md:bg-transparent hover:bg-gray-50'}"
                >
                  <span
                    class="text-body-01-normal-semibold truncate-safe whitespace-nowrap {active
                      ? 'text-primary-600'
                      : 'text-gray-800'}"
                  >
                    {getRoleDisplayName(role)}
                  </span>
                  <span
                    class="shrink-0 text-body-02-normal-medium {active
                      ? 'text-primary-600'
                      : 'text-gray-400'}"
                  >
                    {getRoleDisplayCount(role.member_count)}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- 우측: 상세 -->
        <div class="flex-1 overflow-y-auto">
          {#if selectedRole}
            <div
              class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-100 p-5"
            >
              <div class="min-w-0">
                <Typography
                  variant="headline-02-normal-semibold"
                  color="text-gray-900"
                  className="truncate-safe block"
                  tag="h2"
                >
                  {getRoleDisplayName(selectedRole)}
                </Typography>
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                  className="mt-2 block"
                  tag="p"
                >
                  접근 범위: {getAccessLevelLabel(selectedRoleAccessLevel)}
                </Typography>
              </div>
              <div
                class="role-menu-container relative flex items-center gap-2 shrink-0"
              >
                <button
                  onclick={handleCopyRole}
                  class="h-8 rounded-lg bg-gray-100 px-3 text-body-03-normal-medium text-gray-600"
                >
                  역할 복사
                </button>
                {#if !isOwnRoleLocked && selectedRole?.code !== ROLE_CODES.ADMIN}
                  <Tooltip text="역할 메뉴">
                    <button
                      onclick={() => (roleMenuOpen = !roleMenuOpen)}
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      aria-label="role menu"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <circle cx="10" cy="4" r="1.5" fill="currentColor" />
                        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                        <circle cx="10" cy="16" r="1.5" fill="currentColor" />
                      </svg>
                    </button>
                  </Tooltip>
                {/if}

                {#if roleMenuOpen && !isOwnRoleLocked}
                  <div
                    class="role-dropdown-menu dropdown-panel absolute top-10 right-0 z-20"
                    transition:fly={{ y: -8, duration: 150 }}
                  >
                    <button onclick={handleEditRole} class="dropdown-item">
                      수정
                    </button>
                    {#if !selectedRole?.is_preset}
                      <button
                        onclick={handleDeleteRole}
                        class="dropdown-item is-danger"
                      >
                        삭제
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <div class="px-5 pb-5 pt-1">
            <TabBar
              {tabs}
              {activeTab}
              onTabChange={(tab) =>
                (activeTab = tab as 'permissions' | 'members')}
            />

            {#if activeTab === 'permissions'}
              <div class="mt-7 flex flex-col lg:flex-row gap-6">
                {#if groups.length > 0}
                  <div class="flex-1 min-w-0 space-y-10 overflow-x-auto">
                    {#each groups as group}
                      <div>
                        <Typography
                          variant="title-01-normal-semibold"
                          color="text-gray-900"
                          className="mb-4"
                          >{getGroupDisplayLabel(group.label)}</Typography
                        >
                        <div
                          class="grid grid-cols-[3fr_2.5fr_2.5fr_1fr] items-center mb-1 px-4 bg-gray-50 h-10 cursor-default"
                        >
                          <span class="text-body-03-normal-medium text-gray-500"
                            >메뉴</span
                          >
                          <span
                            class="text-body-03-normal-medium text-gray-500 text-left"
                            >조회</span
                          >
                          <span
                            class="text-body-03-normal-medium text-gray-500 text-left"
                            >편집</span
                          >
                        </div>

                        {#each group.categories as cat}
                          <div
                            class="grid grid-cols-[3fr_2.5fr_2.5fr_1fr] items-center min-h-12 py-2.5 px-4 border-b border-gray-100 cursor-default"
                          >
                            <span
                              class="text-body-01-reading-regular text-gray-800"
                              >{getCategoryDisplayLabel(cat.label)}</span
                            >
                            <!-- 조회 -->
                            {#if cat.hasView}
                              <span
                                class="text-body-02-normal-medium {cat.viewChecked
                                  ? 'text-primary-500'
                                  : 'text-status-danger'}"
                                >{cat.viewChecked ? '허용' : '제한'}</span
                              >
                            {:else}
                              <span
                                class="text-body-02-normal-medium text-gray-400"
                                >-</span
                              >
                            {/if}
                            <!-- 편집 -->
                            {#if cat.hasModify}
                              <span
                                class="text-body-02-normal-medium {cat.viewChecked &&
                                cat.modifyChecked
                                  ? 'text-primary-500'
                                  : 'text-status-danger'}"
                                >{cat.viewChecked && cat.modifyChecked
                                  ? '허용'
                                  : '제한'}</span
                              >
                            {:else}
                              <span
                                class="text-body-02-normal-medium text-gray-400"
                                >-</span
                              >
                            {/if}
                            <!-- 안내 텍스트 (조회/편집과 동일 폭 컬럼, 동일 위치) -->
                            <span
                              class="text-label-01-normal-regular text-body-subtle"
                            >
                              {#if cat.hasView && !cat.viewChecked}
                                메뉴에서 숨겨져요
                              {:else if cat.hasModify && cat.viewChecked && !cat.modifyChecked}
                                읽기만 가능해요
                              {/if}
                            </span>
                          </div>
                        {/each}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="mt-3">
                <div
                  class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3"
                >
                  <div class="flex items-center gap-2">
                    <Typography
                      variant="title-01-normal-semibold"
                      color="text-gray-900"
                    >
                      구성원
                    </Typography>
                    {#if (roleMembersQuery?.data?.total ?? memberRows.length) > 0}
                      <Typography
                        variant="body-02-normal-regular"
                        color="text-gray-500"
                      >
                        {roleMembersQuery?.data?.total ?? memberRows.length}
                      </Typography>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2">
                    <div
                      class="h-11 w-full sm:w-90 rounded-lg border border-gray-200 px-3 flex items-center gap-2 bg-white"
                    >
                      <SearchIcon />
                      <input
                        type="text"
                        bind:value={memberSearchQuery}
                        placeholder="검색어를 입력해주세요"
                        class="w-full bg-transparent outline-none text-body-01-normal-regular placeholder:text-placeholder"
                      />
                    </div>
                    <Button
                      color="stroke-primary"
                      size="md"
                      weight="medium"
                      class="gap-2 rounded-lg h-11 px-5"
                      onclick={handleAssignMembers}
                    >
                      <PlusIcon20 />
                      <Typography
                        variant="body-01-normal-medium"
                        color="text-current"
                      >
                        구성원 추가
                      </Typography>
                    </Button>
                  </div>
                </div>

                {#if filteredMemberRows.length > 0}
                  <div>
                    <div
                      class="grid grid-cols-[1fr_32px] sm:grid-cols-[1.7fr_1fr_1fr_32px] items-center h-10 pl-6 pr-3 bg-gray-50"
                    >
                      <span class="text-body-03-normal-medium text-gray-500"
                        >이름</span
                      >
                      <span
                        class="hidden sm:block text-body-03-normal-medium text-gray-500"
                        >최근 로그인</span
                      >
                      <span
                        class="hidden sm:block text-body-03-normal-medium text-gray-500"
                        >상태</span
                      >
                      <span class="sr-only">작업</span>
                    </div>

                    <div class="max-h-115 overflow-auto">
                      {#each filteredMemberRows as member (member.id)}
                        <div
                          class="grid grid-cols-[1fr_32px] sm:grid-cols-[1.7fr_1fr_1fr_32px] items-center h-18 pl-6 pr-3 border-b border-gray-200 last:border-b-0"
                        >
                          <div class="flex items-center">
                            <div class="min-w-0 flex flex-col gap-2">
                              <p
                                class="text-body-01-normal-semibold text-body-strong truncate-safe"
                              >
                                {member.name}
                                {#if member.id === currentMemberId}
                                  <span
                                    class="text-body-03-normal-medium text-gray-400 ml-1"
                                    >(나)</span
                                  >
                                {/if}
                              </p>
                              <p
                                class="text-body-02-normal-regular text-body-subtle truncate-safe"
                              >
                                {member.email}
                              </p>
                            </div>
                          </div>

                          <span
                            class="hidden sm:block text-body-01-normal-regular text-body-default"
                            >{formatMemberDate(member.lastLoginAt)}</span
                          >

                          <div class="hidden sm:flex items-center gap-2">
                            <span
                              class="h-2 w-2 rounded-full {member.isActive
                                ? 'bg-green-500'
                                : 'bg-gray-400'}"
                            ></span>
                            <span
                              class="text-body-02-normal-medium {member.isActive
                                ? 'text-green-500'
                                : 'text-gray-500'}"
                              >{member.isActive ? '활성' : '비활성'}</span
                            >
                          </div>

                          <KebabMenu items={getMemberMenuItems(member)} />
                        </div>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <div class="flex min-h-60 items-center justify-center">
                    <NoDataSection description="등록된 구성원이 없어요" />
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

  {#snippet fallback()}
    <div class="bg-gray-50 h-full flex items-center justify-center">
      <p class="text-body-02-normal-regular text-gray-500">
        권한 설정 관리 권한이 없습니다
      </p>
    </div>
  {/snippet}
</PermissionGuard>
