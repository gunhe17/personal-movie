<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  export interface RoleChangeItem {
    id: string
    name: string
    fromRoleName: string
    toRoleName: string
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    items?: RoleChangeItem[]
    onConfirm?: () => Promise<void> | void
  }

  let {
    modalId = '',
    closeModal = () => {},
    items = [],
    onConfirm = () => {}
  }: Props = $props()

  let isSubmitting = $state(false)

  async function handleConfirm() {
    if (isSubmitting) return
    isSubmitting = true
    try {
      await onConfirm?.()
      closeModal()
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  size="sm"
  bodyClass="px-5 pt-8 pb-3"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center">
      <svg
        width="54"
        height="54"
        viewBox="0 0 54 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M27 6L50 46H4L27 6Z" fill="#FCA338" />
        <path
          d="M27 20V31"
          stroke="#FFFEE3"
          stroke-width="3"
          stroke-linecap="round"
        />
        <circle cx="27" cy="38" r="2" fill="#FFFEE3" />
      </svg>

      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mt-4 mb-2"
      >
        역할이 변경돼요
      </Typography>
      <Typography
        variant="body-01-reading-regular"
        color="text-gray-600"
        className="text-center"
      >
        선택한 구성원 중 일부는 이미 다른 역할이 배정되어 있어요.
      </Typography>
      <Typography
        variant="body-01-reading-regular"
        color="text-gray-600"
        className="text-center"
      >
        추가하면 기존 역할이 해제되고 선택한 역할로 변경돼요.
      </Typography>

      <div class="mt-4 w-full rounded-lg bg-gray-50 p-3">
        <Typography
          variant="body-03-medium"
          color="text-gray-500"
          className="mb-2">변경 대상</Typography
        >
        <div class="max-h-36 overflow-y-auto space-y-1">
          {#each items as item}
            <p class="text-body-02-normal-regular text-gray-700">
              {item.name} ({item.fromRoleName} → {item.toRoleName})
            </p>
          {/each}
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        type="button"
        onclick={closeModal}
        class="h-11 w-full rounded-lg border border-gray-200 text-body-01-normal-medium text-gray-600 hover:bg-gray-50"
      >
        닫기
      </button>
      <button
        type="button"
        disabled={isSubmitting}
        onclick={handleConfirm}
        class="h-11 w-full rounded-lg border border-gray-200 text-body-01-normal-medium text-[#EF4967] hover:bg-[#D23E461A] disabled:opacity-50"
      >
        {isSubmitting ? '변경 중...' : '변경'}
      </button>
    </div>
  {/snippet}
</BaseModal>
