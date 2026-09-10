<script lang="ts">
  import { getTitleIcon } from '$lib/config/title-icon'
  import { fade } from 'svelte/transition'
  import { page } from '$app/state'
  import { useQueryClient } from '@tanstack/svelte-query'

  import {
    queryBuilder,
    infiniteQueryBuilder
  } from '$lib/hooks/queries/builder'
  import {
    getMyCounselingNotes,
    type MyNotesStatusFilter,
    type MyNotesProgramTypeFilter
  } from '$lib/hooks/actions/counseling.action'
  import {
    NOTES_PAGE_SIZE,
    NOTES_TABS,
    NOTES_EMPTY_MESSAGES,
    NOTES_PROGRAM_TYPE_OPTIONS,
    mapToNoteVM,
    createCounselingNotesService
  } from '$lib/features/counseling/notes'
  import { centerId } from '$lib/stores/center.store'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'

  import Typography from '@common/components/Typography.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import Select from '$lib/components/Select.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'
  import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'

  const queryClient = useQueryClient()
  const notesService = createCounselingNotesService({ queryClient })

  let activeTab = $state<MyNotesStatusFilter>('all')
  // 프로그램 유형(개별/그룹) — 기본 '전체 유형'
  let programType = $state<MyNotesProgramTypeFilter>('all')
  let searchInput = $state('')
  let debouncedSearch = $state('')

  // agent prefill — /counseling/notes?case_id=…&session_id=…[&client_id=…].
  // 진입 시점에 붙잡는다(필터가 URL을 다시 쓸 수 있으므로). keyword만 오면 검색어로 흘린다.
  const prefill = {
    caseId: page.url.searchParams.get('case_id'),
    sessionId: page.url.searchParams.get('session_id'),
    clientId: page.url.searchParams.get('client_id') ?? undefined,
    keyword: page.url.searchParams.get('keyword')
  }
  if (prefill.keyword) searchInput = prefill.keyword

  let prefillOpened = false
  $effect(() => {
    if (!prefill.caseId || !prefill.sessionId || prefillOpened || !$centerId)
      return
    prefillOpened = true
    void notesService.openNoteByIds(
      {
        caseId: prefill.caseId,
        sessionId: prefill.sessionId,
        clientId: prefill.clientId
      },
      $isSecretMode
    )
  })

  $effect(() => {
    const value = searchInput
    const timer = setTimeout(() => {
      debouncedSearch = value.trim()
    }, 300)
    return () => clearTimeout(timer)
  })

  // 카드(grid) 무한 스크롤 — 탭·검색이 바뀌면 key가 갈려 처음부터 다시 쌓인다
  const notesInfinite = infiniteQueryBuilder(getMyCounselingNotes, {
    key: () => ({
      center: $centerId,
      status: activeTab,
      keyword: debouncedSearch || undefined,
      programType
    }),
    buildInput: (skip, limit) => ({
      centerId: $centerId ?? '',
      status: activeTab,
      keyword: debouncedSearch || undefined,
      programType,
      skip,
      limit
    }),
    pageSize: NOTES_PAGE_SIZE,
    enabled: () => !!$centerId
  })

  // 미작성 건수 — 탭 위 말풍선 전용(라벨엔 붙이지 않는다). total만 쓰므로 limit 1.
  const missingCountQuery = queryBuilder(
    getMyCounselingNotes,
    () => ({
      centerId: $centerId ?? '',
      status: 'missing' as const,
      skip: 0,
      limit: 1
    }),
    () => ({ enabled: !!$centerId })
  )
  const missingCount = $derived(missingCountQuery.data?.total ?? 0)
  let missingTipClosed = $state(false)

  // 탭은 라벨만 — 카운트 pill을 붙이면 탭바 높이가 57→63으로 갈려
  // 상담현황·청구와 규격이 어긋난다. 총 건수는 아래 카운트 헤더가 소유한다.
  // 말풍선은 미작성 탭에 있지 않을 때만 — 이미 보고 있는 걸 알릴 이유가 없다.
  const tabs = $derived(
    NOTES_TABS.map((tab) => ({
      value: tab.value,
      label: tab.label,
      notice:
        tab.value === 'missing' &&
        !missingTipClosed &&
        activeTab !== 'missing' &&
        missingCount > 0
          ? `미작성 일지가 ${missingCount}건 있어요!`
          : undefined
    }))
  )

  const notePages = $derived(notesInfinite.data?.pages ?? [])
  const noteVMs = $derived(
    notePages.flatMap((p) => p?.items ?? []).map(mapToNoteVM)
  )
  const totalCount = $derived(notePages[0]?.total ?? 0)
  const isLoading = $derived(notesInfinite.isLoading)
  const loadingMore = $derived(notesInfinite.isFetchingNextPage)
  const hasMore = $derived(notesInfinite.hasNextPage ?? false)
  const loadMore = () => notesInfinite.fetchNextPage()

  function handleTabChange(tab: string) {
    activeTab = tab as MyNotesStatusFilter
  }

  const TitleIcon = $derived(getTitleIcon(page.url.pathname))
