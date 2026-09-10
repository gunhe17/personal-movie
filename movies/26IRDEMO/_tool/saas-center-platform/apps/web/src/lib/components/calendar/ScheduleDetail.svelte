<script lang="ts">
  import { dateToString } from '../../utils/date'
  import { useQueryClient } from '@tanstack/svelte-query'

  import TrashIcon from '../../assets/TrashIcon.svelte'
  import CloseIcon from '../../assets/CloseIcon.svelte'
  import DivideIcon from '../../assets/DivideIcon.svelte'
  import EditIcon from '../../assets/EditIcon.svelte'
  import RoomIcon from '../../assets/RoomIcon.svelte'
  import ScheduleIcon from '../../assets/ScheduleIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { createScheduleService } from '../../features/schedule/calendar/calendar-service'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'

  interface Props {
    schedule?: any
    isOperational?: boolean
    openScheduleDetailInfo?: boolean
  }

  let {
    schedule,
    isOperational,
    openScheduleDetailInfo = $bindable()
  }: Props = $props()

  const queryClient = useQueryClient()
  const scheduleService = createScheduleService({ queryClient })
</script>

<div class="w-full flex justify-end items-center gap-5">
  <div class="flex gap-3 items-center">
    {#if schedule.status !== 'cancelled'}
      <button
        onclick={() => {
          scheduleService.openCancelScheduleModal(schedule.id)
        }}
        class="px-2 py-1 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-100 duration-200"
      >
        취소
      </button>
    {/if}
    <button
      onclick={() => {
        scheduleService.openDeleteScheduleModal(schedule.id)
      }}
      class="hover:scale-105 duration-200"
    >
      <TrashIcon />
    </button>
    <!-- TODO: 편집 핸들러 미연결 (onclick 없음) — 연결 전까지 아이콘-only 유지 -->
    <button aria-label="수정" class="hover:scale-105 duration-200">
      <EditIcon />
    </button>
  </div>
  <!-- svelte-ignore a11y_consider_explicit_label -->
  <button
    onclick={() => {
      openScheduleDetailInfo = false
    }}
    class="hover:scale-105 duration-200"
  >
    <CloseIcon color="#6D7882" />
  </button>
</div>
<section class="pb-4 border-b border-gray-200">
  {#if isOperational}
    <div class="flex items-center gap-2 mb-4">
      <Typography variant="title-01-semibold">
        {schedule.title}
      </Typography>
      {#if schedule.status === 'cancelled'}
        <span
          class="px-2 py-0.5 text-xs font-medium text-status-danger bg-status-danger-bg rounded-full"
        >
          검사 취소
        </span>
      {/if}
    </div>
    <div class="flex items-center gap-1.5 h-6">
      <ScheduleIcon />
      <Typography variant="body-01-regular" color="text-gray-800">
        {dateToString(new Date(), 'YYYY-MM-DD(d)')}
        {schedule.start_at} - {schedule.end_at}
      </Typography>
    </div>
  {:else}
    <div class="flex items-center gap-2 mb-4">
      <Typography variant="title-01-semibold">
        {$isSecretMode
          ? schedule.client.map((c: string) => maskName(c)).join(', ')
          : schedule.client.join(', ')}
      </Typography>
      <DivideIcon height={12} />
      <Typography variant="title-01-semibold">
        {schedule.schedule_type}
      </Typography>
      {#if schedule.status === 'cancelled'}
        <span
          class="px-2 py-0.5 text-xs font-medium text-status-danger bg-status-danger-bg rounded-full"
        >
          검사 취소
        </span>
      {/if}
    </div>
    <div class="space-y-2">
      <div class="flex items-center gap-1.5 h-6">
        <ScheduleIcon />
        <Typography variant="body-01-regular" color="text-gray-800">
          {dateToString(new Date(), 'YYYY-MM-DD(d)')}
          {schedule.start_at} - {schedule.end_at}
        </Typography>
      </div>
      <div class="flex items-center gap-1.5 h-6">
        <RoomIcon />
        <Typography variant="body-01-regular" color="text-gray-800">
          {schedule.room}
        </Typography>
      </div>
    </div>
  {/if}
</section>
{#if !isOperational}
  <section class="py-4 border-b border-gray-200">
    <div class="space-y-3 mb-5">
      <Typography variant="body-02-medium" color="text-gray-700">
        내담자
      </Typography>
      {#each schedule.client as client}
        <div class="flex items-center gap-1.5">
          <Typography variant="body-02-medium">
            {$isSecretMode ? maskName(client) : client}
          </Typography>
          <Typography variant="body-03-regular" color="text-gray-700">
            (0123AB)
          </Typography>
        </div>
      {/each}
    </div>
    <div class="space-y-3">
      <Typography variant="body-02-medium" color="text-gray-700">
        담당자
      </Typography>
      {#each schedule.manager as manager}
        <div class="flex items-center gap-1.5">
          <Typography variant="body-02-medium">
            {manager} 선생님
          </Typography>
        </div>
      {/each}
    </div>
  </section>
{/if}
<section class="pt-4 space-y-2.25">
  <Typography variant="body-02-medium" color="text-gray-700">메모</Typography>
  <Typography variant="body-02-regular" color="text-gray-800">
    {schedule.memo}
  </Typography>
</section>
