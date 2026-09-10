<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Select from '$lib/components/Select.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    onSubmit?: (data: { type: string; content: string }) => void
  }

  let { modalId = '', closeModal = () => {}, onSubmit }: Props = $props()

  const INQUIRY_TYPES = [
    '서비스 이용 문의',
    '결제/환불 문의',
    '기능 개선 요청',
    '오류/버그 신고',
    '기타'
  ]

  const MAX_LENGTH = 200

  let selectedType: string | undefined = $state(INQUIRY_TYPES[0])
  let content = $state('')
  let isSending = $state(false)

  const canSubmit = $derived(content.trim().length > 0 && !isSending)

  async function handleSubmit() {
    if (!canSubmit) return
    isSending = true
    try {
      await onSubmit?.({
        type: selectedType ?? INQUIRY_TYPES[0],
        content: content.trim()
      })
      closeModal()
    } finally {
      isSending = false
    }
  }
</script>

<BaseModal {modalId} {closeModal} title="1:1 문의하기" showHeaderBorder={true}>
  {#snippet body()}
    <div class="flex flex-col gap-6 p-5 pb-7">
      <!-- 문의 유형 -->
      <div class="flex flex-col gap-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          문의 유형
        </Typography>
        <!-- 폭 200 고정 + 드롭다운도 같은 폭 — dropdownExactWidth를 안 주면
             패널이 트리거 폭을 '최소 폭'으로만 쓰고 가장 긴 항목까지 벌어진다 -->
        <Select
          class="w-50"
          options={INQUIRY_TYPES}
          bind:selected={selectedType}
          dropdownExactWidth
          dropdownZIndex={10002}
        />
      </div>

      <!-- 문의 내용 -->
      <div class="flex flex-col gap-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          문의 내용
        </Typography>
        <div class="relative">
          <textarea
            bind:value={content}
            maxlength={MAX_LENGTH}
            placeholder="문의하실 내용을 입력해주세요."
            style="height: 116px;"
            class="w-full resize-none rounded-lg border border-input-border bg-white px-3 py-3 text-body-01-reading-regular text-gray-800 placeholder:text-placeholder focus:border-border-active focus:outline-none"
          ></textarea>
          <span
            class="absolute right-3 bottom-3 text-body-03-normal-regular text-caption-subtle"
          >
            {content.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <button
      type="button"
      disabled={!canSubmit}
      onclick={handleSubmit}
      class="h-11 rounded-lg px-5 text-body-01-normal-medium transition-colors {canSubmit
        ? 'bg-primary-500 text-white hover:bg-primary-600'
        : 'cursor-not-allowed bg-action-primary-disabled text-action-primary-disabled-fg'}"
    >
      {isSending ? '전송 중...' : '문의'}
    </button>
  {/snippet}
</BaseModal>
