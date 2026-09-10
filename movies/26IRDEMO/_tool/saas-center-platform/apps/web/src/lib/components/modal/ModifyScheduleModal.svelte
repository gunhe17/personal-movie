<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { browser } from '$app/environment'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { dateToString, diffMinutes, formatUtcToKst } from '../../utils/date'
  import { mutationBuilder, queryBuilder } from '../../hooks/queries/builder'
  import { centerId, requireCenterId } from '../../stores/center.store'
  import {
    getScheduleDetail,
    patchChangeSchedule,
    postValidateSingleSchedule,
    type MappedSchedule,
    type ConflictingScheduleSummary
  } from '../../hooks/actions/schedule.action'

  import CalendarIcon24 from '../../assets/CalendarIcon24.svelte'
  import MarkerIcon16 from '../../assets/MarkerIcon16.svelte'
  import NextStepIcon from '../../assets/NextStepIcon.svelte'
  import { getRoomList } from '../../hooks/actions/room.action'
  import {
    buildRoomsQueryInput,
    RoomSection
  } from '../../features/schedule/counsel'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import DateSelect from '../searchInput/DateSelect.svelte'
  import { snackbarStore } from '../../stores/snackbar'
  import TimeSelect from '../TimeSelect.svelte'
  import { fade } from 'svelte/transition'

  interface Props {
    modalId?: string
    schedule?: MappedSchedule
    closeModal?: () => void
  }

  let { modalId = '', schedule, closeModal = () => {} }: Props = $props()

  /* ---------------- query ---------------- */

  const changeSchedule = mutationBuilder(
    patchChangeSchedule,
    [],
    [['getScheduleDetail'], ['getScheduleList']]
  )

  const detailQuery = $derived(
    queryBuilder(getScheduleDetail, () => ({
      center_id: $centerId!,
      schedule_id: schedule?.id
    }))
  )

  const scheduleData = $derived(detailQuery.data)

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )

  const roomList = $derived(roomsQuery.data ?? [])

  /* ---------------- state ---------------- */

  let selectedDate = $state<Date | null>(null)
  let startTime = $state('')
  let endTime = $state('')
  let selectedRoom = $state<RoomItemType | null>(null)

  // 충돌 검증 상태
  let isValidating = $state(false)
  let hasConflict = $state(false)
  let conflictingSchedules = $state<ConflictingScheduleSummary[]>([])
  let validateTimer: ReturnType<typeof setTimeout> | null = null

  /* ---------------- 초기값 세팅 ---------------- */

  $effect(() => {
    if (!scheduleData || !roomList.length) return

    // scheduleData.start/end는 UTC → KST 기준으로 날짜/시간 초기화
    const kstDateStr = formatUtcToKst(scheduleData.start, 'YYYY-MM-DDTHH:mm')
    selectedDate = new Date(kstDateStr)
    startTime = formatUtcToKst(scheduleData.start, 'HH:mm')
    endTime = formatUtcToKst(scheduleData.end, 'HH:mm')

    selectedRoom = roomList.find((r) => r.name === schedule?.room) ?? null
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

  const isChanged = $derived.by(() => {
    return isDateChanged || isRoomChanged
  })

  const canSubmit = $derived.by(() => {
    return !!selectedDate && !!startTime && !!endTime && isChanged
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
      hasConflict = false
      conflictingSchedules = []
      return
    }
    if (!selectedDate || !startTime || !endTime || !selectedRoom?.id) {
      hasConflict = false
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
        end: buildISODateTime(selectedDate, endTime)
      })
      hasConflict = result.has_conflicts
      conflictingSchedules = result.conflicting_schedules ?? []
    } catch {
      hasConflict = false
      conflictingSchedules = []
    } finally {
      isValidating = false
    }
  }

  function formatConflictTime(start: string, end: string): string {
    const s = formatUtcToKst(start, 'HH:mm')
    const e = formatUtcToKst(end, 'HH:mm')
    return `${s} - ${e}`
  }

  // 날짜/시간/장소 변경 시 충돌 검증 트리거
  $effect(() => {
    // 의존성 추적용
    selectedDate
    startTime
    endTime
    selectedRoom
    scheduleValidation()
  })

  /* ---------------- submit ---------------- */
  const handleSubmit = () => {
    if (!canSubmit || !scheduleData || !selectedDate) return
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
      room_id: selectedRoom?.id ?? null
    }

    changeSchedule.mutate(payload, {
      onSuccess() {
        snackbarStore.success('일정 변경을 완료했습니다')
        closeModal()
      },
      onError() {
        snackbarStore.error('일정 변경을 실패했습니다')
      }
    })
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={false}
  size="lg"
  bodyClass="p-0!"
  footerClass="px-5 pt-4 pb-5"
  headerClass="px-5 py-4 items-start!"
