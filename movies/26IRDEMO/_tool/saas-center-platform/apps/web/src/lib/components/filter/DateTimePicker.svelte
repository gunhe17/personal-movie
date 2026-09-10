<script lang="ts">
  import Calendar from '../Calendar.svelte'
  import Typography from '@common/components/Typography.svelte'
  import TimeSelect from '../TimeSelect.svelte'
  import { schedulesGroupByDate } from '../../features/schedule/calendar/hooks.svelte'

  interface Props {
    startAt: string | null
    endAt: string | null
    selectedDate: Date | null
  }

  let {
    startAt = $bindable(),
    endAt = $bindable(),
    selectedDate = $bindable()
  }: Props = $props()

  const MIN_DURATION = 10

  const addMinutes = (time: string, mins: number): string => {
    const [h, m] = time.split(':').map(Number)
    const total = h * 60 + m + mins
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const endMinTime = $derived(
    startAt ? addMinutes(startAt, MIN_DURATION) : undefined
  )

  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

  // 선택된 날짜의 기존 예약 일정 목록
  const existingSchedules = $derived.by(() => {
    if (!selectedDate) return []
    const dateKey = toDateKey(selectedDate)
    const grouped = $schedulesGroupByDate
    return grouped[dateKey] ?? []
  })

  const handleStartChange = (v: string) => {
    startAt = v
    if (endAt) {
      const [sh, sm] = v.split(':').map(Number)
      const [eh, em] = endAt.split(':').map(Number)
      if (eh * 60 + em - (sh * 60 + sm) < MIN_DURATION) {
        endAt = addMinutes(v, MIN_DURATION)
      }
    }
  }

  const handleEndChange = (v: string) => {
    endAt = v
  }

  let prevDate = $state<Date | null>(null)

  $effect(() => {
    if (!selectedDate) return
    if (!prevDate) {
      prevDate = selectedDate
      return
    }
    if (selectedDate.getTime() === prevDate.getTime()) return
    startAt = null
    endAt = null
    prevDate = selectedDate
  })
</script>

<div
  class="w-full max-w-3xl rounded-lg border border-gray-200 bg-white overflow-hidden"
>
  <div class="grid grid-cols-1 sm:grid-cols-[minmax(260px,390px)_1fr] min-h-0">
    <!-- 날짜 선택 -->
    <div class="p-4 sm:border-r sm:border-gray-200">
      <Calendar
        bind:selectedDate
        class="border-0! rounded-none! shadow-none! w-full max-w-97.5"
      />
    </div>
    <!-- 시간 선택 -->
    <div
      class="p-5 flex flex-col min-w-0 border-t border-gray-200 sm:border-t-0"
    >
      <div class="space-y-5">
        <div>
          <div class="flex items-center gap-2 mb-3">
            <Typography variant="body-01-medium" color="text-gray-700">
              시간 <span class="field-required">*</span>
            </Typography>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1">
              <TimeSelect value={startAt ?? ''} onChange={handleStartChange} />
            </div>
            <span class="text-gray-400 shrink-0">~</span>
            <div class="flex-1">
              <TimeSelect
                value={endAt ?? ''}
                minTime={endMinTime}
                onChange={handleEndChange}
              />
            </div>
          </div>
        </div>

        <!-- 기존 예약 일정 표시 -->
        {#if existingSchedules.length > 0}
          <div class="space-y-2">
            <Typography variant="label-02-regular" color="text-gray-500">
              해당 날짜의 기존 예약
            </Typography>
            <div class="flex flex-wrap gap-1.5">
              {#each existingSchedules as schedule}
                <span
                  class="inline-flex items-center rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500"
                >
                  {schedule.start_at} ~ {schedule.end_at}
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
