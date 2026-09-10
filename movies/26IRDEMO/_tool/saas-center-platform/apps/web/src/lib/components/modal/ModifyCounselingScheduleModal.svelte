<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { browser } from '$app/environment'
  import { slide } from 'svelte/transition'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { formatUtcToKst } from '../../utils/date'
  import { queryBuilder, mutationBuilder } from '../../hooks/queries/builder'
  import { centerId } from '../../stores/center.store'
  import {
    patchChangeSchedule,
    type MappedSchedule,
    type ScheduleDetailResponse
  } from '../../hooks/actions/schedule.action'
  import {
    getMemberList,
    type MemberListItem
  } from '../../hooks/actions/member.action'
  import { getRoomList } from '../../hooks/actions/room.action'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import {
    buildRoomsQueryInput,
    RoomSection
  } from '../../features/schedule/counsel'
  import MultiDateSchedulePicker from '../schedule/MultiDateSchedulePicker.svelte'
  import { snackbarStore } from '../../stores/snackbar'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'

  interface Props {
    modalId?: string
    schedule?: MappedSchedule
    scheduleData?: ScheduleDetailResponse
    closeModal?: () => void
  }

  let {
    modalId = '',
    schedule,
    scheduleData,
    closeModal = () => {}
  }: Props = $props()

  /* ─────── 세션 내담자 목록 ─────── */
  const sessionClients = $derived(scheduleData?.sessions?.[0]?.clients ?? [])

  /* ─────── 담당자 ─────── */
  const membersQuery = $derived(
    $centerId
      ? queryBuilder(getMemberList, () => ({ centerId: $centerId!, size: 100 }))
      : null
  )
  const memberList = $derived(
    (membersQuery?.data?.items ?? []) as MemberListItem[]
  )

  /* ─────── 장소 ─────── */
  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const roomList = $derived(roomsQuery.data ?? [])

  /* ─────── mutation ─────── */
  const changeSchedule = mutationBuilder(
    patchChangeSchedule,
    [],
    [['getScheduleDetail'], ['getScheduleList']]
  )

  /* ─────── state ─────── */
  let selectedClientIds = $state<string[]>([])
  let selectedCounselorId = $state<string>('')
  let selectedRoom = $state<RoomItemType | null>(null)
  let selectedDates = $state<Date[]>([])
  let startTime = $state('')
  let endTime = $state('')

  /* ─────── 초기값 세팅 ─────── */
  let initialized = $state(false)

  $effect(() => {
    if (initialized || !scheduleData || !roomList.length) return
    initialized = true

    // 내담자
    selectedClientIds = sessionClients.map((c) => c.client_id)

    // 담당자
    selectedCounselorId = scheduleData.member_id

    // 장소
    if (scheduleData.room_id) {
      selectedRoom = roomList.find((r) => r.id === scheduleData.room_id) ?? null
    } else {
      selectedRoom = roomList.find((r) => r.name === schedule?.room) ?? null
    }

    // 일정
    const kstStart = formatUtcToKst(scheduleData.start, 'YYYY-MM-DDTHH:mm')
    selectedDates = [new Date(kstStart)]
    startTime = formatUtcToKst(scheduleData.start, 'HH:mm')
    endTime = formatUtcToKst(scheduleData.end, 'HH:mm')
  })

  /* ─────── 내담자 토글 ─────── */
  const handleToggleClient = (clientId: string) => {
    if (selectedClientIds.includes(clientId)) {
      selectedClientIds = selectedClientIds.filter((id) => id !== clientId)
    } else {
      selectedClientIds = [...selectedClientIds, clientId]
    }
  }

  let showClientHelp = $state(false)

  /* ─────── 내담자 변경 요약 ─────── */
  const removedClients = $derived(
    sessionClients.filter((c) => !selectedClientIds.includes(c.client_id))
  )
  const addedClientIds = $derived(
    selectedClientIds.filter(
      (id) => !sessionClients.some((c) => c.client_id === id)
    )
  )

  /* ─────── 담당자 변경 요약 ─────── */
  const originalCounselorName = $derived(
    scheduleData?.sessions?.[0]?.counselor_name ?? ''
  )
  const selectedCounselorName = $derived(
    memberList.find((m) => m.id === selectedCounselorId)?.person.name ?? ''
  )
  const counselorChanged = $derived(
    !!scheduleData &&
      scheduleData.member_id !== selectedCounselorId &&
      !!selectedCounselorName
  )

  /* ─────── 장소 변경 요약 ─────── */
  const originalRoomName = $derived(scheduleData?.room_name ?? '')
  const roomChanged = $derived(
    !!scheduleData &&
      (scheduleData.room_id ?? null) !== (selectedRoom?.id ?? null)
  )

  /* ─────── 일정 변경 요약 ─────── */
  const selectedDate = $derived(
    selectedDates.length > 0 ? selectedDates[0] : null
  )
  const originalDateText = $derived(
    scheduleData ? formatUtcToKst(scheduleData.start, 'YYYY-MM-DD(d)') : ''
  )
  const currentDateText = $derived.by(() => {
    if (!selectedDate) return ''
    const y = selectedDate.getFullYear()
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const d = String(selectedDate.getDate()).padStart(2, '0')
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const day = days[selectedDate.getDay()]
    return `${y}-${m}-${d}(${day})`
  })
  const dateChanged = $derived.by(() => {
    if (!scheduleData) return false
    const originalStart = formatUtcToKst(scheduleData.start, 'YYYY-MM-DD HH:mm')
    const originalEnd = formatUtcToKst(scheduleData.end, 'HH:mm')
    const currentStart = selectedDate
      ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')} ${startTime}`
      : ''
    return originalStart !== currentStart || originalEnd !== endTime
  })

  /* ─────── 변경 감지 ─────── */
  const isChanged = $derived(
    dateChanged ||
      roomChanged ||
      counselorChanged ||
      removedClients.length > 0 ||
      addedClientIds.length > 0
  )

  const canSubmit = $derived(
    !!selectedDate &&
      !!startTime &&
      !!endTime &&
      !!selectedCounselorId &&
      isChanged
  )

  /* ─────── submit ─────── */
  const handleSubmit = () => {
    if (!canSubmit || !scheduleData || !selectedDate) return

    const newStart = new Date(selectedDate)
    const [sh, sm] = startTime.split(':')
    newStart.setHours(+sh, +sm, 0, 0)

    const newEnd = new Date(selectedDate)
    const [eh, em] = endTime.split(':')
    newEnd.setHours(+eh, +em, 0, 0)

    changeSchedule.mutate(
      {
        schedule_id: schedule?.id,
        center_id: $centerId,
        member_id: selectedCounselorId,
        start: newStart,
        end: newEnd,
        room_id: selectedRoom?.id ?? null
      },
      {
        onSuccess() {
          snackbarStore.success('상담 일정을 수정했어요')
          closeModal()
        },
        onError() {
          snackbarStore.error('상담 일정 수정에 실패했어요')
        }
      }
    )
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  showFooterBorder={true}
  showCloseButton={true}
  size="lg"
  bodyClass="p-0!"
  footerClass="px-5 pt-4 pb-5"
  headerClass="px-5 py-4 items-center!"
>
  {#snippet header()}
    <div class="w-full space-y-2">
      {#if scheduleData}
        <Typography
          variant="headline-02-normal-semibold"
          color="text-body-strong"
        >
          {formatUtcToKst(scheduleData.start, 'YYYY-MM-DD (d) HH:mm')} 상담 일정을
          변경할게요
        </Typography>
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          변경사항은 해당 회기에만 적용돼요
        </Typography>
      {/if}
    </div>
  {/snippet}

  {#snippet body()}
    <div class="p-5 pb-7 space-y-6">
      {#if scheduleData}
        <!-- 내담자 -->
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-3"
          >
            내담자
          </Typography>
          <div class="flex flex-wrap gap-2">
            {#each sessionClients as client}
              {@const isSelected = selectedClientIds.includes(client.client_id)}
              <button
                type="button"
                onclick={() => handleToggleClient(client.client_id)}
                class={twMerge(
                  'h-11 px-4 rounded-lg border text-sm transition-colors',
                  isSelected
                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                )}
              >
                {$isSecretMode
                  ? maskName(client.client_name)
                  : client.client_name}
              </button>
            {/each}
          </div>

          <!-- 아코디언: 내담자 목록에 없나요? -->
          <button
            type="button"
            onclick={() => (showClientHelp = !showClientHelp)}
            class="mt-2 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
          >
            <Typography variant="body-03-normal-regular" color="text-gray-600">
              내담자가 목록에 없나요?
            </Typography>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              class="transition-transform duration-200 {showClientHelp
                ? ''
                : 'rotate-180'}"
            >
              <path
                d="M3 7l3-3 3 3"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          {#if showClientHelp}
            <div
              transition:slide={{ duration: 200 }}
              class="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-5 py-4"
            >
              <div>
                <Typography
                  variant="body-02-normal-medium"
                  color="text-gray-600"
                >
                  여기서는 상담 정보에 등록된 내담자만 선택할 수 있어요
                </Typography>
                <Typography
                  variant="body-03-normal-regular"
                  color="text-gray-600"
                  className="mt-2"
                >
                  새 내담자를 추가하려면 상담 정보에서 먼저 등록해주세요
                </Typography>
              </div>
            </div>
          {/if}

          <!-- 변경 요약 -->
          {#if removedClients.length > 0 || addedClientIds.length > 0}
            <div class="mt-3 space-y-1">
              {#if removedClients.length > 0}
                <Typography
                  variant="body-01-normal-medium"
                  color="text-primary-500"
                >
                  {removedClients
                    .map((c) =>
                      $isSecretMode ? maskName(c.client_name) : c.client_name
                    )
                    .join(', ')}를 제외할게요
                </Typography>
              {/if}
              {#if addedClientIds.length > 0}
                <Typography
                  variant="body-01-normal-medium"
                  color="text-primary-500"
                >
                  {addedClientIds
                    .map((id) => {
                      const c = sessionClients.find((c) => c.client_id === id)
                      const name = c?.client_name ?? id
                      return $isSecretMode ? maskName(name) : name
                    })
                    .join(', ')}를 추가할게요
                </Typography>
              {/if}
            </div>
          {/if}
        </div>

        <!-- 담당자 -->
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-3"
          >
            담당자
          </Typography>
          <div class="flex flex-wrap gap-2">
            {#each memberList as member}
              {@const isSelected = selectedCounselorId === member.id}
              <button
                type="button"
                onclick={() => (selectedCounselorId = member.id)}
                class={twMerge(
                  'h-11 px-4 rounded-lg border text-sm transition-colors',
                  isSelected
                    ? 'border-primary-400 bg-primary-50 text-primary-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                )}
              >
                {member.person.name}
              </button>
            {/each}
          </div>
          {#if counselorChanged}
            <Typography
              variant="body-01-normal-medium"
              color="text-primary-500"
              className="mt-3"
            >
              {originalCounselorName} → {selectedCounselorName} 으로 변경할게요
            </Typography>
          {/if}
        </div>

        <!-- 장소 -->
        <div>
          <RoomSection
            {roomList}
            {selectedRoom}
            onSelectRoom={(room) => (selectedRoom = room)}
            showAddButton={false}
          />
          {#if roomChanged && selectedRoom}
            <Typography
              variant="body-01-normal-medium"
              color="text-primary-500"
              className="mt-3"
            >
              {originalRoomName || '-'} → {selectedRoom.name} 로 변경할게요
            </Typography>
          {/if}
        </div>

        <!-- 일정 -->
        <div>
          <MultiDateSchedulePicker
            bind:selectedDates
            bind:startTime
            bind:endTime
            centerId={$centerId}
            roomId={selectedRoom?.id}
            memberId={selectedCounselorId || null}
            excludeScheduleId={schedule?.id}
            showTitle={true}
            title="일정"
            singleDate={true}
            calendarSize="modal-large"
          />
          {#if dateChanged}
            <Typography
              variant="body-01-normal-medium"
              color="text-primary-500"
              className="mt-3"
            >
              {originalDateText} → {currentDateText} 으로 변경할게요
            </Typography>
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleSubmit}
        disabled={!canSubmit}
        class={twMerge(
          'w-[140px] h-11 rounded-lg flex-center transition',
          !canSubmit
            ? 'bg-action-primary-disabled text-action-primary-disabled-fg cursor-not-allowed'
            : 'bg-primary-500 hover:bg-primary-400'
        )}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          수정
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
