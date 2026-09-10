<script lang="ts">
  import WarningIcon54 from '$lib/assets/WarningIcon54.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    clientName: string
    categories: string[]
    onConfirm?: () => void
    /** 되돌아갈 때 호출 — 스위치처럼 낙관적으로 켜둔 컨트롤을 원복시킨다 */
    onCancel?: () => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    clientName,
    categories,
    onConfirm = () => {},
    onCancel = () => {}
  }: Props = $props()

  function handleConfirm() {
    onConfirm()
    closeModal()
  }

  function handleCancel() {
    onCancel()
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  bodyClass="px-5 pt-8 pb-3"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center">
      <div class="mb-4"><WarningIcon54 /></div>

      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mb-3"
      >
        이대로 공유할까요?
      </Typography>
      <div class="mb-1 text-center">
        <Typography
          variant="body-02-reading-regular"
          color="text-gray-500"
          tag="p"
        >
          공유문에 아래 내용이 담겨 있어요.
        </Typography>
        <Typography
          variant="body-02-reading-regular"
          color="text-gray-500"
          tag="p"
        >
          공유하면 앱에서 바로 볼 수 있고, 이미 읽은 내용은 되돌릴 수 없어요.
        </Typography>
      </div>

      <div class="mt-4 w-full rounded-lg bg-status-danger-bg px-4 py-3">
        <Typography
          variant="body-02-reading-regular"
          color="text-etc-red-pink"
          className="mb-2"
        >
          확인이 필요한 내용
        </Typography>
        <ul class="flex flex-col gap-1">
          {#each categories as category (category)}
            <li class="flex items-center gap-2">
              <span class="h-1 w-1 shrink-0 rounded-full bg-red-400"></span>
              <Typography
                variant="body-02-reading-regular"
                color="text-gray-700"
              >
                {category}
              </Typography>
            </li>
          {/each}
        </ul>
      </div>

      <Typography
        variant="body-03-normal-regular"
        color="text-gray-400"
        className="mt-3 text-center"
        tag="p"
      >
        {clientName}님이 알리기를 원하지 않은 내용은 아닌지 다시 한 번
        확인해주세요.
      </Typography>
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="grid w-full grid-cols-2 gap-3">
      <button
        onclick={handleCancel}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 duration-200 hover:border-gray-300"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          다시 볼게요
        </Typography>
      </button>
      <button
        onclick={handleConfirm}
        class="flex-center h-11 w-full rounded-lg bg-blue-500 duration-200 hover:bg-blue-600"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          확인하고 공유
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