>
  {#snippet header()}
    <div class="w-full">
      {#if scheduleData}
        <!-- 2줄 헤더 규격: 타이틀↔부제 8 · 부제 body-02-normal-regular/gray-500 (Web_Design.md §modal) -->
        <div class="space-y-2">
          <Typography
            variant="headline-02-normal-semibold"
            color="text-gray-800"
          >
            {formatUtcToKst(scheduleData.start, 'YYYY-MM-DD (d) HH:mm')} 일정 변경하기
          </Typography>

          <Typography variant="body-02-normal-regular" color="text-gray-500">
            해당 일정의 정보를 수정할게요
          </Typography>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet body()}
    <div class="p-5 pb-7">
      {#if scheduleData && schedule}
        <!-- 기존 일정 -->
        <Typography variant="title-01-normal-semibold">기존 일정</Typography>

        <div class="p-4 bg-gray-50 rounded-lg mt-2">
          <div class="space-y-3">
            <!-- 시간 -->
            <div class="flex items-center gap-1">
              <CalendarIcon24 />
              <Typography
                variant="title-01-normal-regular"
                color="text-gray-600"
              >
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

              <Typography
                variant="title-01-normal-regular"
                color="text-gray-600"
              >
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
          <!-- 변경 일시 -->
          <div class="space-y-3">
            <Typography variant="title-01-normal-semibold">
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
              <div in:fade class="flex items-center">
                <Typography variant="body-01-normal-regular">
                  {formatUtcToKst(scheduleData.start, 'YYYY-MM-DD (d) HH:mm')} ~
                  {formatUtcToKst(scheduleData.end, 'HH:mm')}
                </Typography>
                <Typography variant="body-01-normal-regular">
                  <span class="mx-1 text-gray-400">→</span>
                  <span class="text-primary-500">
                    {changedDateText}로 변경할게요
                  </span>
                </Typography>
              </div>
            {/if}
          </div>

          <!-- 변경 장소 -->
          <div class="space-y-3">
            <RoomSection
              {roomList}
              {selectedRoom}
              onSelectRoom={(room) => (selectedRoom = room)}
              title="변경 장소"
            />
            {#if isRoomChanged}
              <div in:fade class="flex items-center">
                <Typography variant="body-01-normal-regular">
                  {schedule.room}
                </Typography>
                <Typography variant="body-01-normal-regular">
                  <span class="mx-1 text-gray-400">→</span>
                  <span class="text-primary-500">
                    {selectedRoomName}로 변경할게요
                  </span>
                </Typography>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- 충돌 경고 -->
      {#if hasConflict && conflictingSchedules.length > 0}
        <div
          class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mt-4"
        >
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
            <Typography
              variant="body-02-semibold"
              tag="span"
              color="text-amber-700"
            >
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
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end items-center">
      {#if scheduleData}
        <div class="flex gap-2">
          <!-- 취소 -->
          <button
            onclick={closeModal}
            class="h-11 w-35 rounded-lg flex-center bg-gray-100 hover:bg-gray-200 duration-200"
          >
            <Typography variant="body-01-normal-medium" color="text-gray-600">
              취소
            </Typography>
          </button>

          <!-- 변경 -->
          <button
            onclick={handleSubmit}
            disabled={!canSubmit}
            class={twMerge(
              'w-[140px] h-11 rounded-lg flex-center transition',
              !canSubmit
                ? 'bg-action-primary-disabled text-action-primary-disabled-fg cursor-not-allowed'
                : hasConflict
                  ? 'bg-amber-500 hover:bg-amber-400'
                  : 'bg-primary-500 hover:bg-primary-400'
            )}
          >
            <Typography variant="body-01-normal-medium" color="text-white">
              {hasConflict ? '충돌 무시하고 변경' : '변경'}
            </Typography>
          </button>
        </div>
      {/if}
    </div>
  {/snippet}
</BaseModal>
