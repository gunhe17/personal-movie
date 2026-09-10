<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import MultiDateSchedulePicker from '../schedule/MultiDateSchedulePicker.svelte'
  import SelectableButtonGroup from '$lib/components/assessment/receive/SelectableButtonGroup.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getRoomList,
    type RoomItemType
  } from '$lib/hooks/actions/room.action'
  import { centerId } from '$lib/stores/center.store'
  import { mapRoomOptions } from '$lib/features/assessment/receive/view-model'
  import { buildRoomsQueryInput } from '$lib/features/schedule/counsel'
  import { browser } from '$app/environment'
  import { modalUtils } from '$lib/stores/modal'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'

  interface ScheduleInitial {
    date?: Date
    startTime?: string
    endTime?: string
    roomId?: string | null
    scheduleId?: string | null
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    initial?: ScheduleInitial
    onConfirm: (data: {
      roomId: string | null
      scheduledStart: string
      scheduledEnd: string
    }) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    initial,
    onConfirm
  }: Props = $props()

  const initDate = initial?.date
  const initStartTime = initial?.startTime ?? ''
  const initEndTime = initial?.endTime ?? ''
  const initRoomId = initial?.roomId ?? null
  const initScheduleId = initial?.scheduleId ?? null
  const isEditMode = !!initDate

  /* ─────── state ─────── */
  let selectedDates = $state<Date[]>(initDate ? [initDate] : [])
  let startTime = $state(initStartTime || '09:00')
  let endTime = $state(initEndTime || '10:00')
  let selectedRoomId = $state<string | null>(initRoomId)
  let isSubmitting = $state(false)
  let conflictRoomName = $state<string | null>(null)
  let conflictReason = $state<'room' | 'member' | 'both' | null>(null)

  const selectedDate = $derived(
    selectedDates.length > 0 ? selectedDates[0] : null
  )

  /* ─────── 장소 ─────── */
  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const roomsData = $derived(roomsQuery.data ?? [])
  const roomOptions = $derived(mapRoomOptions(roomsData))

  function handleRoomSelect(roomId: string) {
    selectedRoomId = selectedRoomId === roomId ? null : roomId
  }

  /* ─────── submit ─────── */
  function buildISODateTime(date: Date, time: string): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const dt = new Date(`${y}-${m}-${d}T${time}:00`)
    return dt.toISOString()
  }

  const canSubmit = $derived(
    !!selectedDate &&
      !!startTime &&
      !!endTime &&
      !!selectedRoomId &&
      !isSubmitting
  )

  async function handleConfirm() {
    if (!canSubmit || !selectedDate) return

    if (conflictReason) {
      const confirmed = await modalUtils.confirm(
        '',
        '같은 시간에 이미 일정이 있어요',
        {
          type: 'warning',
          description: buildConflictConfirmDescription(
            conflictRoomName,
            conflictReason,
            isEditMode ? '변경' : '등록'
          ),
          confirmText: isEditMode ? '변경' : '등록'
        }
      )
      if (!confirmed) return
    }

    isSubmitting = true
    try {
      onConfirm({
        roomId: selectedRoomId,
        scheduledStart: buildISODateTime(selectedDate, startTime),
        scheduledEnd: buildISODateTime(selectedDate, endTime)
      })
      closeModal()
    } finally {
      isSubmitting = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="lg"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  title={`검사 일정 ${isEditMode ? '변경' : '추가'}`}
>
  {#snippet body()}
    <div class="space-y-5">
      <!-- 장소 선택 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          장소 <span class="field-required">*</span>
        </Typography>
        {#if roomOptions.length > 0}
          <SelectableButtonGroup
            label="장소"
            labelVariant="body-02-normal-medium"
            showLabel={false}
            options={roomOptions}
            selected={selectedRoomId ?? ''}
            onSelect={handleRoomSelect}
          />
        {:else}
          <div
            class="rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-3.5 py-3"
          >
            <Typography
              variant="body-02-regular"
              tag="span"
              color="text-gray-400"
            >
              등록된 상담실이 없습니다. 일정 설정에서 상담실을 먼저
              추가해주세요.
            </Typography>
          </div>
        {/if}
      </div>

      <!-- 일정 -->
      <MultiDateSchedulePicker
        bind:selectedDates
        bind:startTime
        bind:endTime
        bind:conflictRoomName
        bind:conflictReason
        centerId={$centerId}
        roomId={selectedRoomId}
        excludeScheduleId={initScheduleId}
        showTitle={true}
        title="일정"
        singleDate={true}
        calendarSize="modal-large"
      />
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-end gap-2">
      <button
        onclick={closeModal}
        class="h-11 w-35 rounded-lg flex-center bg-gray-100 hover:bg-gray-200 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          취소
        </Typography>
      </button>
      <button
        onclick={handleConfirm}
        disabled={!canSubmit}
        class={twMerge(
          'w-[140px] h-11 rounded-lg flex-center transition',
          canSubmit
            ? 'bg-primary-500 hover:bg-primary-400'
            : 'bg-action-primary-disabled cursor-not-allowed'
        )}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isSubmitting ? '등록 중...' : isEditMode ? '변경' : '등록'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
