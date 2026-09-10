<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import { tick } from 'svelte'
  import type { SvelteComponent } from 'svelte'
  import Button from '../Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import RadioCircleCheckedIcon from '$lib/assets/RadioCircleCheckedIcon.svelte'
  import RadioCircleUncheckedIcon from '$lib/assets/RadioCircleUncheckedIcon.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCenterAssessments,
    type CenterAssessment
  } from '$lib/hooks/actions/assessment.action'
  // import {
  //   getMemberList,
  //   type MemberListItem
  // } from '$lib/hooks/actions/member.action'
  import { centerId as centerIdStore } from '$lib/stores/center.store'
  import CloseIcon from '../../assets/CloseIcon.svelte'
  import IntelligenceDevelopmentIcon from '$lib/assets/assessmentCardFolderBgImg/IntelligenceDevelopmentIcon.svelte'
  import ProjectiveIcon from '$lib/assets/assessmentCardFolderBgImg/ProjectiveIcon.svelte'
  import ObjectiveIcon from '$lib/assets/assessmentCardFolderBgImg/ObjectiveIcon.svelte'
  import CloseWithCircleIcon16 from '../../assets/CloseWithCircleIcon16.svelte'
  // import StaffMultiSelectInline from '$lib/components/assessment/receive/StaffMultiSelectInline.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    onConfirm?: (data: {
      packageName: string
      description: string
      selectedAssessments: string[]
      // selectedStaff: string[]
    }) => void
    initialPackageName?: string
    initialDescription?: string
    initialSelectedAssessments?: string[]
    // initialSelectedStaff?: string[]
    isEditMode?: boolean
  }

  let {
    modalId = '',
    closeModal = () => {},
    onConfirm = () => {},
    initialPackageName = '',
    initialDescription = '',
    initialSelectedAssessments = [],
    // initialSelectedStaff = [],
    isEditMode = false
  }: Props = $props()

  // 폼 상태
  let packageName = $state(initialPackageName)
  let description = $state(initialDescription)
  let selectedAssessments: string[] = $state([...initialSelectedAssessments])
  // let selectedStaff: string[] = $state([...initialSelectedStaff])
  // let selectedStaffMembers = $state<MemberListItem[]>([])

  // // 센터 멤버 목록 조회 (담당자 선택용)
  // const membersQuery = queryBuilder(getMemberList, () => ({
  //   centerId: $centerIdStore!,
  //   size: 100
  // }))

  // const staffListMembers: MemberListItem[] = $derived.by(() => {
  //   const members = membersQuery.data?.items ?? []
  //   return members.filter((m: MemberListItem) => m.is_active)
  // })

  // // initialSelectedStaff 또는 staffListMembers 변경 시 selectedStaffMembers 동기화
  // $effect(() => {
  //   const list = staffListMembers
  //   const init = initialSelectedStaff
  //   if (list.length === 0) return
  //   selectedStaffMembers = list.filter((m) => init.includes(m.id))
  // })

  // // selectedStaffMembers 변경 시 selectedStaff 동기화 (onConfirm용)
  // $effect(() => {
  //   selectedStaff = selectedStaffMembers.map((m) => m.id)
  // })

  // 필터 탭 상태
  type FilterTab =
    | 'all'
    | 'projective'
    | 'intelligence'
    | 'objective'
    | 'developmental'
  let activeFilter: FilterTab = $state('all')

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'projective', label: '투사적' },
    { key: 'intelligence', label: '지능' },
    { key: 'objective', label: '객관적' },
    { key: 'developmental', label: '발달' }
  ]

  // 타입별 아이콘 컴포넌트 매퍼 (서버 기준)
  const iconMapper: Record<string, typeof SvelteComponent<any>> = {
    projective: ProjectiveIcon,
    intelligence: IntelligenceDevelopmentIcon,
    objective: ObjectiveIcon,
    developmental: IntelligenceDevelopmentIcon
  }

  function getIconComponent(type: string): typeof SvelteComponent<any> | null {
    const normalized = (type || '').toLowerCase()
    return iconMapper[normalized] || null
  }

  // 센터 운영 검사 목록 조회
  const assessmentsQuery = queryBuilder<CenterAssessment[], CenterAssessment[]>(
    getCenterAssessments,
    () => ({ centerId: $centerIdStore!, is_active: true }),
    { refetchOnMount: true }
  )

  const isLoading = $derived(assessmentsQuery.isLoading)

  // 검사 데이터 가공
  const assessments = $derived.by(() => {
    const data = assessmentsQuery.data
    if (!data || !Array.isArray(data)) return []

    return data.map((item: CenterAssessment) => ({
      id: item.assessment_id,
      code: item.code,
      kor_name: item.kor_name,
      eng_name: item.eng_name,
      is_online_available: false,
      assessment_type: item.assessment_type
    }))
  })

  // 필터링된 검사 목록
  const filteredAssessments = $derived.by(() => {
    if (activeFilter === 'all') return assessments
    return assessments.filter((a) => a.assessment_type === activeFilter)
  })

  // 탭 인디케이터 (운영/미운영 탭과 동일한 패턴)
  // 탭 인디케이터 (모달 전용)
  let tabIndicator = $state({
    tabsContainer: null as HTMLDivElement | null,
    tabRefs: {
      all: null as HTMLButtonElement | null,
      projective: null as HTMLButtonElement | null,
      intelligence: null as HTMLButtonElement | null,
      objective: null as HTMLButtonElement | null,
      developmental: null as HTMLButtonElement | null
    },
    indicatorStyle: { left: 0, width: 0 }
  })

  async function updateTabIndicator() {
    const activeRef = tabIndicator.tabRefs[activeFilter]
    const container = tabIndicator.tabsContainer
    if (!activeRef || !container) return
    await tick()
    const containerRect = container.getBoundingClientRect()
    const tabRect = activeRef.getBoundingClientRect()
    tabIndicator = {
      ...tabIndicator,
      indicatorStyle: {
        left: tabRect.left - containerRect.left,
        width: tabRect.width
      }
    }
  }

  // 마운트 상태 추적
  let mounted = $state(false)

  $effect(() => {
    mounted = true
    return () => {
      mounted = false
    }
  })

  // 탭 인디케이터 업데이트
  $effect(() => {
    void activeFilter
    if (mounted && tabIndicator.tabsContainer) {
      requestAnimationFrame(() => updateTabIndicator())
    }
  })

  // 선택된 검사 정보
  const selectedAssessmentInfo = $derived.by(() => {
    return assessments.filter((a) => selectedAssessments.includes(a.id))
  })

  // 유효성 검사
  let isValid = $derived(
    packageName.trim().length > 0 && selectedAssessments.length >= 1
  )
  let isSubmitting = $state(false)

  function toggleAssessment(id: string) {
    if (selectedAssessments.includes(id)) {
      selectedAssessments = selectedAssessments.filter((a) => a !== id)
    } else {
      selectedAssessments = [...selectedAssessments, id]
    }
  }

  function removeAssessment(id: string) {
    selectedAssessments = selectedAssessments.filter((a) => a !== id)
  }

  function clearAllSelected() {
    selectedAssessments = []
  }

  async function handleSubmit() {
    console.log('[package-setting] handleSubmit called', {
      isValid,
      isSubmitting,
      packageName,
      description,
      selectedAssessments
    })
    if (!isValid || isSubmitting) {
      console.warn('[package-setting] blocked submit', {
        isValid,
        isSubmitting
      })
      return
    }
    console.log('[package-setting] submit start')
    isSubmitting = true
    try {
      await onConfirm({
        packageName: packageName.trim(),
        description: description.trim(),
        selectedAssessments
        // selectedStaff
      })
      console.log('[package-setting] submit success')
      closeModal()
    } catch (err) {
      console.error('[package-setting] submit error', err)
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showFooterBorder={true}
  showCloseButton={true}
  bodyClass="p-5 pb-7 overflow-y-auto"
  footerClass="px-5 pt-4 pb-5"
  title="검사 세트를 추가할게요"
>
  {#snippet body()}
    <div class="space-y-6">
      <!-- 세트명 입력 -->
      <div>
        <Typography
          className="mb-2"
          variant="body-01-medium"
          color="text-gray-700"
        >
          검사 세트명
        </Typography>
        <input
          type="text"
          bind:value={packageName}
          placeholder="검사 세트 이름을 입력해주세요"
          class="h-[44px] w-full rounded-lg border border-gray-200 px-2.5 text-sm text-gray-900 placeholder:text-placeholder transition-colors focus:border-border-active focus:outline-none"
        />
      </div>

      <!-- 검사 선택 -->
      <div>
        <Typography
          className="mb-3"
          variant="body-01-medium"
          color="text-gray-700"
        >
          검사 선택
        </Typography>

        <div
          class="h-[280px] rounded-lg bg-gray-50 px-4 pt-3 pb-4 overflow-hidden flex flex-col"
        >
          <!-- 필터 탭 -->
          <div class="mb-4 flex items-center border-b border-gray-200">
            <div class="relative flex" bind:this={tabIndicator.tabsContainer}>
              {#each filterTabs as tab}
                <button
                  onclick={() => (activeFilter = tab.key)}
                  bind:this={tabIndicator.tabRefs[tab.key]}
                  class="relative w-[100px] py-3 text-center transition-colors duration-200 {activeFilter ===
                  tab.key
                    ? 'text-primary-500'
                    : 'text-gray-500 hover:text-gray-700'}"
                >
                  <span class="text-body-01-normal-medium">{tab.label}</span>
                </button>
              {/each}
              <!-- 슬라이딩 인디케이터 -->
              <div
                class="absolute bottom-0 h-0.5 bg-primary-500 transition-all duration-300 ease-out"
                style="left: {tabIndicator.indicatorStyle
                  .left}px; width: {tabIndicator.indicatorStyle.width}px;"
              ></div>
            </div>
          </div>

          <!-- 검사 카드 그리드 -->
          <div class="flex flex-1 overflow-y-auto">
            {#if isLoading}
              <div class="flex w-full items-center justify-center py-8">
                <Typography variant="body-01-regular" color="text-gray-500">
                  검사 목록 로딩 중...
                </Typography>
              </div>
            {:else if filteredAssessments.length === 0}
              <div class="flex w-full items-center justify-center py-8">
                <Typography variant="body-01-regular" color="text-gray-500">
                  해당 카테고리에 검사가 없습니다.
                </Typography>
              </div>
            {:else}
              <div class="grid w-full grid-cols-3 gap-2">
                {#each filteredAssessments as assessment (assessment.id)}
                  {@const isSelected = selectedAssessments.includes(
                    assessment.id
                  )}
                  {@const IconComponent = getIconComponent(
                    assessment.assessment_type
                  )}
                  <button
                    onclick={() => toggleAssessment(assessment.id)}
                    class="relative flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-all {isSelected
                      ? 'border-primary-500 bg-white'
                      : 'border-gray-200 bg-white hover:border-gray-300'}"
                  >
                    <!-- 상단: 아이콘 + 체크박스 -->
                    <div class="flex items-start justify-between">
                      <!-- 아이콘 -->
                      <div class="flex-shrink-0">
                        {#if IconComponent}
                          <IconComponent />
                        {:else}
                          <div
                            class="flex h-5 w-5 items-center justify-center rounded bg-gray-100"
                          >
                            <span class="text-xs text-gray-400">📄</span>
                          </div>
                        {/if}
                      </div>

                      <!-- 체크박스 -->
                      <div>
                        {#if isSelected}
                          <RadioCircleCheckedIcon
                            fillColor="#3B82F6"
                            size={24}
                          />
                        {:else}
                          <RadioCircleUncheckedIcon size={24} />
                        {/if}
                      </div>
                    </div>

                    <!-- 하단: 검사명 -->
                    <div class="w-full min-w-0">
                      <Typography
                        variant="body-02-medium"
                        color={isSelected
                          ? 'text-primary-500'
                          : 'text-gray-800'}
                        className="truncate-safe"
                      >
                        {assessment.kor_name}
                      </Typography>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- 선택된 검사 — 선택 전에는 블록 자체를 렌더하지 않는다(빈 행이 바디 하단 여백 20을 침범) -->
      {#if selectedAssessmentInfo.length > 0}
        <div>
          <div class="mb-2 flex items-center justify-end">
            <button
              onclick={clearAllSelected}
              class="text-body-02-normal-regular text-gray-500"
            >
              전체 해제
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            {#each selectedAssessmentInfo as assessment (assessment.id)}
              <div
                class="flex h-[36px] items-center gap-2 rounded-full border border-primary-300 bg-primary-50 px-[10px]"
              >
                <Typography variant="body-02-medium" color="text-primary-500">
                  {assessment.kor_name}
                </Typography>
                <button onclick={() => removeAssessment(assessment.id)}>
                  <CloseWithCircleIcon16 />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 담당자 선택 (모달 내 인라인 렌더링, body 스크롤과 함께 동작) -->
      <!-- <StaffMultiSelectInline
        options={staffListMembers}
        bind:selected={selectedStaffMembers}
        label="담당자"
        required={false}
        placeholder="담당자 이름을 검색해주세요"
      /> -->
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end">
      <Button
        class="h-11 w-[120px] rounded-lg bg-primary-500 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
        onclick={handleSubmit}
        disabled={!isValid}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isEditMode ? '수정' : '추가'}
        </Typography>
      </Button>
    </div>
  {/snippet}
</BaseModal>
