<script lang="ts">
  import { getTitleIcon } from '$lib/config/title-icon'
  import { fade } from 'svelte/transition'
  import FilterResetButton from '$lib/components/FilterResetButton.svelte'
  import { page } from '$app/state'

  // Components
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'
  import AssessmentTitleCard from '$lib/components/cards/AssessmentTitleCard.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import PageActionButton from '$lib/components/PageActionButton.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import TabBar from '$lib/components/TabBar.svelte'
  import FloatingFilterBar from '$lib/components/FloatingFilterBar.svelte'

  // Queries
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCenterAssessments,
    type CenterAssessment
  } from '$lib/hooks/actions/assessment.action'
  import {
    getAssessmentSetList,
    type AssessmentSetItem,
    type AssessmentSetListResponse
  } from '$lib/hooks/actions/assessmentSet.action'
  import { useQueryClient } from '@tanstack/svelte-query'

  // Center Store
  import { centerId } from '$lib/stores/center.store'

  // Feature modules
  import {
    activeFilterOptions,
    sortOptions,
    assessmentTypeFilterOptions,
    MANAGE_TABS,
    type TabType
  } from '$lib/features/assessment/manage/constants'
  import { useManageFilters } from '$lib/features/assessment/manage/hooks.svelte'
  import {
    mapCenterAssessmentsToVM,
    mapAssessmentSetsToVM,
    type AssessmentVM,
    type AssessmentSetVM
  } from '$lib/features/assessment/manage/view-model'
  import { buildCenterAssessmentsInput } from '$lib/features/assessment/manage/query-builders'
  import { createManageService } from '$lib/features/assessment/manage/manage-service'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { CENTER_PAGE_ACCESS_RULE } from '$lib/features/center/permissions'
  import {
    ASSESSMENT_CREATE_RULE,
    ASSESSMENT_DELETE_RULE
  } from '$lib/features/assessment/permissions'
  import { responsive } from '$lib/stores/responsive.svelte'

  const isOverlayMode = $derived(!responsive.isDesktop)

  // 훅 초기화
  const pathname = page.url.pathname
  const filters = useManageFilters(page.url, pathname)
  const queryClient = useQueryClient()
  const manageService = createManageService({ queryClient })
  // 쿼리 설정: 센터 운영 검사 목록 (필터 반응형 연결)
  const centerAssessmentsQuery = queryBuilder<
    CenterAssessment[],
    CenterAssessment[]
  >(
    getCenterAssessments,
    () => buildCenterAssessmentsInput($centerId!, filters.buildFilters()),
    { placeholderData: undefined, gcTime: 0 }
  )

  // 검사 세트 목록 조회
  const assessmentSetsQuery = queryBuilder<
    AssessmentSetListResponse,
    AssessmentSetListResponse
  >(getAssessmentSetList, () => ({ centerId: $centerId!, page: 1, size: 100 }))

  // Derived states
  const isLoading = $derived(centerAssessmentsQuery.isLoading)
  const isError = $derived(centerAssessmentsQuery.isError)
  const error = $derived(centerAssessmentsQuery.error)
  const isSetsLoading = $derived(assessmentSetsQuery.isLoading)

  // 센터 운영 검사 데이터
  const centerAssessmentsData = $derived.by((): CenterAssessment[] => {
    const data = centerAssessmentsQuery.data
    if (!data) return []
    return Array.isArray(data) ? data : []
  })

  // 검사 세트 데이터
  const assessmentSetsData = $derived.by(
    (): AssessmentSetItem[] => assessmentSetsQuery.data?.items ?? []
  )
  const assessmentSetsVM = $derived.by((): AssessmentSetVM[] =>
    mapAssessmentSetsToVM(assessmentSetsData)
  )

  const assessmentVM = $derived.by((): AssessmentVM[] =>
    mapCenterAssessmentsToVM(centerAssessmentsData)
  )
  const showPackages = $derived(filters.activeTab === 'set')

  // 탭 변경 핸들러
  function handleTabChange(tab: string) {
    filters.changeTab(tab as TabType)
  }

  // 모달/액션 핸들러 (서비스 통합)
  const handleOpenAssessmentToggleModal =
    manageService.openAssessmentToggleModal
  const handleOpenAssessmentRequestModal =
    manageService.openAssessmentRequestModal
  const handleOpenPackageSettingModal = manageService.openCreatePackageModal
  const handleOpenAssessmentDetail = manageService.openAssessmentDetailModal

  function handleEditPackage(setId: string) {
    manageService.editPackage(setId, assessmentSetsData)
  }

  function handleDeletePackage(setId: string) {
    manageService.deletePackage(setId)
  }

  function handleToggleAssessment(
    assessmentId: string,
    currentIsActive: boolean,
    assessmentName: string
  ) {
    manageService.toggleAssessment(
      assessmentId,
      currentIsActive,
      assessmentName
    )
  }

  const isResetDisabled = $derived.by(() => {
    const f = filters.buildFilters()
    return (
      !f.search &&
      f.enabled === 'enabled' &&
      f.active === 'all' &&
      f.assessmentType === 'all'
    )
  })

  const TitleIcon = $derived(getTitleIcon(page.url.pathname))
