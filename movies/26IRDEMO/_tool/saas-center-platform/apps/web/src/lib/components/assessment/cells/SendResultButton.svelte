<script lang="ts">
  import type { AssessmentRowStatus } from '$lib/types/assessmentStatus'
  import SendIcon from '$lib/assets/SendIcon.svelte'
  import SendCompleteIcon from '$lib/assets/SendCompleteIcon.svelte'
  import SendDisabledIcon from '$lib/assets/SendDisabledIcon.svelte'

  interface Props {
    status: AssessmentRowStatus
    resultSent?: boolean
    onclick?: () => void
  }

  let { status, resultSent = false, onclick }: Props = $props()

  // 버튼 상태 결정
  // - pending, in_progress: 비활성화 (회색)
  // - completed + resultSent: 전송 완료 (녹색)
  // - completed + !resultSent: 활성화 (파란색)
  const isDisabled = $derived(
    status === 'pending' || status === 'in_progress' || status === 'cancelled'
  )
  const isSent = $derived(status === 'completed' && resultSent)
  const isActive = $derived(status === 'completed' && !resultSent)
</script>

<button
  type="button"
  disabled={isDisabled}
  aria-label={isSent ? '전송 완료' : '결과 전송'}
  class="flex h-[44px] w-[104px] items-center justify-center gap-2 rounded-full bg-gray-50 transition-colors
		{isDisabled ? 'cursor-not-allowed text-gray-200' : ''}
		{isSent ? 'text-etc-green-yellow hover:bg-gray-100' : ''}
		{isActive ? 'text-gray-900 hover:bg-gray-100' : ''}"
  onclick={!isDisabled ? onclick : undefined}
>
  <!-- 종이비행기 아이콘 - 상태에 따라 분기 -->
  {#if isDisabled}
    <SendDisabledIcon />
  {:else if isSent}
    <SendCompleteIcon />
  {:else}
    <SendIcon />
  {/if}
  <span class="text-body-01-normal-medium"
    >{isSent ? '전송 완료' : '결과 전송'}</span
  >
</button>
