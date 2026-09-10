<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Button from '$lib/components/Button.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'

  interface Props {
    modalId?: string
    assessmentName?: string
    closeModal?: () => void
    onConfirm?: (reason: string) => void
  }

  let { assessmentName = '', closeModal, onConfirm }: Props = $props()

  let reason = $state('')

  function handleConfirm() {
    if (!reason.trim()) {
      snackbarStore.info('거부 사유를 입력해주세요.')
      return
    }
    onConfirm?.(reason)
    closeModal?.()
  }

  function handleCancel() {
    closeModal?.()
  }
</script>

<div class="flex flex-col p-5">
  <!-- 타이틀 -->
  <Typography
    variant="headline-02-semibold"
    color="text-gray-900"
    className="text-center mb-2"
  >
    검사 진행이 거부되었나요?
  </Typography>

  <!-- 서브타이틀 -->
  <Typography
    variant="body-02-regular"
    color="text-gray-500"
    className="text-center mb-5"
  >
    거부 사유를 입력해주세요
  </Typography>

  <!-- 입력 필드 -->
  <input
    type="text"
    bind:value={reason}
    placeholder="거부 사유를 입력해주세요"
    class="field-input w-full mb-6"
  />

  <!-- 버튼 영역 -->
  <div class="flex gap-3">
    <Button
      class="flex-1 h-11 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
      onclick={handleCancel}
    >
      <Typography variant="body-01-normal-medium" color="text-gray-700">
        취소
      </Typography>
    </Button>
    <Button
      class="flex-1 h-11 rounded-lg border border-semantic-negative bg-white hover:bg-status-danger-bg"
      onclick={handleConfirm}
    >
      <Typography
        variant="body-01-normal-medium"
        color="text-semantic-negative"
      >
        거부 처리
      </Typography>
    </Button>
  </div>
</div>
