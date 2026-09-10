<script lang="ts">
  import type { ExamStatus } from '../constants'
  import { EXAM_STATUS_VISUAL } from '../exam-visual'

  interface Props {
    status: ExamStatus
    size?: 'xs' | 'sm'
  }

  let { status, size = 'sm' }: Props = $props()

  let visual = $derived(EXAM_STATUS_VISUAL[status])

  let textSize = $derived(size === 'xs' ? 'text-caption-01-normal-regular' : 'text-xs')
  let dotSize = $derived(size === 'xs' ? 'h-1.5 w-1.5' : 'h-2 w-2')
  let spinnerSize = $derived(size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3')
</script>

<span class="inline-flex items-center gap-1.5 font-semibold {textSize} {visual.textClass}">
  {#if visual.spinning}
    <!-- 진행 중임을 드러내는 상태만 점 대신 스피너를 돈다 -->
    <span
      class="animate-spin rounded-full border-[1.5px] border-t-transparent {spinnerSize} {visual.borderClass}"
    ></span>
  {:else}
    <span class="rounded-full {dotSize} {visual.dotClass}"></span>
  {/if}
  {visual.label}
</span>
