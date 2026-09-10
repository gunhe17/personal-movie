<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Switch from '$lib/components/Switch.svelte'

  export interface NoShowReasonResult {
    memo: string
    isConsumed: boolean
  }

  interface Props {
    modalId?: string
    title?: string
    message?: string
    placeholder?: string
    maxLength?: number
    confirmText?: string
    initialNote?: string
    initialIsConsumed?: boolean
    closeModal?: () => void
    _modalResolve?: (value: NoShowReasonResult | null) => void
    _modalReject?: (reason?: unknown) => void
  }

  let {
    modalId = '',
    title = '노쇼 사유',
    message = '노쇼 사유를 입력해주세요. (선택)',
    placeholder = '사유를 입력해주세요',
    maxLength = 500,
    confirmText = '확인',
    initialNote = '',
    initialIsConsumed = false,
    closeModal = () => {},
    _modalResolve = () => {},
    _modalReject = () => {}
  }: Props = $props()

  let text = $state(initialNote)
  let isConsumed = $state(initialIsConsumed)

  const handleConfirm = () => {
    _modalResolve({ memo: text, isConsumed })
    closeModal()
  }

  const handleClose = () => {
    _modalResolve(null)
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  closeModal={handleClose}
  size="sm"
  bodyClass="p-5 pb-7"
  headerClass="items-start px-5 py-4"
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
>
  {#snippet header()}
    <!-- 2줄 헤더 — 타이틀↔부제 8 · 부제 Body_02/Regular gray-500 -->
    <div class="min-w-0 flex-1">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
        className="block"
      >
        {title}
      </Typography>
      {#if message}
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-500"
          className="mt-2 block"
        >
          {message}
        </Typography>
      {/if}
    </div>
  {/snippet}

  {#snippet body()}
    <div>
      <textarea
        bind:value={text}
        {placeholder}
        maxlength={maxLength}
        rows={4}
        class="w-full resize-none rounded-lg border border-input-border px-3 py-3 text-body-03-reading-regular text-gray-800 outline-none placeholder:text-placeholder focus:border-border-active"
      ></textarea>
      <!-- 입력↔카운터 4 (딸린 보조 표시) -->
      <div class="mt-1 text-right text-label-02-normal-regular text-gray-400">
        {text.length}/{maxLength}
      </div>

      <!-- 회기 차감 = 구분되는 블록이라 위와 24. 구분선은 두지 않는다(여백이 이미 가른다) -->
      <div class="mt-6 flex items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <Typography variant="body-01-normal-semibold" color="text-gray-800">
            회기 차감
          </Typography>
          <Typography variant="body-03-normal-regular" color="text-gray-500">
            이번 노쇼를 남은 회기 1회 사용으로 처리해요.
          </Typography>
        </div>
        <Switch bind:checked={isConsumed} ariaLabel="회기 차감 여부" />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <!-- 정렬·간격·패딩은 BaseModal footer가 소유 -->
    <button
      type="button"
      onclick={handleClose}
      class="h-11 rounded-lg border border-gray-200 bg-white px-5 text-body-01-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
    >
      닫기
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
    >
      {confirmText}
    </button>
  {/snippet}
</BaseModal>
