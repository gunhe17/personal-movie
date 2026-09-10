<script lang="ts">
  import { goto } from '$app/navigation'
  import { queryBuilder } from '../../hooks/queries/builder'

  import { centerId } from '../../stores/center.store'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { dateToString } from '../../utils/date'
  import { getMemberDetail } from '../../hooks/actions/member.action'
  import { MEMBER_EMPLOYMENT_TYPE_MAP } from '../../features/members'

  interface Props {
    modalId?: string
    closeModal?: () => void
    memberId?: string
  }

  let { modalId, closeModal, memberId }: Props = $props()

  const detailQuery = queryBuilder(getMemberDetail, () =>
    buildMemberListInput($centerId!)
  )

  const memberDetail = $derived(detailQuery.data)

  const fields = $derived(
    memberDetail
      ? [
          { label: '생년월일', value: memberDetail.person.birth },
          { label: '이메일', value: memberDetail.person.email },
          { label: '연락처', value: memberDetail.person.phone },
          {
            label: '계약형태',
            value:
              MEMBER_EMPLOYMENT_TYPE_MAP[
                memberDetail.employment_type as keyof typeof MEMBER_EMPLOYMENT_TYPE_MAP
              ] || memberDetail.employment_type
          },
          {
            label: '입사일',
            value: dateToString(memberDetail.created_at, 'YYYY-MM-DD')
          },
          { label: '메모', value: memberDetail.memo }
        ]
      : []
  )

  function buildMemberListInput(centerId: string) {
    return {
      centerId,
      memberId
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={false}
  bodyClass="p-5 pb-7"
  title="담당자 정보"
>
  {#snippet body()}
    <div class="space-y-2">
      <div class="flex items-center gap-2 mb-4">
        <Typography variant="title-01-normal-semibold">
          {memberDetail?.person.name}
        </Typography>
      </div>
      <div class="space-y-2">
        {#each fields as { label, value }}
          <div class="flex items-baseline gap-2">
            <Typography
              variant="body-01-regular"
              tag="span"
              color="text-gray-500"
              className="w-24 shrink-0"
            >
              {label}
            </Typography>
            <Typography
              variant="body-01-regular"
              tag="span"
              color="text-gray-800">{value || '-'}</Typography
            >
          </div>
        {/each}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      onclick={() => {
        closeModal?.()
        goto(`/member/${memberId}`)
      }}
      class="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-gray-500 hover:text-primary-500 transition-colors"
    >
      <Typography variant="body-01-normal-medium">
        담당자 상세로 이동
      </Typography>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path
          d="M7 5L12 10L7 15"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {/snippet}
</BaseModal>
