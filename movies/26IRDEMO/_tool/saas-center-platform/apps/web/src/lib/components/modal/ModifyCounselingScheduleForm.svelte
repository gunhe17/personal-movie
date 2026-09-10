<script lang="ts">
  import { browser } from '$app/environment'
  import { slide } from 'svelte/transition'

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
    patchBulkUpdateSessions,
    getCounselingDetailById
  } from '../../hooks/actions/counseling.action'
  import {
    getMemberList,
    type MemberListItem
  } from '../../hooks/actions/member.action'
  import { getRoomList } from '../../hooks/actions/room.action'
  import type { RoomItemType } from '../../hooks/actions/room.action'
  import { buildRoomsQueryInput } from '../../features/schedule/counsel'
  import SelectableButtonGroup from '../assessment/receive/SelectableButtonGroup.svelte'
  import MultiDateSchedulePicker from '../schedule/MultiDateSchedulePicker.svelte'
  import { snackbarStore } from '../../stores/snackbar'
  import { modalUtils, modalStore } from '../../stores/modal'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import MemberChip from '$lib/components/common/MemberChip.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'

  interface Props {
    schedule?: MappedSchedule
    scheduleData?: ScheduleDetailResponse
    canSubmit?: boolean
    doSubmit?: () => void
    onSuccess?: () => void
  }

  let {
    schedule,
    scheduleData,
    canSubmit = $bindable(false),
    doSubmit = $bindable<() => void>(() => {}),
    onSuccess
  }: Props = $props()

  // "새 내담자 추가" 왕복용 sessionStorage 키 프리픽스 (+ scheduleId)
  const ADDED_CLIENTS_KEY = 'schedule-edit:case-clients:'

  /* ─────── 세션 내담자 (현재 이 세션에 붙어있는 참여자) ─────── */
  const sessionClients = $derived(scheduleData?.sessions?.[0]?.clients ?? [])

  /* ─────── 케이스 전체 내담자 (토글 버튼 소스) ─────── */
  // 세션 participants 가 비어있는 경우에도 케이스에 속한 모든 내담자를
  // 버튼으로 보여줘야 유저가 다시 추가할 수 있다. 상담 상세와 동일한 UX.
  const caseId = $derived(scheduleData?.sessions?.[0]?.case_id ?? null)
  const caseDetailQuery = $derived(
    caseId && $centerId
      ? queryBuilder(getCounselingDetailById, () => ({
          centerId: $centerId!,
          counselingId: caseId!
        }))
      : null
  )
  // 버튼 목록: { id, name } 형태로 통일
  const clientButtonList = $derived<{ id: string; name: string }[]>(
    caseDetailQuery?.data
      ? (caseDetailQuery.data.clients ?? []).map((c) => ({
          id: c.client_id,
          name: c.name
        }))
      : // 로딩 전 fallback — 세션 참여자를 쓰되 비어있으면 빈 배열
        sessionClients.map((c) => ({
          id: c.client_id,
          name: c.client_name
        }))
  )
  // 칩 옵션 — 시크릿 모드에서는 표시 이름만 마스킹(값은 id 그대로)
  const clientChipOptions = $derived(
    clientButtonList.map((c) => ({
      value: c.id,
      label: $isSecretMode ? maskName(c.name) : c.name
    }))
  )
  // 원래 세션에 속해있던 내담자 ID — diff 계산용 snapshot.
  // scheduleData 가 중간에 refetch 되어도 "원본" 기준이 흔들리지 않도록
  // 초기화 effect 에서 한 번만 고정한다.
  let originalSessionClientIds = $state<string[]>([])

  /* ─────── 담당자 ─────── */
  const membersQuery = $derived(
    $centerId
      ? queryBuilder(getMemberList, () => ({ centerId: $centerId!, size: 100 }))
      : null
  )
  const memberList = $derived(
    (membersQuery?.data?.items ?? []) as MemberListItem[]
  )
  // 칩 순서 — 모달 열 때의 원본 상태 기준으로 고정.
  // 대표 → 선택된 담당자 → 미선택 순. 사용자가 토글해도 칩이 튀지 않도록
  // 원본 값(originalPrimaryCounselorId, originalCounselorIds)을 기준으로 정렬.
  const sortedMemberList = $derived.by(() => {
    if (!initialized) return memberList
    const primary = originalPrimaryCounselorId
    const selectedSet = new Set(originalCounselorIds)
    return [...memberList].sort((a, b) => {
      const aPrimary = a.id === primary ? 0 : 1
      const bPrimary = b.id === primary ? 0 : 1
      if (aPrimary !== bPrimary) return aPrimary - bPrimary
      const aSelected = selectedSet.has(a.id) ? 0 : 1
      const bSelected = selectedSet.has(b.id) ? 0 : 1
      return aSelected - bSelected
    })
  })

  /* ─────── 장소 ─────── */
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

  /* ─────── 새 내담자 추가 — 상담 정보(케이스) 수정으로 착지 ─────── */
  // 이 모달은 케이스에 등록된 내담자만 고를 수 있다. 새 내담자는 상담 정보에서
  // 등록해야 하므로 열려 있는 모달을 모두 닫고 상담 상세의 정보 수정으로 보낸다.
  // returnTo·returnSchedule 을 함께 넘겨, 상담 정보 수정을 닫는 순간
  // 원래 화면의 이 일정 수정 모달로 되돌아온다(왕복).
  const goToCaseClientEdit = () => {
    const scheduleId = schedule?.id ?? scheduleData?.id
    if (!caseId || !scheduleId) return
    // 떠나기 직전의 케이스 내담자 명단을 남긴다 — 돌아왔을 때 이 명단에 없는
    // 내담자가 곧 "방금 추가한 사람"이다(§복귀 시 자동 선택).
    if (browser) {
      sessionStorage.setItem(
        `${ADDED_CLIENTS_KEY}${scheduleId}`,
        JSON.stringify(clientButtonList.map((c) => c.id))
      )
    }
    const params = new URLSearchParams({
      edit: 'case',
      returnTo: `${page.url.pathname}${page.url.search}`,
      returnSchedule: scheduleId
    })
    modalStore.closeAll()
    goto(`/counseling/status/${caseId}?${params.toString()}`)
  }

  /* ─────── 복귀 시 새 내담자 자동 선택 ─────── */
  // 내담자를 추가하러 다녀왔는데 칩이 꺼진 채로 돌아오면 "추가했는데 수정이 비활성"
  // 상태가 된다. 떠나기 전 명단과 비교해 새로 생긴 내담자를 이 회기에 바로 선택해
  // 변경사항(=수정 활성)으로 만든다.
  let hasAppliedReturnedClients = $state(false)
  let hasNewClientFromReturn = $state(false)
  $effect(() => {
    if (!browser || hasAppliedReturnedClients || !initialized) return
    const scheduleId = schedule?.id ?? scheduleData?.id
    if (!scheduleId) return
    // 케이스 내담자 목록이 **새로 받아진 뒤에만** 판정한다.
    // 케이스 저장 직후 invalidate 로 재조회가 도는 동안 TanStack 은 직전 데이터를
    // 그대로 내주므로, isFetching 중에 비교하면 방금 추가한 내담자를 놓친다.
    if (!caseDetailQuery?.data || caseDetailQuery.isFetching) return

    const key = `${ADDED_CLIENTS_KEY}${scheduleId}`
    const raw = sessionStorage.getItem(key)
    if (!raw) return
    hasAppliedReturnedClients = true
    sessionStorage.removeItem(key)

    let before: string[] = []
    try {
      before = JSON.parse(raw)
    } catch {
      return
    }
    const beforeSet = new Set(before)
    const added = clientButtonList
      .map((c) => c.id)
      .filter((id) => !beforeSet.has(id))
    if (added.length === 0) return
    // 회기에 아직 안 붙어 있으면 선택까지(=diff), 이미 붙어 있으면 선택은 그대로 두고
    // 왕복 플래그만 세운다 — 어느 쪽이든 수정 버튼은 열린다.
    selectedClientIds = [...new Set([...selectedClientIds, ...added])]
    hasNewClientFromReturn = true
  })

  /* ─────── mutation ─────── */
  // invalidate 대상:
  //   - getScheduleDetail / getScheduleList: 캘린더 뷰 새로고침
  //   - getCounselingDetailById: 상담 상세 페이지(회기별 담당자/내담자 표시) 새로고침.
  //     session_participants 가 바뀌면 상담 상세 회기 섹션도 stale 이 되므로 필수.
  const changeSchedule = mutationBuilder(
    patchChangeSchedule,
    [],
    [['getScheduleDetail'], ['getScheduleList'], ['getCounselingDetailById']]
  )
  // 내담자/담당자(session_participants) 변경용 — changeSchedule 이 schedule 필드만 다루므로
  // participants 변경은 bulk-update 로 별도 반영.
  const bulkUpdateSessions = mutationBuilder(
    patchBulkUpdateSessions,
    [],
    [['getScheduleDetail'], ['getScheduleList'], ['getCounselingDetailById']]
  )

  /* ─────── state ─────── */
  let selectedClientIds = $state<string[]>([])
  // 다중 담당자 (그룹 상담 등).
  // primaryCounselorId 는 selectedCounselorIds 안에 반드시 포함되어야 함.
  // schedule.member_id 가 대표의 source of truth — 저장 시 primaryCounselorId 를 전달.
  let selectedCounselorIds = $state<string[]>([])
  let primaryCounselorId = $state<string | null>(null)
  let selectedRoom = $state<RoomItemType | null>(null)
  let selectedDates = $state<Date[]>([])
  let startTime = $state('')
  let endTime = $state('')
  let memo = $state('')
  let conflictRoomName = $state<string | null>(null)
  let conflictReason = $state<'room' | 'member' | 'both' | null>(null)
  // 원본 snapshot (diff 계산용)
  let originalCounselorIds = $state<string[]>([])
  let originalPrimaryCounselorId = $state<string | null>(null)

  /* ─────── 초기값 세팅 ─────── */
  let initialized = $state(false)

  $effect(() => {
    if (initialized || !scheduleData || !roomList.length) return
    initialized = true

    // 내담자 — 현재 세션에 붙어있는 참여자를 초기 선택 + diff 기준 snapshot
    const initialClientIds = sessionClients.map((c) => c.client_id)
    selectedClientIds = initialClientIds
    originalSessionClientIds = [...initialClientIds]

    // 담당자 — session 의 counselors 리스트가 있으면 그걸 초기값으로 (다중 지원),
    // 없으면 하위 호환으로 schedule.member_id 하나만.
    // 대표: schedule.member_id. 백엔드가 counselors 리스트 [0] 에 이미 정렬해 둠.
    const sessionCounselors = scheduleData.sessions?.[0]?.counselors ?? []
    const initialCounselorIds =
      sessionCounselors.length > 0
        ? sessionCounselors.map((c) => c.counselor_id)
        : scheduleData.member_id
          ? [scheduleData.member_id]
          : []
    selectedCounselorIds = [...initialCounselorIds]
    originalCounselorIds = [...initialCounselorIds]
    // 대표: schedule.member_id 우선, 없으면 첫 번째.
    // schedule.member_id 가 selectedCounselorIds 에 없다면 (데이터 정합성 이슈)
    // 안전하게 첫 번째로 fallback.
    const initialPrimary =
      scheduleData.member_id &&
      initialCounselorIds.includes(scheduleData.member_id)
        ? scheduleData.member_id
        : (initialCounselorIds[0] ?? null)
    primaryCounselorId = initialPrimary
    originalPrimaryCounselorId = initialPrimary

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

    // 메모
    memo = scheduleData.memo ?? ''
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

  /* ─────── 내담자 변경 요약 (원본 세션 기준으로 diff) ─────── */
  const removedClientIds = $derived(
    originalSessionClientIds.filter((id) => !selectedClientIds.includes(id))
  )
  const addedClientIds = $derived(
    selectedClientIds.filter((id) => !originalSessionClientIds.includes(id))
  )
  const clientNameById = $derived(
    new Map(clientButtonList.map((c) => [c.id, c.name]))
  )

  /* ─────── 담당자 토글/대표 지정 핸들러 ─────── */
  function toggleCounselor(memberId: string) {
    if (selectedCounselorIds.includes(memberId)) {
      // 마지막 1명은 해제 금지
      if (selectedCounselorIds.length === 1) return
      // 선택 해제
      const next = selectedCounselorIds.filter((id) => id !== memberId)
      selectedCounselorIds = next
      // 해제 대상이 대표였으면 다른 담당자 중 첫 번째로 자동 승계
      if (primaryCounselorId === memberId) {
        primaryCounselorId = next[0] ?? null
      }
    } else {
      // 선택 추가
      selectedCounselorIds = [...selectedCounselorIds, memberId]
      // 대표가 없었으면 자동으로 대표로 지정 (최초 선택 케이스)
      if (primaryCounselorId === null) {
        primaryCounselorId = memberId
      }
    }
  }

  function setPrimaryCounselor(memberId: string) {
    // 선택된 상태에서만 대표 지정 가능
    if (selectedCounselorIds.includes(memberId)) {
      primaryCounselorId = memberId
    }
  }

  /* ─────── 담당자 변경 요약 (다중 담당자) ─────── */
  const memberNameById = $derived(
    new Map(memberList.map((m) => [m.id, m.person?.name ?? m.id]))
  )
  // 표시용 — 대표를 맨 앞에 두고 나머지
  function formatCounselorNames(ids: string[], primary: string | null): string {
    if (ids.length === 0) return '-'
    const sorted =
      primary && ids.includes(primary)
        ? [primary, ...ids.filter((id) => id !== primary)]
        : ids
    return sorted
      .map((id, idx) => {
        const name = memberNameById.get(id) ?? id
        return idx === 0 && primary ? `${name}(주담당)` : name
      })
      .join(', ')
  }
  const originalCounselorSummary = $derived(
    formatCounselorNames(originalCounselorIds, originalPrimaryCounselorId)
  )
  const selectedCounselorSummary = $derived(
    formatCounselorNames(selectedCounselorIds, primaryCounselorId)
  )
  const counselorChanged = $derived.by(() => {
    if (primaryCounselorId !== originalPrimaryCounselorId) return true
    const current = [...selectedCounselorIds].sort()
    const original = [...originalCounselorIds].sort()
    if (current.length !== original.length) return true
    return current.some((id, i) => id !== original[i])
  })

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

  /* ─────── 메모 변경 요약 ─────── */
  const memoChanged = $derived((scheduleData?.memo ?? '') !== memo)

  /* ─────── 변경 감지 ─────── */
  // hasNewClientFromReturn — "새 내담자 추가"를 다녀와 실제로 내담자가 늘어난 경우.
  // 상담 정보 저장에서 "기존 예정 회기에도 적용"을 고르면 서버가 이미 이 회기의
  // 참여자까지 갱신해 diff 가 0이 된다. 그래도 사용자 입장에선 "추가하고 돌아온"
  // 상태라 수정이 잠겨 있으면 막힌 것처럼 보이므로, 이 왕복 자체를 변경으로 친다.
  const isChanged = $derived(
    dateChanged ||
      roomChanged ||
      counselorChanged ||
      memoChanged ||
      removedClientIds.length > 0 ||
      addedClientIds.length > 0 ||
      hasNewClientFromReturn
  )

  const computedCanSubmit = $derived(
    !!selectedDate &&
      !!startTime &&
      !!endTime &&
      selectedCounselorIds.length > 0 &&
      !!primaryCounselorId &&
      isChanged
  )

  // Sync bindable
  $effect(() => {
    canSubmit = computedCanSubmit
  })

  /* ─────── submit ─────── */
  async function handleSubmit() {
    if (!computedCanSubmit || !scheduleData || !selectedDate) return

    // 충돌 시 컨펌 모달 (reason별 문구 분기)
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

    // 변경 플래그는 mutation 전에 로컬 snapshot 으로 캡처.
    // changeSchedule 성공 → getScheduleDetail invalidate → scheduleData refetch →
    // 반응형 counselorChanged/dateChanged 등이 false 로 뒤집힐 수 있기 때문.
    const didDateChange = dateChanged
    const didRoomChange = roomChanged
    const didCounselorChange = counselorChanged
    const didMemoChange = memoChanged
    const didClientsChange =
      removedClientIds.length > 0 || addedClientIds.length > 0
    const scheduleFieldsChanged =
      didDateChange || didRoomChange || didCounselorChange || didMemoChange
    const sessionId = scheduleData.sessions?.[0]?.session_id
    // primaryCounselorId 는 유저가 명시적으로 지정한 대표 (UI 에서 ★ 배지).
    // 이 값을 schedule.member_id 로 저장. session_participants 에는 전체 배열 전달.
    const targetCounselorIds = [...selectedCounselorIds]
    const targetPrimaryCounselorId = primaryCounselorId
    const targetClientIds = [...selectedClientIds]

    try {
      // 1) Schedule 필드 변경 (시간/장소/대표 담당자)
      //    담당자는 schedule.member_id (대표 1명) 만 업데이트 (회기 수준).
      //    case.counselor_id 는 건드리지 않음 — 그건 상담 정보 수정의 영역.
      //    전체 담당자 목록은 아래 bulk-update 에서 session_participants 에 반영.
      if (scheduleFieldsChanged) {
        const newStart = new Date(selectedDate)
        const [sh, sm] = startTime.split(':')
        newStart.setHours(+sh, +sm, 0, 0)

        const newEnd = new Date(selectedDate)
        const [eh, em] = endTime.split(':')
        newEnd.setHours(+eh, +em, 0, 0)

        await changeSchedule.mutateAsync({
          schedule_id: schedule?.id,
          center_id: $centerId,
          member_id: targetPrimaryCounselorId,
          start: newStart,
          end: newEnd,
          room_id: selectedRoom?.id ?? null,
          memo
        })
      }

      // 2) 내담자/담당자 변경 → 해당 세션의 session_participants 전체 교체.
      //    bulk-update 는 session_ids 에 이 세션 하나만 담아서 호출하므로
      //    다른 회기에 영향 없음. counselor_ids 는 배열 전체를 전달해 다중 지원.
      //    상담 상세 페이지는 session_participants 에서 담당자를 읽으므로
      //    담당자가 바뀌면 반드시 이 경로로 session_participants 도 갱신해야 함.
      if ((didClientsChange || didCounselorChange) && sessionId) {
        const bulkPayload: Record<string, any> = {
          session_ids: [sessionId]
        }
        if (didClientsChange) {
          bulkPayload.client_ids = targetClientIds
        }
        if (didCounselorChange) {
          bulkPayload.counselor_ids = targetCounselorIds
        }
        await bulkUpdateSessions.mutateAsync({
          centerId: $centerId!,
          payload: bulkPayload as any
        })
      }

      snackbarStore.success('상담 일정을 수정했어요')
      onSuccess?.()
    } catch {
      snackbarStore.error('상담 일정 수정에 실패했어요')
    }
  }

  // Expose submit handler
  doSubmit = handleSubmit
</script>

<div class="space-y-6">
  {#if scheduleData}
    <!-- 내담자 -->
    <div>
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="mb-2"
      >
        내담자
      </Typography>
      {#if clientButtonList.length > 0}
        <SelectableButtonGroup
          label="내담자"
          options={clientChipOptions}
          selected={selectedClientIds}
          multiple={true}
          onSelect={handleToggleClient}
          showLabel={false}
        />
      {:else}
        <Typography variant="body-02-normal-regular" color="text-gray-400">
          이 상담에 등록된 내담자가 없어요
        </Typography>
      {/if}

      <!-- 변경 요약 -->
      {#if removedClientIds.length > 0 || addedClientIds.length > 0}
        <div class="mt-3 space-y-1">
          {#if removedClientIds.length > 0}
            <p class="text-body-03-normal-regular">
              <span class="text-gray-600"
                >{removedClientIds
                  .map((id) => {
                    const name = clientNameById.get(id) ?? id
                    return $isSecretMode ? maskName(name) : name
                  })
                  .join(', ')}</span
              ><span class="text-primary-500">를 제외할게요</span>
            </p>
          {/if}
          {#if addedClientIds.length > 0}
            <p class="text-body-03-normal-regular">
              <span class="text-gray-600"
                >{addedClientIds
                  .map((id) => {
                    const name = clientNameById.get(id) ?? id
                    return $isSecretMode ? maskName(name) : name
                  })
                  .join(', ')}</span
              ><span class="text-primary-500">를 추가할게요</span>
            </p>
          {/if}
        </div>
      {/if}

      <!-- 아코디언: 내담자 목록에 없나요? -->
      <button
        type="button"
        onclick={() => (showClientHelp = !showClientHelp)}
        class="mt-3 flex items-center gap-1 text-body-03-normal-regular text-primary-500 hover:text-primary-600 transition-colors"
      >
        내담자가 목록에 없나요?
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          class="transition-transform duration-200 {showClientHelp
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

      {#if showClientHelp}
        <div
          transition:slide={{ duration: 200 }}
          class="mt-2 flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4"
        >
          <div>
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
          <!-- gray-50 면 위 액션 = 흰 버튼(white-action). 회색 텍스트 고정 -->
          {#if caseId}
            <button
              type="button"
              onclick={goToCaseClientEdit}
              class="text-body-02-normal-medium flex h-11 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-gray-600 ring-1 ring-gray-200 ring-inset transition-colors hover:text-gray-800 hover:ring-gray-300"
            >
              <PlusIcon20 />
              새 내담자 추가
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- 담당자 (다중 선택 — 그룹 상담 지원, 대표 지정 가능) -->
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
        {#each sortedMemberList as member (member.id)}
          {@const isSelected = selectedCounselorIds.includes(member.id)}
          {@const isPrimary = primaryCounselorId === member.id}
          <MemberChip
            name={member.person.name}
            selected={isSelected && !isPrimary}
            primary={isPrimary}
            onclick={() => toggleCounselor(member.id)}
            oncrownclick={() => setPrimaryCounselor(member.id)}
            primaryLabel="대표(주 치료사)"
            selectedLabel="보조 치료사"
          />
        {/each}
      </div>
      {#if counselorChanged}
        <p class="mt-3 text-body-03-normal-regular">
          <span class="text-gray-600">{originalCounselorSummary}</span>
          <span class="text-primary-500">
            → {selectedCounselorSummary} 으로 변경할게요</span
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
        selected={selectedRoom?.id ?? ''}
        onSelect={handleRoomSelect}
        showLabel={false}
      />
      {#if roomChanged && selectedRoom}
        <p class="mt-3 text-body-03-normal-regular">
          <span class="text-gray-600">{originalRoomName || '-'}</span>
          <span class="text-primary-500">
            → {selectedRoom.name} 로 변경할게요</span
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
        centerId={$centerId}
        roomId={selectedRoom?.id}
        memberId={primaryCounselorId ?? selectedCounselorIds[0] ?? null}
        excludeScheduleId={schedule?.id}
        showTitle={true}
        title="일정"
        singleDate={true}
        calendarSize="modal-large"
      />
      {#if dateChanged}
        <p class="mt-3 text-body-03-normal-regular">
          <span class="text-gray-600">{originalDateText}</span>
          <span class="text-primary-500">
            → {currentDateText} 으로 변경할게요</span
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
  {/if}
</div>
