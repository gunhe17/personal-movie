<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import RadioCircleCheckedIcon from '$lib/assets/RadioCircleCheckedIcon.svelte'
  import RadioCircleUncheckedIcon from '$lib/assets/RadioCircleUncheckedIcon.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import { formatUtcToKst } from '$lib/utils/date'
  import type { SessionOption } from '../types'

  let {
    sessions = [],
    selectedIds = [],
    onToggle,
    onToggleAll
  } = $props<{
    /** 취소 회기 포함 전체 — 선택 불가 회기는 비활성으로 함께 보여준다 */
    sessions: SessionOption[]
    selectedIds: string[]
    onToggle: (sessionId: string) => void
    onToggleAll: () => void
  }>()

  // 취소·청구됨은 선택 불가 → 항상 하단 (그 외 시간순은 caller가 보장)
  const orderedSessions = $derived(
    [...sessions].sort(
      (a: SessionOption, b: SessionOption) =>
        Number(!selectable(a)) - Number(!selectable(b))
    )
  )

  function selectable(s: SessionOption): boolean {
    return !s.billed && s.status !== 'cancelled'
  }

  const selectableCount = $derived(orderedSessions.filter(selectable).length)
  const allSelected = $derived(
    selectableCount > 0 &&
      orderedSessions
        .filter(selectable)
        .every((s: SessionOption) => selectedIds.includes(s.id))
  )
</script>

<div>
  <span class="field-label mb-2">
    청구할 회기 <span class="field-required">*</span>
  </span>

  {#if orderedSessions.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-8"
    >
      <Typography variant="body-02-normal-regular" color="text-gray-400">
        연결된 회기가 없어요
      </Typography>
    </div>
  {:else}
    <!-- 회기 묶음 컨테이너 — 선택 대상이 한 덩어리로 읽히도록 sunken 면 위에 올린다.
         중첩 radius: 컨테이너 12 ⊃ 회기 박스 8 (Web_Design.md §Rounded) -->
    <div class="rounded-xl bg-gray-50 p-4">
      <!-- 묶음 머리 — 무엇의 모음인지 + 그 모음에 거는 액션.
           전체 선택은 세는 대상 바로 위에 붙어야 무엇이 선택되는지 읽힌다.
           아래 카드와 그룹 내부 간격 12 -->
      <div class="mb-3 flex min-h-5 items-center justify-between gap-2">
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          tag="span"
        >
          총 {orderedSessions.length}개의 회기
        </Typography>
        {#if selectableCount > 0}
          <button
            type="button"
            onclick={onToggleAll}
            class="text-body-03-normal-medium text-primary-500 hover:text-primary-600"
          >
            {allSelected ? '선택 해제' : '전체 선택'}
          </button>
        {/if}
      </div>
      <div class="space-y-2">
        {#each orderedSessions as session (session.id)}
          {@const disabled = !selectable(session)}
          {@const checked = selectedIds.includes(session.id)}
          <button
            type="button"
            {disabled}
            onclick={() => onToggle(session.id)}
            class="flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors {disabled
              ? 'cursor-not-allowed border-border-default bg-gray-100'
              : checked
                ? 'border-primary-400 bg-primary-50'
                : 'border-border-default bg-white hover:border-border-strong'}"
          >
            <span class="flex shrink-0 text-primary-500">
              {#if checked}
                <RadioCircleCheckedIcon
                  fillColor="currentColor"
                  checkColor="var(--color-white)"
                  size={24}
                />
              {:else}
                <RadioCircleUncheckedIcon size={24} />
              {/if}
            </span>
            <span class="flex min-w-0 flex-1 items-center gap-2">
              <Typography
                variant="body-01-normal-medium"
                color={disabled ? 'text-caption-subtle' : 'text-body-strong'}
                className="shrink-0"
                tag="span"
              >
                {session.sessionNumber}회기
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color={disabled ? 'text-caption-subtle' : 'text-body-default'}
                className="truncate-safe min-w-0"
                tag="span"
              >
                {formatUtcToKst(session.start, 'YYYY. M. D (d) HH:mm')}
              </Typography>
            </span>
            {#if session.billed}
              <BadgeRectangle label="청구됨" color="teal" size="sm" />
            {:else if session.status === 'cancelled'}
              <BadgeRectangle label="취소" size="sm" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
