<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  type BadgeStatus =
    | 'scheduled'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show'

  // 상태 배지 색은 Web_Design.md §Status Badge 정본 매핑(state-* 토큰)을 따른다.
  // pending→gray · progress→blue · done→green · canceled→red · inactive→gray
  // scheduled(예정)·no_show(노쇼)는 정본 5상태에 없어 매핑 미정 — 결정 후 정렬 대상
  const BADGE_CLASS: Record<BadgeStatus, string> = {
    scheduled: 'bg-trans-bg-light-blue text-etc-light-blue',
    in_progress: 'bg-state-progress-bg text-state-progress-text',
    completed: 'bg-state-done-bg text-state-done-text',
    cancelled: 'bg-state-canceled-bg text-state-canceled-text',
    no_show: 'bg-orange-50 text-orange-600'
  }

  const BADGE_LABEL: Record<BadgeStatus, string> = {
    scheduled: '예정',
    in_progress: '진행중',
    completed: '완료',
    cancelled: '취소',
    no_show: '노쇼'
  }

  interface Props {
    status: BadgeStatus
    label?: string
    class?: string
  }

  let { status, label, class: className }: Props = $props()
</script>

<div
  class={twMerge(
    'shrink-0 rounded-[100px] h-8 min-w-[60px] px-3 flex items-center justify-center',
    BADGE_CLASS[status] ?? 'bg-gray-100 text-gray-500',
    className
  )}
>
  <span class="text-body-03-normal-regular"
    >{label ?? BADGE_LABEL[status] ?? status}</span
  >
</div>
