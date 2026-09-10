<script lang="ts">
  import {
    STATUS_BADGE_MAP,
    STATUS_API_MAP,
    type AssessmentRowStatus,
    type CaseStatusAPI
  } from '$lib/types/assessmentStatus'
  import { twMerge } from 'tailwind-merge'

  interface Props {
    status: AssessmentRowStatus | CaseStatusAPI | string
    class?: string
  }

  let { status, class: className = '' }: Props = $props()

  // API 타입(대문자)인 경우 변환, 이미 소문자면 그대로 사용
  const normalizedStatus = $derived(
    status in STATUS_API_MAP
      ? STATUS_API_MAP[status as CaseStatusAPI]
      : (status as AssessmentRowStatus)
  )

  const badge = $derived(
    STATUS_BADGE_MAP[normalizedStatus] ?? {
      text: '알 수 없음',
      class: 'bg-gray-100 text-gray-500'
    }
  )
</script>

<!-- 상담(BadgeRound)과 동일한 지오메트리·타이포로 정렬 — 목록 카드에서 톤이 갈리지 않도록 -->
<div
  class={twMerge(
    'shrink-0 rounded-[100px] h-8 min-w-[60px] px-3 flex items-center justify-center',
    badge.class,
    className
  )}
>
  <span class="text-body-03-normal-regular">{badge.text}</span>
</div>
