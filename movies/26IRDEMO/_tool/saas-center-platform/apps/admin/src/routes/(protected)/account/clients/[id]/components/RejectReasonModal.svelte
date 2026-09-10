<!--
  RejectReasonModal
  자격 반려 사유 입력 모달.
  modalStore.openWithPromise() 로 사용 → resolve(reason) 또는 resolve(null)
-->
<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    _modalResolve?: (value: string | null) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    _modalResolve = () => {}
  }: Props = $props()

  let reason = $state('')

  const isValid = $derived(reason.trim().length > 0)

  function handleConfirm() {
    if (!isValid) return
    _modalResolve(reason.trim())
    closeModal()
  }

  function handleCancel() {
    _modalResolve(null)
    closeModal()
  }
</script>

<BaseModal {modalId} closeModal={handleCancel} headerClass="px-6 py-4" bodyClass="px-6 py-5">
  {#snippet header()}
    <Typography variant="title-02-semibold" color="text-gray-900">
      반려 사유
    </Typography>
  {/snippet}

  {#snippet body()}
    <div class="space-y-3">
      <Typography variant="body-02-regular" color="text-gray-600">
        반려 사유를 입력해주세요. 사유는 신청자에게 알림으로 전달됩니다.
      </Typography>
      <textarea
        bind:value={reason}
        rows="4"
        placeholder="예: 첨부된 자격증을 식별할 수 없습니다."
        class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
      ></textarea>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button color="light" content="취소" onclick={handleCancel} />
    <Button
      color="primary"
      content="반려하기"
      disabled={!isValid}
      onclick={handleConfirm}
    />
  {/snippet}
</BaseModal>
