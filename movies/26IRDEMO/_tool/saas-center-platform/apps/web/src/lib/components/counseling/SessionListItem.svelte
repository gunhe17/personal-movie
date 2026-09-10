<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import SessionStatusText from './SessionStatusText.svelte'
  import type { CounselingSession } from '$lib/types/counseling'
  import { formatUtcToKst } from '../../utils/date'
  import ChevronIcon from '../../assets/ChevronIcon.svelte'
  import FieldNoteBadge from './FieldNoteBadge.svelte'

  interface Props {
    session: CounselingSession
    isSelected?: boolean
    /** 녹음 상태: 'recording' | 'paused' | 'completed' | null */
    fieldNoteStatus?: string | null
    onClick?: (session: CounselingSession) => void
  }

  let {
    session,
    isSelected = false,
    fieldNoteStatus = null,
    onClick
  }: Props = $props()

  // 웹은 **쓸 수 있는** 필드노트만 알린다 — 녹음 중·일시정지는 전문가앱이 담당한다.
  const hasFieldNote = $derived(fieldNoteStatus === 'completed')

  const counselorName = $derived(
    session.counselors?.map((c) => c.counselor_name).join(', ') ?? ''
  )

  const isCancelled = $derived(session.status === 'cancelled')
</script>

<button
  type="button"
  onclick={() => onClick?.(session)}
  class="flex w-full items-center gap-3 rounded-lg border px-4 h-17 transition-colors {isSelected
    ? 'border-primary-300 bg-primary-50'
    : 'border-gray-200 bg-white hover:bg-gray-50'}"
>
  <!-- 회기 상태 = 텍스트 표기(케이스 상태 배지보다 한 위계 아래).
       session.status 그대로 — 참석 상태로 보정하지 않는다 -->
  <SessionStatusText status={session.status} />
  {#if hasFieldNote}
    <!-- 좁은 행이라 아이콘만 — 이름은 title/aria가 댄다 -->
    <FieldNoteBadge iconOnly />
  {/if}
  <div class="min-w-0 flex-1">
    <Typography
      variant="body-01-medium"
      className="text-left"
      color={isCancelled
        ? 'text-gray-400'
        : isSelected
          ? 'text-primary-600'
          : 'text-gray-600'}
    >
      {formatUtcToKst(session.start, 'YYYY-MM-DD (d) HH:mm')}
    </Typography>
    <div class="mt-1.5 flex items-center truncate-safe">
      {#if counselorName}
        <Typography
          variant="body-03-normal-regular"
          color={isCancelled
            ? 'text-gray-400'
            : isSelected
              ? 'text-primary-400'
              : 'text-gray-600'}
        >
          {counselorName}
        </Typography>
      {/if}
      {#if counselorName && session.room_name}
        <div class="w-px h-2.5 bg-gray-300 mx-1.5"></div>
      {/if}
      {#if session.room_name}
        <Typography
          variant="body-03-normal-regular"
          color={isCancelled
            ? 'text-gray-400'
            : isSelected
              ? 'text-primary-400'
              : 'text-gray-600'}
        >
          {session.room_name}
        </Typography>
      {/if}
    </div>
  </div>
  <ChevronIcon
    class="shrink-0 rotate-180"
    strokeColor={isSelected ? '#4C87F6' : '#C5CAD0'}
  />
</button>
