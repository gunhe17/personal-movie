<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { browser } from '$app/environment'
  import { slide } from 'svelte/transition'

  import Typography from '@common/components/Typography.svelte'
  import {
    formatUtcToKst,
    kstDateTimeToUtcIso,
    DAYS_IN_KOREA
  } from '../../utils/date'
  import { queryBuilder, mutationBuilder } from '../../hooks/queries/builder'
  import { centerId } from '../../stores/center.store'
  import { getRoomList } from '../../hooks/actions/room.action'
  import { buildRoomsQueryInput } from '../../features/schedule/counsel'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import BaseModal from './BaseModal.svelte'
  import type {
    CounselingCaseBaseDetail,
    CounselingSession
  } from '../../types/counseling'
  import MultiDateSchedulePicker from '../schedule/MultiDateSchedulePicker.svelte'
  import { patchChangeSchedule } from '../../hooks/actions/schedule.action'
  import { patchBulkUpdateSessions } from '../../hooks/actions/counseling.action'
  import { snackbarStore } from '../../stores/snackbar'
  import { modalUtils } from '../../stores/modal'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'
  import SelectableButtonGroup from '../assessment/receive/SelectableButtonGroup.svelte'
  import { getMemberList } from '../../hooks/actions/member.action'
  import type { MemberListItem } from '../../hooks/actions/member.action'
  import { getOperatingTimes } from '../../hooks/actions/center.action'
  import MemberChip from '$lib/components/common/MemberChip.svelte'
  import { getProgramList } from '../../hooks/actions/program.action'

  interface Props {
    modalId?: string
    session?: CounselingSession
    counselingData?: CounselingCaseBaseDetail
    closeModal?: () => void
    onSuccess?: () => void
  }

  let {
    modalId = '',
    session,
    counselingData,
    closeModal = () => {},
    onSuccess
  }: Props = $props()

  /* ---------------- queries ---------------- */

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const roomsData = $derived(roomsQuery.data ?? [])

  const membersQuery = $derived(
    queryBuilder(getMemberList, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )
  const membersData = $derived(
    (membersQuery.data as any)?.items ?? membersQuery.data ?? []
  ) as MemberListItem[]

  const operatingTimesQuery = $derived(
    queryBuilder(getOperatingTimes, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )
  const operatingTimes = $derived(operatingTimesQuery.data ?? [])

  const programsQuery = $derived(
    queryBuilder(getProgramList, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId && !!counselingData?.program_id
    })
  )
  const matchedProgram = $derived(
    (programsQuery.data as any)?.items?.find(
      (p: any) => p.id === counselingData?.program_id
    ) ?? null
  )

  const programDuration = $derived(
    matchedProgram?.duration_minutes ??
      counselingData?.session_rule?.duration_minutes ??
      null
  )
  const programName = $derived(counselingData?.program_name || null)

  /* ---------------- mutations ----------------
   * invalidate 대상:
   *   - getScheduleDetail / getScheduleList → 캘린더 뷰 새로고침
   *   - getCounselingDetailById → 상담 상세 페이지 새로고침
   * 두 쿼리 모두 mutation 레벨에서 invalidate 해서 캐시 비대칭이 없도록 함. */
  const changeSchedule = mutationBuilder(
    patchChangeSchedule,
    [],
    [['getScheduleDetail'], ['getScheduleList'], ['getCounselingDetailById']]
  )
  const bulkUpdateSessions = mutationBuilder(
    patchBulkUpdateSessions,
    [],
    [['getScheduleDetail'], ['getScheduleList'], ['getCounselingDetailById']]
  )

  function addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number)
    const d = new Date(2000, 0, 1, h, m + minutes, 0, 0)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function applyProgramDuration() {
    if (programDuration) {
      endTime = addMinutesToTime(startTime, programDuration)
    }
  }

  /* ---------------- 옵션 데이터 ---------------- */

  const clientChipOptions = $derived(
    (counselingData?.clients ?? []).map((c) => ({
      value: c.client_id,
      label: c.name
    }))
  )

  // 칩 순서 — 모달 열 때의 원본 상태 기준으로 고정.
  // 대표 → 선택된 담당자 → 미선택 순. 사용자가 토글해도 칩이 튀지 않도록
  // 원본 값(originalPrimaryMemberId, originalMemberIds)을 기준으로 정렬한다.
  const memberChipOptions = $derived.by(() => {
    const all = membersData.map((m: MemberListItem) => ({
      value: m.id,
      label: m.person?.name ?? m.id
    }))
    if (!isPreFilled) return all
    const primary = originalPrimaryMemberId
    const selectedSet = new Set(originalMemberIds)
    return [...all].sort((a, b) => {
      const aPrimary = a.value === primary ? 0 : 1
      const bPrimary = b.value === primary ? 0 : 1
      if (aPrimary !== bPrimary) return aPrimary - bPrimary
      const aSelected = selectedSet.has(a.value) ? 0 : 1
      const bSelected = selectedSet.has(b.value) ? 0 : 1
      return aSelected - bSelected
    })
  })

  const roomOptions = $derived(
    roomsData.map((r: RoomItemType) => ({ value: r.id, label: r.name }))
  )

  /* ---------------- state ---------------- */

  let selectedMemberIds = $state<string[]>([])
  // 대표 담당자 — selectedMemberIds 안에 반드시 포함. schedule.member_id 로 저장.
  let primaryMemberId = $state<string | null>(null)
  let selectedRoom = $state<string>('')
  let selectedDates = $state<Date[]>([])
  let startTime = $state('')
  let endTime = $state('')
  let selectedClientIds = $state<string[]>([])
  let conflictRoomName = $state<string | null>(null)
  let conflictReason = $state<'room' | 'member' | 'both' | null>(null)

  /* ---------------- 원본값 (변경 감지용) ---------------- */

  let originalMemberIds = $state<string[]>([])
  let originalPrimaryMemberId = $state<string | null>(null)
  let originalRoomId = $state<string>('')
  let originalStartKst = $state('')
  let originalEndKst = $state('')
  let originalDateStr = $state('')
  let originalClientIds = $state<string[]>([])

  /* ---------------- 초기값 세팅 ---------------- */

  let isPreFilled = $state(false)

  $effect(() => {
    if (isPreFilled) return
    if (!session || !counselingData) return

    // 날짜/시간
    const kstStr = formatUtcToKst(session.start, 'YYYY-MM-DD HH:mm')
    const [datePart, timePart] = kstStr.split(' ')
    const [y, mo, d] = datePart.split('-').map(Number)
    selectedDates = [new Date(y, mo - 1, d)]
    startTime = timePart
    endTime = formatUtcToKst(session.end, 'HH:mm')
    originalStartKst = kstStr
    originalEndKst = formatUtcToKst(session.end, 'HH:mm')
    originalDateStr = formatUtcToKst(session.start, 'YYYY-MM-DD')

    // 장소
    selectedRoom = session.room_id ?? ''
    originalRoomId = session.room_id ?? ''

    // 내담자
    const clientIds = session.clients.map((c) => c.participant_id)
    originalClientIds = clientIds
    selectedClientIds = [...clientIds]

    // 담당자 — 첫 번째가 대표 (백엔드 get_case_detail 에서 이미 대표를
    // schedule.member_id 기준으로 정렬해서 counselors[0] 에 넣어줌).
    const counselorIds = session.counselors.map((c) => c.counselor_id)
    originalMemberIds = counselorIds
    selectedMemberIds = [...counselorIds]
    const initialPrimary = counselorIds[0] ?? null
    primaryMemberId = initialPrimary
    originalPrimaryMemberId = initialPrimary

    isPreFilled = true
  })

  /* ---------------- 파생값 ---------------- */

  const selectedDate = $derived(
    selectedDates.length > 0 ? selectedDates[0] : null
  )

  function formatDateDisplay(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const dayLabel = DAYS_IN_KOREA[date.getDay()]
    return `${y}-${m}-${d} (${dayLabel})`
  }

  /* ---------------- 변경 감지 ---------------- */

  const isTimeChanged = $derived.by(() => {
    if (!session || !startTime || !endTime) return false
    const originalTime = originalStartKst.split(' ')[1] ?? ''
    return originalTime !== startTime || originalEndKst !== endTime
  })

  const isDateChanged = $derived.by(() => {
    if (!session || !selectedDate) return false
    const pad = (n: number) => String(n).padStart(2, '0')
    const currentDateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`
    return originalDateStr !== currentDateStr
  })

  const isScheduleChanged = $derived(isTimeChanged || isDateChanged)
  const isRoomChanged = $derived(!!session && selectedRoom !== originalRoomId)

  const isMembersChanged = $derived.by(() => {
    if (!session) return false
    // 대표 변경도 담당자 변경으로 취급 (schedule.member_id 갱신 필요)
    if (primaryMemberId !== originalPrimaryMemberId) return true
    const currentIds = [...selectedMemberIds].sort()
    const origIds = [...originalMemberIds].sort()
    if (currentIds.length !== origIds.length) return true
    return currentIds.some((id, i) => id !== origIds[i])
  })

  const isClientsChanged = $derived.by(() => {
    if (!session) return false
    const currentIds = [...selectedClientIds].sort()
    const origIds = [...originalClientIds].sort()
    if (currentIds.length !== origIds.length) return true
    return currentIds.some((id, i) => id !== origIds[i])
  })

  const isChanged = $derived(
    isScheduleChanged || isRoomChanged || isMembersChanged || isClientsChanged
  )

  let isSubmitting = $state(false)

  const canSubmit = $derived(
    !!selectedDate &&
      !!startTime &&
      !!endTime &&
      selectedMemberIds.length > 0 &&
      !!primaryMemberId &&
      isChanged &&
      !isSubmitting
  )

  /* ---------------- 헤더 날짜 ---------------- */

  const headerDateStr = $derived(
    session ? formatUtcToKst(session.start, 'YYYY-MM-DD (d)') : ''
  )

  /* ---------------- 변경 요약 텍스트 ---------------- */

  const clientNameMap = $derived(
    new Map((counselingData?.clients ?? []).map((c) => [c.client_id, c.name]))
  )
  const memberNameMap = $derived(
    new Map(
      membersData.map((m: MemberListItem) => [m.id, m.person?.name ?? m.id])
    )
  )
  const roomNameMap = $derived(
    new Map(roomsData.map((r: RoomItemType) => [r.id, r.name]))
  )

  // 내담자 변경 요약
  const clientChangeSummary = $derived.by(() => {
    if (!isClientsChanged) return null
    const removed = originalClientIds
      .filter((id) => !selectedClientIds.includes(id))
      .map((id) => clientNameMap.get(id) ?? id)
    const added = selectedClientIds
      .filter((id) => !originalClientIds.includes(id))
      .map((id) => clientNameMap.get(id) ?? id)
    return { removed, added }
  })

  // 담당자 변경 요약 — 대표를 맨 앞에 "(대표)" 레이블과 함께 표시
  function formatMemberSummary(ids: string[], primary: string | null): string {
    if (ids.length === 0) return '-'
    const sorted =
      primary && ids.includes(primary)
        ? [primary, ...ids.filter((id) => id !== primary)]
        : ids
    return sorted
      .map((id, idx) => {
        const name = memberNameMap.get(id) ?? id
        return idx === 0 && primary ? `${name}(주담당)` : name
      })
      .join(', ')
  }
  const memberChangeSummary = $derived.by(() => {
    if (!isMembersChanged) return null
    return {
      from: formatMemberSummary(originalMemberIds, originalPrimaryMemberId),
      to: formatMemberSummary(selectedMemberIds, primaryMemberId)
    }
  })

  // 장소 변경 요약
  const roomChangeSummary = $derived.by(() => {
    if (!isRoomChanged) return null
    const origName =
      roomNameMap.get(originalRoomId) ?? (originalRoomId || '없음')
    const newName = roomNameMap.get(selectedRoom) ?? (selectedRoom || '없음')
    return { from: origName, to: newName }
  })

  // 일정 변경 요약
  const scheduleChangeSummary = $derived.by(() => {
    if (!isDateChanged || !selectedDate) return null
    const origKst = session
      ? formatUtcToKst(session.start, 'YYYY-MM-DD (d)')
      : ''
    const newKst = formatDateDisplay(selectedDate)
    return { from: origKst, to: newKst }
  })

  /* ---------------- 토글 핸들러 ---------------- */

  function handleClientToggle(value: string) {
    if (selectedClientIds.includes(value)) {
      selectedClientIds = selectedClientIds.filter((id) => id !== value)
    } else {
      selectedClientIds = [...selectedClientIds, value]
    }
  }

  function handleMemberToggle(value: string) {
    if (selectedMemberIds.includes(value)) {
      // 마지막 1명은 해제 금지
      if (selectedMemberIds.length === 1) return
      // 선택 해제
      const next = selectedMemberIds.filter((id) => id !== value)
      selectedMemberIds = next
      // 해제 대상이 대표였으면 남은 담당자 중 첫 번째로 자동 승계
      if (primaryMemberId === value) {
        primaryMemberId = next[0] ?? null
      }
    } else {
      selectedMemberIds = [...selectedMemberIds, value]
      // 대표가 없었으면 자동으로 대표로 지정 (최초 선택)
      if (primaryMemberId === null) {
        primaryMemberId = value
      }
    }
  }

  function setPrimaryMember(value: string) {
    if (selectedMemberIds.includes(value)) {
      primaryMemberId = value
    }
  }

  function handleRoomSelect(value: string) {
    selectedRoom = value
  }

  /* ---------------- 내담자 힌트 아코디언 ---------------- */

  let isClientHintOpen = $state(false)

  /* ---------------- submit ---------------- */

  async function handleSubmit() {
    if (!session || !selectedDate || isSubmitting) return

    if (conflictReason) {
      const confirmed = await modalUtils.confirm(
        '',
        '같은 시간에 이미 일정이 있어요',
        {
          type: 'warning',
          description: buildConflictConfirmDescription(
            conflictRoomName,
            conflictReason,
            '수정'
          ),
          confirmText: '수정'
        }
      )
      if (!confirmed) return
    }

    // 변경 플래그는 mutation 실행 전에 스냅샷으로 캡처.
    // changeSchedule 성공 → 관련 쿼리 invalidate → scheduleData 재계산 과정에서
    // 반응형 flag 들이 false 로 뒤집힐 수 있기 때문.
    const didDateChange = isDateChanged
    const didTimeChange = isTimeChanged
    const didRoomChange = isRoomChanged
    const didMembersChange = isMembersChanged
    const didClientsChange = isClientsChanged
    const scheduleFieldsChanged =
      didDateChange || didTimeChange || didRoomChange
    const targetMemberIds = [...selectedMemberIds]
    // primaryMemberId 는 유저가 명시적으로 지정한 대표.
    // 이 값을 schedule.member_id 로 저장. session_participants 에는 전체 배열 전달.
    const targetPrimaryMemberId = primaryMemberId
    const targetClientIds = [...selectedClientIds]
    const targetRoomId = selectedRoom
    const targetDate = selectedDate
    const targetStartTime = startTime
    const targetEndTime = endTime

    isSubmitting = true

    try {
      const cId = $centerId!

      // 1) Schedule 필드 변경 (시간/장소/대표 담당자)
      //    담당자만 바뀐 경우에도 schedule.member_id 가 캘린더 표시 source 이므로
      //    여기서 같이 업데이트 해야 캘린더에 반영됨.
      //    case.counselor_id 는 건드리지 않음 — 그건 상담 정보 수정의 영역.
      if (scheduleFieldsChanged || didMembersChange) {
        const newStartUtc = kstDateTimeToUtcIso(targetDate, targetStartTime)
        const newEndUtc = kstDateTimeToUtcIso(targetDate, targetEndTime)

        await changeSchedule.mutateAsync({
          schedule_id: session.schedule_id,
          center_id: cId,
          member_id:
            targetPrimaryMemberId ?? session.counselors[0]?.counselor_id,
          start: newStartUtc,
          end: newEndUtc,
          room_id: targetRoomId || null
        })
      }

      // 2) 내담자/담당자 변경 → 해당 세션의 session_participants 만 전체 교체.
      //    bulk-update 는 session_ids 에 이 세션 하나만 넣어서 호출하므로
      //    다른 회기에 영향 없음. client_ids/counselor_ids 는 최종 상태를 그대로
      //    전달하여 서버에서 delete+add 로 전체 교체됨 (제거/추가 모두 커버).
      if ((didMembersChange || didClientsChange) && session.session_id) {
        const bulkPayload: Record<string, any> = {
          session_ids: [session.session_id]
        }
        if (didClientsChange) {
          bulkPayload.client_ids = targetClientIds
        }
        if (didMembersChange) {
          bulkPayload.counselor_ids = targetMemberIds
        }
        await bulkUpdateSessions.mutateAsync({
          centerId: cId,
          payload: bulkPayload as any
        })
      }

      snackbarStore.success('회기가 수정되었습니다')
      onSuccess?.()
      closeModal()
    } catch {
      snackbarStore.error('회기 수정에 실패했습니다')
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
  size="xl"
  bodyClass="p-0!"
  footerClass="px-5 pt-4 pb-5"
  headerClass="px-5 py-4 items-start!"
>
  {#snippet header()}
    <!-- 2줄 헤더 규격: 타이틀↔부제 8 · 부제 body-02-normal-regular/gray-500 (Web_Design.md §modal) -->
    <div class="flex flex-col gap-2">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        {headerDateStr} 일정을 수정할게요
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-gray-500">
        변경사항은 해당 회기에만 적용돼요
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    {#if session && counselingData}
      <div class="p-5 pb-7 space-y-6">
        <!-- 내담자 -->
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            내담자
          </Typography>
          <SelectableButtonGroup
            label="내담자"
            options={clientChipOptions}
            selected={selectedClientIds}
            multiple={true}
            onSelect={handleClientToggle}
            showLabel={false}
          />
          {#if clientChangeSummary}
            <div class="mt-3 space-y-0.5">
              {#if clientChangeSummary.removed.length > 0}
                <p class="text-body-03-normal-regular">
                  <span class="text-gray-600"
                    >{clientChangeSummary.removed.join(', ')}</span
                  ><span class="text-primary-500">를 제외할게요</span>
                </p>
              {/if}
              {#if clientChangeSummary.added.length > 0}
                <p class="text-body-03-normal-regular">
                  <span class="text-gray-600"
                    >{clientChangeSummary.added.join(', ')}</span
                  ><span class="text-primary-500">를 추가할게요</span>
                </p>
              {/if}
            </div>
          {/if}
          <button
            type="button"
            onclick={() => (isClientHintOpen = !isClientHintOpen)}
            class="mt-3 flex items-center gap-1 text-body-03-normal-regular text-primary-500 hover:text-primary-600 transition-colors"
          >
            내담자가 목록에 없나요?
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              class="transition-transform duration-200 {isClientHintOpen
                ? 'rotate-180'
                : ''}"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          {#if isClientHintOpen}
            <div
              class="mt-2 rounded-lg bg-gray-50 p-4"
              transition:slide={{ duration: 200 }}
            >
              <!-- 타이틀 16/500 body-strong ↔ 서브 15/400 body-default, 간격 12 -->
              <Typography
                variant="body-01-normal-medium"
                color="text-body-strong"
              >
                여기서는 상담 정보에 등록된 내담자만 선택할 수 있어요
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-body-default"
                className="mt-3"
              >
                새 내담자를 추가하려면 상담 정보에서 먼저 등록해주세요
              </Typography>
            </div>
          {/if}
        </div>

        <!-- 담당자 (다중 선택 + 대표 지정) -->
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            담당자
          </Typography>
          <!-- 안내 = Reading(150%) 행간 (§Typography — wrap 대비) -->
          <Typography
            variant="body-03-reading-regular"
            color="text-body-subtle"
            className="mb-3"
          >
            처음 선택한 담당자가 대표 치료사로 지정돼요. 왕관 아이콘을 눌러 대표
            치료사를 변경할 수 있어요.
          </Typography>
          <div class="flex flex-wrap gap-2">
            {#each memberChipOptions as option}
              {@const isSelected = selectedMemberIds.includes(option.value)}
              {@const isPrimary = primaryMemberId === option.value}
              <MemberChip
                name={option.label}
                selected={isSelected && !isPrimary}
                primary={isPrimary}
                onclick={() => handleMemberToggle(option.value)}
                oncrownclick={() => setPrimaryMember(option.value)}
                primaryLabel="대표(주 치료사)"
                selectedLabel="보조 치료사"
              />
            {/each}
          </div>
          {#if memberChangeSummary}
            <p class="mt-3 text-body-03-normal-regular">
              <span class="text-gray-600">{memberChangeSummary.from}</span>
              <span class="text-primary-500">
                → {memberChangeSummary.to} 으로 변경할게요</span
              >
            </p>
          {/if}
        </div>

        <!-- 장소 -->
        <div>
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            className="mb-2"
          >
            장소
          </Typography>
          <SelectableButtonGroup
            label="장소"
            options={roomOptions}
            selected={selectedRoom}
            onSelect={handleRoomSelect}
            showLabel={false}
          />
          {#if roomChangeSummary}
            <p class="mt-3 text-body-03-normal-regular">
              <span class="text-gray-600">{roomChangeSummary.from}</span>
              <span class="text-primary-500">
                → {roomChangeSummary.to} 로 변경할게요</span
              >
            </p>
          {/if}
        </div>

        <!-- 일정 -->
        <div>
          <MultiDateSchedulePicker
            bind:selectedDates
            bind:startTime
            bind:endTime
            bind:conflictRoomName
            bind:conflictReason
            {operatingTimes}
            centerId={$centerId}
            roomId={selectedRoom || null}
            memberId={primaryMemberId ?? selectedMemberIds[0] ?? null}
            excludeScheduleId={session?.schedule_id}
            showTitle={true}
            title="일정"
            singleDate={true}
            calendarSize="modal-large"
            onApplyDuration={programDuration ? applyProgramDuration : null}
            durationLabel={programDuration && programName
              ? `${programName} ${programDuration}분 적용`
              : null}
            durationMinutes={programDuration}
          />
          {#if scheduleChangeSummary}
            <p class="mt-2 text-body-03-normal-regular">
              <span class="text-gray-600">{scheduleChangeSummary.from}</span>
              <span class="text-primary-500">
                → {scheduleChangeSummary.to} 으로 변경할게요</span
              >
            </p>
          {/if}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        onclick={handleSubmit}
        disabled={!canSubmit}
        class={twMerge(
          'w-[140px] h-11 rounded-lg flex-center transition',
          canSubmit
            ? 'bg-primary-500 hover:bg-primary-400'
            : 'bg-action-primary-disabled cursor-not-allowed'
        )}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isSubmitting ? '저장 중...' : '수정'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
