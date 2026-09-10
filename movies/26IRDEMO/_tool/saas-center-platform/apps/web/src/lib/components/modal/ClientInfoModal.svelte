<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { ClientDetailVM } from '$lib/features/assessment/status-detail/types'
  import MaleAvatarIcon from '$root/src/lib/assets/MaleAvatarIcon.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName, maskPhone, maskAllText } from '$lib/utils/maskingHandler'
  import { goto } from '$app/navigation'

  interface Props {
    modalId?: string
    closeModal?: () => void
    clientDetail?: ClientDetailVM | null
    clientCode?: string
    /** 내담자 상세 페이지 이동용 */
    clientId?: string
  }

  let { modalId, closeModal, clientDetail, clientCode, clientId }: Props =
    $props()

  const fields = $derived(
    clientDetail
      ? [
          {
            label: '생년월일',
            value: $isSecretMode ? '****-**-**' : clientDetail.birthDate,
            placeholder: '등록된 생년월일이 없습니다'
          },
          {
            label: '연락처',
            value: $isSecretMode ? '***-****-****' : clientDetail.phone,
            placeholder: '등록된 연락처가 없습니다'
          },
          {
            label: '주소',
            value: $isSecretMode ? '***' : clientDetail.address,
            placeholder: '등록된 주소가 없습니다'
          },
          {
            label: '메모',
            value: $isSecretMode ? '***' : clientDetail.memo,
            placeholder: '등록된 메모가 없습니다'
          }
        ]
      : []
  )
  const name = $derived(
    $isSecretMode
      ? maskName(clientDetail?.name ?? '-')
      : (clientDetail?.name ?? '-')
  )
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
    <Typography variant="title-01-semibold" tag="span" color="text-gray-900">
      {name}{#if clientCode}&nbsp;<span
          class="text-gray-400 font-normal text-sm">({clientCode})</span
        >{/if}
    </Typography>
  {/snippet}

  {#snippet body()}
    <div class="space-y-2.5">
      {#each fields as { label, value, placeholder }}
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
            color={value ? 'text-gray-800' : 'text-gray-300'}
          >
            {value || placeholder}
          </Typography>
        </div>
      {/each}
    </div>
  {/snippet}

  {#snippet footer()}
    {#if clientId}
      <button
        onclick={() => {
          closeModal?.()
          goto(`/clients/${clientId}`)
        }}
        class="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-gray-500 hover:text-primary-500 transition-colors"
      >
        <Typography variant="body-01-normal-medium">
          내담자 상세로 이동
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
