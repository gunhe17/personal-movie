<script lang="ts">
  import WarningIcon54 from '../../assets/WarningIcon54.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    targetId?: string
    title?: string
    description?: string
    cancelText?: string
    confirmText?: string
    closeModal?: () => void
    onConfirm?: (id: string) => void
  }

  let {
    modalId = '',
    targetId = '',
    title = '검사 세트를 삭제할까요?',
    description = '접수된 내용이 삭제되며 복구할 수 없어요',
    cancelText = '닫기',
    confirmText = '삭제',
    closeModal = () => {},
    onConfirm = () => {}
  }: Props = $props()

  const handleSubmit = () => {
    if (!targetId || !onConfirm) return
    onConfirm(targetId)
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
      <!-- 경고 아이콘 -->
      <div class="mb-4">
        <WarningIcon54 />
      </div>

      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mb-3"
      >
        {title}
      </Typography>
      <div class="mb-1 text-center">
        {#each description.split('\n') as line}
          <Typography
            variant="body-02-reading-regular"
            color="text-gray-500"
            tag="p"
          >
            {line}
          </Typography>
        {/each}
      </div>
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        onclick={() => closeModal()}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          {cancelText}
        </Typography>
      </button>
      <button
        onclick={handleSubmit}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:bg-gray-50 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-etc-red-pink">
          {confirmText}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
