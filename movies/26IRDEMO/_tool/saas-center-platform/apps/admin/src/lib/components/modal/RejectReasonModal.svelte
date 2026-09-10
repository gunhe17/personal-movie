<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '$components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    title?: string
    placeholder?: string
    confirmText?: string
    onConfirm?: (reason: string) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    title = '거절',
    placeholder = '사유를 입력하세요',
    confirmText = '거절',
    onConfirm = () => {},
  }: Props = $props()

  let reason = $state('')
  const isValid = $derived(reason.trim().length > 0)

  function handleConfirm() {
    if (!isValid) return
    onConfirm(reason.trim())
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showCloseButton={true}
  headerClass="px-6 py-4"
  bodyClass="px-6 py-4"
  footerClass="px-6 py-4"
>
  {#snippet header()}
    <Typography variant="headline-02-semibold" color="text-gray-800">{title}</Typography>
  {/snippet}

  {#snippet body()}
    <div class="space-y-3">
      <label class="block text-sm font-medium text-gray-700" for="reject-reason">
        사유 <span class="text-red-500">*</span>
      </label>
      <input
        id="reject-reason"
        type="text"
        {placeholder}
        bind:value={reason}
        class="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      onclick={closeModal}
      class="flex items-center justify-center h-11 rounded-lg border border-gray-200 px-6 hover:border-gray-300 transition-colors"
    >
      <Typography variant="title-01-semibold" color="text-gray-600">취소</Typography>
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      disabled={!isValid}
      class="flex items-center justify-center h-11 rounded-lg px-6 transition-colors
        {isValid ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
    >
      <Typography variant="title-01-semibold" color={isValid ? 'text-white' : 'text-gray-400'}>{confirmText}</Typography>
    </button>
  {/snippet}
</BaseModal>
