<script lang="ts">
  import type { ExamType } from '../constants'
  import { EXAM_TYPE_VISUAL } from '../exam-visual'

  interface Props {
    type: ExamType
    size?: 'xs' | 'sm'
  }

  let { type, size = 'sm' }: Props = $props()

  let visual = $derived(EXAM_TYPE_VISUAL[type])

  let sizeClass = $derived(
    size === 'xs'
      ? 'px-2 py-px text-caption-01-normal-regular min-w-12'
      : 'px-3 py-0.5 text-xs min-w-16'
  )
</script>

<span
  class="inline-flex items-center justify-center rounded-full border font-medium {sizeClass} {visual.pillClass}"
>
  {visual.label}
</span>
