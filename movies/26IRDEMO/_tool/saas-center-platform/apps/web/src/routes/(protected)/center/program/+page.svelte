<script lang="ts">
  import { fade } from 'svelte/transition'

  import { queryBuilder } from '$root/src/lib/hooks/queries/builder'
  import { getProgramList } from '$root/src/lib/hooks/actions/program.action'

  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import {
    CENTER_PROGRAM_MANAGE_RULE,
    CENTER_PAGE_ACCESS_RULE
  } from '$lib/features/center/permissions'
  import { permissionContext } from '$lib/stores/permission.view'
  import { permissionEngine } from '$lib/utils/permission-engine'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import Select from '$lib/components/Select.svelte'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import ProgramCard from '$root/src/lib/components/ProgramCard.svelte'
  import NoDataSection from '$root/src/lib/components/NoDataSection.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { centerId } from '$lib/stores/center.store'
  import { page } from '$app/state'
  import { afterNavigate, goto } from '$app/navigation'

  import {
    createProgramService,
    buildProgramListInput,
    filterAndSortPrograms,
    PROGRAM_TYPE_FILTER_OPTIONS,
    type ProgramTypeFilter
  } from '$lib/features/center/program'
  import { modalStore } from '$lib/stores/modal'
  import ProgramRegisterModal from '$lib/components/modal/ProgramRegisterModal.svelte'

  const queryClient = useQueryClient()
  const programService = createProgramService({ queryClient })

  const REDIRECT_DELAY_MS = 1500

  const handleRegisterProgram = () => {
    const returnTo = page.url.searchParams.get('returnTo')
    programService.openRegisterModal(
      returnTo
        ? () => setTimeout(() => goto(returnTo), REDIRECT_DELAY_MS)
        : undefined
    )
  }

  const programList = $derived(
    queryBuilder(getProgramList, () => buildProgramListInput($centerId!))
  )

  const programs = $derived(programList.data?.items ?? [])

  // 검색·유형 필터 — 목록을 전량 조회하므로(query-builders) 걸러내기는 프론트가 한다.
  // URL 동기화·페이지네이션이 없는 화면이라 별도 훅 없이 페이지가 상태를 쥔다.
  let searchInput = $state('')
  let typeFilter = $state<ProgramTypeFilter>('all')

  const cards = $derived(
    filterAndSortPrograms(programs, {
      search: searchInput,
      type: typeFilter,
      active: 'all',
      sort: 'name'
    })
  )

  const hasActiveFilter = $derived(!!searchInput.trim() || typeFilter !== 'all')

  const resetFilters = () => {
    searchInput = ''
    typeFilter = 'all'
  }

  const canManageProgram = $derived(
    permissionEngine.evaluate(CENTER_PROGRAM_MANAGE_RULE, $permissionContext)
      .granted
  )

  // Agent page.navigate에 의한 자동 모달 오픈 + pre-fill
  // afterNavigate 사용 — $effect는 page.url을 읽으면서 goto로 page.url을 쓰면
  // self-loop(effect_update_depth_exceeded)가 발생하므로 reactivity 외부에서 처리.
  afterNavigate(() => {
    const params = page.url.searchParams
    if (params.get('action') !== 'create') return

    const props: Record<string, any> = {}
    if (params.get('name')) props.initial_name = params.get('name')
    if (params.get('program_type'))
      props.initial_program_type = params.get('program_type')
    if (params.get('price')) props.initial_price = Number(params.get('price'))
    if (params.get('duration_minutes'))
      props.initial_duration_minutes = Number(params.get('duration_minutes'))

    modalStore.open({
      component: ProgramRegisterModal,
      props,
      options: { customWidth: 540 }
    })
    goto('/center/program', { replaceState: true })
  })
</script>

<PermissionGuard rule={CENTER_PAGE_ACCESS_RULE} showError>
  <div in:fade class="h-full flex flex-col bg-gray-50">
    <!-- 등록 버튼이 타이틀 우측에 서야 하므로 타이틀을 이 페이지가 소유한다
         (레이아웃 STANDALONE_TITLES에서 제외 — 공간 관리와 같은 표준 페이지 헤더).
         타이틀 바로 아래가 필터 바(여백 가진 행) → 간격 8(mb-2) -->
    <PageTitleSection title="프로그램 관리" className="mb-2">
      <PermissionGuard slot="extraBtn" rule={CENTER_PROGRAM_MANAGE_RULE}>
        <PageActionButton
          label="프로그램 등록"
          onclick={handleRegisterProgram}
        />
      </PermissionGuard>
    </PageTitleSection>

    <!-- 검색 및 필터 — 상단에 닿으면 플로팅으로 고정.
         py-4가 타이틀↔필터·필터↔카운트 간격을 함께 담당한다 -->
    <FloatingFilterBar>
      {#snippet children()}
        <div
          class="flex h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 focus-within:border-border-active duration-200 sm:w-90"
        >
          <SearchIcon />
          <input
            type="text"
            bind:value={searchInput}
            placeholder="프로그램·담당자 이름을 입력해주세요"
            class="w-full min-w-0 bg-transparent text-body-01-normal-regular outline-none placeholder:text-placeholder"
          />
        </div>

        <!-- 유형 필터 (전체 / 개별 / 그룹) -->
        <Select
          class="bg-white rounded-lg"
          options={PROGRAM_TYPE_FILTER_OPTIONS}
          selected={PROGRAM_TYPE_FILTER_OPTIONS.find(
            (o) => o.value === typeFilter
          ) ?? PROGRAM_TYPE_FILTER_OPTIONS[0]}
          showActiveHighlight={true}
          defaultValue="all"
          on:change={(e) => (typeFilter = e.detail.value)}
        />

        <FilterResetButton onclick={resetFilters} disabled={!hasActiveFilter} />
      {/snippet}
    </FloatingFilterBar>

    <div class="mb-1 flex h-11 shrink-0 items-center">
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        총 {cards.length}개
      </Typography>
    </div>
    {#if cards.length > 0}
      <section
        class="grid gap-5"
        style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));"
      >
        {#each cards as program (program.id)}
          <ProgramCard
            title={program.name}
            managers={program.managers}
            price={program.price}
            type={program.type}
            duration_minutes={program.raw.duration_minutes}
            showActions={canManageProgram}
            onEdit={() => programService.openEditModal(program.raw)}
            onDelete={() => programService.confirmDelete(program.raw)}
          />
        {/each}
      </section>
    {:else}
      <NoDataSection
        description={hasActiveFilter
          ? '검색 조건에 맞는 프로그램이 없어요'
          : '등록된 프로그램이 없어요'}
      />
    {/if}
  </div>
</PermissionGuard>
