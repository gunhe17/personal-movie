<script lang="ts">
  import { browser } from '$app/environment'
  import { slide } from 'svelte/transition'
  import { twMerge } from 'tailwind-merge'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import SelectableButtonGroup from '../assessment/receive/SelectableButtonGroup.svelte'
  import MultiDateSchedulePicker from '../schedule/MultiDateSchedulePicker.svelte'
  import { queryBuilder } from '../../hooks/queries/builder'
  import { centerId } from '../../stores/center.store'
  import { snackbarStore } from '../../stores/snackbar'
  import { modalUtils } from '../../stores/modal'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'
  import { getRoomList } from '../../hooks/actions/room.action'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import { getMemberList } from '../../hooks/actions/member.action'
  import type { MemberListItem } from '../../hooks/actions/member.action'
  import { getOperatingTimes } from '../../hooks/actions/center.action'
  import { postAddSessionsToCase } from '../../hooks/actions/counseling.action'
  import { getProgramList } from '../../hooks/actions/program.action'
  import { formatUtcToKst } from '../../utils/date'
  import { buildRoomsQueryInput } from '../../features/schedule/counsel'
  import type { CounselingCaseBaseDetail } from '../../types/counseling'
  import MemberChip from '$lib/components/common/MemberChip.svelte'

  interface Props {
    modalId?: string
    counselingDetail: CounselingCaseBaseDetail
    closeModal?: () => void
    onSuccess?: () => void
  }

  let {
    modalId = '',
    counselingDetail,
    closeModal = () => {},
    onSuccess
  }: Props = $props()

  /* ---------------- queries ---------------- */

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const roomList = $derived(roomsQuery.data ?? [])

  const membersQuery = $derived(
    queryBuilder(getMemberList, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )
  const memberList = $derived(
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
      enabled: browser && !!$centerId && !!counselingDetail.program_id
    })
  )
  const matchedProgram = $derived(
    (programsQuery.data as any)?.items?.find(
      (p: any) => p.id === counselingDetail.program_id
    ) ?? null
  )

  /* ---------------- options ---------------- */

  const clientChipOptions = $derived(
    counselingDetail.clients.map((c) => ({
      value: c.client_id,
      label: c.name
    }))
  )

  const memberChipOptions = $derived(
    memberList.map((m: MemberListItem) => ({
      value: m.id,
      label: m.person?.name ?? m.id
    }))
  )

  // 칩 순서 — 모달 열 때의 원본 상태 기준 (대표 → 선택된 담당자 → 미선택)
  const sortedMemberChipOptions = $derived.by(() => {
    if (!isPreFilled) return memberChipOptions
    const primary = originalPrimaryCounselorId
    const selectedSet = new Set(originalCounselorIds)
    return [...memberChipOptions].sort((a, b) => {
      const aPrimary = a.value === primary ? 0 : 1
      const bPrimary = b.value === primary ? 0 : 1
      if (aPrimary !== bPrimary) return aPrimary - bPrimary
      const aSelected = selectedSet.has(a.value) ? 0 : 1
      const bSelected = selectedSet.has(b.value) ? 0 : 1
      return aSelected - bSelected
    })
  })

  const roomOptions = $derived(
    roomList.map((r: RoomItemType) => ({ value: r.id, label: r.name }))
  )

  /* ---------------- default time from session_rule or first session ---------------- */

  function getDefaultTimes(): { start: string; end: string } {
    const rule = counselingDetail.session_rule
    if (rule?.start_time) {
      const [h, m] = rule.start_time.split(':').map(Number)
      const endDate = new Date(2000, 0, 1, h, m + (rule.duration_minutes ?? 60))
      const endStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
      return { start: rule.start_time, end: endStr }
    }

    const validSessions = counselingDetail.sessions?.filter(
      (s) => s.status !== 'cancelled'
    )
    if (validSessions?.length) {
      const first = validSessions[0]
      return {
        start: formatUtcToKst(first.start, 'HH:mm'),
        end: formatUtcToKst(first.end, 'HH:mm')
      }
    }

    return { start: '10:00', end: '11:00' }
  }

  const defaultTimes = getDefaultTimes()

  /* ---------------- 프로그램 시간 적용 ---------------- */

  const programDuration = $derived(
    matchedProgram?.duration_minutes ??
      counselingDetail.session_rule?.duration_minutes ??
      null
  )
  const programName = $derived(counselingDetail.program_name || null)

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

  /* ---------------- state ---------------- */

  let selectedClientIds = $state<string[]>([])
  let selectedCounselorIds = $state<string[]>([])
  // 대표 담당자 — counselor_ids[0] 으로 전송하여 schedule.member_id 에 반영됨.
  let primaryCounselorId = $state<string | null>(null)
  let selectedRoomId = $state<string>('')
  let conflictRoomName = $state<string | null>(null)
  let conflictReason = $state<'room' | 'member' | 'both' | null>(null)
  let selectedDates = $state<Date[]>([])
  let startTime = $state(defaultTimes.start)
  let endTime = $state(defaultTimes.end)
  let isSubmitting = $state(false)
  let isClientHintOpen = $state(false)

  // 칩 정렬용 원본 스냅샷
  let originalCounselorIds = $state<string[]>([])
  let originalPrimaryCounselorId = $state<string | null>(null)

  /* ---------------- 초기값 세팅 ---------------- */

  let isPreFilled = $state(false)

  $effect(() => {
    if (isPreFilled) return
    if (!counselingDetail) return

    // 내담자 전체 선택
    selectedClientIds = counselingDetail.clients.map((c) => c.client_id)

    // 담당자 — case.counselor_id 가 대표. counselors 배열은 백엔드에서 이미
    // 대표 먼저 정렬되어 내려옴.
    const counselorIds = counselingDetail.counselors.map((c) => c.counselor_id)
    if (counselorIds.length > 0) {
      selectedCounselorIds = counselorIds
    } else if (counselingDetail.counselor_id) {
      selectedCounselorIds = [counselingDetail.counselor_id]
    }
    const initialPrimary =
      counselingDetail.counselor_id &&
      selectedCounselorIds.includes(counselingDetail.counselor_id)
        ? counselingDetail.counselor_id
        : (selectedCounselorIds[0] ?? null)
    primaryCounselorId = initialPrimary
    originalCounselorIds = [...selectedCounselorIds]
    originalPrimaryCounselorId = initialPrimary

    isPreFilled = true
  })

  // 장소 — 케이스 최근 회기의 room 승계, 없으면 케이스 room_name 매칭.
  // roomList가 비동기 로드라 담당자/내담자 프리필과 분리 (로드 전 실행되면 매칭 실패 고착)
  let isRoomPreFilled = $state(false)

  $effect(() => {
    if (isRoomPreFilled) return
    if (!counselingDetail) return

    const lastSessionRoomId = [...(counselingDetail.sessions ?? [])]
      .reverse()
      .find((s) => s.status !== 'cancelled' && s.room_id)?.room_id
    if (lastSessionRoomId) {
      selectedRoomId = lastSessionRoomId
      isRoomPreFilled = true
      return
    }

    if (counselingDetail.room_name && roomList.length > 0) {
      const found = roomList.find((r) => r.name === counselingDetail.room_name)
      if (found) selectedRoomId = found.id
      isRoomPreFilled = true
    }
  })

  /* ---------------- derived ---------------- */

  const canSubmit = $derived(
    selectedDates.length > 0 &&
      selectedClientIds.length > 0 &&
      selectedCounselorIds.length > 0 &&
      !!startTime &&
      !!endTime &&
      !isSubmitting
  )

  /* ---------------- handlers ---------------- */

  function handleClientToggle(value: string) {
    if (selectedClientIds.includes(value)) {
      selectedClientIds = selectedClientIds.filter((id) => id !== value)
    } else {
      selectedClientIds = [...selectedClientIds, value]
    }
  }

  function handleCounselorToggle(value: string) {
    if (selectedCounselorIds.includes(value)) {
      // 선택 해제 (마지막 1명도 해제 가능 — 전원 해제 후 다시 고를 수 있어야 한다)
      const next = selectedCounselorIds.filter((id) => id !== value)
      selectedCounselorIds = next
      // 해제 대상이 대표였으면 남은 담당자 중 첫 번째로 자동 승계
      if (primaryCounselorId === value) {
        primaryCounselorId = next[0] ?? null
      }
    } else {
      selectedCounselorIds = [...selectedCounselorIds, value]
      // 대표가 없었으면 자동으로 대표로 지정 (최초 선택)
      if (primaryCounselorId === null) {
        primaryCounselorId = value
      }
    }
  }

  function setPrimaryCounselor(value: string) {
    if (selectedCounselorIds.includes(value)) {
      primaryCounselorId = value
    }
  }

  function handleRoomSelect(value: string) {
    // 이미 선택된 장소를 다시 누르면 해제 (담당자 칩과 동일한 토글 동작)
    selectedRoomId = selectedRoomId === value ? '' : value
  }

  async function handleSubmit() {
    if (!canSubmit || !$centerId) return

    if (conflictReason) {
      const confirmed = await modalUtils.confirm(
        '',
        '같은 시간에 이미 일정이 있어요',
        {
          type: 'warning',
          description: buildConflictConfirmDescription(
            conflictRoomName,
            conflictReason,
            '추가'
          ),
          confirmText: '추가'
        }
      )
      if (!confirmed) return
    }

    isSubmitting = true
    try {
      const dates = selectedDates.map((d) => {
        const [sh, sm] = startTime.split(':')
        const dt = new Date(d)
        dt.setHours(+sh, +sm, 0, 0)
        return dt.toISOString()
      })
      // counselor_ids 를 primary 먼저 오도록 재정렬 (백엔드는 counselor_ids[0]
      // 을 schedule.member_id 의 대표로 사용).
      const orderedCounselorIds =
        primaryCounselorId && selectedCounselorIds.includes(primaryCounselorId)
          ? [
              primaryCounselorId,
              ...selectedCounselorIds.filter((id) => id !== primaryCounselorId)
            ]
          : selectedCounselorIds
      const result = await postAddSessionsToCase().request({
        centerId: $centerId,
        caseId: counselingDetail.case_id,
        dates,
        start_time: startTime,
        end_time: endTime,
        room_id: selectedRoomId || undefined,
        counselor_ids: orderedCounselorIds,
        client_ids: selectedClientIds
      })
      const warningCount = result.warnings?.length ?? 0
      if (warningCount > 0) {
        snackbarStore.success(
          `${result.created_count}개 회기가 생성되었습니다 (충돌 ${warningCount}건)`
        )
      } else {
        snackbarStore.success(`${result.created_count}개 회기가 생성되었습니다`)
      }
      onSuccess?.()
      closeModal()
    } catch {
      snackbarStore.error('회기 생성에 실패했습니다')
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
  size="fit"
  bodyClass="p-0!"
  footerClass="px-5 pt-4 pb-5"
  title="회기를 추가할게요"
>
  {#snippet body()}
    <div class="p-5 pb-7 space-y-6">
      <!-- 내담자 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-3"
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
        <!-- 폼 라벨 표준 = body-02-normal-medium(15/500) + gray-700 + mb-2 -->
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
          {#each sortedMemberChipOptions as option (option.value)}
            {@const isSelected = selectedCounselorIds.includes(option.value)}
            {@const isPrimary = primaryCounselorId === option.value}
            <MemberChip
              name={option.label}
              selected={isSelected && !isPrimary}
              primary={isPrimary}
              onclick={() => handleCounselorToggle(option.value)}
              oncrownclick={() => setPrimaryCounselor(option.value)}
              primaryLabel="대표(주 치료사)"
              selectedLabel="보조 치료사"
            />
          {/each}
        </div>
      </div>

      <!-- 장소 -->
      {#if roomOptions.length > 0}
        <SelectableButtonGroup
          label="장소"
          options={roomOptions}
          selected={selectedRoomId}
          onSelect={handleRoomSelect}
        />
      {/if}

      <!-- 일정 -->
      <MultiDateSchedulePicker
        bind:selectedDates
        bind:startTime
        bind:endTime
        bind:conflictRoomName
        bind:conflictReason
        {operatingTimes}
        centerId={$centerId}
        roomId={selectedRoomId || null}
        memberId={primaryCounselorId ?? selectedCounselorIds[0] ?? null}
        calendarSize="modal-large"
        onApplyDuration={programDuration ? applyProgramDuration : null}
        durationLabel={programDuration && programName
          ? `${programName} ${programDuration}분 적용`
          : null}
        durationMinutes={programDuration}
      />
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end">
      <button
        type="button"
        disabled={!canSubmit}
        onclick={handleSubmit}
        class={twMerge(
          'w-[140px] h-11 rounded-lg transition-colors',
          canSubmit
            ? 'bg-primary-500 text-white hover:bg-primary-600'
            : 'bg-action-primary-disabled text-action-primary-disabled-fg cursor-not-allowed'
        )}
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isSubmitting ? '생성 중...' : '추가'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
