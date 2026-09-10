<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '$components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    title?: string
    message?: string
    cancelText?: string
    confirmText?: string
    onCancel?: () => void
    onConfirm?: () => void
    type?: 'info' | 'warning' | 'danger'
    _modalResolve?: (value: string | null) => void
    _modalReject?: (reason?: unknown) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    title = '확인',
    message = '',
    cancelText = '취소',
    confirmText = '확인',
    onCancel = () => {},
    onConfirm = () => {},
    type = 'info',
    _modalResolve = () => {},
    _modalReject = () => {}
  }: Props = $props()

  const handleConfirm = () => {
    _modalResolve('confirmed')
    onConfirm()
    closeModal()
  }

  const handleCancel = () => {
    _modalResolve('cancelled')
    onCancel()
    closeModal()
  }

  // admin 테마에 맞춤 — 확정 버튼은 admin primary(보라) 사용 (기존 파란색 제거)
  const confirmButtonStyle: Record<string, string> = {
    info: 'bg-primary-400 hover:bg-primary-300 text-white',
    warning: 'bg-primary-400 hover:bg-primary-300 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  bodyClass="pt-8 pb-3 px-6"
  footerClass="px-6 py-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center text-center">
      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mb-3"
      >
        {title}
      </Typography>
      {#if message}
        <Typography variant="body-01-reading-regular" color="text-gray-600" className="whitespace-pre-line">
          {message}
        </Typography>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        type="button"
        onclick={handleCancel}
        class="flex items-center justify-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <Typography variant="title-01-semibold" color="text-gray-600">
          {cancelText}
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        class="flex items-center justify-center h-11 w-full rounded-lg transition-colors {confirmButtonStyle[type]}"
      >
        <Typography variant="title-01-semibold" color="text-white">
          {confirmText}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
