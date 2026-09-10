<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Textarea from '$components/Textarea.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    centerName: string
    onConfirm?: (reason: string) => void | Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    centerName,
    onConfirm = () => {}
  }: Props = $props()

  let reason = $state('')
  let isSubmitting = $state(false)

  const canSubmit = $derived(reason.trim().length > 0 && !isSubmitting)

  async function handleConfirm() {
    if (!canSubmit) return
    isSubmitting = true
    try {
      await onConfirm(reason.trim())
    } finally {
      isSubmitting = false
      closeModal()
    }
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
        센터 경고
      </Typography>
      <Typography
        variant="body-01-reading-regular"
        color="text-gray-600"
        className="whitespace-pre-line mb-5"
      >
        "{centerName}" 센터에 경고를 발송하시겠습니까?{'\n'}경고 내용이 센터
        관리자에게 알림으로 전달됩니다.
      </Typography>
      <div class="w-full text-left">
        <Textarea
          label="경고 사유"
          bind:value={reason}
          placeholder="경고 사유를 입력해주세요"
          rows={3}
          required
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        type="button"
        onclick={closeModal}
        class="flex items-center justify-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <Typography variant="title-01-semibold" color="text-gray-600">
          취소
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        disabled={!canSubmit}
        class="flex items-center justify-center h-11 w-full rounded-lg transition-colors bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Typography variant="title-01-semibold" color="text-white">
          경고 발송
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