</script>

<PermissionGuard rule={CENTER_PAGE_ACCESS_RULE} showError>
  <div in:fade class="mx-auto flex min-h-full w-full flex-col bg-gray-50">
    <!-- 헤더 섹션 -->
    <!-- 타이틀 바로 아래가 탭이면 간격 8(mb-2). 일반 콘텐츠일 때의 16보다 좁힌다 -->
    <div class="mb-2 flex items-center justify-between">
      <div class="flex items-center gap-2">
        {#if TitleIcon}<TitleIcon />{/if}
        <Typography variant="headline-01-normal-semibold" color="text-gray-900"
          >검사 관리</Typography
        >
      </div>
      <div class="flex items-center gap-3">
        <!-- <button
        onclick={handleOpenAssessmentToggleModal}
        class="text-body-01-normal-medium border border-gray-200 h-[44px] rounded-lg bg-gray-50 px-8 text-gray-600 transition-colors hover:bg-gray-100"
      >
        검사 운영 관리
      </button> -->
        <PermissionGuard rule={ASSESSMENT_CREATE_RULE}>
          <PageActionButton
            label="세트 추가"
            onclick={handleOpenPackageSettingModal}
          />
        </PermissionGuard>
      </div>
    </div>

    <!-- 탭 — 탭↔필터 간격은 FloatingFilterBar의 py-4가 담당(정본 = 청구·검사현황) -->
    <TabBar
      tabs={MANAGE_TABS}
      activeTab={filters.activeTab}
      onTabChange={handleTabChange}
    />

    <!-- 필터 영역 — 상단에 닿으면 플로팅으로 고정(정본 = 청구·검사현황) -->
    <FloatingFilterBar>
      {#snippet children()}
        <div
          class="flex h-11 {isOverlayMode
            ? 'w-full'
            : 'w-90'} items-center gap-2 rounded-lg border border-gray-200 bg-white px-3"
        >
          <SearchIcon />
          <input
            type="text"
            bind:value={filters.searchQuery}
            placeholder="검색어를 입력해주세요"
            class="text-body-01-normal-regular w-full bg-transparent outline-none placeholder:text-placeholder"
          />
        </div>
        <Select
          class="w-40 rounded-lg bg-white"
          options={assessmentTypeFilterOptions}
          selected={filters.assessmentTypeFilter}
          showActiveHighlight={true}
          defaultValue="all"
          on:change={(e) => (filters.assessmentTypeFilter = e.detail.value)}
        />
        <Select
          class="w-40 rounded-lg bg-white"
          options={activeFilterOptions}
          selected={filters.activeFilter}
          showActiveHighlight={true}
          defaultValue="all"
          on:change={(e) => (filters.activeFilter = e.detail.value)}
        />
        <!-- 초기화 — 리스트 페이지 공통 규격(정본 = 청구): 아이콘 전용 44 정사각 흰 버튼 -->
        <FilterResetButton
          onclick={filters.resetFilters}
          disabled={isResetDisabled}
        />
      {/snippet}
    </FloatingFilterBar>

    <!-- 총 개수 — 필터와 분리된 카운트 헤더(정본 = 청구) -->
    <div class="mb-1 flex h-11 shrink-0 items-center justify-between">
      <Typography variant="body-01-normal-regular" color="text-gray-700">
        총 {showPackages ? assessmentSetsVM.length : assessmentVM.length}개
      </Typography>
    </div>

    <!-- 검사 목록/세트 컨테이너 -->
    <div class="flex flex-1 flex-col">
      {#if showPackages}
        {#if isSetsLoading}
          <div class="flex-center w-full flex-1">
            <p>로딩 중...</p>
          </div>
        {:else if assessmentSetsVM.length > 0}
          <div class="space-y-5">
            {#each assessmentSetsVM as setItem (setItem.id)}
              <div class="space-y-3 rounded-2xl bg-gray-100 p-5">
                <!-- 세트 헤더 -->
                <div class="flex items-center gap-3">
                  <!-- 세트명 + 검사 갯수 -->
                  <div class="flex items-center gap-1">
                    <span class="text-title-01-normal-semibold text-gray-900"
                      >{setItem.name}</span
                    >
                    <span class="text-body-01-normal-medium text-primary-500"
                      >{setItem.assessmentCount}</span
                    >
                  </div>

                  <span class="text-gray-300">|</span>

                  <!-- 수정 버튼 -->
                  <PermissionGuard rule={ASSESSMENT_CREATE_RULE}>
                    <button
                      onclick={() => handleEditPackage(setItem.id)}
                      aria-label="수정"
                      class="inline-flex items-center gap-1 text-gray-600 transition-colors hover:text-gray-700"
                    >
                      <EditIcon />
                      <span class="text-body-02-normal-medium">수정</span>
                    </button>
                  </PermissionGuard>

                  <!-- 삭제 버튼 -->
                  <PermissionGuard rule={ASSESSMENT_DELETE_RULE}>
                    <Tooltip text="세트 삭제">
                      <button
                        onclick={() => handleDeletePackage(setItem.id)}
                        aria-label="세트 삭제"
                        class="flex items-center justify-center text-gray-400 hover:text-status-danger transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </Tooltip>
                  </PermissionGuard>
                </div>

                <!-- 검사 카드 목록 -->
                {#if setItem.assessments.length > 0}
                  <div class="grid grid-cols-5 gap-4">
                    {#each setItem.assessments as assessment (assessment.id)}
                      <AssessmentTitleCard
                        title_ko={assessment.titleKo}
                        title_en={assessment.titleEn}
                        backgroundImage={assessment.bgImage}
                        backgroundComponent={assessment.backgroundComponent}
                        iconComponent={assessment.iconComponent}
                        bgColor={assessment.bgColor}
                        isOnlineAvailable={assessment.isOnlineAvailable}
                        showSwitch={false}
                        onCardClick={() =>
                          handleOpenAssessmentDetail(
                            assessment.id,
                            assessment.titleKo,
                            assessment.titleEn
                          )}
                      />
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="flex-center w-full flex-1">
            <NoDataSection
              description="등록된 검사 세트가 없어요
자주 사용하는 검사를 묶어두면 빠르게 접수할 수 있어요"
            />
          </div>
        {/if}
      {:else if isLoading}
        <div class="flex-center w-full flex-1">
          <p>로딩 중...</p>
        </div>
      {:else if isError}
        <div class="flex-center w-full flex-1 flex-col gap-2">
          <p class="text-status-danger">에러 발생</p>
          <p class="text-sm text-gray-500">
            {error?.message || '알 수 없는 에러'}
          </p>
        </div>
      {:else if assessmentVM.length > 0}
        <div class="grid grid-cols-5 gap-4">
          {#each assessmentVM as item}
            <AssessmentTitleCard
              title_ko={item.titleKo}
              title_en={item.titleEn}
              backgroundImage={item.bgImage}
              backgroundComponent={item.backgroundComponent}
              iconComponent={item.iconComponent}
              bgColor={item.bgColor}
              isOnlineAvailable={item.isOnlineAvailable}
              isActive={item.isActive}
              onToggle={() =>
                handleToggleAssessment(item.id, item.isActive, item.titleKo)}
              onCardClick={() =>
                handleOpenAssessmentDetail(item.id, item.titleKo, item.titleEn)}
            />
          {/each}
        </div>
      {:else}
        <div class="flex-center w-full flex-1">
          <NoDataSection />
        </div>
      {/if}
    </div>

    <!-- 요청 섹션 -->
    <!-- <div
    class="mt-9 mb-4 flex h-[140px] w-full shrink-0 flex-col items-center justify-center rounded-lg bg-gray-100"
  >
    <h2 class="text-headline-02-normal-semibold mb-3 text-gray-900">
      찾으시는 검사가 없나요?
    </h2>
    <button
      onclick={handleOpenAssessmentRequestModal}
      class="text-body-01-normal-medium h-[44px] w-29.25 rounded-lg border-2 border-dashed border-[#4C87F6] bg-white text-[#4C87F6] transition-colors hover:bg-blue-50"
    >
      검사 요청
    </button>
  </div> -->
  </div>
</PermissionGuard>
