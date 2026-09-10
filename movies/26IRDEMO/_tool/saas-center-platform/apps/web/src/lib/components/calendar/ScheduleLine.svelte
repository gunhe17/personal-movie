<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import { twMerge } from 'tailwind-merge'
  import { getColorFromString } from '../../utils/colorConverter'
  import { formatUtcToKst } from '../../utils/date'
  import { portal } from '../../utils/positionPortal'
  import type { MappedSchedule } from '../../hooks/actions/schedule.action'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { openScheduleDetailModal } from '../modal/openScheduleDetailModal'
  import Center24Icon from '../../assets/Center24Icon.svelte'
  import Counsel24Icon from '../../assets/Counsel24Icon.svelte'
  import AssessmentStack from '../../assets/AssessmentStack.svelte'

  interface Props {
    schedule: MappedSchedule
  }

  let { schedule }: Props = $props()

  const queryClient = useQueryClient()

  let isOperational = $derived(
    schedule && schedule?.schedule_type === 'meeting'
  )
  let isCancelled = $derived(schedule?.session_status === 'cancelled')

  let scheduleLineRef = $state<HTMLElement>()
  let openScheduleSimpleInfo = $state(false)

  // 칩은 한 줄이라 이름을 다 넣지 않는다 — 그룹이면 대표 1명 + "외 N명"
  const clientLabel = $derived.by(() => {
    const names = (schedule.client || '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    if (!names.length) return '-'
    const first = $isSecretMode ? maskName(names[0]) : names[0]
    return names.length > 1 ? `${first} 외 ${names.length - 1}명` : first
  })

  // 팝오버 타이틀 = 상담사가 일정을 구분하는 최소단위(내담자 이름). 운영 일정은 내담자가 없어 제목을 쓴다
  const popoverTitle = $derived.by(() => {
    if (isOperational) return schedule.title || '-'
    const names = (schedule.client || '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    if (!names.length) return schedule.title || '-'
    return names.map((n) => ($isSecretMode ? maskName(n) : n)).join(', ')
  })

  const programLabel = $derived(
    schedule.program_name ||
      (schedule.schedule_type === 'assessment'
        ? '검사'
        : schedule.schedule_type === 'counseling'
          ? '상담'
          : '운영')
  )

  const handleOpenScheduleDetail = (e: MouseEvent) => {
    e.stopPropagation()
    openScheduleDetailModal(schedule, queryClient)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  bind:this={scheduleLineRef}
  onclick={(e) => handleOpenScheduleDetail(e)}
  onmouseenter={() => {
    openScheduleSimpleInfo = true
  }}
  onmouseleave={() => {
    openScheduleSimpleInfo = false
  }}
  class={twMerge(
    'h-6.5 px-2 py-1 flex items-center gap-2 rounded-lg cursor-pointer overflow-hidden min-w-0',
    isCancelled
      ? 'opacity-60'
      : 'hover:opacity-90 transition-opacity duration-200'
  )}
  style:background-color={isOperational
    ? '#8A949E'
    : schedule.counselor_color || getColorFromString(schedule.manager || '')}
>
  <span
    class="inline-flex shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4"
  >
    {#if schedule.schedule_type === 'meeting'}
      <Center24Icon />
    {:else if schedule.schedule_type === 'counseling'}
      <Counsel24Icon />
    {:else}
      <AssessmentStack />
    {/if}
  </span>
  <!-- 한 줄: 내담자 | 장소 (시간은 표시하지 않음 — 상세는 호버 팝오버) -->
  <span
    class="min-w-0 truncate-safe font-pretendard text-[14px] font-normal tracking-[-0.41px] text-white"
    style:line-height="1.25"
    class:line-through={isCancelled}
  >
    {#if isOperational}
      {schedule.title}
    {:else}
      {clientLabel}
    {/if}{#if schedule.room}<span
        class="mx-2 inline-block h-3 w-px bg-white/40 align-middle"
      ></span>{schedule.room}{/if}
  </span>
</div>
{#if openScheduleSimpleInfo}
  <div
    use:portal={{
      anchor: scheduleLineRef,
      offset: 4,
      isFitWidth: false,
      zIndex: 50
    }}
    class="popover-fade-in p-3 w-60 bg-white rounded-lg shadow-lg"
  >
    <!-- 타이틀 = 일정 구분 최소단위: 타입 아이콘 + 내담자 이름, 그 밑에 시간 -->
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <span class="shrink-0">
          {#if schedule.schedule_type === 'meeting'}
            <Center24Icon />
          {:else if schedule.schedule_type === 'counseling'}
            <Counsel24Icon />
          {:else}
            <AssessmentStack />
          {/if}
        </span>
        <Typography variant="body-01-reading-semibold" className="min-w-0">
          {popoverTitle}
        </Typography>
      </div>
      <Typography variant="body-02-normal-medium" color="text-gray-800">
        {schedule.start_at} - {schedule.end_at}
      </Typography>
    </div>
    <hr class="my-3 border-gray-100" />
    <!-- 레이블 + 데이터 (레이블 폭은 가장 넓은 값 기준 고정, 간격 12) -->
    <div class="space-y-3">
      <div class="flex gap-3">
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-500"
          className="w-16 shrink-0"
        >
          프로그램
        </Typography>
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-800"
          className="min-w-0"
        >
          {programLabel}
        </Typography>
      </div>
      {#if !isOperational}
        <div class="flex gap-3">
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="w-16 shrink-0"
          >
            담당자
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-800"
            className="min-w-0"
          >
            {$isSecretMode
              ? maskName(schedule.manager || '-')
              : schedule.manager || '-'}
          </Typography>
        </div>
      {/if}
      {#if schedule.room}
        <div class="flex gap-3">
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="w-16 shrink-0"
          >
            장소
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-800"
            className="min-w-0"
          >
            {schedule.room}
          </Typography>
        </div>
      {/if}
    </div>
  </div>
{/if}
