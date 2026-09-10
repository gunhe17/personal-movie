<style>
  .overlay-scroll-container {
    scrollbar-gutter: stable;
    overflow-y: auto;
  }

  .overlay-scroll-container::-webkit-scrollbar {
    width: 6px;
  }

  .overlay-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .overlay-scroll-container::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import Typography from '@common/components/Typography.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import { twMerge } from 'tailwind-merge'
  import { formatUtcToKst, parseUtcToKstTime } from '$lib/utils/date'
  import { getColorFromString } from '$lib/utils/colorConverter'
  import { modalStore } from '$lib/stores/modal'
  import ScheduleRegisterModal from '$lib/components/modal/ScheduleRegisterModal.svelte'
  import { openScheduleDetailModal } from '$lib/components/modal/openScheduleDetailModal'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import type {
    ScheduleType,
    MappedSchedule
  } from '$lib/hooks/actions/schedule.action'
  import type { OperatingTimeSummary } from '$lib/hooks/actions/center.action'
  import {
    getOperatingHoursForDate,
    isOperatingHourForDay,
    isBreakHourForDay
  } from '$lib/features/schedule/operating-hours'
  import {
    getScheduleTypeLabel,
    getSessionStatusLabel,
    getSessionStatusColor
  } from '$lib/features/schedule/calendar/view-model'
  import { SESSION_STATUS_OPTIONS } from '$lib/features/schedule/calendar/constants'

  interface Props {
    schedules: ScheduleType[]
    selectedDate: Date | null
    operatingTimes?: OperatingTimeSummary[]
    compact?: boolean
    flatMode?: boolean
  }

  let {
    schedules,
    selectedDate,
    operatingTimes = [],
    compact = false,
    flatMode = false
  }: Props = $props()

  const queryClient = useQueryClient()

  // 30분 간격 시간 슬롯 (09:00 ~ 24:00)
  const timeSlots = $derived.by(() => {
    const slots: { hour: number; minute: number; label: string }[] = []
    for (let h = 6; h <= 24; h++) {
      slots.push({
        hour: h,
        minute: 0,
        label: `${String(h).padStart(2, '0')}:00`
      })
      if (h < 24) {
        slots.push({
          hour: h,
          minute: 30,
          label: `${String(h).padStart(2, '0')}:30`
        })
      }
    }
    return slots
  })

  const dayHours = $derived(
    selectedDate
      ? getOperatingHoursForDate(operatingTimes, selectedDate)
      : getOperatingHoursForDate(operatingTimes, new Date())
  )

  // 해당 시간 슬롯에 시작하는 스케줄 찾기
  function getSchedulesForSlot(
    slotHour: number,
    slotMinute: number
  ): ScheduleType[] {
    if (!selectedDate) return []
    return schedules.filter((s) => {
      const kst = parseUtcToKstTime(s.start.toString())
      // KST 기준 날짜 비교 (formatUtcToKst로 통일)
      const kstDateStr = formatUtcToKst(s.start, 'YYYY-MM-DD')
      const selY = selectedDate!.getFullYear()
      const selM = String(selectedDate!.getMonth() + 1).padStart(2, '0')
      const selD = String(selectedDate!.getDate()).padStart(2, '0')
      const selectedDateStr = `${selY}-${selM}-${selD}`

      if (kstDateStr !== selectedDateStr) return false

      // 30분 단위 매칭: 같은 시간대에 속하는지
      if (slotMinute === 0) {
        return kst.hour === slotHour && kst.minute < 30
      } else {
        return kst.hour === slotHour && kst.minute >= 30
      }
    })
  }

  const mapSchedule = (cur: ScheduleType): MappedSchedule => ({
    id: cur.id,
    client: cur.client_names?.join(', ') ?? '',
    counselor_color: cur.counselor_color ?? null,
    manager: cur.counselor_name ?? null,
    date: cur.start,
    start_at: formatUtcToKst(cur.start, 'HH:mm'),
    start_at_origin: cur.start,
    end_at: formatUtcToKst(cur.end, 'HH:mm'),
    end_at_origin: cur.end,
    title: cur.title,
    program_name: cur.program_name ?? null,
    schedule_type: cur.schedule_type,
    room: cur.room_name,
    status: cur.has_conflict ?? false,
    session_status: cur.session_status ?? null
  })

  const handleOpenDetail = (schedule: ScheduleType) => {
    openScheduleDetailModal(mapSchedule(schedule), queryClient)
  }

  const handleSlotClick = (slotHour: number, slotMinute: number) => {
    if (!selectedDate) return
    const date = new Date(selectedDate)
    date.setHours(slotHour, slotMinute, 0, 0)
    modalStore.open({
      component: ScheduleRegisterModal,
      props: {
        selectedDate: date,
        selectedTime: `${slotHour}:${String(slotMinute).padStart(2, '0')}`
      },
      options: { customWidth: 540 }
    })
  }

  // 현재 시간 인디케이터
  const START_HOUR = 6
  const END_HOUR = 24

  let now = $state(new Date())
  let containerEl = $state<HTMLDivElement | null>(null)
  let timeLineTopPx = $state(0)

  const timeLabel = $derived(
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  )
  const isTimeInRange = $derived(
    now.getHours() >= START_HOUR && now.getHours() < END_HOUR
  )

  function updateTimeLinePosition() {
    if (!containerEl) return
    const slots = containerEl.querySelectorAll<HTMLElement>(
      ':scope > [data-slot]'
    )
    if (!slots.length) return

    const hours = now.getHours()
    const minutes = now.getMinutes()
    const totalMinutes = hours * 60 + minutes
    const startMinutes = START_HOUR * 60

    // 현재 시간이 속하는 슬롯 찾기
    let targetIdx = -1
    for (let i = 0; i < timeSlots.length; i++) {
      const slotMin = timeSlots[i].hour * 60 + timeSlots[i].minute
      const nextSlotMin =
        i + 1 < timeSlots.length
          ? timeSlots[i + 1].hour * 60 + timeSlots[i + 1].minute
          : END_HOUR * 60
      if (totalMinutes >= slotMin && totalMinutes < nextSlotMin) {
        targetIdx = i
        break
      }
    }
    if (targetIdx < 0 || targetIdx >= slots.length) return

    const slotEl = slots[targetIdx]
    const slotStartMin =
      timeSlots[targetIdx].hour * 60 + timeSlots[targetIdx].minute
    const slotDuration = 30
    const ratio = (totalMinutes - slotStartMin) / slotDuration

    timeLineTopPx = slotEl.offsetTop + slotEl.offsetHeight * ratio
  }

  $effect(() => {
    // now 변경 시 위치 재계산
    now
    if (browser) requestAnimationFrame(updateTimeLinePosition)
  })

  function isToday(date: Date | null): boolean {
    if (!date) return false
    const today = new Date()
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  onMount(() => {
    updateTimeLinePosition()
    // 오늘이면 현재시간 위치로 스크롤
    if (isToday(selectedDate) && containerEl) {
      requestAnimationFrame(() => {
        if (containerEl && timeLineTopPx > 0) {
          containerEl.scrollTo({
            top: timeLineTopPx - containerEl.clientHeight / 3,
            behavior: 'smooth'
          })
        }
      })
    }
    const intervalId = setInterval(() => {
      now = new Date()
    }, 60 * 1000)
    return () => clearInterval(intervalId)
  })

  // flatMode: 선택된 날짜의 스케줄만 시간순 정렬
  const flatSchedules = $derived.by(() => {
    if (!flatMode || !selectedDate) return []
    const selY = selectedDate.getFullYear()
    const selM = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const selD = String(selectedDate.getDate()).padStart(2, '0')
    const selectedDateStr = `${selY}-${selM}-${selD}`
    return schedules
      .filter((s) => formatUtcToKst(s.start, 'YYYY-MM-DD') === selectedDateStr)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  })

  let statusDropdownOpen = $state<string | null>(null)

  const toggleStatusDropdown = (e: MouseEvent, scheduleId: string) => {
    e.stopPropagation()
    statusDropdownOpen = statusDropdownOpen === scheduleId ? null : scheduleId
  }

  const handleStatusChange = (
    e: MouseEvent,
    schedule: ScheduleType,
    newStatus: string
  ) => {
    e.stopPropagation()
    statusDropdownOpen = null
    // TODO: mutation 호출로 상태 변경 (백엔드 API 준비 후)
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if flatMode}
  <div class="w-full bg-white">
    {#if flatSchedules.length === 0}
      <div class="flex items-center justify-center py-16">
        <Typography variant="body-02-normal-regular" color="text-gray-400">
          예약된 스케줄이 없습니다
        </Typography>
      </div>
    {:else}
      {#each flatSchedules as schedule, idx}
        {@const dotColor =
          schedule.counselor_color ||
          getColorFromString(schedule.counselor_name || '')}
        <div
          onclick={() => handleOpenDetail(schedule)}
          class={twMerge(
            'px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors',
            idx > 0 && 'border-t border-gray-100'
          )}
        >
          <!-- Row 1: 색상 dot + 시간 + 장소 + 상태 뱃지 -->
          <div class="flex items-center justify-between mb-2.5">
            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="w-2 h-2 rounded-full shrink-0"
                style:background-color={dotColor}
              ></span>
              <Typography variant="body-02-normal-medium" color="text-gray-900">
                {formatUtcToKst(schedule.start, 'HH:mm')} - {formatUtcToKst(
                  schedule.end,
                  'HH:mm'
                )}
              </Typography>
              {#if schedule.room_name}
                <span class="w-px h-3 bg-gray-300 mx-1 shrink-0"></span>
                <Typography
                  variant="body-02-normal-medium"
                  color="text-gray-700"
                  className="truncate-safe"
                >
                  {schedule.room_name}
                </Typography>
              {/if}
            </div>
            <span
              class={twMerge(
                'shrink-0 ml-2 px-2 py-0.5 rounded text-xs font-medium',
                getSessionStatusColor(schedule.session_status)
              )}
            >
              {getSessionStatusLabel(schedule.session_status)}
            </span>
          </div>
          <!-- 정보 영역: 배경색으로 구분 -->
          <div class="rounded-lg bg-gray-50 px-3 py-2.5 flex flex-col gap-2">
            <!-- 프로그램 -->
            <div class="flex items-start gap-2">
              <Typography
                variant="body-03-normal-regular"
                color="text-gray-500"
                className="shrink-0 w-12"
              >
                프로그램
              </Typography>
              <Typography variant="body-02-normal-medium" color="text-gray-700">
                {schedule.program_name ||
                  getScheduleTypeLabel(schedule.schedule_type)}
              </Typography>
            </div>
            <!-- 내담자 -->
            <div class="flex items-start gap-2">
              <Typography
                variant="body-03-normal-regular"
                color="text-gray-500"
                className="shrink-0 w-12 pt-px"
              >
                내담자
              </Typography>
              <div class="flex flex-col gap-1 min-w-0">
                {#if schedule.clients?.length}
                  {#each schedule.clients as client}
                    <div class="flex items-center gap-2 min-w-0">
                      <Typography
                        variant="body-02-normal-medium"
                        color="text-gray-800"
                        className="truncate-safe"
                      >
                        {$isSecretMode ? maskName(client.name) : client.name}
                      </Typography>
                      <ClientBirthGender
                        birthDate={client.birth_date}
                        gender={client.gender}
                        variant="body-03-normal-regular"
                      />
                    </div>
                  {/each}
                {:else if schedule.client_names?.length}
                  {#each schedule.client_names as name}
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-gray-800"
                    >
                      {$isSecretMode ? maskName(name) : name}
                    </Typography>
                  {/each}
                {:else}
                  <Typography
                    variant="body-02-normal-medium"
                    color="text-gray-400">-</Typography
                  >
                {/if}
              </div>
            </div>
            <!-- 담당자 -->
            <div class="flex items-start gap-2">
              <Typography
                variant="body-03-normal-regular"
                color="text-gray-500"
                className="shrink-0 w-12"
              >
                담당자
              </Typography>
              <Typography variant="body-02-normal-medium" color="text-gray-700">
                {schedule.counselor_name || '-'}
              </Typography>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{:else}
  <div
    bind:this={containerEl}
    class="w-full h-full min-h-0 relative overlay-scroll-container bg-white"
  >
    {#each timeSlots as slot, idx}
      {@const slotSchedules = getSchedulesForSlot(slot.hour, slot.minute)}
      {@const nextSlot = idx < timeSlots.length - 1 ? timeSlots[idx + 1] : null}
      {@const slotBg = isOperatingHourForDay(slot.hour, dayHours)
        ? isBreakHourForDay(slot.hour, dayHours)
          ? 'bg-gray-50/50'
          : 'bg-white'
        : 'bg-gray-50'}
      <div
        data-slot
        class={twMerge(
          'grid min-h-[50px]',
          compact ? 'grid-cols-[56px_1fr]' : 'grid-cols-[80px_1fr]',
          slotBg
        )}
      >
        <div class="relative border-r border-gray-200">
          {#if nextSlot}
            <Typography
              variant={isToday(selectedDate)
                ? 'body-01-normal-regular'
                : 'body-02-regular'}
              color="text-gray-500"
              className="absolute bottom-0 right-4 translate-y-1/2"
            >
              {nextSlot.label}
            </Typography>
          {/if}
        </div>
        <div
          onclick={() =>
            !slotSchedules.length && handleSlotClick(slot.hour, slot.minute)}
          class={twMerge(
            'relative border-b border-gray-100',
            nextSlot?.minute === 0 && 'border-b-gray-200',
            !slotSchedules.length && 'cursor-pointer hover:bg-gray-50'
          )}
        >
          <!-- 짧은 틱: 콘텐츠 border-b에서 왼쪽(시간 컬럼)으로 삐져나오는 가로선 -->
          {#if nextSlot}
            <span
              class={twMerge(
                'absolute -bottom-px -left-3 w-3 h-px bg-gray-100',
                nextSlot?.minute === 0 && 'bg-gray-200'
              )}
            ></span>
          {/if}
          {#each slotSchedules as schedule, scheduleIdx}
            {@const dotColor =
              schedule.counselor_color ||
              getColorFromString(schedule.counselor_name || '')}
            {#if compact}
              <!-- 모바일 카드 레이아웃 -->
              <div
                onclick={() => handleOpenDetail(schedule)}
                class={twMerge(
                  'px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors',
                  scheduleIdx > 0 && 'border-t border-gray-100'
                )}
              >
                <!-- Row 1: 색상 dot + 시간 + 상태 뱃지 -->
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-1.5">
                    <span
                      class="w-2 h-2 rounded-full shrink-0"
                      style:background-color={dotColor}
                    ></span>
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-gray-900"
                    >
                      {formatUtcToKst(schedule.start, 'HH:mm')} - {formatUtcToKst(
                        schedule.end,
                        'HH:mm'
                      )}
                    </Typography>
                  </div>
                  <span
                    class={twMerge(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      getSessionStatusColor(schedule.session_status)
                    )}
                  >
                    {getSessionStatusLabel(schedule.session_status)}
                  </span>
                </div>
                <!-- Row 2: 내담자 -->
                <div class="ml-3.5 mb-0.5">
                  {#if schedule.clients?.length}
                    {#each schedule.clients as client}
                      <div class="flex items-center gap-2 min-w-0">
                        <Typography
                          variant="body-02-normal-medium"
                          color="text-gray-800"
                          className="truncate-safe"
                        >
                          {$isSecretMode ? maskName(client.name) : client.name}
                        </Typography>
                        <ClientBirthGender
                          birthDate={client.birth_date}
                          gender={client.gender}
                          variant="body-03-normal-regular"
                        />
                      </div>
                    {/each}
                  {:else if schedule.client_names?.length}
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-gray-800"
                    >
                      {$isSecretMode
                        ? schedule.client_names
                            .map((n) => maskName(n))
                            .join(', ')
                        : schedule.client_names.join(', ')}
                    </Typography>
                  {:else}
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-gray-400">-</Typography
                    >
                  {/if}
                </div>
                <!-- Row 3: 항목 · 장소 · 담당자 -->
                <div class="ml-3.5">
                  <Typography
                    variant="body-03-normal-regular"
                    color="text-gray-500"
                  >
                    {schedule.program_name ||
                      getScheduleTypeLabel(
                        schedule.schedule_type
                      )}{schedule.room_name
                      ? ` · ${schedule.room_name}`
                      : ''}{schedule.counselor_name
                      ? ` · ${schedule.counselor_name}`
                      : ''}
                  </Typography>
                </div>
              </div>
            {:else}
              <!-- 데스크톱 테이블 레이아웃 -->
              <div
                onclick={() => handleOpenDetail(schedule)}
                class={twMerge(
                  'grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1fr_1.2fr] items-center hover:bg-gray-50 cursor-pointer transition-colors',
                  scheduleIdx > 0 && 'border-t border-gray-100'
                )}
              >
                <!-- 내담자 -->
                <div class="p-4 flex flex-col gap-4">
                  {#each schedule.clients?.length ? schedule.clients : [] as client}
                    <div class="flex items-baseline">
                      <span
                        class="shrink-0 min-w-16 max-w-24 truncate-safe mr-2"
                      >
                        <Typography
                          variant="body-02-normal-medium"
                          color="text-gray-900"
                        >
                          {$isSecretMode ? maskName(client.name) : client.name}
                        </Typography>
                      </span>
                      <ClientBirthGender
                        birthDate={client.birth_date}
                        gender={client.gender}
                        variant="body-03-normal-regular"
                      />
                    </div>
                  {/each}
                  {#if !schedule.clients?.length && !schedule.client_names?.length}
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-gray-400">-</Typography
                    >
                  {/if}
                  {#if !schedule.clients?.length && schedule.client_names?.length}
                    {#each schedule.client_names as name}
                      <Typography
                        variant="body-02-normal-medium"
                        color="text-gray-900"
                      >
                        {$isSecretMode ? maskName(name) : name}
                      </Typography>
                    {/each}
                  {/if}
                </div>
                <!-- 치료실 -->
                <div class="p-4 text-center">
                  <Typography variant="body-02-regular" color="text-gray-600">
                    {schedule.room_name || '-'}
                  </Typography>
                </div>
                <!-- 항목 -->
                <div class="p-4 text-center">
                  <Typography variant="body-02-regular" color="text-gray-600">
                    {schedule.program_name ||
                      getScheduleTypeLabel(schedule.schedule_type)}
                  </Typography>
                </div>
                <!-- 상태 -->
                <div class="p-4 relative flex justify-center">
                  <button
                    onclick={(e) => toggleStatusDropdown(e, schedule.id)}
                    class={twMerge(
                      'px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1',
                      getSessionStatusColor(schedule.session_status)
                    )}
                  >
                    {getSessionStatusLabel(schedule.session_status)}
                    <svg
                      class="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {#if statusDropdownOpen === schedule.id}
                    <div
                      class="dropdown-panel absolute top-full left-4 z-20 mt-1"
                    >
                      {#each SESSION_STATUS_OPTIONS as opt}
                        <button
                          onclick={(e) =>
                            handleStatusChange(e, schedule, opt.value)}
                          class="dropdown-item"
                        >
                          {opt.label}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
                <!-- 담당 -->
                <div class="p-4 flex items-center justify-center gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full shrink-0"
                    style:background-color={dotColor}
                  ></span>
                  <Typography variant="body-02-regular" color="text-gray-600">
                    {schedule.counselor_name || '-'}
                  </Typography>
                </div>
                <!-- 메모 -->
                <div class="p-4 text-center">
                  <Typography
                    variant="body-02-regular"
                    color="text-gray-400"
                    className="truncate-safe"
                  >
                    -
                  </Typography>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/each}
    <!-- 현재 시간 인디케이터 -->
    {#if isTimeInRange}
      <div
        class="absolute left-0 w-full z-10 pointer-events-none"
        style="top: {timeLineTopPx}px;"
      >
        <div class="relative flex items-center -translate-y-1/2">
          <div class="w-[80px] flex justify-center shrink-0">
            <div
              class="h-[26px] px-2.5 rounded-full bg-[#EF49671A] flex items-center justify-center"
            >
              <span class="text-label-02-normal-medium text-[#EF4967]"
                >{timeLabel}</span
              >
            </div>
          </div>
          <div class="h-0.5 bg-[#EF4967] flex-1"></div>
        </div>
      </div>
    {/if}
  </div>
{/if}
