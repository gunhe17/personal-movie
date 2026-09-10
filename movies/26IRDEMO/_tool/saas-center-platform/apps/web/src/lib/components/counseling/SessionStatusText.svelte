<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  type SessionStatus =
    | 'scheduled'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show'

  // 케이스(상담) 상태는 배지, 회기(세션) 상태는 텍스트 — 같은 배지로 두 축을 표기하면
  // 어느 쪽 상태인지 구분이 안 된다. 색은 BadgeRound와 동일 토큰을 쓰고 알약만 뺀다.
  const TEXT_CLASS: Record<SessionStatus, string> = {
    scheduled: 'text-etc-light-blue',
    in_progress: 'text-state-progress-text',
    completed: 'text-state-done-text',
    cancelled: 'text-state-canceled-text',
    no_show: 'text-orange-600'
  }

  const LABEL: Record<SessionStatus, string> = {
    scheduled: '예정',
    in_progress: '진행중',
    completed: '완료',
    cancelled: '취소',
    no_show: '노쇼'
  }

  interface Props {
    status: SessionStatus
    label?: string
    class?: string
  }

  let { status, label, class: className }: Props = $props()
</script>

<span
  class={twMerge(
    'shrink-0 whitespace-nowrap text-body-03-normal-medium',
    TEXT_CLASS[status] ?? 'text-gray-500',
    className
  )}
>
  {label ?? LABEL[status] ?? status}
</span>
