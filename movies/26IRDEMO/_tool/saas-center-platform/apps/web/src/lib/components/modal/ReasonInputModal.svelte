<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    title?: string
    message?: string
    placeholder?: string
    maxLength?: number
    confirmText?: string
    closeModal?: () => void
    _modalResolve?: (value: string | null) => void
    _modalReject?: (reason?: unknown) => void
  }

  let {
    modalId = '',
    title = '사유 입력',
    message = '',
    placeholder = '사유를 입력해주세요',
    maxLength = 500,
    confirmText = '확인',
    closeModal = () => {},
    _modalResolve = () => {},
    _modalReject = () => {}
  }: Props = $props()

  let text = $state('')

  const handleConfirm = () => {
    _modalResolve(text || 'confirmed')
    closeModal()
  }

  // X 버튼(BaseModal close) 시 'cancelled'로 resolve
  const handleClose = () => {
    _modalResolve('cancelled')
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  closeModal={handleClose}
  size="sm"
  showHeaderBorder={true}
  showFooterBorder={false}
  showCloseButton={true}
  {title}
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col p-5 pb-7">
      {#if message}
        <div class="mb-3 flex flex-col gap-2">
          {#each message.split('\n') as line}
            <Typography variant="body-02-medium" color="text-gray-500">
              {line}
            </Typography>
          {/each}
        </div>
      {/if}
      <textarea
        bind:value={text}
        {placeholder}
        maxlength={maxLength}
        rows={4}
        class="w-full rounded-lg border border-gray-200 text-body-03-reading-regular text-gray-800 placeholder:text-placeholder outline-none focus:border-border-active resize-none px-3 py-3.5"
      ></textarea>
      <!-- 입력↔카운터 4 (딸린 보조 표시) -->
      <div class="mt-1 text-right text-label-02-normal-regular text-gray-400">
        {text.length}/{maxLength}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        type="button"
        onclick={handleConfirm}
        class="flex-center h-11 rounded-lg bg-primary-500 px-5 hover:bg-primary-600 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {confirmText}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
