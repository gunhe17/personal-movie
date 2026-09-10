<script lang="ts">
  // 상담 접수 폼 (Progress-Stepper)
  // 공통 ReceiveStepperLayout(헤더/스텝퍼/메모/버튼/인터랙션) 위에 상담 도메인 폼만 주입.
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { readReturnTo, withLandingDate } from '$lib/utils/return-to'
  import { browser } from '$app/environment'
  import { t, josa } from '$lib/ontology/terms'
  import { tick } from 'svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder, mutationBuilder } from '$lib/hooks/queries/builder'
  import { buildConflictConfirmDescription } from '$lib/features/schedule/conflict-messages'

  import {
    getMemberList,
    getMeMember,
    type MemberListItem,
    type MeMemberResponse
  } from '$lib/hooks/actions/member.action'
  import {
    getRoomList,
    type RoomItemType
  } from '$lib/hooks/actions/room.action'

  import {
    useCounselForm,
    CounselTypeSection,
    StaffSection,
    RoomSection
  } from '$lib/features/schedule/counsel'

  import Typography from '@common/components/Typography.svelte'
  import { ClientMultiSelect } from '$lib/components/assessment/receive'
  import MultiDateSchedulePicker from '$lib/components/schedule/MultiDateSchedulePicker.svelte'
  import ReceiveStepperLayout, {
    type StepItem
  } from '$lib/components/common/ReceiveStepperLayout.svelte'

  import { centerId } from '$lib/stores/center.store'
  import { getOperatingTimes } from '$lib/hooks/actions/center.action'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalUtils } from '$lib/stores/modal'
  import { parseDateParam, nextHalfHourSlot } from '$root/src/lib/utils/date'
  import {
    buildIndividualCounselRequest,
    buildRoomsQueryInput
  } from '$root/src/lib/features/schedule/counsel/query-builders'
  import { postCreateCounseling } from '$root/src/lib/hooks/actions/counseling.action'
  import { getProgramList } from '$root/src/lib/hooks/actions/program.action'
  import {
    getClientList,
    type ClientListItem
  } from '$root/src/lib/hooks/actions/client.action'
  import {
    buildClientListInput,
    DEFAULT_FILTERS
  } from '$root/src/lib/features/clients'
  import type { ExtendedClient } from '$root/src/lib/stores/receiveForm'
  import {
    createReceiveService,
    meMemberToMemberItem
  } from '$root/src/lib/features/assessment/receive'
  import { isCounselor } from '$root/src/lib/stores/permission.view'
  import { registerCounselReceiveTools } from '$lib/features/agent/page-tools/counsel-receive'
  import WarningCircleIcon16 from '$lib/assets/WarningCircleIcon16.svelte'
  import { pageToolRegistry } from '$lib/features/agent/page-tools'

  // ============ 초기화 ============
  const form = useCounselForm()
  const queryClient = useQueryClient()
  const createCounsel = mutationBuilder(postCreateCounseling)

  // ============ Queries ============
  const programQuery = $derived(
    queryBuilder(getProgramList, () => ({ centerId: $centerId! }))
  )
  const programList = $derived(programQuery.data?.items ?? [])

  const roomsQuery = $derived(
    queryBuilder(getRoomList, () => buildRoomsQueryInput($centerId!), {
      enabled: browser && !!$centerId
    })
  )
  const roomList = $derived((roomsQuery.data as RoomItemType[]) ?? [])

  const memberQuery = $derived(
    queryBuilder(getMemberList, () => ({ centerId: $centerId! }))
  )
  const meMemberQuery = $derived(
    queryBuilder(getMeMember, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId && $isCounselor
    })
  )
  const memberList = $derived(
    $isCounselor
      ? meMemberQuery.data
        ? [meMemberToMemberItem(meMemberQuery.data as MeMemberResponse)]
        : []
      : memberQuery.data
        ? (memberQuery.data?.items as MemberListItem[])
        : []
  )

  const clientsQuery = $derived(
    queryBuilder(
      getClientList,
      () => buildClientListInput($centerId!, DEFAULT_FILTERS),
      { enabled: browser && !!$centerId && form.clientType === 'individual' }
    )
  )

  let locallyAddedClients = $state<ClientListItem[]>([])
  const clientsData = $derived.by(() => {
    const queryItems = clientsQuery.data?.items ?? []
    if (locallyAddedClients.length === 0) return queryItems
    const existingIds = new Set(queryItems.map((c) => c.id))
    const newOnly = locallyAddedClients.filter((c) => !existingIds.has(c.id))
    return [...newOnly, ...queryItems]
  })

  const operatingTimesQuery = $derived(
    queryBuilder(getOperatingTimes, () => ({ centerId: $centerId! }), {
      staleTime: 5 * 60 * 1000
    })
  )
  const operatingTimes = $derived(operatingTimesQuery.data ?? [])

  const receiveService = createReceiveService({ queryClient })

  // ============ 시간 동기화 (picker ↔ form) ============
  const FALLBACK_START = '10:00'
  const DEFAULT_DURATION_MINUTES = 60

  function getOperatingStartTime(times: typeof operatingTimes): string {
    if (!times.length) return FALLBACK_START
    const todayWeekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][
      new Date().getDay()
    ]
    const todayOp = times.find((t) => t.weekday === todayWeekday && t.open_time)
    const firstOp = times.find((t) => t.open_time)
    const op = todayOp ?? firstOp
    if (!op?.open_time) return FALLBACK_START
    return op.open_time.slice(0, 5)
  }
  function addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m + minutes, 0, 0)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  let pickerStartTime = $state(FALLBACK_START)
  let pickerEndTime = $state('')
  let defaultTimeApplied = $state(false)

  // URL 파라미터 (초기값 캡처)
  const urlDateParam = page.url.searchParams.get('date')
  const urlTimeParam = page.url.searchParams.get('time')
  const urlRoomIdParam = page.url.searchParams.get('room_id')
  const urlMemberIdsParam = page.url.searchParams.get('member_ids')

  onMount(() => {
    if (urlDateParam) {
      const date = parseDateParam(urlDateParam)
      if (!isNaN(date.getTime())) form.selectedDates = [date]
    }
    if (urlTimeParam) {
      form.startTime = urlTimeParam
      pickerStartTime = urlTimeParam
      form.endTime = addMinutesToTime(urlTimeParam, DEFAULT_DURATION_MINUTES)
      pickerEndTime = form.endTime
    }

    // Agent page tool 등록 (Agent가 아닌 일반 접근에서는 호출되지 않음)
    registerCounselReceiveTools(
      form,
      () => programList,
      () => roomList,
      handleConfirm
    )
  })

  onDestroy(() => {
    if (browser) pageToolRegistry.unregisterAll()
  })

  $effect(() => {
    if (defaultTimeApplied || urlTimeParam) return
    if (operatingTimes.length === 0) return
    defaultTimeApplied = true
    // 운영 시작시간이 이미 지났으면(오늘 접수) 현재 이후 가장 가까운 정시/30분
    const opStart = getOperatingStartTime(operatingTimes)
    const nextSlot = nextHalfHourSlot()
    pickerStartTime = nextSlot > opStart ? nextSlot : opStart
  })

  let prevProgramId = $state<string | null>(null)
  $effect(() => {
    const program = form.selectedProgram
    const currentId = program?.id ?? null
    if (currentId === prevProgramId) return
    prevProgramId = currentId
    if (!program?.duration_minutes) return
    pickerEndTime = addMinutesToTime(pickerStartTime, program.duration_minutes)
  })
  function applyProgramDuration() {
    if (form.selectedProgram?.duration_minutes) {
      pickerEndTime = addMinutesToTime(
        pickerStartTime,
        form.selectedProgram.duration_minutes
      )
    }
  }

  $effect(() => {
    form.startTime = pickerStartTime
  })
  $effect(() => {
    form.endTime = pickerEndTime
  })
  $effect(() => {
    if (form.startTime && form.startTime !== pickerStartTime)
      pickerStartTime = form.startTime
  })
  $effect(() => {
    if (form.endTime && form.endTime !== pickerEndTime)
      pickerEndTime = form.endTime
  })

  // URL member_ids / room_id 자동 선택
  let memberInitialized = false
  $effect(() => {
    if (memberInitialized || !urlMemberIdsParam || !memberList.length) return
    const ids = urlMemberIdsParam.split(',')
    const matched = memberList.filter((m) => ids.includes(m.id))
    if (matched.length) {
      matched.forEach((m) => form.toggleMember(m))
      memberInitialized = true
    }
  })
  let roomInitialized = false
  $effect(() => {
    if (roomInitialized || !urlRoomIdParam || !roomList.length) return
    const matched = roomList.find((r) => r.id === urlRoomIdParam)
    if (matched) {
      form.selectRoom(matched)
      roomInitialized = true
    }
  })

  let conflictRoomName = $state<string | null>(null)
  let conflictReason = $state<'room' | 'member' | 'both' | null>(null)

  // ============ 제출 ============
  const handleConfirm = async () => {
    if (!form.validate()) return
    // 그룹 프로그램 1명 — 경고를 무시하고 진행하는지 한 번 되묻는다(하드 블록 아님)
    if (groupClientWarning) {
      const confirmed = await modalUtils.confirm(
        '',
        '그룹 프로그램인데 내담자가 1명이에요',
        {
          type: 'warning',
          description:
            '이대로 접수하면 참여자 1명으로 기록돼요. 이어서 등록할까요?',
          confirmText: '등록'
        }
      )
      if (!confirmed) return
    }
    if (conflictReason) {
      const confirmed = await modalUtils.confirm(
        '',
        '같은 시간에 이미 일정이 있어요',
        {
          type: 'warning',
          description: buildConflictConfirmDescription(
            conflictRoomName,
            conflictReason,
            '등록'
          ),
          confirmText: '등록'
        }
      )
      if (!confirmed) return
    }
    const request = buildIndividualCounselRequest({
      centerId: $centerId!,
      selectedClients: form.selectedClients,
      selectedDates: form.selectedDates,
      startTime: form.startTime,
      endTime: form.endTime,
      selectedMember: form.selectedMember,
      primaryMemberId: form.primaryMemberId,
      selectedProgram: form.selectedProgram,
      selectedRoom: form.selectedRoom,
      clientMemo: form.clientMemo
    })
    createCounsel.mutate(request, {
      onSuccess: async (data: any) => {
        snackbarStore.success('상담 일정이 등록되었어요')
        const warnings: string[] = data?.warnings ?? []
        if (warnings.length > 0) {
          const shown = warnings.slice(0, 5)
          const extra = warnings.length - shown.length
          snackbarStore.warning(
            shown.join('\n') + (extra > 0 ? `\n외 ${extra}건 더` : ''),
            null,
            5000
          )
        }
        // 일정에서 들어왔으면 그 화면으로 복귀(returnTo) — 등록한 날짜로 열어 방금 만든 일정이 바로 보이게 한다.
        // 그 밖의 진입(메뉴·에이전트)은 새 케이스가 바로 보이는 현황 목록으로.
        // replaceState — 제출 끝난 폼을 history에서 지워 뒤로가기가 접수 이전 화면(에이전트 등)으로 바로 가게 함
        const returnTo = readReturnTo(page.url)
        goto(
          returnTo
            ? withLandingDate(returnTo, form.selectedDates[0])
            : '/counseling/status',
          { replaceState: true }
        )
      },
      onError: (error) => console.error('상담 일정 접수 실패:', error)
    })
  }

  function handleOpenClientRegisterModal() {
    receiveService.openClientRegisterModal((client) => {
      const newExtendedClient: ExtendedClient = {
        uid: client.id,
        role: 'client',
        name: client.name,
        gender: client.gender === 'female' ? '여자' : '남자',
        birth_date: client.birthDate ? new Date(client.birthDate) : null,
        guardian_relationship: '',
        guardian_name: '',
        guardian_phone: '',
        memo: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      form.selectedClients = [...form.selectedClients, newExtendedClient]
      locallyAddedClients = [
        {
          id: client.id,
          name: client.name,
          role: 'client',
          gender: client.gender,
          birth_date: client.birthDate
        },
        ...locallyAddedClients
      ]
      queryClient.invalidateQueries({
        queryKey: ['getClientList'],
        exact: false
      })
    })
  }

  // ============ 우측 스텝퍼 (form 상태에서 파생) ============
  function fmtSchedule(): string {
    if (!form.selectedDates.length || !form.startTime)
      return '일정을 선택해주세요'
    const d = form.selectedDates[0]
    const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일`
    const cnt = form.selectedDates.length
    return cnt > 1
      ? `${dateLabel} 외 ${cnt - 1}일 · ${form.startTime}`
      : `${dateLabel} · ${form.startTime}`
  }
  /**
   * 우측 접수 진행의 이름 미리보기는 **앞 3명까지 적고 나머지를 세운다** —
   * 한 명만 적고 "외 N명"으로 접으면 누가 들어갔는지 확인하려고 좌측 폼으로
   * 되돌아가야 한다(그룹 프로그램일수록 그 확인이 잦다).
   */
  const PREVIEW_NAME_MAX = 3

  function joinNamesWithRest(names: string[]): string {
    const head = names.slice(0, PREVIEW_NAME_MAX).join(', ')
    const rest = names.length - PREVIEW_NAME_MAX
    return rest > 0 ? `${head} 외 ${rest}명` : head
  }

  function fmtMembers(): string {
    if (!form.selectedMember.length) return '담당자를 선택해주세요'
    // 대표는 항상 맨 앞 — 3명까지 적을 때도 대표가 잘리지 않는다.
    // 제외는 id로 한다(동명이인이 있으면 이름 비교로는 한 명이 사라진다)
    const primary =
      form.selectedMember.find((m) => m.id === form.primaryMemberId) ??
      form.selectedMember[0]
    const names = [
      `${primary.person?.name ?? ''}(대표)`,
      ...form.selectedMember
        .filter((m) => m.id !== primary.id)
        .map((m) => m.person?.name ?? '')
    ]
    return joinNamesWithRest(names)
  }
  function fmtClients(): string {
    if (!form.selectedClients.length)
      return `${josa(t('subject'), '을/를')} 선택해주세요`
    return joinNamesWithRest(form.selectedClients.map((c) => c.name))
  }

  /**
   * 그룹 프로그램인데 내담자가 1명 — **막지 않고 경고한다.**
   * 첫 회기에 한 명만 확정된 채 자리를 먼저 잡는 운영이 실재해서, 하드 블록은
   * "개별로 잘못 접수"라는 우회를 만든다. 대신 칩 아래 인라인 경고 + 우측 진행
   * 스텝의 노란 ! + 제출 시 확인 한 번으로 실수만 걸러낸다(일정 충돌과 같은 문법).
   */
  const groupClientWarning = $derived(
    form.selectedProgramType === 'GROUP' && form.selectedClients.length === 1
      ? '그룹은 2명 이상 필요해요'
      : null
  )

  const scheduleWarning = $derived.by(() => {
    if (!conflictReason) return null
    if (conflictReason === 'room') return '같은 시간 장소 일정이 있어요'
    if (conflictReason === 'member') return '같은 시간 담당자 일정이 있어요'
    return '같은 시간 장소·담당자 일정이 있어요'
  })

  const steps = $derived<StepItem[]>([
    {
      key: 'program',
      field: 'program',
      label: '프로그램',
      done: !!form.selectedProgram,
      warning: null,
      preview: form.selectedProgram
        ? `${form.selectedProgram.name} · ${form.selectedProgramType === 'GROUP' ? '그룹' : '개별'}`
        : '프로그램을 선택해주세요'
    },
    {
      key: 'client',
      field: 'client',
      label: '내담자',
      done: form.selectedClients.length > 0,
      warning: groupClientWarning,
      preview: fmtClients(),
      deferAutoAdvance: true
    },
    {
      key: 'counselor',
      field: 'counselor',
      label: '담당자',
      done: form.selectedMember.length > 0,
      warning: null,
      preview: fmtMembers()
    },
    {
      key: 'room',
      field: 'room',
      label: '장소',
      done: !!form.selectedRoom,
      warning: null,
      preview: form.selectedRoom?.name ?? '장소를 선택해주세요'
    },
    {
      key: 'schedule',
      field: 'schedule',
      label: '일정',
      done: form.selectedDates.length > 0 && !!form.startTime && !!form.endTime,
      warning: scheduleWarning,
      preview: fmtSchedule()
    }
  ])

  let activeField = $state<string | null>('program')
  let flashField = $state<string | null>(null)
  let goToNextUndone = $state<() => void>(() => {})

  // 드롭다운이 닫혀도 다음 단계로 자동 스크롤하지 않는다 —
  // 화면이 제멋대로 튀어 사용자가 위치를 잃는다. 이동은 우측 접수 진행에서 직접 누를 때만.
  function handleClientDropdownClose() {}
</script>

<ReceiveStepperLayout
  title="상담 접수"
  {steps}
  bind:activeField
  bind:flashField
  bind:memo={form.clientMemo}
  memoPlaceholder="접수 과정의 특이사항을 자유롭게 적어주세요."
  submitLabel="등록"
  canSubmit={form.canSubmit}
  onSubmit={handleConfirm}
  onCancel={() => history.back()}
  bind:goToNextUndone
  form={formContent}
/>

{#snippet formContent()}
  <!-- 행 간격은 gap이 소유한다 — 각 행에 상하 패딩을 주면 여백이 두 군데(행·컨테이너)에서
       생겨 바깥 패딩만으로 조절이 안 된다. 여백은 카드 컨테이너 패딩 + 이 gap 둘뿐. -->
  <div class="flex flex-col gap-8">
    {@render formRow('program', '프로그램')}
    {@render formRow('client', '내담자')}
    {@render formRow('counselor', '담당자')}
    {@render formRow('room', '장소')}
    {@render formRow('schedule', '일정')}
  </div>
{/snippet}

<!-- 좌측 폼 행: 라벨 + 섹션 컴포넌트. 포커스 시 하이라이트(flash). -->
{#snippet formRow(field: string, label: string)}
  <!-- 라벨 위 / 입력 아래 세로 배치(전 해상도 동일). 구분선 없이 여백으로 섹션을 나눈다.
       라벨↔데이터 간격 8 — 입력 필드 규격(§Components>text-field)과 같은 값.
       행 자체 패딩 없음 — 바깥 컨테이너와 gap이 여백을 소유. -->
  <div
    class="flex flex-col gap-2 {flashField === field ? 'field-flash' : ''}"
    data-field={field}
    onfocusin={() => (activeField = field)}
    onclickcapture={() => (activeField = field)}
  >
    <div class="flex shrink-0 items-center">
      <Typography variant="body-01-medium" color="text-gray-700"
        >{label} <span class="field-required">*</span></Typography
      >
    </div>
    <!-- 폭 상한 772 = 일정(MultiDateSchedulePicker) 컨테이너 폭.
         모든 항목의 우측 끝을 이 컨테이너에 맞춘다 — 넘치면 장소·프로그램 그리드가
         화면 끝까지 늘어나 일정 영역만 홀로 좁아 보인다. -->
    <div class="min-w-0 max-w-[772px] flex-1">
      {#if field === 'program'}
        <CounselTypeSection
          {programList}
          selectedProgram={form.selectedProgram}
          onProgramSelect={form.handleProgramSelect}
          isLoading={programQuery.isLoading}
          showTitle={false}
        />
        {#if form.validationErrors.program}<p class="mt-1 field-help is-error">
            {form.validationErrors.program}
          </p>{/if}
      {:else if field === 'client'}
        <!-- 상한은 바깥 래퍼(772)가 소유 — 여기서 따로 좁히면 우측 끝이 어긋난다 -->
        <div class="bg-white">
          <ClientMultiSelect
            label=""
            options={clientsData}
            bind:selected={form.selectedClients}
            placeholder="내담자 이름을 검색해주세요"
            searchInputTextClass="text-body-01-normal-regular"
            showRegisterOption={true}
            onRegisterClick={handleOpenClientRegisterModal}
            onOpen={() =>
              queryClient.invalidateQueries({
                queryKey: ['getClientList'],
                exact: false
              })}
            onClose={handleClientDropdownClose}
            disableBottomMargin
          />
        </div>
        <!-- 그룹 프로그램 경고 — 선택된 칩 바로 아래.
             막는 게 아니라 알리는 자리라 에러(status-danger)가 아닌 경고(status-warning)다 -->
        {#if groupClientWarning}
          <div class="mt-2 flex items-center gap-2 text-status-warning">
            <WarningCircleIcon16 />
            <Typography variant="body-03-normal-regular" color="text-current">
              그룹 프로그램이에요. 내담자를 2명 이상 선택해주세요
            </Typography>
          </div>
        {/if}
        {#if form.validationErrors.client}<p class="mt-1 field-help is-error">
            {form.validationErrors.client}
          </p>{/if}
      {:else if field === 'counselor'}
        <!-- 안내 = Reading(150%) 행간. 모달·공용 섹션과 동일 문구·규격 -->
        <Typography
          variant="body-03-reading-regular"
          color="text-body-subtle"
          className="mb-4 block"
        >
          처음 선택한 담당자가 대표 치료사로 지정돼요. 왕관 아이콘을 눌러 대표
          치료사를 변경할 수 있어요.
        </Typography>
        <StaffSection
          {memberList}
          isCounselor={$isCounselor}
          selectedMember={form.selectedMember}
          onToggleMember={form.toggleMember}
          primaryMemberId={form.primaryMemberId}
          onSetPrimary={form.setPrimaryMember}
          showTitle={false}
        />
        {#if form.validationErrors.counselor}<p
            class="mt-1 field-help is-error"
          >
            {form.validationErrors.counselor}
          </p>{/if}
      {:else if field === 'room'}
        <RoomSection
          {roomList}
          isRequired={false}
          showTitle={false}
          selectedRoom={form.selectedRoom}
          isLoading={roomsQuery.isLoading}
          onSelectRoom={form.selectRoom}
        />
        {#if form.validationErrors.room}<p class="mt-1 field-help is-error">
            {form.validationErrors.room}
          </p>{/if}
      {:else if field === 'schedule'}
        <div class="bg-white">
          <MultiDateSchedulePicker
            bind:selectedDates={form.selectedDates}
            bind:startTime={pickerStartTime}
            bind:endTime={pickerEndTime}
            bind:conflictRoomName
            bind:conflictReason
            {operatingTimes}
            centerId={$centerId}
            roomId={form.selectedRoom?.id}
            memberId={form.primaryMemberId ??
              form.selectedMember?.[0]?.id ??
              null}
            showTitle={false}
            calendarSize="page"
            onApplyDuration={form.selectedProgram?.duration_minutes
              ? applyProgramDuration
              : null}
            durationLabel={form.selectedProgram?.duration_minutes
              ? `${form.selectedProgram.name} ${form.selectedProgram.duration_minutes}분 적용`
              : null}
            durationMinutes={form.selectedProgram?.duration_minutes ?? null}
          />
        </div>
        {#if form.validationErrors.schedule}<p class="mt-1 field-help is-error">
            {form.validationErrors.schedule}
          </p>{/if}
      {/if}
    </div>
  </div>
{/snippet}
