<script lang="ts">
  import { browser } from '$app/environment'
  import { twMerge } from 'tailwind-merge'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type {
    CounselingCaseBaseDetail,
    CaseClient
  } from '../../types/counseling'
  import type {
    MemberListItem,
    MeMemberResponse
  } from '../../hooks/actions/member.action'
  import { formatUtcToKst } from '../../utils/date'
  import { queryBuilder, mutationBuilder } from '../../hooks/queries/builder'
  import { centerId } from '../../stores/center.store'
  import { isCounselor } from '../../stores/permission.view'
  import { getMemberList, getMeMember } from '../../hooks/actions/member.action'
  import { patchCounselingCase } from '../../hooks/actions/counseling.action'
  import { StaffSection } from '../../features/schedule/counsel'
  import { snackbarStore } from '../../stores/snackbar'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { meMemberToMemberItem } from '../../features/assessment/receive'

  import LockIcon14 from '../../assets/LockIcon14.svelte'
  import NextStepIcon from '../../assets/NextStepIcon.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    counselingDetail: CounselingCaseBaseDetail
    clients: CaseClient[]
  }

  let {
    modalId = '',
    closeModal = () => {},
    counselingDetail,
    clients
  }: Props = $props()

  const queryClient = useQueryClient()

  /* ---------------- queries ---------------- */
  const memberQuery = $derived(
    queryBuilder(getMemberList, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId && !$isCounselor
    })
  )

  const meMemberQuery = $derived(
    queryBuilder(getMeMember, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId && $isCounselor
    })
  )

  const memberList = $derived(
    $isCounselor
      ? meMemberQuery.data
        ? [meMemberToMemberItem(meMemberQuery.data as MeMemberResponse)]
        : []
      : memberQuery.data
        ? (memberQuery.data?.items as MemberListItem[])
        : []
  )

  const patchCase = mutationBuilder(
    patchCounselingCase,
    [],
    [['getCounselingDetailById'], ['getCounselingsByCenterId']]
  )

  /* ---------------- state ---------------- */
  let selectedMember = $state<MemberListItem[]>([])
  let isPreFilled = $state(false)

  /* ---------------- pre-fill ---------------- */
  $effect(() => {
    if (isPreFilled) return
    if (!memberList.length) return

    // 담당자
    const counselorSource = counselingDetail.counselors?.length
      ? counselingDetail.counselors
      : (counselingDetail.sessions?.[0]?.counselors ?? [])
    if (counselorSource.length) {
      const matched = memberList.filter((m) =>
        counselorSource.some((c) => c.counselor_id === m.id)
      )
      selectedMember =
        matched.length > 0
          ? matched
          : counselorSource.map((c) => ({
              id: c.counselor_id,
              role_code: '',
              role_name: '',
              employment_type: '',
              color: null,
              memo: null,
              is_active: true as const,
              person: { name: c.counselor_name, phone: null, email: null },
              created_at: ''
            }))
    }

    isPreFilled = true
  })

  /* ---------------- derived ---------------- */
  const isCounselorChanged = $derived.by(() => {
    const originalId = counselingDetail.counselor_id
    if (selectedMember.length === 0) return false
    return selectedMember[0].id !== originalId
  })

  const canSubmit = $derived(selectedMember.length > 0 && isCounselorChanged)

  /* ---------------- readonly fields ---------------- */
  // svelte-ignore state_referenced_locally
  const readonlyFields = $derived([
    {
      label: '프로그램',
      value: counselingDetail.program_name
    },
    {
      label: '형태',
      value: counselingDetail.case_type === 'individual' ? '1:1 개별' : '그룹'
    },
    {
      label: '내담자',
      value: clients.map((c) => c.name).join(', ')
    },
    {
      label: '접수일',
      value: formatUtcToKst(counselingDetail.created_at, 'YYYY-MM-DD (d) HH:mm')
    },
    {
      label: '시작 일정',
      value: formatUtcToKst(
        counselingDetail.first_session_start,
        'YYYY-MM-DD (d) HH:mm'
      )
    },
    {
      label: '종결일',
      value: counselingDetail.completed_at
        ? formatUtcToKst(counselingDetail.completed_at, 'YYYY-MM-DD (d) HH:mm')
        : '-'
    }
  ])

  /* ---------------- handlers ---------------- */
  function toggleMember(member: MemberListItem) {
    const exists = selectedMember.some((m) => m.id === member.id)
    selectedMember = exists
      ? selectedMember.filter((m) => m.id !== member.id)
      : [...selectedMember, member]
  }

  function handleSubmit() {
    if (!canSubmit) return
    patchCase.mutate(
      {
        centerId: $centerId!,
        counselingId: counselingDetail.case_id,
        counselor_id: selectedMember[0]?.id
      },
      {
        onSuccess() {
          snackbarStore.success('상담 정보가 변경되었습니다')
          closeModal()
        },
        onError() {
          snackbarStore.error('상담 변경에 실패했습니다')
        }
      }
    )
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={false}
  size="lg"
  bodyClass="p-0!"
  footerClass="px-5 pt-4 pb-5"
  headerClass="px-5 py-4 items-start!"
>
  {#snippet header()}
    <!-- 2줄 헤더 규격: 타이틀↔부제 8 · 부제 body-02-normal-regular/gray-500 (Web_Design.md §modal) -->
    <div class="flex flex-col gap-2">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        상담 변경
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-gray-500">
        변경된 내용은 이후 예정된 모든 회기에 반영됩니다
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="p-5 pb-7 space-y-5">
      <!-- 현재 정보 요약 (읽기 전용) -->
      <div>
        <div class="mb-3 flex items-center gap-1.5">
          <LockIcon14 />
          <Typography variant="body-02-medium" color="text-gray-400">
            기본 정보
          </Typography>
        </div>
        <div
          class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
        >
          {#each readonlyFields as field}
            <div class="grid grid-cols-[80px_1fr] items-start">
              <Typography variant="body-02-regular" color="text-gray-400">
                {field.label}
              </Typography>
              <Typography variant="body-02-regular" color="text-gray-500">
                {field.value}
              </Typography>
            </div>
          {/each}
        </div>
      </div>

      <!-- 화살표 -->
      <div class="w-full flex justify-center">
        <NextStepIcon />
      </div>

      <!-- 변경 영역 -->
      <div class="space-y-6">
        <!-- 담당자 변경 -->
        <div class="space-y-2">
          <StaffSection
            {memberList}
            isCounselor={$isCounselor}
            {selectedMember}
            onToggleMember={toggleMember}
          />
          {#if isCounselorChanged}
            <div class="flex items-center">
              <Typography variant="body-02-regular" color="text-gray-500">
                {counselingDetail.counselor_name}
              </Typography>
              <Typography variant="body-02-regular">
                <span class="mx-1 text-gray-400">&rarr;</span>
                <span class="text-primary-500">
                  {selectedMember.map((m) => m.person.name).join(', ')}(으)로
                  변경
                </span>
              </Typography>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end items-center">
      <div class="flex gap-2">
        <button
          onclick={closeModal}
          class="h-11 w-35 rounded-lg flex-center bg-gray-100 hover:bg-gray-200 duration-200"
        >
          <Typography variant="body-01-normal-medium" color="text-gray-600">
            취소
          </Typography>
        </button>
        <button
          onclick={handleSubmit}
          disabled={!canSubmit}
          class={twMerge(
            'h-11 px-6 w-35 rounded-lg flex-center transition',
            canSubmit
              ? 'bg-primary-500 hover:bg-primary-400'
              : 'bg-action-primary-disabled text-action-primary-disabled-fg cursor-not-allowed'
          )}
        >
          <Typography variant="body-01-normal-medium" color="text-white">
            수정
          </Typography>
        </button>
      </div>
    </div>
  {/snippet}
</BaseModal>
