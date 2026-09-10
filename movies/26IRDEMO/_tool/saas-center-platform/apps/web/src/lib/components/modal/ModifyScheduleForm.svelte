<script lang="ts">
  import { browser } from '$app/environment'

  import Typography from '@common/components/Typography.svelte'
  import { dateToString, diffMinutes, formatUtcToKst } from '../../utils/date'
  import { mutationBuilder, queryBuilder } from '../../hooks/queries/builder'
  import { centerId, requireCenterId } from '../../stores/center.store'
  import {
    patchChangeSchedule,
    postValidateSingleSchedule,
    type MappedSchedule,
    type ConflictingScheduleSummary,
    type ScheduleDetailResponse
  } from '../../hooks/actions/schedule.action'

  import CalendarIcon24 from '../../assets/CalendarIcon24.svelte'
  import MarkerIcon16 from '../../assets/MarkerIcon16.svelte'
  import NextStepIcon from '../../assets/NextStepIcon.svelte'
  import { getRoomList } from '../../hooks/actions/room.action'
  import { buildRoomsQueryInput } from '../../features/schedule/counsel'
  import SelectableButtonGroup from '../assessment/receive/SelectableButtonGroup.svelte'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import DateSelect from '../searchInput/DateSelect.svelte'
  import { snackbarStore } from '../../stores/snackbar'
  import { modalUtils } from '../../stores/modal'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'
  import TimeSelect from '../TimeSelect.svelte'
  import { fade } from 'svelte/transition'

  interface Props {
    schedule?: MappedSchedule
    scheduleData?: ScheduleDetailResponse
    canSubmit?: boolean
    hasConflict?: boolean
    doSubmit?: () => void
    onSuccess?: () => void
  }

  let {
    schedule,
    scheduleData,
    canSubmit = $bindable(false),
    hasConflict = $bindable(false),
    doSubmit = $bindable<() => void>(() => {}),
    onSuccess
  }: Props = $props()

  /* ---------------- mutation ---------------- */

  const changeSchedule = mutationBuilder(
    patchChangeSchedule,
    [],
    [['getScheduleDetail'], ['getScheduleList']]
  )

  /* ---------------- queries ---------------- */

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )

  const roomList = $derived(roomsQuery.data ?? [])
  const roomOptions = $derived(
    roomList.map((r: RoomItemType) => ({ value: r.id, label: r.name }))
  )
  const handleRoomSelect = (roomId: string) => {
    selectedRoom = roomList.find((r: RoomItemType) => r.id === roomId) ?? null
  }

  /* ---------------- state ---------------- */

  let selectedDate = $state<Date | null>(null)
  let startTime = $state('')
  let endTime = $state('')
  let selectedRoom = $state<RoomItemType | null>(null)
  let memo = $state('')

  let isValidating = $state(false)
  let internalHasConflict = $state(false)
  let conflictingSchedules = $state<ConflictingScheduleSummary[]>([])
  let validateTimer: ReturnType<typeof setTimeout> | null = null

  /* ---------------- 초기값 세팅 ---------------- */

  let initialized = $state(false)

  $effect(() => {
    if (initialized || !scheduleData || !roomList.length) return
    initialized = true

    const kstDateStr = formatUtcToKst(scheduleData.start, 'YYYY-MM-DDTHH:mm')
    selectedDate = new Date(kstDateStr)
    startTime = formatUtcToKst(scheduleData.start, 'HH:mm')
    endTime = formatUtcToKst(scheduleData.end, 'HH:mm')
    selectedRoom = roomList.find((r) => r.name === schedule?.room) ?? null
    memo = scheduleData.memo ?? ''
  })

  /* ---------------- 파생값 ---------------- */

  const selectedRoomName = $derived(selectedRoom?.name ?? '')

  const changedDateText = $derived.by(() => {
    if (!selectedDate || !startTime || !endTime)
      return '날짜와 시간을 선택해주세요'
    return `${dateToString(selectedDate, 'YYYY-MM-DD')} ${startTime} ~ ${endTime}`
  })

  const isDateChanged = $derived.by(() => {
    if (!scheduleData) return false
    const originalStart = formatUtcToKst(scheduleData.start, 'YYYY-MM-DD HH:mm')
    const originalEnd = formatUtcToKst(scheduleData.end, 'HH:mm')
    const currentStart = `${dateToString(selectedDate!, 'YYYY-MM-DD')} ${startTime}`
    const currentEnd = endTime
    return originalStart !== currentStart || originalEnd !== currentEnd
  })

  const isRoomChanged = $derived(
    !!scheduleData && !!selectedRoomName && selectedRoomName !== schedule?.room
  )

  // 일시·장소 변경만 충돌 검증 대상 — 메모는 별도 플래그로 두고 제출 가능 여부에만 반영
  const isChanged = $derived(isDateChanged || isRoomChanged)

  const isMemoChanged = $derived((scheduleData?.memo ?? '') !== memo)

  const computedCanSubmit = $derived(
    !!selectedDate && !!startTime && !!endTime && (isChanged || isMemoChanged)
  )

  // Sync bindable values
  $effect(() => {
    canSubmit = computedCanSubmit
  })
  $effect(() => {
    hasConflict = internalHasConflict
  })

  /* ---------------- 충돌 검증 ---------------- */

  function buildISODateTime(date: Date, time: string): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const dt = new Date(`${y}-${m}-${d}T${time}:00`)
    return dt.toISOString()
  }

  function scheduleValidation() {
    if (validateTimer) clearTimeout(validateTimer)
    if (!isChanged) {
      internalHasConflict = false
      conflictingSchedules = []
      return
    }
    if (!selectedDate || !startTime || !endTime || !selectedRoom?.id) {
      internalHasConflict = false
      conflictingSchedules = []
      return
    }
    validateTimer = setTimeout(() => runValidation(), 400)
  }

  async function runValidation() {
    if (!selectedDate || !startTime || !endTime || !selectedRoom?.id) return
    isValidating = true
    try {
      const result = await postValidateSingleSchedule().request({
        center_id: requireCenterId(),
        room_id: selectedRoom.id,
        start: buildISODateTime(selectedDate, startTime),
        end: buildISODateTime(selectedDate, endTime),
        member_id: scheduleData?.member_id ?? null
      })
      internalHasConflict = result.has_conflicts
      conflictingSchedules = result.conflicting_schedules ?? []
    } catch {
      internalHasConflict = false
      conflictingSchedules = []
    } finally {
      isValidating = false
    }
  }

  // 충돌 목록에서 우세한 reason 계산 (both > member > room)
  const dominantConflictReason = $derived<'room' | 'member' | 'both' | null>(
    (() => {
      if (!internalHasConflict || conflictingSchedules.length === 0) return null
      const reasons = conflictingSchedules.map((c) => c.conflict_reason)
      if (reasons.some((r) => r === 'both')) return 'both'
      if (reasons.some((r) => r === 'member')) return 'member'
      return 'room'
    })()
  )

  function formatConflictTime(start: string, end: string): string {
    const s = formatUtcToKst(start, 'HH:mm')
    const e = formatUtcToKst(end, 'HH:mm')
    return `${s} - ${e}`
  }

  // 날짜/시간/장소 변경 시 충돌 검증 트리거
  $effect(() => {
    selectedDate
    startTime
    endTime
    selectedRoom
    scheduleValidation()
  })

  /* ---------------- submit ---------------- */

  async function handleSubmit() {
    if (!computedCanSubmit || !scheduleData || !selectedDate) return

    // 충돌 시 컨펌 모달 (reason별 문구 분기)
    if (internalHasConflict && dominantConflictReason) {
      const confirmed = await modalUtils.confirm(
        '',
        '같은 시간에 이미 일정이 있어요',
        {
          type: 'warning',
          description: buildConflictConfirmDescription(
            selectedRoom?.name ?? null,
            dominantConflictReason,
            '변경'
          ),
          confirmText: '변경'
        }
      )
      if (!confirmed) return
    }

    const newStart = new Date(selectedDate)
    const [sh, sm] = startTime.split(':')
    newStart.setHours(+sh, +sm, 0, 0)

    const newEnd = new Date(selectedDate)
    const [eh, em] = endTime.split(':')
    newEnd.setHours(+eh, +em, 0, 0)

    const payload = {
      schedule_id: schedule?.id,
      center_id: $centerId,
      member_id: scheduleData.member_id,
      start: newStart,
      end: newEnd,
      room_id: selectedRoom?.id ?? null,
      memo
    }

    changeSchedule.mutate(payload, {
      onSuccess() {
        snackbarStore.success('일정 변경을 완료했습니다')
        onSuccess?.()
      },
      onError() {
        snackbarStore.error('일정 변경을 실패했습니다')
      }
    })
  }

  // Expose submit handler
  doSubmit = handleSubmit
