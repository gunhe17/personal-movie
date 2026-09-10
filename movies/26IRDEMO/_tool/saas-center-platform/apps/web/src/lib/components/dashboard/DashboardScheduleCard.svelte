<script lang="ts" module>
  export type ScheduleCardStatus =
    | 'scheduled'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show'

  /**
   * 회기 상태 배지 — Web_Design.md §badge Round 규격(h32 · px12 · pill · Body_02/Medium 15 · min-width 63).
   * 색은 피그마 대시보드 시안 기준: 예정=tag-blue 틴트 · 진행 중=primary outline · 완료=state-done.
   * 취소는 §Status Badge 규칙에 따라 line-through 병행.
   */
  const BADGE: Record<ScheduleCardStatus, { label: string; class: string }> = {
    scheduled: { label: '예정', class: 'bg-tag-blue-bg text-tag-blue-fg' },
    in_progress: {
      label: '진행 중',
      class: 'border border-primary-500 text-primary-500'
    },
    completed: {
      label: '완료',
      class: 'bg-state-done-bg text-state-done-text'
    },
    // 배지 자체에는 취소선을 쓰지 않는다 — 취소 표현은 카드 본문(dim + 시각 취소선)이 맡는다
    cancelled: {
      label: '취소',
      class: 'bg-state-canceled-bg text-state-canceled-text'
    },
    no_show: {
      label: '노쇼',
      class: 'bg-state-pending-bg text-state-pending-text'
    }
  }
</script>

<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import SpotIcon20 from '$lib/assets/SpotIcon20.svelte'
  import NoteIcon20 from '$lib/assets/NoteIcon20.svelte'
  import TestIcon20 from '$lib/assets/TestIcon20.svelte'
  import Counsel20Icon from '$lib/assets/Counsel20Icon.svelte'

  interface Props {
    /** HH:mm */
    time: string
    /** 내담자 표시명 */
    name: string
    birthDate?: string | null
    gender?: string | null
    roomName?: string | null
    programName?: string | null
    /** 일정 종류 — 프로그램 행 아이콘을 상담·검사로 가른다 */
    scheduleType?: string | null
    status: ScheduleCardStatus
    /** 포커스 카드만 상호작용을 받는다 */
    focused?: boolean
    /** 예약 시각이 지났는데 완료·취소 정리가 안 된 회기 */
    pendingConfirm?: boolean
    /** 이 카드에서 방금 완료 처리해 일지 작성이 남은 상태 */
    noteRequired?: boolean
    /** 완료/취소 처리 중 */
    busy?: boolean
    onDetail?: () => void
    onComplete?: () => void
    onCancel?: () => void
    onWriteNote?: () => void
  }

  let {
    time,
    name,
    birthDate = null,
    gender = null,
    roomName = null,
    programName = null,
    scheduleType = null,
    status,
    focused = false,
    pendingConfirm = false,
    noteRequired = false,
    busy = false,
    onDetail,
    onComplete,
    onCancel,
    onWriteNote
  }: Props = $props()

  const badge = $derived(BADGE[status] ?? BADGE.scheduled)

  // 성별 | 생년월일 — 값이 없으면 '-'로 자리를 지켜 두 항목이 항상 보이게 한다
  const genderLabel = $derived(
    ['female', 'F', 'FEMALE', '여자', '여'].includes(gender ?? '')
      ? '여'
      : ['male', 'M', 'MALE', '남자', '남'].includes(gender ?? '')
        ? '남'
        : null
  )
  const birthLabel = $derived(
    birthDate ? ($isSecretMode ? '****-**-**' : birthDate) : null
  )

  const metaRows = $derived(
    [
      { icon: 'room' as const, text: roomName },
      { icon: 'program' as const, text: programName }
    ].filter((r) => !!r.text)
  )

  // 프로그램 행 아이콘은 일정 종류를 그대로 말한다 — 상담·검사는 Icon_20 세트의
  // 각 표기 아이콘, 그 밖(운영 등)은 세트 기본 노트 아이콘.
  const programIcon = $derived(
    scheduleType === 'counseling'
      ? ('counseling' as const)
      : scheduleType === 'assessment'
        ? ('assessment' as const)
        : ('note' as const)
  )

  /**
   * 취소된 일정 — 배지는 그대로 두고 카드 본문 전체를 dim(gray-400)으로 낮추고
   * 시각에만 취소선을 건다. 아이콘은 고정 색 에셋이라 opacity로 함께 낮춘다.
   */
  const isCancelled = $derived(status === 'cancelled')
  const dim = (normal: string) => (isCancelled ? 'text-gray-400' : normal)
</script>

<!--
  포커스 카드 보더 = 그라디언트. CSS는 border에 그라디언트를 직접 못 주므로
  padding-box(흰 면) + border-box(그라디언트) 두 겹 배경으로 1px 테두리만 칠한다.
