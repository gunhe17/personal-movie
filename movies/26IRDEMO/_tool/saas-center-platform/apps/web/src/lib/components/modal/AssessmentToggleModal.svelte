<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Button from '../Button.svelte'
  import Switch from '../Switch.svelte'
  import Typography from '@common/components/Typography.svelte'
  import SearchIcon from '$lib/assets/SearchIcon.svelte'
  import { assessmentColorMapper } from '$lib/utils/assessmentColorMapper'
  import AssessmentAvatarInfoCard from '../cards/AssessmentAvatarInfoCard.svelte'
  import { queryBuilder, mutationBuilder } from '$lib/hooks/queries/builder'
  import {
    getAssessments,
    bulkUpdateActivationStatus,
    type Assessment
  } from '$lib/hooks/actions/assessment.action'
  import { getPackageListByCenterId } from '$lib/hooks/actions/package.action'
  import { modalStore } from '$lib/stores/modal'
  import { centerId, requireCenterId } from '$lib/stores/center.store'
  import AssessmentSetWarningModal from './AssessmentSetWarningModal.svelte'

  type TabType = 'enabled' | 'disabled'

  interface AssessmentItem extends Assessment {
    is_active: boolean
    symbol_color: string | undefined
    backgroundImage: string | undefined
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
  }

  let { modalId = '', closeModal = () => {} }: Props = $props()

  // 검색어 상태
  let searchQuery = $state('')
  // 현재 탭 상태
  let activeTab: TabType = $state('enabled')

  // 페이지와 동일한 getAssessments API 사용 (전체 조회)
  const assessmentsQuery = queryBuilder(getAssessments, () => ({
    queryParams: {
      page: 1,
      page_size: 1000 // 전체 조회
      // status 필터 없음 - 전체 목록
    }
  }))

  // 패키지 목록 쿼리 (세트에 포함된 검사 확인용)
  const packagesQuery = queryBuilder(getPackageListByCenterId, () => ({
    centerId: $centerId!,
    queryParams: {
      page: 1,
      page_size: 100
    }
  }))

  const assessmentList = $derived(assessmentsQuery)
  const queryData = $derived(assessmentList.data)
  const packagesData = $derived(packagesQuery.data?.data ?? [])

  // 검사 데이터 가공 (status를 is_active로 변환)
  const assessmentData = $derived.by((): AssessmentItem[] => {
    if (!queryData) return []

    const data = Array.isArray(queryData) ? queryData : queryData.data || []

    return data.map(
      (item: Assessment): AssessmentItem => ({
        ...item,
        is_active: item.status === 'public',
        symbol_color: assessmentColorMapper[item.code]?.symbol_color,
        backgroundImage: assessmentColorMapper[item.code]?.backgroundImage
      })
    )
  })

  // 초기 상태 저장 (서버에서 받은 원본 상태)
  const initialStates = $derived.by(() => {
    const stateMap = new Map<string, boolean>()
    assessmentData.forEach((item) => {
      stateMap.set(item.uid, item.is_active)
    })
    return stateMap
  })

  // 로컬 상태 관리 (사용자가 변경한 상태)
  let localStates = $state<Map<string, boolean>>(new Map())

  // 최근 토글된 아이템 (애니메이션을 위해 잠시 현재 탭에 유지)
  let recentlyToggledItems = $state<Set<string>>(new Set())

  // assessmentData가 변경될 때마다 localStates 초기화
  $effect(() => {
    const newStates = new Map<string, boolean>()
    assessmentData.forEach((item) => {
      newStates.set(item.uid, item.is_active)
    })
    localStates = newStates
  })

  // 현재 상태를 반영한 검사 데이터
  const displayAssessmentData = $derived.by(() => {
    return assessmentData.map((item) => ({
      ...item,
      is_active: localStates.get(item.uid) ?? item.is_active
    }))
  })

  // 운영중/운영안함 카운트
  const enabledCount = $derived(
    displayAssessmentData.filter((item) => item.is_active).length
  )
  const disabledCount = $derived(
    displayAssessmentData.filter((item) => !item.is_active).length
  )

  // 검색 및 탭 필터링된 데이터
  const filteredAssessmentData = $derived.by(() => {
    let filtered = displayAssessmentData

    // 탭 필터링 (최근 토글된 아이템은 애니메이션을 위해 잠시 유지)
    if (activeTab === 'enabled') {
      filtered = filtered.filter(
        (item) => item.is_active || recentlyToggledItems.has(item.uid)
      )
    } else {
      filtered = filtered.filter(
        (item) => !item.is_active || recentlyToggledItems.has(item.uid)
      )
    }

    // 검색어 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.kor_name.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query)
      )
    }

    return filtered
  })

  // Mutation 설정 (통합 Bulk API 사용)
  const updateActivationStatusMutation = mutationBuilder(
    bulkUpdateActivationStatus,
    ['getAssessments', 'assessments-summary'], // 검사 목록 및 요약 정보 무효화
    undefined,
    {
      successMessage: '검사 설정이 변경되었습니다.',
      errorMessage: '검사 설정 변경에 실패했습니다.'
    }
  )

  // 개별 검사 토글 핸들러 (로컬 상태만 변경)
  function handleToggleAssessment(item: (typeof displayAssessmentData)[0]) {
    const currentState = localStates.get(item.uid) ?? item.is_active
    const newStates = new Map(localStates)
    newStates.set(item.uid, !currentState)
    localStates = newStates

    // 애니메이션을 위해 잠시 현재 탭에 유지
    recentlyToggledItems = new Set([...recentlyToggledItems, item.uid])

    // 400ms 후 다른 탭으로 이동
    setTimeout(() => {
      recentlyToggledItems = new Set(
        [...recentlyToggledItems].filter((id) => id !== item.uid)
      )
    }, 400)
  }

  // 실제 API 호출 함수
  function executeUpdate(
    payload: Array<{ assessment_uid: string; is_active: boolean }>
  ) {
    console.log('🔄 변경할 검사 목록:', payload)
    updateActivationStatusMutation.mutate(
      {
        centerId: requireCenterId(),
        payload
      },
      {
        onSuccess: () => {
          console.log('✅ 검사 설정이 성공적으로 변경되었습니다.')
          closeModal()
        },
        onError: (error) => {
          console.error('❌ 검사 설정 변경 중 오류 발생:', error)
        }
      }
    )
  }

  // 적용하기 버튼 핸들러
  function handleConfirm() {
    const payload: Array<{ assessment_uid: string; is_active: boolean }> = []

    displayAssessmentData.forEach((item) => {
      const initialState = initialStates.get(item.uid) ?? false
      const currentState = localStates.get(item.uid) ?? item.is_active

      if (initialState !== currentState) {
        payload.push({
          assessment_uid: item.uid,
          is_active: currentState
        })
      }
    })

    if (payload.length === 0) {
      console.log('ℹ️ 변경 사항이 없습니다.')
      closeModal()
      return
    }

    // 비활성화되는 검사 UID 목록
    const deactivatingUids = payload
      .filter((item) => !item.is_active)
      .map((item) => item.assessment_uid)

    console.log('🔍 [handleConfirm] deactivatingUids:', deactivatingUids)
    console.log('🔍 [handleConfirm] packagesData:', packagesData)

    // 비활성화되는 검사가 포함된 세트 찾기
    const affectedSets: string[] = []
    if (deactivatingUids.length > 0 && packagesData.length > 0) {
      packagesData.forEach((pkg) => {
        console.log(
          '🔍 [handleConfirm] pkg:',
          pkg.name,
          'assessments:',
          pkg.assessments
        )
        const hasAffectedAssessment = pkg.assessments.some((assessment) =>
          deactivatingUids.includes(assessment.uid)
        )
        if (hasAffectedAssessment) {
          affectedSets.push(pkg.name)
        }
      })
    }

    console.log('🔍 [handleConfirm] affectedSets:', affectedSets)

    // 영향받는 세트가 있으면 경고 모달 표시
    if (affectedSets.length > 0) {
      modalStore.open({
        component: AssessmentSetWarningModal,
        props: {
          affectedSets,
          onConfirm: () => executeUpdate(payload)
        },
        options: { size: 'sm' }
      })
    } else {
      // 영향받는 세트가 없으면 바로 적용
      executeUpdate(payload)
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="lg"
  bodyClass="px-0 py-0"
  footerClass="px-5 pt-4 pb-5"
  title="검사 운영 여부를 설정할게요"
>
  {#snippet body()}
    <div class="flex flex-col">
      <!-- 설명 텍스트 -->
      <div class="px-5 pt-5">
        <Typography variant="body-02-regular" color="text-primary-500">
          개별 검사 운영 설정은 세트 판매 여부와 독립적으로 적용돼요
        </Typography>
      </div>

      <!-- 검색 입력 -->
      <div class="px-5 pt-5">
        <div
          class="flex h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3"
        >
          <SearchIcon />
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="검색어를 입력해주세요"
            class="text-body-02-normal-regular w-full bg-transparent outline-none placeholder:text-placeholder"
          />
        </div>
      </div>

      <!-- 탭 -->
      <div class="mt-4 flex gap-2 border-b border-gray-100 px-5">
        <button
          onclick={() => (activeTab = 'enabled')}
          class="relative px-3 py-2 text-sm font-medium transition-colors {activeTab ===
          'enabled'
            ? 'text-gray-900'
            : 'text-gray-400 hover:text-gray-600'}"
        >
          운영중 {enabledCount}
          {#if activeTab === 'enabled'}
            <div
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"
            ></div>
          {/if}
        </button>
        <button
          onclick={() => (activeTab = 'disabled')}
          class="relative px-3 py-2 text-sm font-medium transition-colors {activeTab ===
          'disabled'
            ? 'text-gray-900'
            : 'text-gray-400 hover:text-gray-600'}"
        >
          운영안함 {disabledCount}
          {#if activeTab === 'disabled'}
            <div
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"
            ></div>
          {/if}
        </button>
      </div>

      <!-- 검사 목록 (스크롤) -->
      <div class="max-h-[320px] overflow-y-auto px-5 pt-2 pb-7">
        {#each filteredAssessmentData as item (item.uid)}
          <div class="flex items-center justify-between py-2">
            <AssessmentAvatarInfoCard
              name_kr={item.kor_name}
              name_en={item.eng_name}
              symbol_color={item.symbol_color || '#000000'}
              is_online_available={item.is_online_available}
            />

            <!-- 운영 토글 -->
            <div class="flex items-center gap-2">
              <Typography
                variant="body-02-regular"
                color={item.is_active ? 'text-primary-500' : 'text-gray-400'}
              >
                {item.is_active ? '운영함' : '운영안함'}
              </Typography>
              <Switch
                checked={item.is_active}
                onclick={() => handleToggleAssessment(item)}
                ariaLabel="{item.code} 운영 토글"
              />
            </div>
          </div>
        {/each}

        {#if filteredAssessmentData.length === 0}
          <div class="flex items-center justify-center py-8 text-gray-400">
            검색 결과가 없습니다.
          </div>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <Button
        class="h-11 rounded-lg bg-primary-500 px-6 transition-colors hover:bg-primary-600"
        onclick={handleConfirm}
      >
        <Typography variant="body-01-normal-medium" color="text-white"
          >적용</Typography
        >
      </Button>
    </div>
  {/snippet}
</BaseModal>
