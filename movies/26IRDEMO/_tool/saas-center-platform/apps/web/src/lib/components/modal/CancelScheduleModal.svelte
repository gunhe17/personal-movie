<script lang="ts">
  import WarningTriangleYellow54 from '../../assets/WarningTriangleYellow54.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    title?: string
    description?: string
    closeModal?: () => void
    onConfirm?: (cancelReason: string) => void
  }

  let {
    modalId = '',
    title = '일정을 취소할까요?',
    description = '취소된 일정은 캘린더에 취소 상태로 남아있어요.',
    closeModal = () => {},
    onConfirm = () => {}
  }: Props = $props()

  let cancelReason = $state('')

  const handleConfirm = () => {
    onConfirm(cancelReason.trim())
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
    <div class="flex flex-col items-center text-center">
      <WarningTriangleYellow54 />
      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mt-4 mb-2"
      >
        {title}
      </Typography>
      {#if description}
        <Typography
          variant="body-01-reading-regular"
          color="text-gray-600"
          className="mb-1"
        >
          {description}
        </Typography>
      {/if}
    </div>
    <div class="mt-4 w-full">
      <textarea
        bind:value={cancelReason}
        placeholder="취소 사유를 입력해주세요 (선택)"
        maxlength={500}
        rows={3}
        class="w-full rounded-lg border border-gray-200 bg-gray-50 text-body-03-reading-regular text-gray-700 outline-none resize-none focus:border-border-active focus:bg-white transition-colors px-3 py-3.5"
      ></textarea>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        type="button"
        onclick={closeModal}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          아니요
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-[#EF4967]">
          취소할게요
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