</script>

<!-- 카드(grid) 목록 = 페이지 흐름대로 늘어남 → 본문 전체 스크롤(높이 락 없음) -->
<div in:fade class="mx-auto flex flex-col bg-gray-50">
  <!-- 헤더 -->
  <!-- 타이틀 바로 아래가 탭이면 간격 8(mb-2). 일반 콘텐츠일 때의 16보다 좁힌다 -->
  <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
    <div class="flex items-center gap-2">
      {#if TitleIcon}<TitleIcon />{/if}
      <h1 class="text-headline-01-normal-semibold text-gray-800">상담일지</h1>
    </div>
  </div>

  <!-- 탭 영역 — 아래 여백은 자신이 갖지 않는다.
       탭↔필터 간격은 뒤따르는 필터 바의 py-4가 소유한다(Web_Design.md §Title system) -->
  <TabBar
    {tabs}
    {activeTab}
    onTabChange={handleTabChange}
    onNoticeClose={() => (missingTipClosed = true)}
  />

  <!-- 검색 영역 — 상단에 닿으면 플로팅으로 고정.
       py-4가 탭↔필터·필터↔카운트 간격을 함께 담당한다 -->
  <FloatingFilterBar>
    {#snippet children()}
      <div
        class="flex h-11 w-full bg-white items-center gap-2 rounded-lg border border-gray-200 px-3 focus-within:border-border-active duration-200 sm:w-90"
      >
        <SearchIcon />
        <input
          type="text"
          bind:value={searchInput}
          placeholder="내담자 이름을 입력해주세요"
          class="w-full bg-transparent text-body-01-normal-regular outline-none placeholder:text-placeholder"
        />
      </div>

      <!-- 프로그램 유형 (개별/그룹) — 기본 '전체 유형' -->
      <Select
        class="bg-white rounded-lg"
        options={NOTES_PROGRAM_TYPE_OPTIONS}
        selected={programType}
        showActiveHighlight={true}
        defaultValue="all"
        on:change={(e) =>
          (programType = e.detail.value as MyNotesProgramTypeFilter)}
      />
    {/snippet}
  </FloatingFilterBar>

  <!-- 총 건수 -->
  <div class="mb-1 flex h-11 shrink-0 items-center justify-between">
    <Typography variant="body-01-normal-regular" color="text-gray-700">
      총 {totalCount}건
    </Typography>
  </div>

  <!-- 목록 -->
  <div class="flex min-h-0 flex-1 flex-col">
    {#if isLoading}
      <div class="flex flex-1 items-center justify-center py-12">
        <Typography variant="body-01-medium" color="text-gray-500">
          로딩 중...
        </Typography>
      </div>
    {:else if noteVMs.length === 0}
      <div class="flex flex-1 items-center justify-center py-12">
        <NoDataSection
          description={debouncedSearch
            ? '검색 결과가 없어요'
            : programType !== 'all'
              ? '조건에 맞는 일지가 없어요'
              : NOTES_EMPTY_MESSAGES[activeTab]}
        />
      </div>
    {:else}
      <!-- 카드(grid) — 한 줄 4장 고정(데스크탑), 좁아지면 3 → 2 → 1로 단계 축소 -->
      <div
        class="grid grid-cols-1 gap-5 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {#each noteVMs as vm (vm.key)}
          <!-- 상담일지 카드 — Figma 10974:29583 기준(높이만 400으로 조정).
               헤더(내담자·상태) / 본문(프로그램·일시 → 일지 요약) 2단, 본문이 남는 높이를 먹는다 -->
          <button
            type="button"
            onclick={() => notesService.openNote(vm.item, $isSecretMode)}
            class="flex h-[400px] w-full flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white text-left shadow-card transition-all duration-200 hover:border-primary-400 hover:shadow-card-hover"
          >
            <!-- 헤더 — 내담자 최소 단위(아바타 + 이름 + 생년월일|성별) + 상태 배지 -->
            <div
              class="flex shrink-0 items-center gap-2 border-b border-border-subtle p-5"
            >
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <ClientAvatar
                  profileImageUrl={vm.profileImageUrl}
                  name={vm.clientName}
                  gender={vm.gender}
                  sizeClass="h-10 w-10"
                  textClass="text-body-01-normal-medium"
                />
                <div class="flex min-w-0 flex-col justify-center gap-2">
                  <Typography
                    variant="title-01-normal-semibold"
                    color="text-body-strong"
                    tag="span"
                    className="truncate-safe"
                  >
                    {$isSecretMode ? maskName(vm.clientName) : vm.clientName}
                  </Typography>
                  <ClientBirthGender
                    birthDate={vm.birthDate}
                    gender={vm.gender}
                  />
                </div>
              </div>
              <BadgeRectangle
                label={vm.isWritten ? '작성완료' : '미작성'}
                color={vm.isWritten ? 'green' : 'gray'}
              />
            </div>

            <!-- 본문 — 헤더 구분선 아래로 프로그램·일시, 그 아래 일지 요약 -->
            <div class="flex min-h-0 flex-1 flex-col gap-4 px-5 pt-3 pb-5">
              <div class="flex min-w-0 flex-col gap-2">
                {#if vm.programLabel}
                  <Typography
                    variant="body-01-normal-medium"
                    color="text-body-strong"
                    tag="span"
                    className="truncate-safe"
                  >
                    {vm.programLabel}
                  </Typography>
                {/if}
                <!-- 카드 폭이 좁으면 한 줄에 안 들어간다. 자르지 않고 접는다
                     — 2줄 wrap이라 Reading(150%) 행간 -->
                <Typography
                  variant="body-02-reading-regular"
                  color="text-body-default"
                  tag="span"
                >
                  {vm.scheduleLabel}
                </Typography>
              </div>

              <!-- 일지 요약 — 여러 줄 wrap이라 Reading(150%) 행간.
                   미작성은 placeholder 톤(값이 없다는 표시) -->
              <!-- 미리보기 — 뒤에 은은한 괘선(모달 일지와 같은 결, note-lines).
                   괘선 면은 남은 높이를 채우고(카드 아래까지 노트가 이어진다),
                   글은 그 안에서 7줄로 잘린다(…). 클램프를 면에 직접 걸면 flex가
                   박스를 늘려 8번째 줄이 반쯤 비친다 — 그래서 면과 글을 나눈다. -->
              <div class="note-lines min-h-0 min-w-0 flex-1">
                <p
                  class="line-clamp-6 {vm.isWritten
                    ? 'text-body-default'
                    : 'text-placeholder'}"
                >
                  {vm.summaryLine}
                </p>
              </div>
            </div>
          </button>
        {/each}
      </div>

      <InfiniteScrollSentinel
        onLoadMore={loadMore}
        {hasMore}
        loading={loadingMore}
      />
    {/if}
  </div>
</div>
