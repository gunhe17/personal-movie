<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { SpecialistDetailVM } from '$lib/features/assessment/status-detail/types'
  import MaleAvatarIcon from '$root/src/lib/assets/MaleAvatarIcon.svelte'
  import { goto } from '$app/navigation'

  interface Props {
    modalId?: string
    closeModal?: () => void
    specialistDetail?: SpecialistDetailVM | null
    /** 담당자 상세 페이지 이동용 */
    memberId?: string
  }

  let { modalId, closeModal, specialistDetail, memberId }: Props = $props()

  const fields = $derived(
    specialistDetail
      ? [
          { label: '생년월일', value: specialistDetail.birthDate },
          { label: '이메일', value: specialistDetail.email },
          { label: '연락처', value: specialistDetail.phone },
          { label: '계약형태', value: specialistDetail.employmentTypeLabel },
          { label: '입사일', value: specialistDetail.hireDate },
          { label: '메모', value: specialistDetail.memo }
        ]
      : []
  )
  const name = $derived(specialistDetail?.name ?? '-')
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  bodyClass="p-5 pb-7"
  headerClass="px-5 py-4"
>
  {#snippet header()}
    <div class="flex items-center gap-2">
      <Typography variant="title-01-semibold" tag="span" color="text-gray-900">
        {name}
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="space-y-2.5">
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
            color="text-gray-800"
          >
            {value || '-'}
          </Typography>
        </div>
      {/each}
    </div>
  {/snippet}

  {#snippet footer()}
    {#if memberId}
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
    {/if}
  {/snippet}
</BaseModal>
