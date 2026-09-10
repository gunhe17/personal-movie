<script lang="ts">
  import { browser } from '$app/environment'
  import { twMerge } from 'tailwind-merge'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import {
    AssessmentSelector,
    SelectableButtonGroup
  } from '$lib/components/assessment/receive'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getCenterAssessments,
    type CenterAssessment
  } from '$lib/hooks/actions/assessment.action'
  import { getAssessmentSetList } from '$lib/hooks/actions/assessmentSet.action'
  import {
    getMemberList,
    getMeMember,
    type MemberListItem
  } from '$lib/hooks/actions/member.action'
  import { centerId } from '$lib/stores/center.store'
  import { isCounselor } from '$lib/stores/permission.view'
  import {
    buildAssessmentsQueryInput,
    buildPackagesQueryInput,
    buildMembersQueryInput
  } from '$lib/features/assessment/receive/query-builders'
  import {
    mapAssessmentSetItemsToPackages,
    mapMemberOptions,
    meMemberToMemberItem,
    mapCaseCounselorToMemberItem,
    mapCaseTasksToAssessmentItemNames
  } from '$lib/features/assessment/receive/view-model'
  import type { PackageType } from '$lib/hooks/actions/package.action'
  import type { CaseDetail } from '$lib/hooks/actions/case.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    caseDetail: CaseDetail
    onConfirm: (data: {
      assessmentIds: string[]
      counselorId: string | null
      assistantIds: string[]
      setId: string | null
    }) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    caseDetail,
    onConfirm
  }: Props = $props()

  let isSubmitting = $state(false)

  // ============ 쿼리 (ternary 조건부 + staleTime 캐시 패턴) ============
  const assessmentsQuery = $derived(
    browser && $centerId
      ? queryBuilder<CenterAssessment[], CenterAssessment[]>(
          getCenterAssessments,
          () => ({ centerId: $centerId!, ...buildAssessmentsQueryInput() }),
          { staleTime: 5 * 60 * 1000 }
        )
      : null
  )
  const packagesQuery = $derived(
    browser && $centerId
      ? queryBuilder(
          getAssessmentSetList,
          () => buildPackagesQueryInput($centerId!),
          {
            staleTime: 5 * 60 * 1000
          }
        )
      : null
  )
  const membersQuery = $derived(
    browser && $centerId && !$isCounselor
      ? queryBuilder(getMemberList, () => buildMembersQueryInput($centerId!), {
          staleTime: 5 * 60 * 1000
        })
      : null
  )
  const meMemberQuery = $derived(
    browser && $centerId && $isCounselor
      ? queryBuilder(getMeMember, () => ({ centerId: $centerId! }), {
          staleTime: 5 * 60 * 1000
        })
      : null
  )

  // ============ 파생 데이터 ============
  const assessmentsData = $derived(assessmentsQuery?.data ?? [])
  const assessmentOptions = $derived(assessmentsData.map((a) => a.eng_name))
  const assessmentKorNameMap = $derived<Record<string, string>>(
    Object.fromEntries(
      assessmentsData.map((a) => [a.eng_name, a.kor_name ?? ''])
    )
  )
  const packagesData = $derived(
    mapAssessmentSetItemsToPackages(packagesQuery?.data?.items ?? [], $centerId)
  )
  const membersData = $derived(
    $isCounselor
      ? meMemberQuery?.data
        ? [meMemberToMemberItem(meMemberQuery.data)]
        : []
      : (membersQuery?.data?.items ?? [])
  )
  const memberOptions = $derived(mapMemberOptions(membersData))
  const membersLoading = $derived(
    $isCounselor
      ? (meMemberQuery?.isLoading ?? false) && !meMemberQuery?.data
      : (membersQuery?.isLoading ?? false) && !membersQuery?.data
  )
  const membersEmpty = $derived(!membersLoading && memberOptions.length === 0)
  const isDataLoading = $derived(
    ((assessmentsQuery?.isLoading ?? false) && !assessmentsQuery?.data) ||
      ((packagesQuery?.isLoading ?? false) && !packagesQuery?.data) ||
      membersLoading
  )

  // ============ 폼 상태 ============
  let selectedAssessmentItems = $state<string[]>([])
  let selectedPackageIds = $state<string[]>([])
  let excludedAssessmentItems = $state<string[]>([])
  let selectedMember = $state<MemberListItem[]>([])

  // 세트에 포함된 검사 목록
  const assessmentsInSelectedPackages = $derived.by(() => {
    const names: string[] = []
    for (const pkg of packagesData) {
      if (!selectedPackageIds.includes(pkg.uid)) continue
      for (const a of pkg.assessments) {
        if (!names.includes(a.eng_name)) names.push(a.eng_name)
      }
    }
    return names
  })

  // ============ Pre-fill (데이터 로드 후 1회) ============
  let preFilled = $state(false)

  $effect(() => {
    if (
      preFilled ||
      assessmentsQuery?.isLoading ||
      !assessmentsData.length ||
      membersLoading
    )
      return
    preFilled = true

    // 검사 항목 복원
    selectedAssessmentItems = mapCaseTasksToAssessmentItemNames(
      caseDetail.tasks,
      assessmentsData
    )

    // 세트 복원
    if (caseDetail.set_id) {
      const matchedPkg = packagesData.find((p) => p.uid === caseDetail.set_id)
      if (matchedPkg) {
        selectedPackageIds = [matchedPkg.uid]
      }
    }

    // 담당자 복원
    const members: MemberListItem[] = []
    if (caseDetail.counselor) {
      // 멤버 목록에서 찾기 (활성 상태 확인)
      const found = membersData.find(
        (m) => m.id === caseDetail.counselor.member_id
      )
      members.push(found ?? mapCaseCounselorToMemberItem(caseDetail.counselor))
    }
    if (caseDetail.assistants?.length) {
      for (const assistant of caseDetail.assistants) {
        const found = membersData.find((m) => m.id === assistant.member_id)
        members.push(found ?? mapCaseCounselorToMemberItem(assistant))
      }
    }
    selectedMember = members
  })

  // 제외 항목 자동 정리
  $effect(() => {
    const cleaned = excludedAssessmentItems.filter((item) =>
      assessmentsInSelectedPackages.includes(item)
    )
    if (cleaned.length !== excludedAssessmentItems.length) {
      excludedAssessmentItems = cleaned
    }
  })

  // ============ 핸들러 ============
  function togglePackage(pkg: PackageType) {
    if (selectedPackageIds.includes(pkg.uid)) {
      selectedPackageIds = selectedPackageIds.filter((id) => id !== pkg.uid)
    } else {
      selectedPackageIds = [...selectedPackageIds, pkg.uid]
    }
  }

  function toggleAssessmentItem(item: string) {
    if (assessmentsInSelectedPackages.includes(item)) {
      // 세트에 포함된 검사 → 제외/포함 토글
      if (excludedAssessmentItems.includes(item)) {
        excludedAssessmentItems = excludedAssessmentItems.filter(
          (i) => i !== item
        )
      } else {
        excludedAssessmentItems = [...excludedAssessmentItems, item]
      }
    } else {
      // 개별 검사 토글
      if (selectedAssessmentItems.includes(item)) {
        selectedAssessmentItems = selectedAssessmentItems.filter(
          (i) => i !== item
        )
      } else {
        selectedAssessmentItems = [...selectedAssessmentItems, item]
      }
    }
  }

  function handleMemberSelect(id: string) {
    const member = membersData.find((m: MemberListItem) => m.id === id)
    if (member) {
      if (selectedMember.some((m: MemberListItem) => m.id === id)) {
        selectedMember = selectedMember.filter(
          (m: MemberListItem) => m.id !== id
        )
      } else {
        selectedMember = [...selectedMember, member]
      }
    }
  }

  // 최종 검사 ID 목록 계산
  function getAssessmentIds(): string[] {
    const selectedIds = assessmentsData
      .filter((a) => selectedAssessmentItems.includes(a.eng_name))
      .map((a) => a.assessment_id)

    const packageIds = packagesData
      .filter((pkg) => selectedPackageIds.includes(pkg.uid))
      .flatMap((pkg) =>
        pkg.assessments
          .filter((a) => !excludedAssessmentItems.includes(a.eng_name))
          .map((a) => a.uid)
      )

    return [...new Set([...selectedIds, ...packageIds])]
  }

  const canSubmit = $derived(
    !isSubmitting &&
      !isDataLoading &&
      (selectedAssessmentItems.length > 0 || selectedPackageIds.length > 0) &&
      selectedMember.length > 0
  )

  async function handleConfirm() {
    if (!canSubmit) return
    isSubmitting = true
    try {
      const assessmentIds = getAssessmentIds()
      const mainCounselorId = selectedMember[0]?.id ?? null
      const assistantIds = selectedMember.slice(1).map((m) => m.id)
      // 세트 ID: 단일 세트만 선택된 경우 반영
      const setId =
        selectedPackageIds.length === 1 ? selectedPackageIds[0] : null

      onConfirm({
        assessmentIds,
        counselorId: mainCounselorId,
        assistantIds,
        setId
      })
      closeModal()
    } finally {
      isSubmitting = false
    }
  }

  // 내담자 이름
  const clientName = $derived(caseDetail.clients?.[0]?.name ?? '')
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="lg"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  title="검사 정보 수정"
>
  {#snippet body()}
    <div class="space-y-6">
      {#if isDataLoading}
        <div class="flex items-center justify-center py-12">
          <Typography variant="body-01-medium" color="text-gray-400">
            데이터를 불러오는 중...
          </Typography>
        </div>
      {:else}
        <!-- 내담자 (읽기 전용) -->
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            내담자
          </Typography>
          <div
            class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5"
          >
            <Typography
              variant="body-01-regular"
              tag="span"
              color="text-gray-700"
            >
              {clientName || '내담자 정보 없음'}
            </Typography>
          </div>
        </div>

        <!-- 검사 항목 -->
        <AssessmentSelector
          labelVariant="body-02-normal-medium"
          labelClass="mb-2"
          packages={packagesData}
          {assessmentOptions}
          korNameMap={assessmentKorNameMap}
          {selectedPackageIds}
          {selectedAssessmentItems}
          {excludedAssessmentItems}
          {assessmentsInSelectedPackages}
          onTogglePackage={togglePackage}
          onToggleAssessment={toggleAssessmentItem}
        />

        <!-- 담당자 -->
        <div>
          {#if membersEmpty}
            <div>
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="mb-2"
              >
                담당자 <span class="field-required">*</span>
              </Typography>
              <div
                class="flex flex-col items-center gap-2 rounded-lg bg-gray-50 py-6"
              >
                <Typography variant="body-02-regular" color="text-gray-400">
                  등록된 담당자가 없어요
                </Typography>
              </div>
            </div>
          {:else}
            <SelectableButtonGroup
              label="담당자"
              labelClass="mb-2"
              required={true}
              options={memberOptions}
              selected={selectedMember.map((m) => m.id)}
              multiple={true}
              onSelect={handleMemberSelect}
            />
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-end gap-2">
      <button
        onclick={closeModal}
        class="h-11 w-35 rounded-lg flex-center bg-gray-100 hover:bg-gray-200 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          취소
        </Typography>
      </button>
      <button
        onclick={handleConfirm}
        disabled={!canSubmit}
        class={twMerge(
          'w-[140px] h-11 rounded-lg flex-center transition',
          canSubmit
            ? 'bg-primary-500 hover:bg-primary-400'
            : 'bg-action-primary-disabled cursor-not-allowed'
        )}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isSubmitting ? '수정 중...' : '수정'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