</script>

{#if scheduleData && schedule}
  <!-- 기존 일정 -->
  <Typography variant="body-02-normal-medium" color="text-title-subtitle">
    기존 일정
  </Typography>

  <div class="p-4 bg-gray-50 rounded-lg mt-2">
    <div class="space-y-3">
      <!-- 시간 -->
      <div class="flex items-center gap-1">
        <CalendarIcon24 />
        <Typography variant="title-01-normal-regular" color="text-gray-600">
          {formatUtcToKst(scheduleData.start, 'YYYY-MM-DD(d) HH:mm')}
          ~ {formatUtcToKst(scheduleData.end, 'HH:mm')}
          ({Math.abs(
            diffMinutes(
              new Date(scheduleData.end),
              new Date(scheduleData.start)
            ) || 0
          )}분)
        </Typography>
      </div>

      <!-- 장소 -->
      <div class="flex items-center gap-1">
        <div class="w-6 h-6">
          <MarkerIcon16 class="w-auto h-full" />
        </div>

        <Typography variant="title-01-normal-regular" color="text-gray-600">
          {schedule.room}
        </Typography>
      </div>
    </div>
  </div>

  <!-- 화살표 -->
  <div class="w-full flex justify-center my-3">
    <NextStepIcon />
  </div>

  <!-- 변경 영역 -->
  <div class="space-y-6">
    <!-- 변경 일시 — 라벨↔컨트롤 8 (폼 라벨 정본) · 컨트롤↔변경 요약 12 -->
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        변경 일시 <span class="field-required">*</span>
      </Typography>

      <div class="flex items-center gap-3">
        <!-- 날짜 -->
        <div class="flex-1">
          <DateSelect bind:selectedDate className="h-12" />
        </div>
        <!-- 시간 -->
        <div class="w-36">
          <TimeSelect
            bind:value={startTime}
            onChange={(v: string) => (startTime = v)}
          />
        </div>
        <span class="text-gray-400 shrink-0">~</span>
        <div class="w-36">
          <TimeSelect
            bind:value={endTime}
            minTime={startTime}
            onChange={(v: string) => (endTime = v)}
          />
        </div>
      </div>

      {#if isDateChanged}
        <p in:fade class="mt-3 text-body-03-normal-regular">
          <span class="text-gray-600">
            {formatUtcToKst(scheduleData.start, 'YYYY-MM-DD (d) HH:mm')} ~
            {formatUtcToKst(scheduleData.end, 'HH:mm')}
          </span>
          <span class="text-primary-500">
            → {changedDateText}로 변경할게요</span
          >
        </p>
      {/if}
    </div>

    <!-- 변경 장소 -->
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        변경 장소
      </Typography>
      <SelectableButtonGroup
        label="변경 장소"
        options={roomOptions}
        selected={selectedRoom?.id ?? ''}
        onSelect={handleRoomSelect}
        showLabel={false}
      />
      {#if isRoomChanged}
        <p in:fade class="mt-3 text-body-03-normal-regular">
          <span class="text-gray-600">{schedule.room}</span>
          <span class="text-primary-500">
            → {selectedRoomName}로 변경할게요</span
          >
        </p>
      {/if}
    </div>

    <!-- 메모 -->
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        메모
      </Typography>
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <textarea
        bind:value={memo}
        placeholder="메모 내용을 입력해주세요"
        class="text-body-01-reading-regular h-30 w-full resize-none rounded-lg border border-gray-200 focus:border-border-active focus:outline-none px-3 py-3.5"
      />
    </div>
  </div>
{/if}

<!-- 충돌 경고 -->
{#if internalHasConflict && conflictingSchedules.length > 0}
  <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4">
    <div class="mb-1.5 flex items-center gap-1.5">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        class="shrink-0 text-amber-500"
      >
        <path
          d="M8 1.5L1 14h14L8 1.5z"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
        <path
          d="M8 6v3.5"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>
      <Typography variant="body-02-semibold" tag="span" color="text-amber-700">
        일정이 겹칩니다
      </Typography>
    </div>
    <div class="space-y-1 pl-5.5">
      {#each conflictingSchedules as conflict}
        <div class="text-xs text-amber-600">
          {formatConflictTime(conflict.start, conflict.end)}
          {#if conflict.room_name || selectedRoomName}
            · {conflict.room_name || selectedRoomName}
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