-->
<article
  class="flex w-[380px] flex-col gap-5 rounded-2xl bg-white p-5 shadow-card {focused
    ? 'border-transparent'
    : 'pointer-events-none border border-gray-100'}"
  style={focused
    ? 'border-width: 1.5px; background: linear-gradient(var(--color-white), var(--color-white)) padding-box, linear-gradient(135deg, var(--color-focus-accent-from) 0%, var(--color-focus-accent-to) 100%) border-box;'
    : ''}
>
  <div class="flex flex-col gap-1">
    <!-- 시각 + 상태 -->
    <div class="flex items-start justify-between gap-3">
      <Typography
        variant="body-01-normal-semibold"
        color={dim('text-gray-900')}
        className={isCancelled ? 'line-through' : ''}
      >
        {time}
      </Typography>
      <div
        class="flex h-8 min-w-[63px] shrink-0 items-center justify-center rounded-full px-3 {badge.class}"
      >
        <span class="text-body-02-normal-medium">{badge.label}</span>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <!-- 내담자 -->
      <div class="flex flex-col gap-3">
        <Typography
          variant="title-01-normal-semibold"
          color={dim('text-gray-900')}
          className="block truncate-safe"
        >
          {name}
        </Typography>
        <!-- 인라인 병기 데이터 — 생년월일 + gap 6 + 세로선 + gap 6 + 성별 -->
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color={birthLabel ? dim('text-gray-700') : 'text-gray-400'}
          >
            {birthLabel ?? '-'}
          </Typography>
          <span class="h-3 w-px shrink-0 bg-gray-300" aria-hidden="true"></span>
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color={genderLabel ? dim('text-gray-700') : 'text-gray-400'}
          >
            {genderLabel ?? '-'}
          </Typography>
        </div>
      </div>

      <!-- 상담실 · 프로그램 -->
      {#if metaRows.length > 0}
        <div class="flex flex-col gap-2">
          {#each metaRows as row (row.icon)}
            <div class="flex items-center gap-2">
              <span
                class="flex size-5 shrink-0 items-center justify-center {isCancelled
                  ? 'opacity-50'
                  : ''}"
              >
                {#if row.icon === 'room'}
                  <!-- 장소는 세트 기본 회색 대신 연한 파랑(primary-400) — 값이 아니라
                       위치라는 걸 한눈에 가른다 -->
                  <SpotIcon20 color="var(--color-primary-400)" />
                {:else if programIcon === 'counseling'}
                  <Counsel20Icon />
                {:else if programIcon === 'assessment'}
                  <TestIcon20 />
                {:else}
                  <NoteIcon20 />
                {/if}
              </span>
              <!-- 15/Medium — 시각(16/600)보다 한 단 낮춰 이름·시각 다음 위계로 둔다 -->
              <Typography
                variant="body-02-normal-medium"
                color={dim('text-gray-700')}
                className="min-w-0 truncate-safe"
              >
                {row.text}
              </Typography>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if pendingConfirm}
    <!-- 지난 회기 인라인 정리 — 카드에서 바로 완료·취소를 고른다.
         별도 면(회색 박스)을 두지 않는다 — 카드 높이가 뛰고, 카드 안에 배경 면이 겹친다.
         위 일정 데이터와 섞이지 않도록 구분은 카드 내부 표준인 border-gray-100 라인으로. -->
    <div class="flex flex-col gap-3 border-t border-gray-100 pt-4">
      <Typography variant="body-03-normal-medium" color="text-gray-700">
        일정이 완료되었나요?
      </Typography>
      <div class="flex gap-2">
        <button
          type="button"
          disabled={busy}
          tabindex={focused ? 0 : -1}
          onclick={(e) => {
            e.stopPropagation()
            onComplete?.()
          }}
          class="flex h-9 flex-1 items-center justify-center rounded-lg bg-primary-500 px-4 text-body-03-normal-medium text-white transition-colors hover:bg-primary-600 disabled:bg-action-primary-disabled"
        >
          완료됐어요
        </button>
        <button
          type="button"
          disabled={busy}
          tabindex={focused ? 0 : -1}
          onclick={(e) => {
            e.stopPropagation()
            onCancel?.()
          }}
          class="flex h-9 flex-1 items-center justify-center rounded-lg border border-red-200 px-4 text-body-03-normal-medium text-status-danger transition-colors hover:border-transparent hover:bg-status-danger-bg disabled:text-gray-400"
        >
          취소됐어요
        </button>
      </div>
    </div>
  {:else if noteRequired}
    <button
      type="button"
      tabindex={focused ? 0 : -1}
      onclick={(e) => {
        e.stopPropagation()
        onWriteNote?.()
      }}
      class="flex h-12 items-center justify-center rounded-lg bg-primary-500 px-6 text-body-02-normal-medium text-white transition-colors hover:bg-primary-600"
    >
      일지 작성
    </button>
  {:else}
    <button
      type="button"
      tabindex={focused ? 0 : -1}
      onclick={(e) => {
        e.stopPropagation()
        onDetail?.()
      }}
      class="flex h-10 items-center justify-center rounded-lg border border-gray-200 px-6 text-body-02-normal-medium text-gray-600 transition-colors hover:bg-gray-50"
    >
      상세 보기
    </button>
  {/if}
</article>
