<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import SemacticNoticeBang16 from '$lib/assets/SemacticNoticeBang16.svelte'
  import { snackbarStore } from '../../stores/snackbar'
  import GreenCircleCheck54 from '../../assets/GreenCircleCheck54.svelte'
  import GrayCircleInfoIcon16 from '../../assets/GrayCircleInfoIcon16.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    addedNames: string[]
    removedNames: string[]
    scheduledCount: number
    onApply: () => Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    addedNames = [],
    removedNames = [],
    scheduledCount = 0,
    onApply
  }: Props = $props()

  let isApplying = $state(false)

  async function handleApply() {
    if (isApplying) return
    isApplying = true
    try {
      await onApply()
      snackbarStore.success('변경된 내담자가 회기에 적용되었습니다')
      closeModal()
    } catch {
      snackbarStore.error('회기 내담자 적용에 실패했습니다')
    } finally {
      isApplying = false
    }
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
      <!-- 녹색 체크 아이콘 -->
      <GreenCircleCheck54 />

      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
        className="mt-4 mb-3"
      >
        상담 정보가 수정되었어요
      </Typography>
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-600"
        className="mb-4"
      >
        변경된 내담자를 모든 회기에 적용할까요?
      </Typography>

      <!-- 변경 내역 카드 -->
      <div class="w-full rounded-[8px] bg-gray-50 p-4 text-left">
        <Typography
          variant="body-02-medium"
          color="text-gray-600"
          className="mb-3"
        >
          변경 대상
        </Typography>

        <div class="space-y-1.5">
          {#if addedNames.length > 0}
            <div class="flex items-start gap-2">
              <span
                class="shrink-0 rounded text-01-normal-regular text-gray-600"
              >
                추가
              </span>
              <span class="text-01-normal-regular text-gray-800"
                >{addedNames.join(', ')}</span
              >
            </div>
          {/if}
          {#if removedNames.length > 0}
            <div class="flex items-start gap-2">
              <span class="text-01-normal-regular shrink-0 text-gray-600">
                제외
              </span>
              <span class="text-01-normal-regular text-gray-800"
                >{removedNames.join(', ')}</span
              >
            </div>
          {/if}
        </div>

        <div class="mt-3 flex items-center gap-1.5 text-gray-400">
          <GrayCircleInfoIcon16 />
          <span class="text-body-03-normal-regular"
            >지금 이후 {scheduledCount}개의 회기에만 적용돼요</span
          >
        </div>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-end gap-2">
      <button
        onclick={closeModal}
        class="h-11 rounded-lg bg-gray-100 px-6 transition hover:bg-gray-200"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          닫기
        </Typography>
      </button>
      <button
        onclick={handleApply}
        disabled={isApplying}
        class="h-11 rounded-lg bg-primary-500 px-6 transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        <Typography
          variant="body-01-normal-medium"
          color={isApplying ? 'text-gray-400' : 'text-white'}
        >
          {isApplying ? '적용 중...' : '적용'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
