<script lang="ts">
  import { browser } from '$app/environment'
  import { twMerge } from 'tailwind-merge'

  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import SelectableButtonGroup from '../assessment/receive/SelectableButtonGroup.svelte'
  import ClientMultiSelect from '../assessment/receive/ClientMultiSelect.svelte'
  import MultiDateSchedulePicker from '../schedule/MultiDateSchedulePicker.svelte'

  import { queryBuilder } from '../../hooks/queries/builder'
  import { centerId } from '../../stores/center.store'
  import { modalUtils } from '../../stores/modal'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'
  import { snackbarStore } from '../../stores/snackbar'
  import { getRoomList } from '../../hooks/actions/room.action'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import { getMemberList } from '../../hooks/actions/member.action'
  import type { MemberListItem } from '../../hooks/actions/member.action'
  import { getClientList } from '../../hooks/actions/client.action'
  import type { ClientListItem } from '../../hooks/actions/client.action'
  import { getOperatingTimes } from '../../hooks/actions/center.action'
  import { postApplyCaseEdits } from '../../hooks/actions/counseling.action'
  import { buildRoomsQueryInput } from '../../features/schedule/counsel'
  import { getProgramList } from '../../hooks/actions/program.action'
  import { formatUtcToKst } from '../../utils/date'
  import type {
    CounselingCaseBaseDetail,
    CounselingSession
  } from '../../types/counseling'
  import type { ExtendedClient } from '../../stores/receiveForm'
  import MemberChip from '$lib/components/common/MemberChip.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    counselingData: CounselingCaseBaseDetail
    onSuccess?: () => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    counselingData,
    onSuccess
  }: Props = $props()

  /* ==================== queries ==================== */

  const clientsQuery = $derived(
    queryBuilder(getClientList, () => ({ centerId: $centerId!, limit: 500 }), {
      enabled: browser && !!$centerId
    })
  )
  const clientsData = $derived(
    (clientsQuery.data as any)?.items ?? []
  ) as ClientListItem[]

  const membersQuery = $derived(
    queryBuilder(getMemberList, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )
  const membersData = $derived(
    (membersQuery.data as any)?.items ?? membersQuery.data ?? []
  ) as MemberListItem[]

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const roomsData = $derived(roomsQuery.data ?? [])

  const operatingTimesQuery = $derived(
    queryBuilder(getOperatingTimes, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )
  const operatingTimes = $derived(operatingTimesQuery.data ?? [])

  const programsQuery = $derived(
    queryBuilder(getProgramList, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId && !!counselingData.program_id
    })
  )
  const matchedProgram = $derived(
    (programsQuery.data as any)?.items?.find(
      (p: any) => p.id === counselingData.program_id
    ) ?? null
  )

  const programDuration = $derived(
    matchedProgram?.duration_minutes ??
      counselingData.session_rule?.duration_minutes ??
      null
  )
  const programName = $derived(counselingData.program_name || null)

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

  /* ==================== 옵션 데이터 ==================== */

  // 칩 순서 — 모달 열 때의 원본 상태 기준으로 고정.
  // 대표 → 선택된 담당자 → 미선택 순. 사용자가 토글해도 칩이 튀지 않도록
  // 원본 값(originalPrimaryCounselorId, originalCounselorIds)을 기준으로 정렬한다.
  const memberChipOptions = $derived.by(() => {
    const all = membersData.map((m: MemberListItem) => ({
      value: m.id,
      label: m.person?.name ?? m.id
    }))
    if (!isPreFilled) return all
    const primary = originalPrimaryCounselorId
    const selectedSet = new Set(originalCounselorIds)
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

  /* ==================== state ==================== */

  let selectedClients = $state<ExtendedClient[]>([])
  let selectedCounselorIds = $state<string[]>([])
  // 대표 담당자 ID — selectedCounselorIds 안에 반드시 포함.
  // 백엔드 apply_case_edits 는 counselor_ids[0] 을 대표로 취급하므로,
  // 저장 시 이 ID 를 배열 맨 앞에 두고 전송한다.
  let primaryCounselorId = $state<string | null>(null)
  let selectedRoom = $state<string>('')
  let selectedDates = $state<Date[]>([])
  let startTime = $state('10:00')
  let endTime = $state('11:00')
  let conflictRoomName = $state<string | null>(null)
  let conflictReason = $state<'room' | 'member' | 'both' | null>(null)

  /* ==================== 원본값 (변경 감지용) ==================== */

  let originalClientIds = $state<string[]>([])
  let originalCounselorIds = $state<string[]>([])
  let originalPrimaryCounselorId = $state<string | null>(null)
  let originalRoomId = $state<string>('')
  let originalDateStrs = $state<string[]>([])
  let originalStartTime = $state('')

  /** 기존 예정 회기 날짜 중, 현재 selectedDates 에 여전히 남아 있는 것만 하이라이트 */
  const displayedHighlightedDates = $derived.by(() => {
    if (originalDateStrs.length === 0) return []
    const currentStrs = new Set(
      selectedDates.map((d) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${dd}`
      })
    )
    return originalDateStrs
      .filter((s) => currentStrs.has(s))
      .map((s) => {
        const [y, mo, d] = s.split('-').map(Number)
        return new Date(y, mo - 1, d)
      })
  })
  let originalEndTime = $state('')

  /* ==================== 예정 회기 ==================== */

  const scheduledSessions = $derived(
    counselingData.sessions.filter(
      (s: CounselingSession) => s.status === 'scheduled'
    )
  )

  /* ==================== 초기값 세팅 ==================== */

  let isPreFilled = $state(false)

  $effect(() => {
    if (isPreFilled) return
    if (!counselingData) return

    // 내담자 — CaseClient → ExtendedClient 변환
    const clients = counselingData.clients.map((c) => ({
      uid: c.client_id,
      role: 'client',
      name: c.name,
      gender: (c.gender === 'female' ? '여자' : '남자') as '남자' | '여자',
      birth_date: c.birth_date ? new Date(c.birth_date) : null,
      guardian_relationship: '',
      guardian_name: '',
      guardian_phone: '',
      memo: '',
      created_at: '',
      updated_at: ''
    }))
    selectedClients = clients
    originalClientIds = counselingData.clients.map((c) => c.client_id)

    // 담당자 — counselingData.counselors 의 첫 번째가 대표 (백엔드에서 이미 정렬)
    const counselorIds = counselingData.counselors.map((c) => c.counselor_id)
    selectedCounselorIds = [...counselorIds]
    originalCounselorIds = [...counselorIds]
    const initialPrimary = counselorIds[0] ?? null
    primaryCounselorId = initialPrimary
    originalPrimaryCounselorId = initialPrimary

    // 장소 — 첫 번째 예정 회기의 room_id
    const firstScheduled = scheduledSessions[0]
    const roomId = firstScheduled?.room_id ?? ''
    selectedRoom = roomId
    originalRoomId = roomId

    // 일정 — 예정 회기 날짜들 (기존 회기도 selectedDates에 포함, highlightedDates로 스타일 구분)
    const dates: Date[] = []
    const dateStrs: string[] = []
    for (const session of scheduledSessions) {
      const kstStr = formatUtcToKst(session.start, 'YYYY-MM-DD')
      const [y, mo, d] = kstStr.split('-').map(Number)
      dates.push(new Date(y, mo - 1, d))
      dateStrs.push(kstStr)
    }
    selectedDates = dates
    originalDateStrs = dateStrs

    // 시간 — 첫 번째 예정 회기
    if (firstScheduled) {
      startTime = formatUtcToKst(firstScheduled.start, 'HH:mm')
      endTime = formatUtcToKst(firstScheduled.end, 'HH:mm')
      originalStartTime = startTime
      originalEndTime = endTime
    }

    isPreFilled = true
  })

  /* ==================== 변경 감지 ==================== */

  const isClientsChanged = $derived.by(() => {
    const currentIds = selectedClients.map((c) => c.uid).sort()
    const origIds = [...originalClientIds].sort()
    if (currentIds.length !== origIds.length) return true
    return currentIds.some((id, i) => id !== origIds[i])
  })

  const isCounselorsChanged = $derived.by(() => {
    // 대표 변경도 담당자 변경으로 취급
    if (primaryCounselorId !== originalPrimaryCounselorId) return true
    const currentIds = [...selectedCounselorIds].sort()
    const origIds = [...originalCounselorIds].sort()
    if (currentIds.length !== origIds.length) return true
    return currentIds.some((id, i) => id !== origIds[i])
  })

  const isRoomChanged = $derived(selectedRoom !== originalRoomId)

  const isTimeChanged = $derived(
    startTime !== originalStartTime || endTime !== originalEndTime
  )

  const isDatesChanged = $derived.by(() => {
    const currentStrs = selectedDates
      .map((d) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${dd}`
      })
      .sort()
    const origStrs = [...originalDateStrs].sort()
    if (currentStrs.length !== origStrs.length) return true
    return currentStrs.some((s, i) => s !== origStrs[i])
  })

  const isScheduleChanged = $derived(isDatesChanged || isTimeChanged)

  const isChanged = $derived(
    isClientsChanged ||
      isCounselorsChanged ||
      isRoomChanged ||
      isScheduleChanged
  )

  let isSubmitting = $state(false)

  const canSubmit = $derived(
    isChanged &&
      !isSubmitting &&
      selectedCounselorIds.length > 0 &&
      !!primaryCounselorId &&
      !!startTime &&
      !!endTime
  )

  /* ==================== 이름 매핑 ==================== */

  const clientNameMap = $derived(
    new Map(clientsData.map((c: ClientListItem) => [c.id, c.name]))
  )
  const memberNameMap = $derived(
    new Map(
      membersData.map((m: MemberListItem) => [m.id, m.person?.name ?? m.id])
    )
  )
  const roomNameMap = $derived(
    new Map(roomsData.map((r: RoomItemType) => [r.id, r.name]))
  )

  /* ==================== 변경 요약 ==================== */

  const clientChangeSummary = $derived.by(() => {
    if (!isClientsChanged) return null
    const currentIds = selectedClients.map((c) => c.uid)
    const removed = originalClientIds
      .filter((id) => !currentIds.includes(id))
      .map((id) => {
        const caseClient = counselingData.clients.find(
          (c) => c.client_id === id
        )
        return caseClient?.name ?? clientNameMap.get(id) ?? id
      })
    const added = currentIds
      .filter((id) => !originalClientIds.includes(id))
      .map((id) => {
        const sel = selectedClients.find((c) => c.uid === id)
        return sel?.name ?? clientNameMap.get(id) ?? id
      })
    return { removed, added }
  })

  // 담당자 변경 요약 — 대표를 맨 앞에 "(대표)" 로 표시
  function formatCounselorSummary(
    ids: string[],
    primary: string | null
  ): string {
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
  const counselorChangeSummary = $derived.by(() => {
    if (!isCounselorsChanged) return null
    return {
      from: formatCounselorSummary(
        originalCounselorIds,
        originalPrimaryCounselorId
      ),
      to: formatCounselorSummary(selectedCounselorIds, primaryCounselorId)
    }
  })

  const roomChangeSummary = $derived.by(() => {
    if (!isRoomChanged) return null
    const origName =
      roomNameMap.get(originalRoomId) ?? (originalRoomId || '없음')
    const newName = roomNameMap.get(selectedRoom) ?? (selectedRoom || '없음')
    return { from: origName, to: newName }
  })

  /* ==================== 토글 핸들러 ==================== */

  function handleCounselorToggle(value: string) {
    if (selectedCounselorIds.includes(value)) {
      // 마지막 1명은 해제 금지
      if (selectedCounselorIds.length === 1) return
      // 선택 해제
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
    selectedRoom = value
  }

  /* ==================== submit ==================== */

  function dateToStr(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return

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

    isSubmitting = true

    try {
      const cId = $centerId!

      // 내담자 변경 + 기존 예정 회기 있으면 → 기존 회기에 적용할지 먼저 물어봄
      let syncClientsToScheduledSessions = false
      if (isClientsChanged && scheduledSessions.length > 0) {
        const addedNames = clientChangeSummary?.added ?? []
        const removedNames = clientChangeSummary?.removed ?? []
        const changeLines: string[] = []
        if (addedNames.length > 0)
          changeLines.push(`추가: ${addedNames.join(', ')}`)
        if (removedNames.length > 0)
          changeLines.push(`제외: ${removedNames.join(', ')}`)

        syncClientsToScheduledSessions = await modalUtils.confirm(
          '',
          '내담자 변경을 기존 예정 회기에도 적용할까요?',
          {
            description: `${changeLines.join(' / ')}\n예정된 ${scheduledSessions.length}개 회기의 참여자가 함께 업데이트됩니다.`,
            confirmText: '적용',
            cancelText: '적용하지 않음'
          }
        )
      }

      // counselor_ids 를 primary 먼저 오도록 재정렬 (백엔드는 counselor_ids[0]
      // 을 case.counselor_id / schedule.member_id 의 대표로 사용).
      const orderedCounselorIds =
        primaryCounselorId && selectedCounselorIds.includes(primaryCounselorId)
          ? [
              primaryCounselorId,
              ...selectedCounselorIds.filter((id) => id !== primaryCounselorId)
            ]
          : selectedCounselorIds

      // 단일 엔드포인트 호출 (서버가 diff 계산 후 단일 트랜잭션으로 반영)
      const action = postApplyCaseEdits()
      const result = await action.request({
        centerId: cId,
        caseId: counselingData.case_id,
        payload: {
          client_ids: selectedClients.map((c) => c.uid),
          counselor_ids: orderedCounselorIds,
          room_id: selectedRoom || null,
          start_time: startTime,
          end_time: endTime,
          session_dates: selectedDates.map(dateToStr),
          sync_clients_to_scheduled_sessions: syncClientsToScheduledSessions
        }
      })

      if (result.warnings && result.warnings.length > 0) {
        // 경고는 있지만 수정은 성공 — 스낵바로 안내
        snackbarStore.success(
          `상담 정보가 수정되었습니다 (경고 ${result.warnings.length}건)`
        )
      } else {
        snackbarStore.success('상담 정보가 수정되었습니다')
      }
      onSuccess?.()
      closeModal()
    } catch {
      snackbarStore.error('상담 정보 수정에 실패했습니다')
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
        상담 정보를 수정할게요
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-gray-500">
        변경 내용은 이후 모든 예정 회기에 적용돼요
      </Typography>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="p-5 pb-7 space-y-6">
      <!-- 프로그램 -->
      <div>
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-2"
        >
          프로그램
        </Typography>
        <Typography variant="body-02-normal-medium" color="text-gray-900">
          {counselingData.program_name || '-'}{counselingData.case_type
            ? `-${counselingData.case_type === 'individual' ? '개별' : counselingData.case_type === 'group' ? '그룹' : counselingData.case_type}`
            : ''}
        </Typography>
      </div>

      <!-- 내담자 -->
      <ClientMultiSelect
        options={clientsData}
        bind:selected={selectedClients}
        label="내담자"
        labelVariant="body-02-normal-medium"
        placeholder="내담자 이름을 검색해주세요"
      />
      {#if clientChangeSummary}
        <!-- 변경 요약 = well 블록 (§Components — bg-base + radius 8 + 패딩 16).
             문장 사이 간격 8. -mt-4 = 자기 입력칸에 붙여 두는 보조 블록이라
             그룹 간격(24)이 아니라 8로 당긴다 -->
        <div class="-mt-4 space-y-2 rounded-lg bg-bg-base p-4">
          <!-- 이름은 이 문장의 주어 — text-body-strong · Medium으로 서술부와 갈라 읽는다 -->
          {#if clientChangeSummary.removed.length > 0}
            <p class="text-body-03-normal-regular">
              <span class="text-body-03-normal-medium text-body-strong"
                >{clientChangeSummary.removed.join(', ')}</span
              ><span class="text-primary-500">를 제외할게요</span>
            </p>
          {/if}
          {#if clientChangeSummary.added.length > 0}
            <p class="text-body-03-normal-regular">
              <span class="text-body-03-normal-medium text-body-strong"
                >{clientChangeSummary.added.join(', ')}</span
              ><span class="text-primary-500">를 추가할게요</span>
            </p>
          {/if}
        </div>
      {/if}

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
        {#if counselorChangeSummary}
          <p class="mt-3 text-body-03-normal-regular">
            <span class="text-gray-600">{counselorChangeSummary.from}</span>
            <span class="text-primary-500">
              &rarr; {counselorChangeSummary.to} 으로 변경할게요</span
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
              &rarr; {roomChangeSummary.to} 로 변경할게요</span
            >
          </p>
        {/if}
      </div>

      <!-- 일정 -->
      <MultiDateSchedulePicker
        bind:selectedDates
        bind:startTime
        bind:endTime
        bind:conflictRoomName
        bind:conflictReason
        {operatingTimes}
        centerId={$centerId}
        roomId={selectedRoom || null}
        memberId={primaryCounselorId ?? selectedCounselorIds[0] ?? null}
        enablePatternDetection={true}
        calendarSize="modal-large"
        onApplyDuration={programDuration ? applyProgramDuration : null}
        durationLabel={programDuration && programName
          ? `${programName} ${programDuration}분 적용`
          : null}
        durationMinutes={programDuration}
        highlightedDates={displayedHighlightedDates}
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
